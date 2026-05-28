import { http, HttpResponse } from "msw";
import type {
  FkRef,
  UiActivityEntry,
  UiTicketDetail,
  UiTicketDetailActivity,
  UiTicketType,
} from "@sdm/api-types";
import type { Incident, Problem, Request as ServiceRequest, Change } from "@sdm/domain";
import { store } from "../db";
import type { AuditEvent, AuditEventOutcome } from "../db/types";
import { parseTenantFromRequest } from "../utils/tenant";
import { correlationIdFrom } from "../utils/correlation";
import { notFound, badRequest } from "../utils/errors";

/**
 * MSW mirror of the BFF `/api/tickets/:type/:id` aggregator (F.3 + F.6).
 *
 * H.8 consumes this in the workspace. The BFF aggregator pulls activity from
 * CA SDM `act_log` and attachments from `attmnt`; in MSW we synthesize a small
 * deterministic activity stream from the parent record (creation event + the
 * `description` field) and keep `attachments`/`linked` as empty supported
 * shapes. The FE renders the same `_unsupported` empty-state when the BFF says
 * a branch failed; here we keep `_unsupported: false` so the timeline is
 * always populated.
 *
 * Transition endpoints (`/take`, `/resolve`, `/escalate`, `/watch`) mutate the
 * underlying store entity and append an internal activity entry so the
 * timeline updates without a refetch round-trip. Each call emits a synthetic
 * audit event into `store.auditEvents` (existing F.4 taxonomy —
 * `data.incident.write` / `data.request.write` / etc.) so the audit log
 * picks them up.
 */

const ALLOWED_TYPES: ReadonlyArray<UiTicketType> = ["incident", "request", "problem", "change"];

const STATUS_LABEL: Record<string, string> = {
  OP: "Otvorený",
  WIP: "V riešení",
  HLD: "Pozastavený",
  AWU: "Čaká na používateľa",
  AWV: "Čaká na dodávateľa",
  ESC: "Eskalovaný",
  RES: "Vyriešený",
  CL: "Uzavretý",
  CD: "Zrušený",
  NEW: "Nový",
  SUBMITTED: "Odoslaný",
  APPR_PENDING: "Čaká schválenie",
  APPROVED: "Schválený",
  REJECTED: "Zamietnutý",
  IN_PROGRESS: "V riešení",
  DELIVERED: "Doručené",
  ROOT_CAUSE_KNOWN: "Známa príčina",
  KNOWN_ERROR: "Known Error",
};

const PRIORITY_LABEL: Record<string, string> = {
  "1": "Kritická",
  "2": "Vysoká",
  "3": "Stredná",
  "4": "Nízka",
  "5": "Plánovaná",
};

function fkStatus(status: string | null | undefined): FkRef | null {
  if (!status) return null;
  return { id: status, code: status, label: STATUS_LABEL[status] ?? status };
}

function fkPriority(priority: number | null | undefined): FkRef | null {
  if (priority == null) return null;
  const code = String(priority);
  return { id: code, code, label: PRIORITY_LABEL[code] ?? code };
}

function fkContact(id: string | null | undefined): FkRef | null {
  if (!id) return null;
  const user = store.users.find((u) => u.id === id);
  if (!user) return { id, code: id, label: id };
  return { id, code: id, label: `${user.firstName} ${user.lastName}` };
}

type AnyTicket = Incident | ServiceRequest | Problem | Change;

function findTicket(
  type: UiTicketType,
  tenant: string,
  id: string,
): { ticket: AnyTicket; index: number } | null {
  const list = listFor(type).filter((t) => t.tenantId === tenant);
  const idx = list.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  // Locate in original (mutable) array.
  const original = listFor(type);
  const originalIdx = original.findIndex((t) => t.id === id);
  return { ticket: original[originalIdx]!, index: originalIdx };
}

function listFor(type: UiTicketType): AnyTicket[] {
  switch (type) {
    case "incident":
      return store.incidents as unknown as AnyTicket[];
    case "request":
      return store.requests as unknown as AnyTicket[];
    case "problem":
      return store.problems as unknown as AnyTicket[];
    case "change":
      return store.changes as unknown as AnyTicket[];
  }
}

