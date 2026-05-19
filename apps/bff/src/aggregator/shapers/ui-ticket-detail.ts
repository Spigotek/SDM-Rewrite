import type { UiTicketDetail, UiTicketType } from "@sdm/api-types";
import { mapIncidentRow } from "../../api/endpoints/incidents";
import { mapProblemRow } from "../../api/endpoints/problems";
import { mapRequestRow } from "../../api/endpoints/requests";
import { epochSecToIso, liftAttrs, toFkRef, type CaSdmFk } from "../../api/endpoints/_shape";

type RawRow = Record<string, unknown>;

/**
 * Shape a raw CA SDM parent ticket row into `UiTicketDetail` with empty
 * linked/attachments/activity blocks. Those blocks carry `_unsupported: true`
 * because the CA SDM `lrel_*`/`attmnt`/`act_log` factory names have not been
 * captured in `real-backend-contracts.md` yet — the FE renders an empty
 * state and the post-discovery chunk flips the flag without breaking shape.
 */
export function rawToUiTicketDetail(raw: RawRow, ticketType: UiTicketType): UiTicketDetail {
  if (ticketType === "change") {
    return changeToUi(raw);
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
    attachments: emptyAttachments(),
    activity: emptyActivity(),
  };
}

/**
 * `chg` schema diverges from `in`/`cr`/`pr` (real-backend-contracts.md §15):
 * PK is `chg_ref_num`, customer attribute is `requestor`, status table is
 * `chgstat`. F.2 changes.ts handles this for the entity endpoint; for the
 * aggregator we re-do the projection locally rather than threading a fourth
 * mapRow through the same composition pattern.
 */
function changeToUi(raw: RawRow): UiTicketDetail {
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
    attachments: emptyAttachments(),
    activity: emptyActivity(),
  };
}

function emptyLinked(): UiTicketDetail["linked"] {
  return { _unsupported: true, problems: [], changes: [], incidents: [] };
}

function emptyAttachments(): UiTicketDetail["attachments"] {
  return { _unsupported: true, items: [] };
}

function emptyActivity(): UiTicketDetail["activity"] {
  return { _unsupported: true, items: [], hasMore: false };
}
