import { http, HttpResponse } from "msw";
import { store } from "../db";
import { incidentId, type Incident, type IncidentStatus } from "@sdm/domain";
import { paginate, readPageParams } from "../utils/pagination";
import { parseTenantFromRequest } from "../utils/tenant";
import { correlationIdFrom } from "../utils/correlation";
import { badRequest, notFound } from "../utils/errors";

function tenantIncidents(tenant: string): Incident[] {
  return store.incidents.filter((i) => i.tenantId === tenant);
}

function applyStatusFilter(records: Incident[], url: URL): Incident[] {
  const status = url.searchParams.get("status");
  if (!status) return records;
  return records.filter((i) => i.status === status);
}

function applyAssigneeFilter(records: Incident[], url: URL): Incident[] {
  const assignee = url.searchParams.get("assigneeId");
  if (!assignee) return records;
  return records.filter((i) => i.assigneeId === assignee);
}

export const incidentHandlers = [
  http.get("*/api/incidents", ({ request }) => {
    const tenant = parseTenantFromRequest(request);
    const url = new URL(request.url);
    const filtered = applyAssigneeFilter(applyStatusFilter(tenantIncidents(tenant), url), url);
    const page = paginate(filtered, readPageParams(url));
    return HttpResponse.json(page);
  }),

  http.get("*/api/incidents/:id", ({ params, request }) => {
    const tenant = parseTenantFromRequest(request);
    const id = String(params["id"] ?? "");
    const incident = tenantIncidents(tenant).find((i) => i.id === id);
    if (!incident) return notFound("incident", id, correlationIdFrom(request));
    return HttpResponse.json(incident);
  }),

  http.post("*/api/incidents", async ({ request }) => {
    const tenant = parseTenantFromRequest(request);
    const correlationId = correlationIdFrom(request);
    const body = (await request.json().catch(() => ({}))) as Partial<Incident>;
    if (!body.summary) return badRequest("summary is required", correlationId);
    const now = new Date().toISOString();
    const ref = `IN-${String(10000 + store.incidents.length).padStart(5, "0")}`;
    const created: Incident = {
      id: incidentId(`incident:${Date.now()}`),
      ref,
      summary: body.summary,
      description: body.description ?? null,
      priority: body.priority ?? 3,
      urgency: body.urgency ?? 3,
      impact: body.impact ?? 3,
      status: (body.status ?? "OP") as IncidentStatus,
      category: body.category ?? null,
      isMajor: body.isMajor ?? false,
      affectedEndUserId: body.affectedEndUserId ?? store.incidents[0]!.affectedEndUserId,
      requesterId: body.requesterId ?? null,
      affectedCiId: null,
      callBackAt: null,
      outageStartAt: null,
      outageEndAt: null,
      outageType: null,
      isReturnedToService: false,
      symptomCode: null,
      rootCause: null,
      solutionUrls: [],
      linkedProblemIds: [],
      linkedChangeIds: [],
      assigneeId: body.assigneeId ?? null,
      assignedGroupId: null,
      openedAt: now,
      targetStartAt: null,
      resolvedAt: null,
      closedAt: null,
      createdAt: now,
      lastModifiedAt: now,
      tenantId: tenant,
    };
    store.incidents.push(created);
    return HttpResponse.json(created, { status: 201 });
  }),

  http.patch("*/api/incidents/:id", async ({ params, request }) => {
    const tenant = parseTenantFromRequest(request);
    const id = String(params["id"] ?? "");
    const idx = store.incidents.findIndex((i) => i.id === id && i.tenantId === tenant);
    if (idx === -1) return notFound("incident", id, correlationIdFrom(request));
    const patch = (await request.json().catch(() => ({}))) as Partial<Incident>;
    const existing = store.incidents[idx]!;
    const updated: Incident = {
      ...existing,
      ...patch,
      id: existing.id,
      tenantId: existing.tenantId,
      lastModifiedAt: new Date().toISOString(),
    };
    store.incidents[idx] = updated;
    return HttpResponse.json(updated);
  }),
];
