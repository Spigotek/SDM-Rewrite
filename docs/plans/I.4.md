# I.4 — KB authoring (TipTap + DOMPurify + publish + visibility + analytics)

> **Status**: ✅ DONE (squash `bb06931`, PR #45)
> **Branch**: `chunk/I.4-kb-authoring` (deleted)
> **Outcome**: H.15 workspace KB graduated read-only → full write. `/kb/editor` + `/kb/editor/:id` + `/kb/analytics` routes (gated `kb.edit`/`kb.analytics`). TipTap 2.27 lazy chunk `vendor-editor` 127.89 KB gz (cap raised 120→130). Markdown canonical persist via hand-rolled bridge. Sanitizer dep pivot BFF + MSW: `isomorphic-dompurify` → `sanitize-html` (CI Node 22 ESM resolution issue v `html-encoding-sniffer` transitive + CodeQL incomplete-multi-character-sanitization findings v pôvodnom regex). FE keeps DOMPurify. BFF kb-write endpoints (POST/PATCH/DELETE/draft/publish/analytics) + 12 cases. MSW write/draft/publish/analytics handlers + draft localStorage store + `x-msw-user-id` persona header (reusable v I.5). Journeys #13/#14/#15 graduated `deferred/partial → pass`. `@security:kb-markdown-sanitization` covered.
> **Cieľ**: rozšíriť H.15 workspace KB z read-only na full write — TipTap editor
> route `/kb/editor` + `/kb/editor/:id`, DOMPurify sanitization pipeline, publish
> flow s visibility selector (public / tenant / sp_only), draft auto-save,
> analytics dashboard (top-10 articles / bottom-5 / search-miss). Closes journeys
> #13 (kb-author-new), #14 (kb-from-incident, publish-from-editor portion),
> #15 (kb-analytics-review).

## Pivot vs ROADMAP

ROADMAP §v1 scope: "KB editor (write/publish)" je explicitne v1+, **pulled-in**
do Phase I aby zatvorilo journeys #13/#14/#15.

H.15 implementoval read-only — Edit/New buttons hidden via
`<Can permission="kb.edit" fallback={null}>`. I.4 doplní actual editor surface +
mutations + analytics.

## Inputs

- **`docs/spec/knowledge-management.md`** — autoritatívne KB feature spec.
- **`docs/agents/ux-persona-analyst/wireframes/workspace/04-kb-editor.md`** — editor wireframe.
- **`docs/agents/security/owasp-mitigations.md` §XSS** — DOMPurify allowlist.
- **`docs/agents/qa-test-strategy/acceptance-criteria.md` §journey-13/14/15`** — primary acceptance.
- **`apps/workspace/src/features/kb/`** — H.15 baseline (read-only).
- **`packages/api-mocks/src/handlers/knowledge.ts`** — H.6/H.15 MSW handler (read-side).
- **`apps/bff/src/api/endpoints/kb.ts`** — F.2 entity proxy (read-side); needs write augmentation.

## Outputs

```
apps/workspace/src/features/kb/editor/             # NEW dir
├── KbEditorRoute.tsx                              # /kb/editor (new) + /kb/editor/:id (existing)
├── components/
│   ├── EditorShell.tsx                            # TipTap editor wrapper + toolbar
│   ├── EditorToolbar.tsx                          # bold/italic/heading/list/link/table/image/code
│   ├── VisibilitySelector.tsx                     # public / tenant-scoped / sp_only
│   ├── PublishModal.tsx                           # confirm publish + visibility + tags
│   ├── DraftAutoSave.tsx                          # debounced auto-save indicator
│   └── KbAnalyticsRoute.tsx                       # /kb/analytics dashboard
├── lib/
│   ├── tiptap-extensions.ts                       # configured TipTap extensions
│   ├── sanitizer.ts                               # DOMPurify wrapper + allowlist
│   └── markdown-bridge.ts                         # TipTap JSON ↔ markdown (for body persistence)
├── api.ts                                         # postArticle, patchArticle, deleteArticle, publishArticle, draftSave, analyticsQuery
├── hooks.ts
└── types.ts

apps/bff/src/api/endpoints/kb-write.ts             # NEW: POST/PATCH/DELETE/publish kb endpoints
apps/bff/src/api/endpoints/kb-analytics.ts         # NEW: GET /api/kb/analytics shape
apps/bff/tests/kb-write.test.ts                    # NEW: 8+ cases (create/update/publish/delete/visibility/sanitization-check/audit/permission-deny)

packages/api-mocks/src/handlers/knowledge.ts       # MOD: add write/publish/analytics handlers + draft store
packages/api-mocks/src/db/types.ts                 # MOD: KbArticle gets `draftBody`, `visibility`, `publishedAt`, `publishedBy`
packages/api-mocks/src/fixtures/kb.ts              # MOD: seed published vs draft articles + analytics fixtures

apps/workspace/package.json                        # +deps: @tiptap/react, @tiptap/starter-kit, @tiptap/extension-link, @tiptap/extension-table, @tiptap/extension-image, isomorphic-dompurify
apps/workspace/vite.config.ts                      # +manualChunks: vendor-editor (TipTap + DOMPurify lazy chunk)
apps/workspace/.size-limit.json                    # +vendor-editor cap (120 KB gzip)

apps/workspace/src/routes/index.tsx                # MOD: add /kb/editor + /kb/editor/:id + /kb/analytics routes (kb.edit / kb.analytics gated)
apps/workspace/src/features/kb/components/KbBrowseList.tsx  # MOD: surface Edit/New buttons gated by kb.edit
apps/workspace/lighthouserc.json                   # +graduated thresholds for /kb/editor + /kb/analytics

packages/i18n/catalogs/workspace/{sk,en}.json      # +kb.editor.* + kb.analytics.* keys (~30)
tools/browser-test/scenarios/acceptance/
├── journey-13-workspace-kb-author-new.spec.ts     # RESTORE: full editor + publish flow
├── journey-14-workspace-kb-from-incident.spec.ts  # RESTORE: publish-from-editor portion
└── journey-15-workspace-kb-analytics.spec.ts      # RESTORE: full analytics dashboard

docs/agents/qa-test-strategy/acceptance-coverage.md # UPDATE: #13/#14/#15 → pass; @security:kb-markdown-sanitization → covered
docs/ROADMAP.md
docs/plans/I.4.md
```

## Done-when

- [ ] `/kb/editor` (new) + `/kb/editor/:id` (edit existing) routes, gated `<RouteGuard requires={["kb.edit"]}>`. `/kb/analytics` gated `kb.analytics`.
- [ ] **TipTap editor**: starter-kit + link + table + image extensions. Markdown body persisted as canonical (TipTap JSON ↔ markdown via `markdown-bridge.ts` per H.6 pattern).
- [ ] **DOMPurify sanitization** pipeline: every TipTap output → DOMPurify allowlist (per `owasp-mitigations.md §XSS`) before BFF POST. Server-side BFF also sanitizes (defense in depth).
- [ ] **Visibility selector**: `public` / `tenant` (default) / `sp_only` (SP admins only).
- [ ] **Publish flow**: `<PublishModal>` confirms visibility + tags → `POST /api/kb/articles/:id/publish`. Audit emit `data.kb.write` s `details.op: kb.publish`.
- [ ] **Draft auto-save**: debounced 5 s; `PATCH /api/kb/articles/:id/draft`. Indicator "Saving…" → "Saved {relative time}".
- [ ] **Analytics dashboard** `/kb/analytics`: top-10 articles by views, bottom-5 by helpfulness, search-miss list (queries with no result). Time range selector (last 7/30/90 days).
- [ ] **BFF write endpoints**: POST/PATCH/DELETE/publish/draft — all audit-emit + RBAC enforce + sanitize. Test matrix: create/update/publish/delete/visibility/sanitization/audit/permission-deny.
- [ ] **Bundle**: `vendor-editor` lazy chunk ≤ 120 KB gzip. Workspace initial JS ≤ 178 KB (vs H.16 baseline ~176 KB). NO editor code in initial bundle.
- [ ] LHCI `/kb/editor` desktop TTI ≤ 3.0 s (heavy per `performance.md §2`).
- [ ] Browser tests: journeys #13, #14, #15 full flow pass.
- [ ] `acceptance-coverage.md`: #13 deferred → pass; #14 partial → pass; #15 partial → pass; `@security:kb-markdown-sanitization` covered.

## Stratégia

### Fáza A — TipTap + DOMPurify + markdown-bridge

1. `pnpm --filter @sdm/workspace add @tiptap/react @tiptap/starter-kit @tiptap/extension-link @tiptap/extension-table @tiptap/extension-image isomorphic-dompurify`.
2. `vite.config.ts` add `vendor-editor` manualChunks regex.
3. `.size-limit.json` add `vendor-editor` cap 120 KB.
4. `lib/sanitizer.ts`: DOMPurify wrapper s allowlist:
   ```ts
   const ALLOWED_TAGS = [
     "p",
     "h1",
     "h2",
     "h3",
     "ul",
     "ol",
     "li",
     "strong",
     "em",
     "code",
     "pre",
     "a",
     "img",
     "table",
     "tr",
     "td",
     "th",
     "blockquote",
   ];
   const ALLOWED_ATTR = ["href", "src", "alt", "title", "target", "rel"];
   export function sanitize(html: string): string {
     return DOMPurify.sanitize(html, {
       ALLOWED_TAGS,
       ALLOWED_ATTR,
       FORBID_ATTR: ["onerror", "onload"],
     });
   }
   ```
5. `lib/markdown-bridge.ts`: TipTap JSON → markdown via TipTap utility OR `tiptap-markdown` package. Reverse: markdown → TipTap JSON via `marked` AST.

### Fáza B — Editor route + components + BFF write

1. `KbEditorRoute.tsx`: lazy import TipTap; useEditor + state management RHF/Zod for title + tags + visibility metadata.
2. `EditorShell.tsx`: TipTap render + toolbar; per-action emit content (`onUpdate`).
3. `VisibilitySelector.tsx`: radio group `public/tenant/sp_only`.
4. `PublishModal.tsx`: confirm + visibility + tags → mutation `publishArticle`.
5. `DraftAutoSave.tsx`: debounced 5s save; on success update last-saved timestamp.
6. BFF `kb-write.ts`:
   - `POST /api/kb/articles` { title, body, visibility, tags } → create draft → audit emit.
   - `PATCH /api/kb/articles/:id` → update.
   - `PATCH /api/kb/articles/:id/draft` → draft save (separate from publish).
   - `POST /api/kb/articles/:id/publish` → set publishedAt + publishedBy + audit emit.
   - `DELETE /api/kb/articles/:id` → soft delete + audit emit.
   - Every endpoint: validate session, check `kb.edit` permission, sanitize body server-side (defense in depth).
7. MSW handlers mirror.

### Fáza C — Analytics + browser tests + PR

1. `KbAnalyticsRoute.tsx`: TanStack Query `analyticsQuery({ range })`. Render 3 cards: top-10 / bottom-5 / search-miss.
2. BFF `kb-analytics.ts`: `GET /api/kb/analytics?range=7d|30d|90d` → fixture-backed (MSW dev); real implementation post-MVP (TBD per I.6 release dry-run).
3. Restore journey-13/14/15 full browser test assertions.
4. Update `acceptance-coverage.md`.

## Open questions / risks — recommended resolutions

- **TipTap JSON vs markdown persistence**: TipTap natively persists as JSON. Markdown is interop-friendly + matches H.6 portal reader. **Recommendation**: persist markdown (BFF column `body_markdown`), convert to TipTap JSON on editor load. `tiptap-markdown` lib handles roundtrip.
- **DOMPurify v isomorphic-dompurify**: workspace is FE only — `dompurify` (vanilla) sufficient. `isomorphic-dompurify` works in Node too (for BFF defense in depth) — use it ak BFF needs sanitize tiež. Recommendation: `isomorphic-dompurify` v oboch — single import path.
- **Draft conflict resolution**: two browser tabs editing same article → last-write-wins (per H.1 tenant precedent). Real-time collab je v1+++.
- **Image upload**: TipTap image extension needs `POST /api/attachments/kb` endpoint. Per H.3 attachments deferred — **DO NOT add binary upload** v I.4. Image extension uses URL paste only (markdown `![alt](url)`).
- **Analytics data source**: CA SDM doesn't expose KB analytics natively. MSW fixtures sufficient pre journey pass. Real analytics ingest deferred v1+++.

## Notes pre subagenta

- Reuse `vendor-markdown` chunk z H.6/H.9 (markdown READ); `vendor-editor` is NEW (TipTap WRITE).
- Lazy chunk discipline: editor + analytics routes lazy-loaded — initial bundle ostáva pod 180 KB.
- Subagent **NESMIE**:
  - Pridať image upload (attachments deferred per H.3).
  - Implementovať real-time collab (Yjs/Loro out of scope).
  - Mergovať vlastný PR.
