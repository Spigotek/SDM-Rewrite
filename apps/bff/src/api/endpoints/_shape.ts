/**
 * Shared shape helpers for the BFF entity proxy.
 *
 * CA SDM responses arrive in two flavours after `parseSdmResponseBody`:
 *  - Top-level object with `@id` / `@COMMON_NAME` / `@REL_ATTR` (XML attributes
 *    promoted to keys per the upstream JSON renderer convention).
 *  - Nested FK projections same shape: `{ "@id", "@REL_ATTR", "@COMMON_NAME", link: {…} }`.
 *
 * The helpers below produce stable FE-facing shapes:
 *  - Top-level `id` (from `@id`), `displayName` (from `@COMMON_NAME`), `relAttr`.
 *  - FK projections collapse to `{ id, code, label }` where `code = @REL_ATTR`,
 *    `label = @COMMON_NAME` — both coerced to strings to absorb the
 *    `pri.@COMMON_NAME` numeric quirk (§18, real-backend-contracts.md).
 *  - Epoch-second timestamps convert to ISO-8601.
 *
 * Per-entity files compose these helpers; F.5 will align them with
 * `@sdm/api-types` once domain modeller decisions land (cross-chunk D4).
 */

export interface FkRef {
  readonly id: string;
  readonly code: string;
  readonly label: string;
}

export interface CaSdmFk {
  readonly "@id"?: string | number;
  readonly "@REL_ATTR"?: string | number;
  readonly "@COMMON_NAME"?: string | number;
  readonly link?: unknown;
}

export function isFkObject(v: unknown): v is CaSdmFk {
  return Boolean(v && typeof v === "object" && "@id" in (v as Record<string, unknown>));
}

export function toFkRef(raw: CaSdmFk | undefined | null): FkRef | null {
  if (!raw) return null;
  if (raw["@id"] === undefined) return null;
  return {
    id: String(raw["@id"]),
    code: raw["@REL_ATTR"] !== undefined ? String(raw["@REL_ATTR"]) : "",
    label: raw["@COMMON_NAME"] !== undefined ? String(raw["@COMMON_NAME"]) : "",
  };
}

/**
 * CA SDM dates are epoch seconds (§7, §10). Strings (because `parseTagValue:false`)
 * may be empty when the field is absent. Returns null on missing/invalid input.
 */
export function epochSecToIso(raw: string | number | null | undefined): string | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return new Date(n * 1000).toISOString();
}

/** Strip the `@` XML-attribute prefix from top-level keys and lift them. */
export function liftAttrs(raw: Record<string, unknown>): {
  id: string;
  displayName: string;
  relAttr: string;
} {
  return {
    id: raw["@id"] !== undefined ? String(raw["@id"]) : "",
    displayName: raw["@COMMON_NAME"] !== undefined ? String(raw["@COMMON_NAME"]) : "",
    relAttr: raw["@REL_ATTR"] !== undefined ? String(raw["@REL_ATTR"]) : "",
  };
}

/**
 * Build a CA SDM XML body from a FE-shaped JSON payload.
 *  - Flat scalar values become `<key>value</key>`.
 *  - Objects shaped `{ id }` or `{ code }` become FK empty-elements with
 *    `REL_ATTR` per §12.1 (text-content FKs are rejected by the DAL).
 *  - `null` / `undefined` are skipped.
 *
 * @param wrapper outer element name (e.g. "in", "cr", "chg", "KD", "nr")
 * @param fields FE-supplied attribute → value map; FK fields = `{ relAttr: "..." }`
 */
export function toCaSdmXmlBody(wrapper: string, fields: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null) continue;
    if (typeof value === "object" && value !== null) {
      const fk = (value as { relAttr?: unknown }).relAttr;
      if (typeof fk === "string" || typeof fk === "number") {
        parts.push(`<${key} REL_ATTR=${quoteXml(String(fk))}/>`);
      }
      continue;
    }
    parts.push(`<${key}>${escapeXmlText(String(value))}</${key}>`);
  }
  return `<${wrapper}>${parts.join("")}</${wrapper}>`;
}

function escapeXmlText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function quoteXml(s: string): string {
  return `"${s.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}"`;
}

/** URL-encode a CA SDM path segment id, preserving the `U'...'` GUID shape. */
export function encodePkPathSegment(id: string): string {
  return encodeURIComponent(id);
}