function customerIdOf(ticket: AnyTicket, type: UiTicketType): string | null {
  switch (type) {
    case "incident":
      return (ticket as Incident).affectedEndUserId ?? null;
    case "request":
      return (ticket as ServiceRequest).requesterId ?? null;
    case "problem":
      return null;
    case "change":
      return (ticket as Change).requesterId ?? null;
  }
}

function refOf(ticket: AnyTicket): string {
  // Change uses `ref` field too — domain TicketBase exposes `ref`.
  return (ticket as { ref?: string }).ref ?? ticket.id;
}

function statusOf(ticket: AnyTicket): string {
  return (ticket as { status?: string }).status ?? "";
}

function priorityOf(ticket: AnyTicket): number | null {
  const p = (ticket as { priority?: number }).priority;
  return typeof p === "number" ? p : null;
}

// ─── Synthetic activity stream ───────────────────────────────────────────────

type ActivityRow = UiActivityEntry;

const activityStore = new Map<string, ActivityRow[]>();

function activityKey(tenant: string, type: UiTicketType, id: string): string {
  return `${tenant}::${type}::${id}`;
}

function seedActivity(ticket: AnyTicket, type: UiTicketType, tenant: string): ActivityRow[] {
  const key = activityKey(tenant, type, ticket.id);
  const existing = activityStore.get(key);
  if (existing) return existing;
  const items: ActivityRow[] = [];
  const opened =
    (ticket as { openedAt?: string | null; createdAt?: string | null }).openedAt ??
    (ticket as { createdAt?: string | null }).createdAt ??
    null;
  items.push({
    id: `act:${ticket.id}:created`,
    kind: "system",
    author: null,
    text: `Ticket created`,
    createdAt: opened,
  });
  const description = (ticket as { description?: string | null }).description;
  if (description) {
    items.push({
      id: `act:${ticket.id}:initial`,
      kind: "public",
      author: fkContact(customerIdOf(ticket, type)),
      text: description,
      createdAt: opened,
    });
  }
  activityStore.set(key, items);
  return items;
}

function appendActivity(
  tenant: string,
  type: UiTicketType,
  ticketId: string,
  entry: Omit<ActivityRow, "id" | "createdAt"> & { createdAt?: string },
): ActivityRow {
  const key = activityKey(tenant, type, ticketId);
  const list = activityStore.get(key) ?? [];
  const row: ActivityRow = {
    id: `act:${ticketId}:${Date.now()}:${list.length}`,
    createdAt: entry.createdAt ?? new Date().toISOString(),
    kind: entry.kind,
    author: entry.author,
    text: entry.text,
  };
  list.push(row);
  activityStore.set(key, list);
  return row;
}

// ─── Audit emit ──────────────────────────────────────────────────────────────

function emitAudit(
  eventType: string,
  tenant: string,
  userId: string,
  correlationId: string | undefined,
  outcome: AuditEventOutcome,
  details: Record<string, unknown>,
): void {
  const ev: AuditEvent = {
    id: `audit:h8:${Date.now()}:${store.auditEvents.length}`,
    timestamp: new Date().toISOString(),
    eventType,
    userId,
    tenantId: tenant,
    correlationId: correlationId ?? "",
    outcome,
    details,
  };
  store.auditEvents.push(ev);
}

function auditEventTypeFor(type: UiTicketType): string {
  // F.4 taxonomy: `data.<entity>.write`.
  return `data.${type}.write`;
}

// ─── Detail shaper ───────────────────────────────────────────────────────────

function shapeDetail(ticket: AnyTicket, type: UiTicketType, tenant: string): UiTicketDetail {
  const items = seedActivity(ticket, type, tenant);
  const activity: UiTicketDetailActivity = {
    _unsupported: false,
    items: [...items].sort((a, b) => {
      const ta = a.createdAt ? Date.parse(a.createdAt) : 0;
      const tb = b.createdAt ? Date.parse(b.createdAt) : 0;
      return ta - tb;
    }),
    hasMore: false,
  };
  return {
    ticketType: type,
    id: ticket.id,
    ref: refOf(ticket),
    summary: (ticket as { summary?: string }).summary ?? "",
    description: (ticket as { description?: string | null }).description ?? "",
    status: fkStatus(statusOf(ticket)),
    priority: fkPriority(priorityOf(ticket)),
    customer: fkContact(customerIdOf(ticket, type)),
    assignee: fkContact((ticket as { assigneeId?: string | null }).assigneeId ?? null),
    openedAt: (ticket as { openedAt?: string | null }).openedAt ?? null,
    closedAt: (ticket as { closedAt?: string | null }).closedAt ?? null,
    linked: { _unsupported: false, problems: [], changes: [], incidents: [] },
    attachments: { _unsupported: false, items: [] },
    activity,
  };
}

