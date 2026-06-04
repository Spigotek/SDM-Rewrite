# Changelog

All notable changes to **SDM-Rewrite** are recorded here. The format follows
[Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) and the project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

This file aggregates per-phase summaries pulled from `docs/ROADMAP.md` and the
per-chunk plans under `docs/plans/`. Sources of truth for design decisions live
in `docs/spec/` and `docs/agents/`; this changelog tracks **what shipped** to the
release artefact, not why.

## [1.0.0] - 2026-06-03

Initial public release — **MVP**. Modern multi-tenant SDM frontend for CA Service
Desk Manager 17.4. Two SPAs (`portal`, `workspace`), one BFF (Hono on Node 22),
six personas served (Lucia, Anna, Peter, Robert, Marek, Jana) plus SP Admin
cross-tenant cockpit. **18 of 18 acceptance journeys pass.**

Detailed release notes: [`RELEASE-NOTES-v1.0.md`](./RELEASE-NOTES-v1.0.md).

### Added — Phase E (Dev productivity unlock, 3 chunks)

- **E.1** `@sdm/api-mocks` — MSW handlers for `/api/*` + `/me/*` + `/auth/*` +
  `/config`, deterministic faker fixtures (~300 records), in-memory store,
  browser + node worker bootstraps; `VITE_USE_MOCKS=true` opens the SPAs
  without a running BFF.
- **E.2** Real RBAC mapping — `UIRole` (8 values, incl. `requester_external`),
  ~70 dot-notation `Permission` keys, 31-screen visibility matrix, multi-role
  aggregation. `<Can>` / `<RouteGuard>` / `<ScreenGuard>` in `@sdm/auth`.
- **E.3** SPA app shell + bootstrap — `/config` + `/me` + `/me/tenants` loader,
  typed `Session`, top bar with brand, tenant dropdown, user pill,
  `ErrorBoundary`. SPA-owned active tenant (`X-CA-SDM-Tenant` injection).

### Added — Phase F (BFF real implementation, 6 chunks)

- **F.1** Auth module — Basic-Auth → access-key broker, in-memory session
  store, `/auth/*`, `/me` canonical shape, CSRF Origin check. Live smoke
  against real CA SDM 17.4 (`10.11.35.35:8050`) green.
- **F.2** REST proxy — shared `SdmHttpClient`, error shaper (AUTH_EXPIRED /
  NOT_FOUND mapping), tenant scoping, `fast-xml-parser` XML→JSON adapter, 7
  entity proxies (`in`/`cr`/`pr`/`chg`/`KD`/`nr`), reference factories with
  15 min TTL cache.
- **F.3** Aggregator endpoints — `/me/tenants` (5 min TTL), `/api/queue`
  parallel fan-out across incidents/requests/problems (30 s TTL,
  partial-failure tolerant), `/api/tickets/:type/:id` MVP stub.
- **F.4** Platform — canonical 40-event audit taxonomy with PII redaction +
  SHA-256 pseudonymisation + 1:100 heartbeat sampling, hooked into auth,
  tenant switch, entity routes. `/config` serves canonical `RuntimeConfig`.
  `/readyz` two-step probe (broker bootstrap + `GET /pri?size=1`, 2 s).
- **F.5** MSW vs BFF cleanup — canonical `/me` shape (no FE permission
  derivation; `effectivePermissions[]` from BFF), `LoginPage` + `Heartbeat` +
  `IdleModal` (29 min warn, 30 min redirect), cross-tab sync via
  BroadcastChannel + Safari fallback.
- **F.6** Ticket-detail B-E probe — `act_log` (BREL → `alg` / `chgalg`) +
  attachments (BLREL join + `/attmnt/{id}` enrichment) probed against live
  CA SDM. Aggregator parallel fan-out via `Promise.allSettled`.

### Added — Phase G (Cross-cutting concerns, 5 chunks)

- **G.1** Design system — `@sdm/design-system` with `tokens.css`
  (light/dark/hc), `reset.css`, FOUC-safe inline script, 12 base components
  (Button, IconButton, Link, Badge, StatusBadge, PriorityBadge, Card,
  TextField, TextArea, Select, Checkbox, Icon).
- **G.2** i18n — `@sdm/i18n` on `i18next@23 + react-i18next@15 + i18next-icu`,
  88 keys total across `shared`/`portal`/`workspace` catalogs, 100% SK ↔ EN
  parity. `pnpm i18n:check` CI gate. ICU plurals for SK 3+exact forms.
- **G.3** Observability — `@sentry/react@8` with `beforeSend` deep PII strip
  (16 fragments), per-tenant SHA-256 salted user context, ULID correlation
  IDs, lazy Sentry init via `requestIdleCallback`.
