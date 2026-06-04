# J.5 — KB image upload binary (graduates H.3 attachments deferral)

> **Status**: ✅ DONE (squash `d6bf6be`, PR #51)
> **Branch**: `chunk/J.5-kb-image-upload` (deleted)
> **Outcome**: BFF `POST /api/attachments/kb` multipart upload + `GET /api/attachments/kb/:id`
> serve shipped. 5 MB Hono `bodyLimit`. Magic-number sniff (PNG/JPG/GIF/SVG) is authoritative;
> client `Content-Type` is cross-checked AFTER sniff — mismatch returns 400. JPG: APP markers
> stripped (EXIF/IPTC/XMP/vendor) via hand-rolled `stripJpgMetadata` (~93 LOC, no dep). SVG:
> strict `sanitize-html` allowlist (no script, no foreignObject, no event handlers, no
> dangerous xlink:href). ULID attachment IDs with strict regex validation BEFORE `fs` ops —
> path traversal defended. Storage keyed by `(tenantId, attachmentId)`; extension derived from
> sniffed MIME, not client filename. Audit composed under existing `data.kb.write` factory +
> `details.op="attachment.upload"` (F.4 frozen taxonomy honoured). GET handler returns 404
> (never 403) on cross-tenant miss — caller cannot distinguish "not in tenant" from "does
> not exist". Permission `kb.write` (correct disk reality; plan's `kb.edit` was aspirational
> — `kb.write` is what I.4 kb-write.ts uses + permissions.ts taxonomy lists). Workspace
> TipTap editor gained drag-drop + paste-clipboard handlers via new `upload.ts` helper +
> `EditorShell` mod (66 LOC route + 51 LOC shell). Drop-zone hover state in `kb.css`. MSW
> handler returns inline `data:` URI for dev parity. **41 BFF cases** (attachments-kb ×14,
> magic-sniff ×11, exif-strip ×7, svg-sanitize ×9) + browser scenario `j5-kb-image-upload`
> ×3 specs. **No new runtime deps** (existing `sanitize-html` 2.17.4 reused; hand-rolled
> magic sniff + EXIF strip). Workspace initial JS gzip unchanged (upload code in lazy
> `vendor-editor` chunk from I.4). CHANGELOG Known issues entry "KB editor image upload"
> struck through. H.3 deferral comment in `NewIncidentForm.tsx:41-46` narrowed (incident
> attachments stay v1.2+). 24 files / 2059 ins / 17 del. All CI green (acceptance × 3
> browsers, lint+typecheck+test+build, CodeQL × 2, Trufflehog, helm chart lint, security
> browser scenarios).
> **Cieľ**: ship binary image upload for KB editor — `POST /api/attachments/kb` multipart
> endpoint with 5 MB size cap, magic-number-validated MIME (PNG / JPG / SVG / GIF whitelist),
> SVG sanitization via existing `sanitize-html`, JPG EXIF strip (manual APP-marker drop, no
> new runtime deps), file-system storage under configurable path, `GET /api/attachments/kb/:id`
> serve handler. TipTap editor (I.4) gains drag-drop + paste-from-clipboard upload that hits
> the endpoint and inserts the returned URL. Graduates H.3 attachment deferral comment in
> `NewIncidentForm.tsx` (kept in scope for KB only — incident attachments stay deferred to
> v1.2+).

## Pivot vs ROADMAP

