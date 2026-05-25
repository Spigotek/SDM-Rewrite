import type { UiActivityEntry } from "@sdm/api-types";
import { epochSecToIso, toFkRef, type CaSdmFk } from "./_shape";

/**
 * Activity-log row shaping for the ticket-detail aggregator.
 *
 * `alg` (used by `in`/`cr`/`pr`) and `chgalg` (used by `chg`) share the same
 * attribute set — `description`, `time_stamp`, `analyst`, `internal`, `type`,
 * `action_desc`. Per `real-backend-contracts.md §22`, the BREL navigation
 * `/{factory}/{id}/act_log` returns `collection_alg` or `collection_chgalg`
 * depending on factory; both row shapes feed the same `UiActivityEntry`.
 *
 * `kind` derivation:
 *  1. `internal === 1` → `"internal"` (private analyst note).
 *  2. `type.@REL_ATTR === "LOG"` AND `internal !== 1` → `"public"` (user comment).
 *  3. anything else → `"system"` (transfer, status change, attach-doc, …).
 */

export type ActivityFactoryKey = "alg" | "chgalg";

/** X-Obj-Attrs projection required for full mapping — bare BREL omits all of these. */
export const ACTIVITY_LOG_ATTRS = "type,description,time_stamp,analyst,internal,action_desc";

const PUBLIC_COMMENT_REL_ATTR = "LOG";

export function mapActivityRow(raw: Record<string, unknown>): UiActivityEntry {
  const idRaw = raw["@id"];
  const id = idRaw !== undefined ? String(idRaw) : "";
  const description = typeof raw["description"] === "string" ? raw["description"] : "";
  const actionDesc = typeof raw["action_desc"] === "string" ? raw["action_desc"] : "";
  const text = description !== "" ? description : actionDesc;
  const author = toFkRef(raw["analyst"] as CaSdmFk | undefined);
  const createdAt = epochSecToIso(raw["time_stamp"] as string | number | null | undefined);
  const kind = deriveKind(raw);
  return { id, kind, author, text, createdAt };
}

function deriveKind(raw: Record<string, unknown>): UiActivityEntry["kind"] {
  const internal = raw["internal"];
  if (internal === 1 || internal === "1") return "internal";
  const type = raw["type"] as CaSdmFk | undefined;
  const relAttr = type?.["@REL_ATTR"];
  if (relAttr !== undefined && String(relAttr) === PUBLIC_COMMENT_REL_ATTR) return "public";
  return "system";
}
