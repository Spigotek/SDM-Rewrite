import type { FkRef, UiQueueItem, UiTicketType } from "@sdm/api-types";
import { mapIncidentRow, type IncidentRowFe } from "../../api/endpoints/incidents";
import { mapProblemRow, type ProblemRowFe } from "../../api/endpoints/problems";
import { mapRequestRow, type RequestRowFe } from "../../api/endpoints/requests";

/**
 * Shape a raw CA SDM row (from `in`/`cr`/`pr` factories) into the uniform
 * `UiQueueItem` contract used by the queue handler.
 *
 * Composition is `raw → F.2 entity mapRow (FE shape) → UiQueueItem` — that
 * keeps FK collapsing, epoch→ISO conversion, and `customer.label` formatting
 * authoritative in `endpoints/*.ts` (no duplication of `toFkRef` semantics).
 *
 * `lastActivityAt` falls back to `openedAt` because CA SDM `last_mod_dt` is
 * not in the F.2 `DEFAULT_ATTRS` projection. Switching to true last-activity
 * is a non-breaking change once the activity log fan-out lands.
 */

type RawRow = Record<string, unknown>;

export function rawToUiQueueItem(raw: RawRow, ticketType: UiTicketType): UiQueueItem {
  switch (ticketType) {
    case "incident":
      return incidentToUi(mapIncidentRow(raw));
    case "request":
      return requestToUi(mapRequestRow(raw));
    case "problem":
      return problemToUi(mapProblemRow(raw));
    case "change":
      throw new Error("change rows are not part of the queue fan-out in MVP");
  }
}

function incidentToUi(row: IncidentRowFe): UiQueueItem {
  return {
    ticketType: "incident",
    id: row.id,
    ref: row.ref,
    summary: row.summary,
    status: castFkRef(row.status),
    priority: castFkRef(row.priority),
    customer: castFkRef(row.customer),
    assignee: castFkRef(row.assignee),
    lastActivityAt: row.openedAt,
    openedAt: row.openedAt,
  };
}

function requestToUi(row: RequestRowFe): UiQueueItem {
  return {
    ticketType: "request",
    id: row.id,
    ref: row.ref,
    summary: row.summary,
    status: castFkRef(row.status),
    priority: castFkRef(row.priority),
    customer: castFkRef(row.customer),
    assignee: castFkRef(row.assignee),
    lastActivityAt: row.openedAt,
    openedAt: row.openedAt,
  };
}

function problemToUi(row: ProblemRowFe): UiQueueItem {
  return {
    ticketType: "problem",
    id: row.id,
    ref: row.ref,
    summary: row.summary,
    status: castFkRef(row.status),
    priority: castFkRef(row.priority),
    customer: castFkRef(row.customer),
    assignee: castFkRef(row.assignee),
    lastActivityAt: row.openedAt,
    openedAt: row.openedAt,
  };
}

function castFkRef(ref: { id: string; code: string; label: string } | null): FkRef | null {
  return ref;
}

/**
 * Numeric proxy for CA SDM `pri.REL_ATTR` so the queue sorts by priority
 * desc (1 = highest in CA SDM, see real-backend-contracts.md §18). Returns 0
 * for "None"/empty so unprioritized rows sink to the bottom.
 */
export function priorityWeight(item: UiQueueItem): number {
  const code = item.priority?.code;
  if (!code) return 0;
  const n = Number(code);
  if (!Number.isFinite(n) || n <= 0) return 0;
  // CA SDM priority is 1 (highest) … 5 (lowest); invert so larger = higher.
  return 6 - Math.min(5, Math.max(1, Math.floor(n)));
}