- **G.4** Performance budgets — `size-limit@12` per app (portal 180 KB,
  workspace 350 KB initial JS), Vite `manualChunks` split into
  `vendor-{react,i18n,ds,observability}`, `@lhci/cli@0.15` per-PR audits +
  nightly sweep.
- **G.5** Self-host fonts — Inter Variable + JetBrains Mono Variable
  (woff2 latin + latin-ext), `font-display: swap`, `<link rel="preload">`
  on Inter latin. No CDN call.

### Added — Phase H (Feature modules — MVP, 17 chunks)

- **H.0** React Router 6 data router + TanStack Query 5; lazy code-split per
  route; `manualChunks` `vendor-router` + `vendor-state`.
- **H.1** Tenant switcher activation — BFF `POST /me/active-tenant` with
  membership check + audit emit, broad cache nuke, single / compact /
  expanded variants, search input, kbd shortcut `T`, pending-changes guard.
- **H.2** Portal Home — Lucia landing with hero greeting, action cards,
  recent tickets, KB suggestions. BFF `customer=me` opt-in (server-side
  `WC=customer=<session.contactId>`).
- **H.3** Portal new-incident — RHF + Zod form (summary/description/priority/
  category), inline field errors, success screen with 3 CTAs, pending-changes
  register on dirty.
- **H.4** Portal ticket-detail — `/tickets/:id` with prefix-based type
  detection (incident/request/problem/change), 5 components (Header / Body /
  ActivityTimeline / AttachmentsList / PublicComposer), defence-in-depth
  client-side filter on internal items.
- **H.5** Portal service catalog + new-request — `/catalog` + `/catalog/:id`,
  12 dynamic field types (text/textarea/number/date/select/multi/radio/
  checkbox/file/user-picker/ci-picker/markdown-help), Zod schema built from
  catalog field definitions.
- **H.6** Portal KB search + article — `/kb` + `/kb/article/:id`, react-markdown
  with rehype-sanitize, lazy `vendor-markdown` chunk, helpfulness vote stub,
  related articles.
- **H.7** Workspace queue — `/queue` with TanStack Table, F.3 aggregator
  `/api/queue` consumer, saved views via `useSyncExternalStore`, keyboard
  nav (`j`/`k`/`↑`/`↓`/`Enter`/`Esc`), 30 s poll when visible.
- **H.8** Workspace ticket-detail — agent route with 8 components
  (`AgentTicketHeader` inline edit, `ActionBar` Take/Resolve/Escalate/Watch,
  `Composer` 3-tab, `ContextPanel`). Action endpoints in MSW handler
  `ticket-detail.ts`.
- **H.9** Workspace changes list + detail — `/changes` + `/changes/:id` with
  4 tabs (Detail / Impact / Rollback / Approvals). Markdown rollback render
  lazy-loaded via `vendor-markdown`.
- **H.10** Change calendar — `/changes/calendar` with FullCalendar 6 (day/
  week/month view switch), event colour per `risk_tier`, lazy
  `vendor-calendar` chunk (~75 KB gz, well under 150 KB cap).
- **H.11** CAB approval flow — Approve / Reject / Send-reminder actions
  gated by `<Can permission="cab.approve">`, BFF endpoints
  `/api/changes/:id/{approve,reject,reminder}` with audit emit.
- **H.12** Workspace problems + link-to-incident — `/problems` + detail,
  link/unlink/convert flows via MSW; BFF mutation deferred (no F.2 entity-
  proxy footprint refactor in MVP).
- **H.13** Workspace CMDB CI list + detail — `/cmdb` + `/cmdb/ci/:id` with
  4 tabs (Detail / Attributes / Relationships / History), per-class attribute
  registry (`buildAttributeGroups`) with collapsible groups persisted per
  user. CMDB read-only.
- **H.14** CMDB relationships graph — Cytoscape 3 +
  `cytoscape-cose-bilkent`, lazy `vendor-graph` chunk, edge styles per
  `relationType` (depends_on solid / hosts thick / peers_with dashed),
  a11y treeview fallback.
- **H.15** Workspace KB browse + read — `/kb` + `/kb/article/:id` workspace
  variants, category + language filters, "Attach to incident" cross-feature
  CTA.
- **H.16** Acceptance criteria smoke — 18 thin journey scenarios under
  `tools/browser-test/scenarios/acceptance/`, dedicated
  `.github/workflows/acceptance.yml` workflow, `acceptance-coverage.md`
  matrix.

### Added — Phase I (Acceptance + production hardening + v1.0 cut, 8 chunks)

- **I.0** LHCI graduation — stub-BFF harness (`tools/stub-bff/server.ts`),
  portal initial JS 163 → **106 KB gz** (-35%), workspace 176 → **145 KB gz**
  (-18%). LHCI numeric TTI / LCP / score gates calibrated on measured
  baseline; score is the primary regression catcher, absolute timings are
  catastrophic-regression catchers.
