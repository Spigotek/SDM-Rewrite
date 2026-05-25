import type { UiAttachmentMeta } from "@sdm/api-types";
import { epochSecToIso, type CaSdmFk } from "./_shape";

/**
 * Attachment shaping for the ticket-detail aggregator.
 *
 * Per `real-backend-contracts.md §23`, the BREL navigation
 * `/{factory}/{id}/attachments` returns a `collection_lrel_attachments_*` join
 * shape whose rows expose only an `attmnt` FK (`@id` + `@COMMON_NAME`-as-epoch).
 * File metadata (`file_name`, `file_size`, `file_type`, `last_mod_dt`) lives on
 * the `attmnt` factory directly and is fetched in a second step. Dot-projection
 * via `X-Obj-Attrs: attmnt.file_name` is silently ignored upstream.
 *
 * The aggregator pulls the join, then fans out parallel `GET /attmnt/{id}` with
 * the required attribute projection.
 */

/** X-Obj-Attrs for the per-row enrichment fetch. */
export const ATTACHMENT_ROW_ATTRS = "file_name,file_type,file_size,last_mod_dt,last_mod_by";

/** Inner array keys returned by the BREL join — keyed by the parent factory. */
export const LREL_ATTACHMENT_FACTORY = {
  in: "lrel_attachments_requests",
  cr: "lrel_attachments_requests",
  pr: "lrel_attachments_requests",
  chg: "lrel_attachments_changes",
} as const;

export type ParentTicketFactory = keyof typeof LREL_ATTACHMENT_FACTORY;

/**
 * Map a fully-enriched `attmnt` row (after step-2 fetch) to the FE shape.
 * Caller must have hit `/caisd-rest/attmnt/{id}` with `ATTACHMENT_ROW_ATTRS` —
 * dot-projection through the BREL does not populate these fields.
 */
export function mapAttmntRow(raw: Record<string, unknown>): UiAttachmentMeta {
  const idRaw = raw["@id"];
  const id = idRaw !== undefined ? String(idRaw) : "";
  const name = typeof raw["file_name"] === "string" ? raw["file_name"] : "";
  const sizeRaw = raw["file_size"];
  const sizeBytes = sizeRaw === undefined || sizeRaw === null ? null : Number(sizeRaw);
  const fileType = typeof raw["file_type"] === "string" ? raw["file_type"] : null;
  const uploadedAt = epochSecToIso(raw["last_mod_dt"] as string | number | null | undefined);
  return {
    id,
    name,
    mime: deriveMime(fileType),
    sizeBytes: sizeBytes !== null && Number.isFinite(sizeBytes) ? sizeBytes : null,
    uploadedAt,
  };
}

/**
 * Extract attmnt FK ids from a BREL join collection. Skips rows missing the
 * `attmnt` field (a degraded-row signal from upstream).
 */
export function extractAttachmentIds(joinRows: ReadonlyArray<Record<string, unknown>>): string[] {
  const out: string[] = [];
  for (const row of joinRows) {
    const fk = row["attmnt"] as CaSdmFk | undefined;
    if (fk && fk["@id"] !== undefined) {
      out.push(String(fk["@id"]));
    }
  }
  return out;
}

/**
 * Map well-known CA SDM file_type extensions to a best-effort MIME. The set is
 * tight on purpose — unknown extensions return null so the FE icon picker can
 * fall through to a generic icon rather than guessing wrong. Compliance-grade
 * MIME enforcement (sniffing actual bytes) belongs to a Phase G hardening pass
 * per `real-backend-contracts.md §23.4`.
 */
const MIME_TABLE: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  pdf: "application/pdf",
  txt: "text/plain",
  csv: "text/csv",
  xml: "application/xml",
  json: "application/json",
  zip: "application/zip",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

function deriveMime(fileType: string | null): string | null {
  if (!fileType) return null;
  return MIME_TABLE[fileType.toLowerCase()] ?? null;
}
