import { http, HttpResponse } from "msw";
import { store } from "../db";
import type { Incident, Problem } from "@sdm/domain";
import { paginate, readPageParams } from "../utils/pagination";
import { parseTenantFromRequest } from "../utils/tenant";
import { correlationIdFrom } from "../utils/correlation";
import { notFound } from "../utils/errors";

function tenantProblems(tenant: string): Problem[] {
  return store.problems.filter((p) => p.tenantId === tenant);
}

export const problemHandlers = [
  http.get("*/api/problems", ({ request }) => {
    const tenant = parseTenantFromRequest(request);
    const url = new URL(request.url);
    const all = tenantProblems(tenant);
    const status = url.searchParams.get("status");
    const filtered = status ? all.filter((p) => p.status === status) : all;
    return HttpResponse.json(paginate(filtered, readPageParams(url)));
  }),

  http.get("*/api/problems/:id", ({ params, request }) => {
    const tenant = parseTenantFromRequest(request);
    const id = String(params["id"] ?? "");
    const found = tenantProblems(tenant).find((p) => p.id === id);
    if (!found) return notFound("problem", id, correlationIdFrom(request));
    return HttpResponse.json(found);
  }),

  http.get("*/api/problems/:id/related-incidents", ({ params, request }) => {
    const tenant = parseTenantFromRequest(request);
    const id = String(params["id"] ?? "");
    const problem = tenantProblems(tenant).find((p) => p.id === id);
    if (!problem) return notFound("problem", id, correlationIdFrom(request));
    const incidents: Incident[] = store.incidents.filter(
      (i) => i.tenantId === tenant && problem.linkedIncidentIds.includes(i.id),
    );
    return HttpResponse.json({ incidents });
  }),
];
