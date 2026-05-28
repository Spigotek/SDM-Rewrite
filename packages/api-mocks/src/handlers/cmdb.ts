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
    return HttpResponse.json({ relationships });
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