H.3 (PR #30) deferred attachments: "Attachments deferred per user default — TODO comment v
`NewIncidentForm.tsx:41-46` references future scope (BFF multipart endpoint + virus-scan
policy + DS FileUpload primitive)." J.5 closes the KB half of that — incident attachments
stay deferred (separate scope; user upload pattern in portal differs from KB editor pattern
in workspace).

I.4 (PR #45) KB editor shipped with image insertion via URL paste only — no binary upload.
J.5 wires the binary path.

J.md / ROADMAP J.5 entry: "graduates H.3 attachments deferral; `/api/attachments/kb` endpoint,
5 MB max, PNG/JPG/SVG/GIF whitelist, EXIF strip, MIME sniff."

## Inputs

- **`apps/workspace/src/features/kb/editor/`** — I.4 TipTap editor. Image insertion via
  current "insert image" toolbar button uses URL paste; J.5 adds drag-drop + paste-clipboard
  handlers calling the new upload endpoint, then inserts the returned URL.
- **`apps/bff/src/api/routes.ts`** — registration site for `/api/attachments/kb/*` routes.
- **`apps/bff/src/api/endpoints/knowledge.ts` (H.6 + I.4 surface)** — confirms KB endpoint
  patterns. No direct dep — attachments routes live in their own file.
- **`apps/bff/src/platform/audit/events.ts`** — frozen taxonomy. Upload audited via existing
  `data.kb.write` with `details.op: "attachment.upload"` discriminator (no new event name).
- **`packages/api-mocks/src/handlers/knowledge.ts`** — I.4 KB write handlers (draft / publish).
  J.5 adds attachments handlers under `packages/api-mocks/src/handlers/attachments.ts`.
- **`apps/portal/src/features/incidents/NewIncidentForm.tsx` lines 41-46** — H.3 deferral TODO
  comment. J.5 narrows comment to "incident attachments still deferred; KB attachments
  shipped in J.5".
- **`apps/bff/package.json`** — deps inventory: existing `sanitize-html` reused for SVG.
  **No new runtime deps**.
- **`docs/agents/devex-devops/runtime-config.md`** — add `BFF_ATTACHMENTS_DIR` env var entry.
- **Memory `feedback_pr_flow.md`** — PR-per-chunk discipline.

## Outputs

```
apps/bff/src/api/endpoints/attachments-kb.ts        # NEW: POST /api/attachments/kb (upload) + GET /api/attachments/kb/:id (serve)
apps/bff/src/platform/attachments/                  # NEW dir
├── magic-sniff.ts                                  # NEW: manual magic-number → MIME detection (PNG/JPG/SVG/GIF)
├── exif-strip.ts                                   # NEW: manual JPG APP-marker drop (no dep)
├── svg-sanitize.ts                                 # NEW: sanitize-html wrapper with image-safe schema (no script, no event handlers, no foreign elements)
└── storage.ts                                      # NEW: file-system put/get/delete under BFF_ATTACHMENTS_DIR
apps/bff/src/config/schema.ts                       # MOD: + BFF_ATTACHMENTS_DIR runtime config field (default ./.attachments-kb in dev, /var/lib/sdm/attachments in prod)
apps/bff/src/api/routes.ts                          # MOD: register attachments-kb routes
apps/bff/tests/attachments-kb.test.ts               # NEW: 12+ cases (happy uploads × 4 formats, size limit, mime mismatch, magic-number rejection, SVG sanitize, JPG EXIF strip, path traversal block, GET serve happy + 404, auth gate)
apps/bff/tests/magic-sniff.test.ts                  # NEW: 6+ cases (each format magic match; mismatched ext+content; truncated buffer)
apps/bff/tests/exif-strip.test.ts                   # NEW: 4+ cases (no APP markers, single APP1, multiple APPx, no-op for non-JPG buffers)
apps/bff/tests/svg-sanitize.test.ts                 # NEW: 5+ cases (clean svg passes, script stripped, event handler stripped, foreignObject stripped, href javascript: stripped)

apps/workspace/src/features/kb/editor/upload.ts     # NEW: uploadKbImage(file) → Promise<{url, mime, sizeBytes}>; binds drag-drop + paste handlers
apps/workspace/src/features/kb/editor/KbEditorRoute.tsx  # MOD: wire drop-zone + paste handler onto TipTap container; insert image with returned URL
apps/workspace/src/features/kb/kb.css               # MOD: + drop-zone hover state

packages/api-mocks/src/handlers/attachments.ts      # NEW: MSW POST /api/attachments/kb mock — accepts FormData, validates, returns synthetic URL pointing at data: URI of resized stub
packages/api-mocks/src/handlers/index.ts            # MOD: export attachments handlers

packages/i18n/catalogs/workspace/{sk,en}.json       # +6 keys: kb.editor.upload.dropZone / kb.editor.upload.uploading / kb.editor.upload.error.size / kb.editor.upload.error.mime / kb.editor.upload.error.svg / kb.editor.upload.error.generic

tools/browser-test/scenarios/j5-kb-image-upload.spec.ts  # NEW: 2-3 cases (upload PNG via drag-drop → URL inserted; upload >5 MB → error toast; upload .exe disguised as .png → error toast)

docs/agents/devex-devops/runtime-config.md          # MOD: + BFF_ATTACHMENTS_DIR section
docs/CHANGELOG.md                                   # MOD: Known issues — KB image upload entry struck through (now shipped); incident attachments entry remains
docs/ROADMAP.md                                     # J.5 ⏳ → ✅ DONE; Aktuálny stav updated
docs/plans/J.5.md                                   # Status NEXT → DONE; PR #
```

**No new runtime deps.** All validation + EXIF strip + SVG sanitize done with existing
`sanitize-html` and hand-rolled byte-level helpers.

## Done-when

- [ ] BFF `POST /api/attachments/kb`: - Requires active session + `kb.edit` permission. 401/403 otherwise. - Body limit 5 MB (Hono `bodyLimit({ maxSize: 5 * 1024 * 1024 })`) — 413 over. - Reads multipart `file` field via `c.req.formData()`. - Magic-number sniff on the first ≤ 12 bytes — accepts PNG (`89 50 4E 47 0D 0A 1A 0A`),
      JPG (`FF D8 FF`), GIF (`47 49 46 38 [37|39] 61`), SVG (text starting with `<svg` or
      `<?xml` + `<svg` within first 1 KB). Reject everything else with 415 +
      `code: ATTACHMENT_UNSUPPORTED_MIME` + `details.detected_mime` field. - Cross-check the client-supplied Content-Type against the sniffed MIME — mismatch
      (e.g. `Content-Type: image/png` but magic says JPG) → 400 +
      `code: ATTACHMENT_MIME_MISMATCH`. - For JPG: strip APP markers (`FF E0`-`FF EF` blocks) before persisting — removes EXIF + Photoshop / XMP / vendor metadata. - For SVG: load text body, run `sanitize-html` with strict image-safe schema (allow
      only the SVG primitive tags + `xmlns`, `viewBox`, `width`, `height`, `fill`, `stroke`,
      `d`, `points`, `cx`/`cy`/`r`, etc. — NO `script`, `foreignObject`, `iframe`, event
      handlers, `xlink:href` with `javascript:` or `data:text/html`). - Generate opaque attachment ID (ULID per G.3 standard). - Write sanitized + stripped bytes to `<BFF_ATTACHMENTS_DIR>/<tenantId>/<attachmentId>.<ext>` (extension derived from sniffed MIME, NOT client filename — defends against path-traversal via crafted filenames). - Emit audit `data.kb.write` with `details.op: "attachment.upload"`,
      `details.attachment_id`, `details.mime`, `details.size_bytes` (composed under frozen
      F.4 taxonomy — NO new event name). - Return `201 + { id, url: "/api/attachments/kb/<id>", mime, sizeBytes }`.
- [ ] BFF `GET /api/attachments/kb/:id`: - Requires active session (no specific permission — visible to anyone who can read KB). - Looks up `<BFF_ATTACHMENTS_DIR>/<tenantId>/<id>.<ext>` for the session's active tenant. - 404 if not found; **never** 403 (tenant-isolation already enforced via path). - Streams file with appropriate `Content-Type` + `Content-Disposition: inline` +
      `Cache-Control: public, max-age=86400` (1 day; attachments are immutable once written).
- [ ] BFF runtime config: `BFF_ATTACHMENTS_DIR` (default: `./.attachments-kb` in dev,
      `/var/lib/sdm/attachments-kb` in container). Documented in `runtime-config.md`.
- [ ] FE `apps/workspace/src/features/kb/editor/upload.ts`: - `uploadKbImage(file: File): Promise<{url, mime, sizeBytes}>` — POST multipart to
      BFF; throws typed `AttachmentError` on 4xx with code from response. - Pre-upload guard: reject files > 5 MB client-side with toast (avoid round-trip). - Pre-upload guard: reject non-whitelisted MIME (client-side; server enforces too).
- [ ] FE TipTap integration: - Drag-and-drop on editor container → `uploadKbImage` → insert image with returned URL. - Paste from clipboard (DataTransfer items with `kind === "file"` + `type.startsWith("image/")`)
      → same path. - Show inline progress indicator (small spinner overlay) during upload. - On error: show toast with i18n message; do NOT insert broken image.
- [ ] MSW `POST /api/attachments/kb` mock: accepts FormData, validates size + MIME, returns
      synthetic URL pointing at a tiny inline `data:` URI of a coloured placeholder (so dev /
      browser tests don't depend on real file I/O).
- [ ] Browser test `j5-kb-image-upload.spec.ts`: 2-3 cases per Done-when last bullet.
- [ ] `pnpm i18n:check` green (+6 `kb.editor.upload.*` keys SK + EN).
- [ ] Bundle budgets: workspace ≤ 350 KB initial JS gzip. Upload code is part of
      `vendor-editor` chunk (lazy-loaded with TipTap from I.4); initial bundle unchanged.
- [ ] `pnpm typecheck` + `pnpm lint` + `pnpm test` green.
- [ ] CI green: ci.yml + acceptance.yml + security.yml (CodeQL must not flag the new
      sanitize-html call or magic-number reader as security findings).

## Stratégia

### Fáza A — BFF magic-sniff + EXIF strip + SVG sanitize utilities

1. `apps/bff/src/platform/attachments/magic-sniff.ts`:

   ```ts
   export type DetectedMime = "image/png" | "image/jpeg" | "image/gif" | "image/svg+xml";

   const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
   const JPG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);
   const GIF87_MAGIC = Buffer.from("GIF87a");
   const GIF89_MAGIC = Buffer.from("GIF89a");

   export function sniffMime(buf: Buffer): DetectedMime | null {
     if (buf.length >= 8 && buf.subarray(0, 8).equals(PNG_MAGIC)) return "image/png";
     if (buf.length >= 3 && buf.subarray(0, 3).equals(JPG_MAGIC)) return "image/jpeg";
     if (buf.length >= 6) {
       const head6 = buf.subarray(0, 6);
       if (head6.equals(GIF87_MAGIC) || head6.equals(GIF89_MAGIC)) return "image/gif";
     }
     // SVG: text-based, find <svg or <?xml ... <svg in first 1KB
     const head = buf.subarray(0, Math.min(1024, buf.length)).toString("utf8");
     if (/^\s*(?:<\?xml[^?]*\?>\s*)?<svg[\s>]/i.test(head)) return "image/svg+xml";
     return null;
   }
   ```

2. `apps/bff/src/platform/attachments/exif-strip.ts`:
   ```ts
   /**
    * Strip JPG APP markers (FF E0 ... FF EF) which carry EXIF / IPTC / XMP / vendor metadata.
    * Operates on raw JPG buffer; no-ops on non-JPG (returns input unchanged).
    *
    * Algorithm: walk the marker stream after SOI (FF D8), drop APP markers + their length-
    * prefixed payloads, keep everything else byte-for-byte. Scan stops at SOS (FF DA) — image
    * data follows and contains no further metadata markers (well, no APP markers).
    */
   export function stripJpgMetadata(buf: Buffer): Buffer {
     /* ~50 LOC */
   }
   ```
3. `apps/bff/src/platform/attachments/svg-sanitize.ts`:

   ```ts
   import sanitizeHtml from "sanitize-html";

   const ALLOWED_TAGS = [
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
   ];
   const ALLOWED_ATTRS_BY_TAG = {
     /* per-tag whitelist; NO event handlers, NO xlink:href with non-fragment values */
   };

   export function sanitizeSvg(text: string): string {
     return sanitizeHtml(text, {
       allowedTags: ALLOWED_TAGS,
       allowedAttributes: ALLOWED_ATTRS_BY_TAG,
       parser: { lowerCaseTags: false }, // SVG is case-sensitive
       transformTags: {
         // strip any xlink:href with javascript:/data:text/html
         use: stripDangerousHref,
         a: stripDangerousHref,
       },
     });
   }
   ```

4. Unit tests for each (`apps/bff/tests/magic-sniff.test.ts`, etc.).

### Fáza B — BFF upload + serve endpoints

1. `apps/bff/src/platform/attachments/storage.ts`:
   ```ts
   export class AttachmentStorage {
     constructor(private readonly baseDir: string) {}
     async put(tenantId: string, attachmentId: string, mime: DetectedMime, bytes: Buffer): Promise<void> { ... }
     async get(tenantId: string, attachmentId: string): Promise<{mime: DetectedMime; bytes: Buffer} | null> { ... }
     async delete(tenantId: string, attachmentId: string): Promise<void> { ... }
   }
   ```
   - File path: `<baseDir>/<tenantId>/<attachmentId>.<ext>`. Tenant ID + attachment ID both
     ULID — safe path components (alphanumeric + uppercase).
   - On `put`: `fs.mkdir(recursive)` + `fs.writeFile`.
   - Defends path traversal via strict ID validation (regex `^[0-9A-HJKMNP-TV-Z]{26}$`).
2. `apps/bff/src/api/endpoints/attachments-kb.ts`:
   - Hono handler chains `bodyLimit(5 MB)` + `requireActiveSession` + `requirePermission("kb.edit")` for POST.
   - Parses FormData, extracts `file` field, validates size + magic-number + MIME match + SVG/JPG processing.
   - Persists via storage.
   - Emits audit.
   - Returns 201.
   - GET handler: `requireActiveSession` only, looks up by tenant + id, streams response.
3. `apps/bff/src/api/routes.ts`: register the routes after KB analytics (alphabetical order).
4. `apps/bff/src/config/schema.ts`: add `attachments: { kbDir: string }` field.
5. Tests: `apps/bff/tests/attachments-kb.test.ts` ≥ 12 cases per Done-when matrix.

### Fáza C — FE TipTap drag-drop + paste + MSW

1. `apps/workspace/src/features/kb/editor/upload.ts`:
   ```ts
   export class AttachmentError extends Error {
     constructor(
       public code: string,
       message: string,
     ) {
       super(message);
     }
   }
   export async function uploadKbImage(file: File): Promise<UploadResult> {
     if (file.size > 5 * 1024 * 1024) throw new AttachmentError("ATTACHMENT_TOO_LARGE", "...");
     if (!["image/png", "image/jpeg", "image/gif", "image/svg+xml"].includes(file.type))
       throw new AttachmentError("ATTACHMENT_UNSUPPORTED_MIME", "...");
     const fd = new FormData();
     fd.append("file", file);
     const r = await fetch("/api/attachments/kb", {
       method: "POST",
       body: fd,
       credentials: "include",
     });
     if (!r.ok) {
       const e = await r.json().catch(() => ({}));
       throw new AttachmentError(e.code ?? "UPLOAD_ERROR", e.message ?? "Upload failed");
     }
     return r.json() as Promise<UploadResult>;
   }
   ```
2. `apps/workspace/src/features/kb/editor/KbEditorRoute.tsx` MOD:
   - Bind `onDrop` + `onPaste` to the TipTap editor container.
   - On valid file event: `uploadKbImage(file)` → `editor.commands.setImage({ src: result.url, alt: file.name })`.
   - Show small spinner overlay during upload (CSS-only, no new component).
   - On `AttachmentError`: toast with i18n message keyed off `error.code`.
3. `packages/api-mocks/src/handlers/attachments.ts`:
   - `http.post("*/api/attachments/kb", ...)` → validate size + MIME (same shape as BFF),
     return `{id, url: "data:image/png;base64,iVBORw0K...", mime, sizeBytes}` for dev parity.
4. `apps/workspace/src/features/kb/kb.css`: drop-zone hover style (border colour, slight
   background tint).
5. Browser test `j5-kb-image-upload.spec.ts`: 3 specs (happy PNG, size > 5 MB, fake .png
   header but garbage body via JS-constructed File).

### Fáza D — Docs + PR

1. Update `docs/agents/devex-devops/runtime-config.md` + add to deploy `values-staging.yaml`
   (`bff.env.BFF_ATTACHMENTS_DIR: "/var/lib/sdm/attachments-kb"`) — BUT no new helm template
   needed if env var defaults work; document the volume mount requirement as a Known issue
   for J.0 re-open (PVC for attachments persistence post-restart).
2. Update H.3 deferral comment in `NewIncidentForm.tsx` lines 41-46 — narrow scope to
   "incident attachments still deferred; KB attachments shipped in J.5 (PR # TBD)".
3. CHANGELOG Known issues: strike through "KB editor image upload — markdown URL paste only;
   binary upload deferred to v1.1+" (now done).
4. PR `feat(kb): binary image upload via POST /api/attachments/kb (J.5)`.
5. Subagent does NOT merge. Parent verifies CI + merges.

### Fáza E — Post-merge

Parent updates ROADMAP J.5 → ✅ DONE + J.6 NEXT + commit `docs(J.5): refresh PR # + status after merge`.

## Open questions / risks — recommended resolutions

- **SVG XSS via foreign elements / namespaces** — `sanitize-html` with strict
  allowlist (no script, no foreignObject, no iframe, no xlink:href with non-fragment values)
  is the industry-standard approach. Cross-check the tag/attr allowlist against OWASP SVG
  cheat sheet during implementation. Add test cases for every attack vector from the cheat
  sheet.
- **EXIF strip correctness** — manual APP-marker drop is sufficient for the EXIF + IPTC + XMP
  cases (all use APP1/APP13/APP14). It is **not** sufficient for very exotic metadata
  embedded inside the JPEG body (extremely rare; not a privacy concern in practice). Document
  the limitation in `exif-strip.ts` header.
- **Multi-instance file storage** — `BFF_ATTACHMENTS_DIR` is a local directory; multi-instance
  BFF deploys need a shared mount (NFS / EFS) or migration to object storage (S3) — v2.0
  scope. Helm chart should provision a PVC when J.0 cluster comes online; document as Known
  issue tied to J.0 unblock.
- **Orphan attachments** — when a KB article is deleted, attachments remain on disk. v1.1
  ships without sweep (manual cleanup acceptable on dev/test); v2.0 should add a periodic
  garbage collection job. Document.
- **Path traversal via crafted IDs** — defended by strict ULID regex validation. Add test
  case: `GET /api/attachments/kb/../../etc/passwd` → 400.
- **GIF animation safety** — GIF is allowed; animation payload is harmless in `<img>` context.
  No special handling needed.
- **PNG iTXt / tEXt metadata** — PNG can carry text chunks with arbitrary data. Low privacy
  risk (most PNG screenshot tools don't write metadata) + non-trivial to strip without a
  dep. **Recommendation**: defer PNG metadata strip to v1.2 with a Known issues entry.
  Document scope.
- **`kb.attachments.view` permission** — none introduced. Anyone with active session + tenant
  scope can fetch via GET. Justification: KB articles are visible to KB readers; embedded
  images should be too. If KB visibility differs per article (private vs public), the article
  permission already gates the URL — images inherit via referrer-based UX.
- **Rate limiting on uploads** — 5 MB × 100 req/s = 500 MB/s flood potential. **Recommendation**:
  add basic per-session rate limit (10 uploads / 60 s) in this chunk — small Hono middleware,
  no dep. If subagent finds it bloats scope, defer to J.5.1 follow-up.
- **TipTap image extension** — I.4 wired `@tiptap/extension-image`; verify it's still in the
  bundle (likely yes per `vendor-editor` chunk). Subagent should verify before assuming.

## Notes pre subagenta

- **Subagent NESMIE**:
  - Add any new runtime dep (`file-type`, `piexifjs`, `sharp`, etc.) — use hand-rolled magic
    sniff + EXIF strip + existing `sanitize-html` only. If a hand-rolled implementation feels
    too large or risky, STOP and report — escalate to parent.
  - Touch incident attachments (`apps/portal/src/features/incidents/`) beyond updating the
    H.3 TODO comment narrowing.
  - Add S3 / object storage path — v2.0 scope.
  - Add virus scanning — v1.2+ scope.
  - Mergovať vlastný PR.
- **Subagent musí**:
  - Validate magic numbers BEFORE the client-supplied Content-Type. Never trust client headers.
  - Strict SVG sanitizer allowlist + at least 5 attack-vector test cases.
  - Audit emit composed under existing `data.kb.write` with `details.op: "attachment.upload"`.
  - Path components (tenant ID + attachment ID) validated against strict ULID regex BEFORE
    use in `fs` operations.
  - GET handler must not 403; tenant isolation via path lookup (404 if cross-tenant).
  - Single squash-friendly PR commit `feat(kb): binary image upload via POST /api/attachments/kb (J.5)`.
- **READ FIRST** (subagent should read these before editing):
  - `docs/plans/J.5.md` (this file) end-to-end
  - `apps/bff/src/api/endpoints/kb-analytics.ts` (recent endpoint pattern with permission check)
  - `apps/bff/src/api/endpoints/admin-tenants.ts` (J.3 pattern for audit emit composition)
  - `apps/bff/src/auth/tenant-suspension.ts` (session.activeTenantId pattern)
  - `apps/workspace/src/features/kb/editor/KbEditorRoute.tsx` (TipTap mount point)
  - `apps/bff/package.json` (existing deps inventory — `sanitize-html` is there)
  - `docs/plans/I.4.md` (KB editor baseline)
  - `docs/plans/H.3.md` (attachment deferral original scope)
  - [OWASP SVG cheat sheet — XSS attack vectors](https://github.com/cure53/H5SC)
