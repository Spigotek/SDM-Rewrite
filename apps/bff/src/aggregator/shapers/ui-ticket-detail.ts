import type {
  UiTicketDetail,
  UiTicketDetailActivity,
  UiTicketDetailAttachments,
  UiTicketType,
} from "@sdm/api-types";
import { mapIncidentRow } from "../../api/endpoints/incidents";
import { mapProblemRow } from "../../api/endpoints/problems";
import { mapRequestRow } from "../../api/endpoints/requests";
import { epochSecToIso, liftAttrs, toFkRef, type CaSdmFk } from "../../api/endpoints/_shape";

type RawRow = Record<string, unknown>;

/**
 * Shape a raw CA SDM parent ticket row plus the fan-out branch results into
 * `UiTicketDetail`. Per F.6:
 *  - `activity` / `attachments` carry real data when the BREL fan-out succeeded
 *    (`_unsupported: false`) or empty fallbacks when the branch failed
 *    (`_unsupported: true`).
 *  - `linked` stays `_unsupported: true` — `real-backend-contracts.md §24`
 *    documents that no BREL relation works on this CA SDM 17.4 instance.
 *    Flipping it later is non-breaking (only `_unsupported` toggles).
 */
export function rawToUiTicketDetail(
  raw: RawRow,
  ticketType: UiTicketType,
  branches: {
    activity: UiTicketDetailActivity;
    attachments: UiTicketDetailAttachments;
  },
): UiTicketDetail {
  if (ticketType === "change") {
    return changeToUi(raw, branches);
  }
  const row =
    ticketType === "incident"
      ? mapIncidentRow(raw)
      : ticketType === "request"
        ? mapRequestRow(raw)
        : mapProblemRow(raw);
  return {
    ticketType,
    id: row.id,
    ref: row.ref,
    summary: row.summary,
    description: row.description,
    status: row.status,
    priority: row.priority,
    customer: row.customer,
    assignee: row.assignee,
    openedAt: row.openedAt,
    closedAt: row.closedAt,
    linked: emptyLinked(),
    attachments: branches.attachments,
    activity: branches.activity,
  };
}

/**
 * `chg` schema diverges from `in`/`cr`/`pr` (real-backend-contracts.md §15):
 * PK is `chg_ref_num`, customer attribute is `requestor`, status table is
 * `chgstat`. F.2 changes.ts handles this for the entity endpoint; for the
 * aggregator we re-do the projection locally rather than threading a fourth
 * mapRow through the same composition pattern.
 */
function changeToUi(
  raw: RawRow,
  branches: {
    activity: UiTicketDetailActivity;
    attachments: UiTicketDetailAttachments;
  },
): UiTicketDetail {
  const top = liftAttrs(raw);
  return {
    ticketType: "change",
    id: top.id,
    ref: String(raw["chg_ref_num"] ?? top.displayName ?? ""),
    summary: typeof raw["summary"] === "string" ? raw["summary"] : "",
    description: typeof raw["description"] === "string" ? raw["description"] : "",
    status: toFkRef(raw["status"] as CaSdmFk | undefined),
    priority: toFkRef(raw["priority"] as CaSdmFk | undefined),
    customer: toFkRef(raw["requestor"] as CaSdmFk | undefined),
    assignee: toFkRef(raw["assignee"] as CaSdmFk | undefined),
    openedAt: epochSecToIso(raw["open_date"] as string | number | null | undefined),
    closedAt: epochSecToIso(raw["close_date"] as string | number | null | undefined),
    linked: emptyLinked(),
    attachments: branches.attachments,
    activity: branches.activity,
  };
}

/**
 * Linked tickets stay `_unsupported: true` per real-backend-contracts.md §24
 * — no BREL relation on this instance produces a Problem→Incident,
 * Incident→Change, or Problem→Change navigation. A future CA SDM customisation
 * or server-side WC query layer would unblock this.
 */
function emptyLinked(): UiTicketDetail["linked"] {
  return { _unsupported: true, problems: [], changes: [], incidents: [] };
}
