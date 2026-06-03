import { http, HttpResponse } from "msw";
import { store } from "../db";
import type { Ci, TenantId } from "@sdm/domain";
import { paginate, readPageParams } from "../utils/pagination";
import { parseTenantFromRequest } from "../utils/tenant";
import { correlationIdFrom } from "../utils/correlation";
import { forbidden, notFound } from "../utils/errors";
import { crossTenantRelationshipsFixture, sharedCiIdsFixture } from "../fixtures/ci";
import { DEFAULT_USER_ID } from "../fixtures/users";
import { getMswViewAsTenant, isSpAdmin, spAdminTenantIds } from "./sp";

const MSW_USER_HEADER = "x-msw-user-id";

function resolveUserIdValue(request: Request): string {
  const override = request.headers.get(MSW_USER_HEADER);
  if (override && store.users.some((u) => u.id === override)) return override;
  return DEFAULT_USER_ID;
}

/**
 * I.5 — overlay the shared-tenant ids onto a CI when the caller is allowed to
 * see them (`sp_admin` per the role-assignment check). The base fixture's
 * `sharedWithTenantIds` is optional so non-sp_admin clients see an unchanged
 * shape (single-tenant invariant per H.13/H.14).
 */
function withSharedMarker(ci: Ci, allowCrossTenant: boolean): Ci {
  if (!allowCrossTenant) return ci;
  const shared = sharedCiIdsFixture[ci.id];
  if (!shared) return ci;
  return { ...ci, sharedWithTenantIds: shared as readonly TenantId[] };
}

function tenantCis(tenant: string): Ci[] {
  return store.cis.filter((c) => c.tenantId === tenant);
}

/**
 * Deterministic CI history stream — derived from the CI's lifecycle anchors
 * (`createdAt`, `lastModifiedAt`) and its neighbour-relationship count. The
 * goal is to give the workspace H.13 History tab a realistic timeline without
 * a separate audit-log fixture. The BFF will eventually project CA SDM
 * `nr_com` (asset_log BREL) into the same shape.
 *
 * Why deterministic + not random:
 *  - Browser tests assert on row counts and action codes; a faker-seeded list
 *    would still drift if the seed plumbing changes upstream.
 *  - Reasoning about the timeline is easier when "ci:60003 always has 5
 *    history rows starting with `created` and ending with `discovered`".
 */
function buildCiHistory(ci: Ci): Array<{
  id: string;
  timestamp: string;
  action:
    | "created"
    | "attribute_changed"
    | "relationship_added"
    | "relationship_removed"
    | "status_changed"
    | "discovered";
  actor: string;
  detail: string;
}> {
  const neighbours = store.ciRelationships.filter(
    (r) => r.sourceCiId === ci.id || r.targetCiId === ci.id,
  );
  const createdMs = Date.parse(ci.createdAt);
  const modifiedMs = Date.parse(ci.lastModifiedAt);
  const haveModifiedDelta = !Number.isNaN(modifiedMs) && modifiedMs !== createdMs;
  const entries: Array<{
    id: string;
    timestamp: string;
    action:
      | "created"
      | "attribute_changed"
      | "relationship_added"
      | "relationship_removed"
      | "status_changed"
      | "discovered";
    actor: string;
    detail: string;
  }> = [];

  entries.push({
    id: `${ci.id}:hist:0`,
    timestamp: ci.createdAt,
    action: "created",
    actor: "discovery@system",
    detail: `CI vytvorené (class ${ci.class}).`,
  });

  neighbours.slice(0, 3).forEach((rel, idx) => {
    // Spread relationship-adds across the lifecycle window.
    const offset = haveModifiedDelta
      ? createdMs + ((modifiedMs - createdMs) * (idx + 1)) / 5
      : createdMs + (idx + 1) * 60_000 * 60 * 24;
    entries.push({
      id: `${ci.id}:hist:rel:${rel.id}`,
      timestamp: new Date(offset).toISOString(),
      action: rel.sourceCiId === ci.id ? "relationship_added" : "relationship_added",
      actor: "discovery@system",
      detail: `${rel.type} → ${rel.sourceCiId === ci.id ? rel.targetCiId : rel.sourceCiId}`,
    });
  });

  if (haveModifiedDelta) {
    entries.push({
      id: `${ci.id}:hist:attr`,
      timestamp: new Date(modifiedMs).toISOString(),
      action: "attribute_changed",
      actor: ci.primaryContactId ?? "discovery@system",
      detail: "Aktualizované atribúty z poslednej discovery sweep.",
    });
  }

  entries.push({
    id: `${ci.id}:hist:disc`,
    timestamp: new Date(Math.max(createdMs, modifiedMs)).toISOString(),
    action: "discovered",
    actor: "discovery@system",
    detail: `Discovery agent overil dostupnosť — status ${ci.status}.`,
  });

  // Most recent first.
  entries.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
  return entries;
}

