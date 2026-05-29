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

  // --- H.5 Service Catalog (items + dynamic-form schema) ---
  // The H.5 wireframe (`portal/03-service-catalog.md`) consumes the catalog as
  // a flat list of items (no nested `offering` wrapper). Two endpoints, both
  // tenant-scoped:
  //   GET  /api/catalog/items          → [{ id, name, description, category,
  //                                        sla?, cost?, featured? }, ...]
  //   GET  /api/catalog/items/:id      → { item, fields: CatalogField[] }
  // The legacy `/api/catalog/:id` route stays for back-compat with H.0
  // tests; both `/items` routes must be registered BEFORE `:id` because
  // MSW does first-match-wins on the handler array (otherwise `:id`
  // captures `items` as a URL param and returns 404).
  http.get("*/api/catalog/items", ({ request }) => {
    const tenant = parseTenantFromRequest(request);
    const url = new URL(request.url);
    const category = url.searchParams.get("category");
    const featuredOnly = url.searchParams.get("featured") === "true";
    const items = store.catalog
      .filter((c) => c.tenantId === tenant)
      .filter((c) => (category ? c.category === category : true))
      .filter((c) => (featuredOnly ? c.featured === true : true))
      .map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        category: c.category,
        ...(c.sla ? { sla: c.sla } : {}),
        ...(c.cost ? { cost: c.cost } : {}),
        ...(c.featured !== undefined ? { featured: c.featured } : {}),
      }));
    return HttpResponse.json({ items });
  }),

  http.get("*/api/catalog/items/:id", ({ params, request }) => {
    const tenant = parseTenantFromRequest(request);
    const id = String(params["id"] ?? "");
    const offering = store.catalog.find((c) => c.id === id && c.tenantId === tenant);
    if (!offering) return notFound("catalog item", id, correlationIdFrom(request));
    const item = {
      id: offering.id,
      name: offering.name,
      description: offering.description,
      category: offering.category,
      ...(offering.sla ? { sla: offering.sla } : {}),
      ...(offering.cost ? { cost: offering.cost } : {}),
      ...(offering.featured !== undefined ? { featured: offering.featured } : {}),
    };
    return HttpResponse.json({ item, fields: offering.form.fields });
  }),

  // Legacy back-compat routes for H.0 tests (must stay AFTER `items` routes
  // — first-match-wins, see comment above).
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