// ─── Handlers ────────────────────────────────────────────────────────────────

export const ticketDetailHandlers = [
  http.get("*/api/tickets/:type/:id", ({ params, request }) => {
    const tenant = parseTenantFromRequest(request);
    const type = String(params["type"] ?? "") as UiTicketType;
    const id = String(params["id"] ?? "");
    const corr = correlationIdFrom(request);
    if (!ALLOWED_TYPES.includes(type)) {
      return badRequest(`Unknown ticket type "${type}"`, corr);
    }
    const found = findTicket(type, tenant, id);
    if (!found) return notFound(`ticket:${type}`, id, corr);
    return HttpResponse.json(shapeDetail(found.ticket, type, tenant));
  }),

  http.patch("*/api/tickets/:type/:id", async ({ params, request }) => {
    const tenant = parseTenantFromRequest(request);
    const type = String(params["type"] ?? "") as UiTicketType;
    const id = String(params["id"] ?? "");
    const corr = correlationIdFrom(request);
    if (!ALLOWED_TYPES.includes(type)) return badRequest(`Unknown type "${type}"`, corr);
    const found = findTicket(type, tenant, id);
    if (!found) return notFound(`ticket:${type}`, id, corr);
    const patch = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const list = listFor(type);
    const before = list[found.index]!;
    const next = {
      ...before,
      ...patch,
      id: before.id,
      tenantId: before.tenantId,
      lastModifiedAt: new Date().toISOString(),
    } as AnyTicket;
    list[found.index] = next;
    if ("status" in patch && patch["status"] !== statusOf(before)) {
      appendActivity(tenant, type, id, {
        kind: "system",
        author: null,
        text: `Status changed: ${statusOf(before)} → ${patch["status"]}`,
      });
    }
    emitAudit(auditEventTypeFor(type), tenant, "user-1", corr, "success", {
      action: "patch",
      ticketId: id,
      patch,
    });
    return HttpResponse.json(shapeDetail(next, type, tenant));
  }),

  http.post("*/api/tickets/:type/:id/take", async ({ params, request }) => {
    const tenant = parseTenantFromRequest(request);
    const type = String(params["type"] ?? "") as UiTicketType;
    const id = String(params["id"] ?? "");
    const corr = correlationIdFrom(request);
    if (!ALLOWED_TYPES.includes(type)) return badRequest(`Unknown type "${type}"`, corr);
    const found = findTicket(type, tenant, id);
    if (!found) return notFound(`ticket:${type}`, id, corr);
    const list = listFor(type);
    const before = list[found.index]! as AnyTicket & { assigneeId?: string | null };
    const next = {
      ...before,
      assigneeId: "user-1",
      status: type === "request" ? "IN_PROGRESS" : "WIP",
      lastModifiedAt: new Date().toISOString(),
    } as AnyTicket;
    list[found.index] = next;
    appendActivity(tenant, type, id, {
      kind: "system",
      author: fkContact("user-1"),
      text: "Assigned to Anna Analyst",
    });
    emitAudit(auditEventTypeFor(type), tenant, "user-1", corr, "success", {
      action: "take",
      ticketId: id,
    });
    return HttpResponse.json(shapeDetail(next, type, tenant));
  }),

  http.post("*/api/tickets/:type/:id/resolve", async ({ params, request }) => {
    const tenant = parseTenantFromRequest(request);
    const type = String(params["type"] ?? "") as UiTicketType;
    const id = String(params["id"] ?? "");
    const corr = correlationIdFrom(request);
    if (!ALLOWED_TYPES.includes(type)) return badRequest(`Unknown type "${type}"`, corr);
    const found = findTicket(type, tenant, id);
    if (!found) return notFound(`ticket:${type}`, id, corr);
    const body = (await request.json().catch(() => ({}))) as {
      solution?: string;
      category?: string;
    };
    if (!body.solution || body.solution.trim().length === 0) {
      return badRequest("solution is required", corr);
    }
    const list = listFor(type);
    const before = list[found.index]!;
    const now = new Date().toISOString();
    const next = {
      ...before,
      status: "RES",
      resolvedAt: now,
      lastModifiedAt: now,
      ...(body.category ? { category: body.category } : {}),
    } as AnyTicket;
    list[found.index] = next;
    appendActivity(tenant, type, id, {
      kind: "public",
      author: fkContact("user-1"),
      text: `Resolution: ${body.solution}`,
    });
    appendActivity(tenant, type, id, {
      kind: "system",
      author: null,
      text: "Ticket resolved",
    });
    emitAudit(auditEventTypeFor(type), tenant, "user-1", corr, "success", {
      action: "resolve",
      ticketId: id,
      category: body.category ?? null,
    });
    return HttpResponse.json(shapeDetail(next, type, tenant));
  }),

  http.post("*/api/tickets/:type/:id/escalate", async ({ params, request }) => {
    const tenant = parseTenantFromRequest(request);
    const type = String(params["type"] ?? "") as UiTicketType;
    const id = String(params["id"] ?? "");
    const corr = correlationIdFrom(request);
    if (!ALLOWED_TYPES.includes(type)) return badRequest(`Unknown type "${type}"`, corr);
    const found = findTicket(type, tenant, id);
    if (!found) return notFound(`ticket:${type}`, id, corr);
    const body = (await request.json().catch(() => ({}))) as { note?: string; group?: string };
    const list = listFor(type);
    const before = list[found.index]!;
    const next = {
      ...before,
      status: type === "incident" ? "ESC" : statusOf(before),
      lastModifiedAt: new Date().toISOString(),
    } as AnyTicket;
    list[found.index] = next;
    appendActivity(tenant, type, id, {
      kind: "internal",
      author: fkContact("user-1"),
      text: body.note
        ? `Escalated${body.group ? ` to ${body.group}` : ""}: ${body.note}`
        : `Escalated${body.group ? ` to ${body.group}` : ""}`,
    });
    emitAudit(auditEventTypeFor(type), tenant, "user-1", corr, "success", {
      action: "escalate",
      ticketId: id,
      group: body.group ?? null,
    });
    return HttpResponse.json(shapeDetail(next, type, tenant));
  }),

  http.post("*/api/tickets/:type/:id/watch", async ({ params, request }) => {
    const tenant = parseTenantFromRequest(request);
    const type = String(params["type"] ?? "") as UiTicketType;
    const id = String(params["id"] ?? "");
    const corr = correlationIdFrom(request);
    if (!ALLOWED_TYPES.includes(type)) return badRequest(`Unknown type "${type}"`, corr);
    const found = findTicket(type, tenant, id);
    if (!found) return notFound(`ticket:${type}`, id, corr);
    appendActivity(tenant, type, id, {
      kind: "system",
      author: fkContact("user-1"),
      text: "Added to watchers",
    });
    emitAudit(auditEventTypeFor(type), tenant, "user-1", corr, "success", {
      action: "watch",
      ticketId: id,
    });
    return HttpResponse.json(shapeDetail(found.ticket, type, tenant));
  }),

  http.post("*/api/tickets/:type/:id/comments", async ({ params, request }) => {
    const tenant = parseTenantFromRequest(request);
    const type = String(params["type"] ?? "") as UiTicketType;
    const id = String(params["id"] ?? "");
    const corr = correlationIdFrom(request);
    if (!ALLOWED_TYPES.includes(type)) return badRequest(`Unknown type "${type}"`, corr);
    const found = findTicket(type, tenant, id);
    if (!found) return notFound(`ticket:${type}`, id, corr);
    const body = (await request.json().catch(() => ({}))) as {
      text?: string;
      kind?: "public" | "internal";
    };
    const text = (body.text ?? "").trim();
    if (!text) return badRequest("text is required", corr);
    const kind: "public" | "internal" = body.kind === "internal" ? "internal" : "public";
    appendActivity(tenant, type, id, {
      kind,
      author: fkContact("user-1"),
      text,
    });
    emitAudit(auditEventTypeFor(type), tenant, "user-1", corr, "success", {
      action: "comment",
      ticketId: id,
      kind,
    });
    return HttpResponse.json(shapeDetail(found.ticket, type, tenant));
  }),
];
