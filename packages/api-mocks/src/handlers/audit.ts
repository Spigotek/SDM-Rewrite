import { http, HttpResponse } from "msw";
import { store } from "../db";
import { AUDIT_EVENT_TYPES } from "../fixtures/audit-events";
import { paginate, readPageParams } from "../utils/pagination";
import { parseTenantFromRequest } from "../utils/tenant";
import { correlationIdFrom } from "../utils/correlation";
import { notFound } from "../utils/errors";

export const auditHandlers = [
  http.get("*/api/audit/event-types", () => HttpResponse.json({ eventTypes: AUDIT_EVENT_TYPES })),

  http.get("*/api/audit/events", ({ request }) => {
    const tenant = parseTenantFromRequest(request);
    const url = new URL(request.url);
    const eventType = url.searchParams.get("eventType");
    const userId = url.searchParams.get("userId");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    let events = store.auditEvents.filter((e) => e.tenantId === tenant);
    if (eventType) events = events.filter((e) => e.eventType === eventType);
    if (userId) events = events.filter((e) => e.userId === userId);
    if (from) events = events.filter((e) => e.timestamp >= from);
    if (to) events = events.filter((e) => e.timestamp <= to);

    const sorted = [...events].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    return HttpResponse.json(paginate(sorted, readPageParams(url)));
  }),

  http.get("*/api/audit/events/:id", ({ params, request }) => {
    const tenant = parseTenantFromRequest(request);
    const id = String(params["id"] ?? "");
    const event = store.auditEvents.find((e) => e.id === id && e.tenantId === tenant);
    if (!event) return notFound("audit event", id, correlationIdFrom(request));
    return HttpResponse.json(event);
  }),
];
