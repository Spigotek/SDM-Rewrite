/**
 * KB editor HTML sanitization — defense-in-depth wrapper around
 * `isomorphic-dompurify` (works in both browser + Node so the same allowlist
 * applies on the BFF `kb-write.ts` path).
 *
 * The allowlist is the structured-content surface that survives the
 * `react-markdown` + `rehype-sanitize` pipeline used by the H.6 portal and
 * H.9 workspace markdown renderers — every tag the editor emits has a
 * markdown equivalent the read surface can render.
 *
 * Source: `docs/agents/security/owasp-mitigations.md §A03 Markdown sanitizer
 * whitelist` + `library-recommendation.md §17`.
 *
 * The Browser test journey #13 injects `<script>alert(1)</script>` and
 * asserts the published article contains neither the tag nor the inline
 * handler — the test is the canonical contract for this allowlist.
 */
import DOMPurify from "isomorphic-dompurify";

const ALLOWED_TAGS = [
  "p",
  "br",
  "h1",
  "h2",
  "h3",
  "h4",
  "ul",
  "ol",
  "li",
  "strong",
  "em",
  "u",
  "s",
  "code",
  "pre",
  "blockquote",
  "a",
  "img",
  "table",
  "thead",
  "tbody",
  "tr",
  "td",
  "th",
  "hr",
  "span",
] as const;

const ALLOWED_ATTR = ["href", "src", "alt", "title", "target", "rel", "class"] as const;

const FORBID_ATTR = [
  "onerror",
  "onload",
  "onclick",
  "onmouseover",
  "onfocus",
  "onblur",
  "onchange",
  "onsubmit",
  "onkeydown",
  "onkeyup",
  "style",
] as const;

const FORBID_TAGS = ["script", "style", "iframe", "object", "embed", "form", "input"] as const;

/**
 * Sanitize a rich-text HTML payload (TipTap `getHTML()` output, or any
 * server-received `body_html` chunk). Returns a safe HTML string with all
 * inline handlers stripped, `javascript:` URIs blocked, and the tag set
 * collapsed to the markdown-equivalent allowlist.
 */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [...ALLOWED_TAGS],
    ALLOWED_ATTR: [...ALLOWED_ATTR],
    FORBID_ATTR: [...FORBID_ATTR],
    FORBID_TAGS: [...FORBID_TAGS],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|\/|#)/i,
    KEEP_CONTENT: true,
  });
}

/**
 * Sanitize a canonical-markdown payload. Markdown itself is mostly safe (the
 * `react-markdown` renderer doesn't enable `unsafe`), but we still strip the
 * two attack-prone surfaces: raw HTML script tags inside the markdown source
 * and the `javascript:` URL scheme inside links. The remaining markdown is
 * passed through unchanged so the canonical body roundtrips byte-for-byte.
 */
export function sanitizeMarkdown(markdown: string): string {
  // Remove `<script>` / `<style>` blocks and any raw HTML on/handler attrs.
  // DOMPurify normalises the input as HTML — we re-stringify the sanitized
  // tree to lift script/style chunks while leaving plain markdown intact.
  const stripped = DOMPurify.sanitize(markdown, {
    ALLOWED_TAGS: [...ALLOWED_TAGS],
    ALLOWED_ATTR: [...ALLOWED_ATTR],
    FORBID_ATTR: [...FORBID_ATTR],
    FORBID_TAGS: [...FORBID_TAGS],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|\/|#)/i,
    KEEP_CONTENT: true,
    USE_PROFILES: { html: true },
  });
  // Belt-and-suspenders for markdown link syntax: `[text](javascript:…)` —
  // DOMPurify wouldn't catch this because the markdown source isn't HTML
  // until rendered. The regex matches the link target inside `()`.
  return stripped.replace(/\]\((\s*javascript:[^)]*)\)/gi, "](#)");
}