export const cmdbHandlers = [
  http.get("*/api/ci", ({ request }) => {
    const tenant = parseTenantFromRequest(request);
    const url = new URL(request.url);
    const correlationId = correlationIdFrom(request);
    const tenantsParam = url.searchParams.get("tenants");
    const userIdValue = resolveUserIdValue(request);
    const sp = isSpAdmin(userIdValue);

    // I.5 — cross-tenant CI query (`?tenants=all`) for sp_admin. The response
    // pages over every tenant the caller has sp_admin in; the shared-marker
    // overlay is applied so the FE can render the "Shared (N)" badge.
    if (tenantsParam === "all") {
      if (!sp) return forbidden("cross-tenant query requires sp_admin", correlationId);
      const allowed = new Set(spAdminTenantIds(userIdValue));
      const all = store.cis.filter((c) => allowed.has(c.tenantId));
      const klass = url.searchParams.get("class");
      const filtered = klass ? all.filter((c) => c.class === klass) : all;
      const enriched = filtered.map((c) => withSharedMarker(c, true));
      return HttpResponse.json(paginate(enriched, readPageParams(url)));
    }

    const viewAs = sp ? getMswViewAsTenant(userIdValue) : null;
    const effectiveTenant = viewAs ?? tenant;
    const all = tenantCis(effectiveTenant);
    const klass = url.searchParams.get("class");
    const filtered = klass ? all.filter((c) => c.class === klass) : all;
    // Apply shared marker overlay for sp_admin callers even on single-tenant
    // queries so the Marek/Robert view-as drill-in shows "Shared (N)".
    const enriched = filtered.map((c) => withSharedMarker(c, sp));
    return HttpResponse.json(paginate(enriched, readPageParams(url)));
  }),

  http.get("*/api/ci/:id", ({ params, request }) => {
    const tenant = parseTenantFromRequest(request);
    const id = String(params["id"] ?? "");
    const correlationId = correlationIdFrom(request);
    const userIdValue = resolveUserIdValue(request);
    const sp = isSpAdmin(userIdValue);

    // sp_admin can look up a CI in any tenant they administer; we still keep
    // the cross-tenant 404 contract for non-sp_admin callers.
    const candidate = sp
      ? store.cis.find((c) => c.id === id && spAdminTenantIds(userIdValue).includes(c.tenantId))
      : tenantCis(tenant).find((c) => c.id === id);
    if (!candidate) return notFound("ci", id, correlationId);
    return HttpResponse.json(withSharedMarker(candidate, sp));
  }),

  http.get("*/api/ci/:id/relationships", ({ params, request }) => {
    const tenant = parseTenantFromRequest(request);
    const url = new URL(request.url);
    const id = String(params["id"] ?? "");
    const userIdValue = resolveUserIdValue(request);
    const sp = isSpAdmin(userIdValue);
    const ciScope = sp ? store.cis : tenantCis(tenant);
    const ci = ciScope.find((c) => c.id === id);
    if (!ci) return notFound("ci", id, correlationIdFrom(request));

    const sameTenantRels = store.ciRelationships.filter(
      (r) => r.sourceCiId === ci.id || r.targetCiId === ci.id,
    );

    // I.5 — when sp_admin requests `?tenants=all`, include cross-tenant edges
    // anchored on this CI so the graph can render foreign-tenant neighbours.
    const wantsCross = url.searchParams.get("tenants") === "all" && sp;
    const crossRels = wantsCross
      ? crossTenantRelationshipsFixture.filter(
          (r) => r.sourceCiId === ci.id || r.targetCiId === ci.id,
        )
      : [];
    const relationships = [...sameTenantRels, ...crossRels];

    const neighbourIds = new Set<string>();
    for (const rel of relationships) {
      const other = rel.sourceCiId === ci.id ? rel.targetCiId : rel.sourceCiId;
      neighbourIds.add(other);
    }
    // Neighbour resolution: same-tenant always, cross-tenant only for sp_admin
    // with explicit `?tenants=all`.
    const neighbourPool = wantsCross ? store.cis : tenantCis(tenant);
    const neighbours = neighbourPool
      .filter((c) => neighbourIds.has(c.id))
      .map((c) => withSharedMarker(c, sp));
    return HttpResponse.json({ relationships, neighbours });
  }),

  http.get("*/api/ci/:id/history", ({ params, request }) => {
    const tenant = parseTenantFromRequest(request);
    const id = String(params["id"] ?? "");
    const ci = tenantCis(tenant).find((c) => c.id === id);
    if (!ci) return notFound("ci", id, correlationIdFrom(request));
    return HttpResponse.json({ entries: buildCiHistory(ci) });
  }),

  // Lightweight CMDB search used by Service Catalog `ci-picker` fields (H.5).
  // Case-insensitive contains on `name` or `id`, capped at 20. Tenant-scoped.
  http.get("*/api/cmdb", ({ request }) => {
    const tenant = parseTenantFromRequest(request);
    const url = new URL(request.url);
    const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
    const all = tenantCis(tenant);
    const matches = (
      q
        ? all.filter((c) => c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q))
        : all
    )
      .slice(0, 20)
      .map((c) => ({ id: c.id, name: c.name, class: c.class }));
    return HttpResponse.json({ items: matches });
  }),
];
