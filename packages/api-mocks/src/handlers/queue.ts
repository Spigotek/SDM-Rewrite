import { http, HttpResponse } from "msw";
import type { FkRef, UiQueueItem, UiQueuePage, UiTicketType } from "@sdm/api-types";
import { store } from "../db";
import { parseTenantFromRequest } from "../utils/tenant";

/**
 * Mirror of the BFF `paginationToCaSdm` translation (`page` 0-based → `start`
 * 1-based) so MSW returns the same slice the BFF would for a given page.
 */
function readQueuePagination(url: URL): { start: number; size: number } {
  const page = Math.max(0, Number(url.searchParams.get("page") ?? "0") || 0);
  const rawSize = Number(url.searchParams.get("size") ?? "100") || 100;
  const size = Math.min(Math.max(1, Math.floor(rawSize)), 200);
  return { start: page * size + 1, size };
}

/**
 * MSW mirror of the BFF `/api/queue` aggregator (F.3). Reads the tenant-scoped
 * incidents/requests/problems from the in-memory store and shapes them into the
 * uniform `UiQueueItem` contract used by the workspace queue. Sort key matches
 * the BFF shaper: priority desc (1 = highest in CA SDM → highest weight), then
 * `openedAt` desc as a tiebreaker.
 *
 * The handler is intentionally narrow: it ignores the BFF `filter` (raw CA SDM
 * `where_clause`) param and instead returns the full tenant-scoped buffer. H.7
 * does filter/search client-side so the BFF endpoint stays unchanged for MVP.
 */

const STATUS_LABEL: Record<string, string> = {
  OP: "Otvorený",
  WIP: "V riešení",
  HLD: "Pozastavený",
  AWU: "Čaká na používateľa",
  RES: "Vyriešený",
  CL: "Uzavretý",
  NEW: "Nový",
  SUBMITTED: "Odoslaný",
  APPR_PENDING: "Čaká schválenie",
  APPROVED: "Schválený",
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

function fkStatus(status: string): FkRef {
  return { id: status, code: status, label: STATUS_LABEL[status] ?? status };
}

function fkPriority(priority: number): FkRef {
  const code = String(priority);
  return { id: code, code, label: PRIORITY_LABEL[code] ?? code };
}

function fkContact(id: string | null): FkRef | null {
  if (!id) return null;
  const user = store.users.find((u) => u.id === id);
  if (!user) return { id, code: id, label: id };
  return { id, code: id, label: `${user.firstName} ${user.lastName}` };
}

function priorityWeight(item: UiQueueItem): number {
  const code = item.priority?.code;
  if (!code) return 0;
  const n = Number(code);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return 6 - Math.min(5, Math.max(1, Math.floor(n)));
}

function compareQueueItems(a: UiQueueItem, b: UiQueueItem): number {
  const dp = priorityWeight(b) - priorityWeight(a);
  if (dp !== 0) return dp;
  const ta = a.openedAt ? Date.parse(a.openedAt) : 0;
  const tb = b.openedAt ? Date.parse(b.openedAt) : 0;
  return tb - ta;
}

function buildQueue(tenant: string): UiQueueItem[] {
  const items: UiQueueItem[] = [];

  for (const inc of store.incidents.filter((i) => i.tenantId === tenant)) {
    items.push(
      mapRow(
        "incident",
        inc.id,
        inc.ref,
        inc.summary,
        inc.status,
        inc.priority,
        inc.affectedEndUserId,
        inc.assigneeId,
        inc.openedAt,
      ),
    );
  }
  for (const req of store.requests.filter((r) => r.tenantId === tenant)) {
    items.push(
      mapRow(
        "request",
        req.id,
        req.ref,
        req.summary,
        req.status,
        req.priority,
        req.requesterId,
        req.assigneeId,
        req.openedAt,
      ),
    );
  }
  for (const prb of store.problems.filter((p) => p.tenantId === tenant)) {
    // Problems don't carry a `requesterId` in the domain model — the customer
    // cell stays empty (`—`) which matches the wireframe's MVP behaviour.
    items.push(
      mapRow(
        "problem",
        prb.id,
        prb.ref,
        prb.summary,
        prb.status,
        prb.priority,
        null,
        prb.assigneeId,
        prb.openedAt,
      ),
    );
  }

  items.sort(compareQueueItems);
  return items;
}

function mapRow(
  ticketType: UiTicketType,
  id: string,
  ref: string,
  summary: string,
  status: string,
  priority: number,
  customerId: string | null,
  assigneeId: string | null,
  openedAt: string | null,
): UiQueueItem {
  return {
    ticketType,
    id,
    ref,
    summary,
    status: fkStatus(status),
    priority: fkPriority(priority),
    customer: fkContact(customerId),
    assignee: fkContact(assigneeId),
    lastActivityAt: openedAt,
    openedAt,
  };
}

export const queueHandlers = [
  http.get("*/api/queue", ({ request }) => {
    const tenant = parseTenantFromRequest(request);
    const url = new URL(request.url);
    const { start, size } = readQueuePagination(url);
    const items = buildQueue(tenant);
    const sliced = items.slice(start - 1, start - 1 + size);
    const body: UiQueuePage = {
      data: sliced,
      page: { total: items.length, start, size: sliced.length },
      hasMore: false,
    };
    return HttpResponse.json(body);
  }),
];
