import { XMLParser } from "fast-xml-parser";

/**
 * Shared CA SDM XML parser options. Must match `auth/sdm-broker.ts` exactly so
 * the BFF has a single canonical convention for upstream payloads:
 *  - XML attributes → keys prefixed with `@` (e.g. id="42" → "@id": "42")
 *  - Element text → string value on the parent object
 *  - Single child element → nested object; repeated children → array
 *  - `parseTagValue:false` keeps numeric-looking strings (`expiration_date`,
 *    `open_date`) as strings — callers do their own coercion.
 */
export const SDM_XML_PARSER_OPTIONS = {
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  processEntities: false,
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
} as const;

const XML_PARSER = new XMLParser(SDM_XML_PARSER_OPTIONS);

/**
 * Parse a CA SDM REST response body into a JS object using the same convention
 * as the upstream JSON renderer. JSON content types pass through `JSON.parse`;
 * XML uses fast-xml-parser configured identically to the auth broker.
 *
 * Bias: per real-backend-contracts.md §9, CA SDM error responses are always XML
 * even when JSON was requested — so on ambiguity (no content-type) the body's
 * first non-whitespace character decides, with XML as the tiebreaker.
 *
 * @throws if the body cannot be parsed as the declared content-type.
 */
export function parseSdmResponseBody(
  body: string,
  contentType: string | null | undefined,
): unknown {
  const ct = (contentType ?? "").toLowerCase();
  if (ct.includes("json")) return JSON.parse(body);
  if (ct.includes("xml")) return XML_PARSER.parse(body, true);
  const firstChar = body.trimStart().charAt(0);
  if (firstChar === "{" || firstChar === "[") return JSON.parse(body);
  return XML_PARSER.parse(body, true);
}
