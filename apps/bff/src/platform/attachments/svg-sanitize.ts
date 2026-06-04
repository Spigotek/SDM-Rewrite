/**
 * SVG-safe sanitizer using the existing `sanitize-html` dependency.
 *
 * Strict allowlist approach: only SVG primitive tags survive; anything that
 * can carry executable code (script, foreignObject, iframe, use with
 * dangerous href, event handlers) is stripped.
 *
 * Cross-checked against OWASP SVG XSS vectors (H5SC / cure53):
 *   - <script> → not in ALLOWED_TAGS → removed with text content
 *   - <foreignObject> → not in ALLOWED_TAGS → removed
 *   - <iframe> → not in ALLOWED_TAGS → removed
 *   - on* event handlers → only safelisted attributes survive
 *   - xlink:href="javascript:..." → transformTags strips dangerous schemes
 *   - href="javascript:..." → allowedSchemes restricts to fragment-only on <use>/<a>
 *   - <animate> with href → not in ALLOWED_TAGS → removed
 *   - <set> attributeName="href" → not in ALLOWED_TAGS → removed
 *   - data: URIs in image src → not in allowedSchemes → stripped
 *   - style attribute → not in allowed per-tag attrs → stripped
 *   - CSS expression() in style → style not allowed anyway
 */
import sanitizeHtml from "sanitize-html";

const ALLOWED_TAGS: string[] = [
  "svg",
  "g",
  "path",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "text",
  "tspan",
  "title",
  "desc",
  "defs",
  "linearGradient",
  "radialGradient",
  "stop",
  "use",
  "symbol",
  "marker",
  "pattern",
  "clipPath",
  "mask",
  "image",
];

/**
 * Per-tag attribute allowlist.
 *
 * `"*"` catches shared structural attributes valid on any SVG element.
 * `use` / `image` need href (fragment-only for use; http(s) for image) —
 * dangerous schemes are stripped by the `allowedSchemes` + transform.
 *
 * NO event handlers (on*), NO style (CSS injection), NO class unless needed.
 * Note: xlink:href is a namespace-prefixed attribute; sanitize-html strips
 * unknown namespaced attributes by default.
 */
const ALLOWED_ATTRIBUTES: sanitizeHtml.IOptions["allowedAttributes"] = {
  "*": [
    "id",
    "xmlns",
    "xmlns:xlink",
    "xml:space",
    "viewBox",
    "width",
    "height",
    "x",
    "y",
    "x1",
    "y1",
    "x2",
    "y2",
    "fill",
    "fill-opacity",
    "fill-rule",
    "stroke",
    "stroke-width",
    "stroke-opacity",
    "stroke-linecap",
    "stroke-linejoin",
    "stroke-dasharray",
    "stroke-dashoffset",
    "opacity",
    "d",
    "points",
    "cx",
    "cy",
    "r",
    "rx",
    "ry",
    "transform",
    "gradientUnits",
    "gradientTransform",
    "offset",
    "stop-color",
    "stop-opacity",
    "clip-path",
    "mask",
    "marker-start",
    "marker-end",
    "marker-mid",
    "patternUnits",
    "patternTransform",
    "markerWidth",
    "markerHeight",
    "markerUnits",
    "refX",
    "refY",
    "orient",
    "preserveAspectRatio",
    "font-size",
    "font-family",
    "font-weight",
    "text-anchor",
    "dominant-baseline",
    "color",
  ],
  use: ["href", "xlink:href"],
  image: ["href", "xlink:href"],
  a: ["href"],
};

/** Strip dangerous href schemes from <use> and <image>. */
function stripDangerousHref(tagName: string, attribs: Record<string, string>): sanitizeHtml.Tag {
  const href = attribs["href"] ?? attribs["xlink:href"] ?? "";
  const safe = isSafeHref(tagName, href);
  const cleaned: Record<string, string> = {};
  for (const [k, v] of Object.entries(attribs)) {
    if ((k === "href" || k === "xlink:href") && !safe) continue;
    cleaned[k] = v;
  }
  return { tagName, attribs: cleaned };
}

/** <use> must only reference same-document fragments (#id). <image> allows https. */
function isSafeHref(tagName: string, href: string): boolean {
  const trimmed = href.trim();
  if (!trimmed) return false;
  if (tagName === "use") return trimmed.startsWith("#");
  // <image> and <a>: allow http(s) and relative paths; block javascript:/data:
  if (/^javascript:/i.test(trimmed)) return false;
  if (/^data:/i.test(trimmed)) return false;
  if (/^vbscript:/i.test(trimmed)) return false;
  return true;
}

/**
 * Sanitize an SVG string using the strict image-safe allowlist.
 * Returns the sanitized SVG string (may be empty if the input was not SVG).
 */
export function sanitizeSvg(text: string): string {
  return sanitizeHtml(text, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    allowedSchemes: ["http", "https"],
    allowedSchemesAppliedToAttributes: ["href", "xlink:href"],
    allowProtocolRelative: false,
    // sanitize-html strips text content of these dangerous tags:
    nonTextTags: ["script", "style", "iframe", "noscript"],
    // SVG tag names are case-sensitive (e.g. linearGradient); do NOT lowercase.
    parser: { lowerCaseTags: false },
    transformTags: {
      use: (tagName, attribs) => stripDangerousHref(tagName, attribs),
      image: (tagName, attribs) => stripDangerousHref(tagName, attribs),
      a: (tagName, attribs) => stripDangerousHref(tagName, attribs),
    },
  });
}
