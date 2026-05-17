import { http, HttpResponse } from "msw";
import { store } from "../db";
import { requestId, type Request as ServiceRequest, type RequestStatus } from "@sdm/domain";
import { paginate, readPageParams } from "../utils/pagination";
import { parseTenantFromRequest } from "../utils/tenant";
import { correlationIdFrom } from "../utils/correlation";
import { badRequest, notFound } from "../utils/errors";

function tenantRequests(tenant: string): ServiceRequest[] {
  return store.requests.filter((r) => r.tenantId === tenant);
}

export const requestHandlers = [
  http.get("*/api/requests", ({ request }) => {
    const tenant = parseTenantFromRequest(request);
    const url = new URL(request.url);
    const all = tenantRequests(tenant);
    const status = url.searchParams.get("status");
    const filtered = status ? all.filter((r) => r.status === status) : all;
    return HttpResponse.json(paginate(filtered, readPageParams(url)));
  }),

  http.get("*/api/requests/:id", ({ params, request }) => {
    const tenant = parseTenantFromRequest(request);
    const id = String(params["id"] ?? "");
    const found = tenantRequests(tenant).find((r) => r.id === id);
    if (!found) return notFound("request", id, correlationIdFrom(request));
    return HttpResponse.json(found);
  }),

  http.post("*/api/requests", async ({ request }) => {
    const tenant = parseTenantFromRequest(request);
    const correlationId = correlationIdFrom(request);
    const body = (await request.json().catch(() => ({}))) as Partial<ServiceRequest>;
    if (!body.summary) return badRequest("summary is required", correlationId);
    if (!body.requesterId) return badRequest("requesterId is required", correlationId);
    const now = new Date().toISOString();
    const ref = `REQ-${String(20000 + store.requests.length).padStart(5, "0")}`;
    const created: ServiceRequest = {
      id: requestId(`request:${Date.now()}`),
      ref,
      summary: body.summary,
      description: body.description ?? null,
      priority: body.priority ?? 3,
      urgency: body.urgency ?? 3,
      severity: body.severity ?? null,
      status: (body.status ?? "SUBMITTED") as RequestStatus,
      category: body.category ?? "general",
      requesterId: body.requesterId,
      assigneeId: body.assigneeId ?? null,
      assignedGroupId: null,
      serviceCatalogItemId: body.serviceCatalogItemId ?? null,
      formData: body.formData ?? {},
      isReturnedToService: false,
      linkedChangeIds: [],
      openedAt: now,
      targetStartAt: null,
      resolvedAt: null,
      closedAt: null,
      createdAt: now,
      lastModifiedAt: now,
      tenantId: tenant,
    };
    store.requests.push(created);
    return HttpResponse.json(created, { status: 201 });
  }),

  // --- Service Catalog ---
  http.get("*/api/catalog", ({ request }) => {
    const tenant = parseTenantFromRequest(request);
    const offerings = store.catalog.filter((c) => c.tenantId === tenant);
    return HttpResponse.json({ offerings });
  }),

  http.get("*/api/catalog/:id", ({ params, request }) => {
    const tenant = parseTenantFromRequest(request);
    const id = String(params["id"] ?? "");
    const offering = store.catalog.find((c) => c.id === id && c.tenantId === tenant);
    if (!offering) return notFound("catalog offering", id, correlationIdFrom(request));
    return HttpResponse.json(offering);
  }),

  http.get("*/api/catalog/:id/form", ({ params, request }) => {
    const tenant = parseTenantFromRequest(request);
    const id = String(params["id"] ?? "");
    const offering = store.catalog.find((c) => c.id === id && c.tenantId === tenant);
    if (!offering) return notFound("catalog offering", id, correlationIdFrom(request));
    return HttpResponse.json({ form: offering.form });
  }),
];