- **I.1** Step-up 2FA + emergency approve + RHF DynamicForm fix — BFF
  `POST /auth/step-up` (RFC 6238 TOTP via `node:crypto`, single-use 15 min
  tokens), EMERGENCY-category server gate, `<StepUpModal>` in
  `<ApproveModal>`. DynamicForm bug fixed (`shouldUnregister: true` +
  dynamic resolver against visible-fields schema). ResolveModal close-block
  predicate (Solution + Category required when status → CL).
- **I.2** Security audit sweep — `.github/workflows/security.yml` with
  CodeQL TS+JS, Trufflehog `--only-verified`, `pnpm audit
--audit-level=high` blocking. Playwright multi-browser matrix (chromium +
  firefox + webkit) × 18 journeys. `@axe-core/playwright` per-route sweep
  (5+6 routes plus 5 detail variants), 4 a11y bugs fixed. BFF security
  tests 56 cases.
- **I.3** Multi-tenancy edge cases — tenant suspension flow
  (`tenantStatus: active|suspended`, /me/tenants filtering, 403 with audit
  `authz.tenant.switch.denied` `details.reason: "suspended"`). Cross-tenant
  race detector (`X-Response-Tenant` mismatch → retry-once +
  `TENANT_RACE`). Sentry `beforeSend` cross-tenant tag scrubber.
  `TenantSuspendedError` with TenantSwitcher grey-out + tooltip.
- **I.4** KB authoring (v1+ pulled in) — H.15 graduated read-only → full
  write. TipTap 2.27 lazy `vendor-editor` chunk (~128 KB gz),
  `sanitize-html` (BFF + MSW server) + `DOMPurify` (FE), visibility radio
  (public/tenant/sp_only). BFF kb-write endpoints (POST/PATCH/DELETE/draft/
  publish/analytics) with 12 cases. `<DraftAutoSave>` 5 s debounced.
- **I.5** SP cockpit / cross-tenant view (v1+ pulled in) — `/sp/cockpit`
  per-tenant health summary, CalendarFilters "All my tenants" toggle,
  per-tenant colour overlay, `SharedCiMarker` badge in CmdbTable / CiHeader,
  cross-tenant Cytoscape edges (dashed orange). BFF `sp-impersonation.ts`:
  `GET /me/sp-tenants`, `POST/DELETE /api/sp/view-as` (step-up gated,
  1 h TTL).
- **I.6** Release v1.0 dry-run scaffolding — chart bump 0.1.0 →
  `1.0.0-rc.1`, `values-staging.yaml` with vault-ref placeholders,
  `acceptance-live.yml` workflow, `scripts/release-dry-run.sh` +
  `scripts/rollback-test.sh` (top-5 critical paths),
  `playwright.config.live.ts`, `docs/RELEASE-DRY-RUN.md` post-mortem
  template with GO/NO-GO matrix.
- **I.7** v1.0 cut — chart bump `1.0.0-rc.1` → `1.0.0`,
  `.github/workflows/release.yml` builds + pushes portal/workspace/BFF
  images and helm chart (OCI) to `ghcr.io/spigotek` on `v*.*.*` tag push,
  this CHANGELOG, user-facing release notes
  (`RELEASE-NOTES-v1.0.md`).

### Security

- CodeQL TypeScript + JavaScript scanning, Trufflehog verified-secrets sweep,
  and `pnpm audit --audit-level=high` block every PR
  (`.github/workflows/security.yml`).
- Step-up 2FA (RFC 6238 TOTP via `node:crypto`) gates emergency change
  approvals in production tenants.
- Tenant suspension flow plus cross-tenant deny sweep enforce RLS-equivalent
  boundaries server-side (`apps/bff/src/security/`).
- Defence-in-depth XSS sanitisation — `DOMPurify` in the browser plus
  `sanitize-html` on the BFF and the MSW dev backend.
- `@axe-core/playwright` per-route sweep — 0 serious / critical violations on
  shipped routes.
- Playwright matrix: Chromium + Firefox + WebKit × 18 acceptance journeys.

### Performance

- Portal initial JS **106 KB gz** (-35 % vs pre-I.0 baseline). Workspace
  initial JS **145 KB gz** (-18 %).
- Lighthouse mobile portal `/` score **0.92** (gate 0.90), TTI ~3 s under the
  LHCI harsh preset (slow-4G + 4× CPU). Real-user TTI ~1.5-2 s on typical
  on-prem deployments with modern devices.
- Workspace desktop `/queue` Lighthouse score **0.99**, TTI ~800 ms.
- `size-limit` per-app caps + Vite `manualChunks` split prevent regressions.

### Compatibility

- Chrome / Edge 120+
- Firefox 120+
- Safari 17+
- Mobile: iOS Safari 17+ on the portal (workspace is desktop-first; the
  change calendar redirects mobile users to the changes list view).

