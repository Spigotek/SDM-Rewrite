import { http, HttpResponse } from "msw";
import { store } from "../db";
import type { Ci } from "@sdm/domain";
import { paginate, readPageParams } from "../utils/pagination";
import { parseTenantFromRequest } from "../utils/tenant";
import { correlationIdFrom } from "../utils/correlation";
import { notFound } from "../utils/errors";

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
    const all = tenantCis(tenant);
    const klass = url.searchParams.get("class");
    const filtered = klass ? all.filter((c) => c.class === klass) : all;
    return HttpResponse.json(paginate(filtered, readPageParams(url)));
  }),

  http.get("*/api/ci/:id", ({ params, request }) => {
    const tenant = parseTenantFromRequest(request);
    const id = String(params["id"] ?? "");
    const found = tenantCis(tenant).find((c) => c.id === id);
    if (!found) return notFound("ci", id, correlationIdFrom(request));
    return HttpResponse.json(found);
  }),

  http.get("*/api/ci/:id/relationships", ({ params, request }) => {
    const tenant = parseTenantFromRequest(request);
    const id = String(params["id"] ?? "");
    const ci = tenantCis(tenant).find((c) => c.id === id);
    if (!ci) return notFound("ci", id, correlationIdFrom(request));
    const relationships = store.ciRelationships.filter(
      (r) => r.sourceCiId === ci.id || r.targetCiId === ci.id,
    );
    // H.14 graph renderer needs neighbour CIs (label + class) to render
    // nodes — without them the Cytoscape graph would only show ids. We
    // resolve neighbours from the same tenant scope so cross-tenant CIs
    // never leak (sp_admin cross-tenant variant is a future chunk).
    const neighbourIds = new Set<string>();
    for (const rel of relationships) {
      const other = rel.sourceCiId === ci.id ? rel.targetCiId : rel.sourceCiId;
      neighbourIds.add(other);
    }
    const sameTenant = tenantCis(tenant);
    const neighbours = sameTenant.filter((c) => neighbourIds.has(c.id));
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