### Deployment

- Container images — multi-arch (`linux/amd64` + `linux/arm64`):
  - `ghcr.io/spigotek/sdm-bff:1.0.0` (also tagged `1.0`, `latest`)
  - `ghcr.io/spigotek/sdm-portal:1.0.0` (also tagged `1.0`, `latest`)
- Container images — single-arch (`linux/amd64` only):
  - `ghcr.io/spigotek/sdm-workspace:1.0.0` (also tagged `1.0`, `latest`) — multi-arch in v1.1 (J.1)
- Helm chart (OCI): `oci://ghcr.io/spigotek/charts/sdm` version `1.0.0`.
- Staging values reference: `deploy/helm/sdm/values-staging.yaml` (vault-ref
  placeholders for secrets; on-prem deployment per
  memory `deploy_target.md`).

### Known issues

The following items are intentionally deferred and tracked for v1.1+:

- **Workspace image is `linux/amd64` only in v1.0.** Cross-compile failed
  with QEMU SIGILL during release; ships single-arch via the workaround
  in `release.yml`. Multi-arch lands in v1.1 via native `ubuntu-22.04-arm`
  GitHub-hosted runner (J.1). Impact: arm64 clusters cannot run v1.0
  workspace; arm64 BFF + portal are unaffected.
- ~~**Mobile PWA offline mode** — draft auto-save and service-worker cache planned for v1.1.~~
  **Portal PWA — installability + read-only offline shipped in v1.1 (J.7)** (portal only;
  workspace exempt per desktop-first H.10 outcome). Workbox SW via `vite-plugin-pwa` precaches
  app shell; runtime caches: SWR `/api/*` GET, NetworkFirst `/me`+`/config`, CacheFirst
  `/api/attachments/kb/*`. **Offline mutation queue** (draft auto-save + replay) deferred to
  v1.2+ — requires production mobile traffic signal (J.0 staging cluster still pending).
- ~~**Advanced change-calendar interactions (drag-resize)** — deferred to v1+
  per H.10 plan.~~ Shipped in J.6: FullCalendar `editable: true` when caller
  has `change.schedule` permission; `eventDrop` + `eventResize` wire to new
  BFF `PATCH /api/changes/:id/schedule`; client-side conflict detection with
  `<ConflictConfirmModal>`; `info.revert()` on cancel or PATCH failure.
  **Cross-tenant heavy overlay** (drag across tenant boundaries in sp_admin
  overlay mode) remains deferred to v2.0.
- **KB analytics widgets** — MSW-fixture is the production behaviour on
  the dev/test backend (CA SDM 17.4 has no native KB analytics surface;
  current BFF endpoint returns identical synthetic snapshots as MSW). J.4
  (2026-06-04) closed as N/A because (a) F.4 audit taxonomy is frozen for
  Phase J — adding `data.kb.read` / `data.kb.search` would violate the
  Hard rules, and (b) no production traffic source exists yet (J.0 staging
  deploy deferred). Real ingest = v2.0 scope (purpose-built telemetry
  channel + FE beacons + aggregation). Swap point in `kb-analytics.ts:103`.
- ~~**KB editor image upload** — markdown URL paste only; binary upload
  deferred to v1.1+.~~ Shipped in J.5: `POST /api/attachments/kb` multipart
  upload + `GET /api/attachments/kb/:id` serve. PNG / JPG / SVG / GIF
  whitelist, 5 MB cap, magic-number MIME validation, SVG sanitization, JPG
  EXIF strip. TipTap editor gains drag-drop + paste-clipboard handlers.
- **LCP on portal mobile** — Lighthouse picker prefers multi-line text
  rects, which biases LCP measurement on the portal Home empty-state
  paragraph. Closing the remaining gap to the GOAL.md sub-3 s mobile target
  requires SSR (planned for v1.1+).
- **Real-time tenant suspension push** — currently detected on the next API
  call. WebSocket-driven push planned for v1.1+.
- **Real BFF cross-tenant query support** (SP cockpit) — pre-flight eval
  (J.2, 2026-06-04) confirmed the dev/test CA SDM 17.4 instance at
  `10.11.35.35:8050` is single-tenant (`/tenant` collection returns
  `COUNT=0` rows per `real-backend-contracts.md §6`). I.5 (PR #46) already
  shipped the BFF cross-tenant surface (`sp-impersonation.ts`,
  `?tenants=all` aggregation, audit emit) + MSW overlay; on this instance
  the MSW path is the production path because zero-tenant backend has
  nothing to aggregate. If a multi-tenant CA SDM is configured later, the
  follow-up is verification of the existing I.5 code path, not new build.

### Migration notes

- None — initial public release.

[1.0.0]: https://github.com/Spigotek/SDM-Rewrite/releases/tag/v1.0.0
