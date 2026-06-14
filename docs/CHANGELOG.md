# Changelog

All notable changes to **SDM-Rewrite** are recorded here. The format follows
[Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) and the project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

This file aggregates per-phase summaries pulled from `docs/ROADMAP.md` and the
per-chunk plans under `docs/plans/`. Sources of truth for design decisions live
in `docs/spec/` and `docs/agents/`; this changelog tracks **what shipped** to the
release artefact, not why.

## [1.4.0] - 2026-06-14

"Queue overhaul". Built directly on owner feedback after v1.3.0
staging walk: filter chip didn't apply, left-rail clicks were inert,
split-pane right column still said "Plný detail ticketu dorazí v
H.8.", UI density hard to scan. v1.4 fixes all four and ships a
Kanban view as the surprise. See
[`RELEASE-NOTES-v1.4.0.md`](./RELEASE-NOTES-v1.4.0.md) for the full
post-mortem.

### Fixed

- **Filter chip applies to rows.** `statusMatchesFilter()` +
  `CA_CODE_TO_LOGICAL` map bridges logical-status URL params and
  CA SDM codes.
- **Left-rail wired.** Every item now navigates to a real query
  contract (`?status=new`, `?status=in_progress`, etc.). Inbox /
  My queue / Starred stay URL-only stubs until BFF predicates land.
- **Split-pane detail.** Real `QueueDetailPane` (Header +
  transitionable StatusBadge + 3 tabs + "Otvoriť plný detail" CTA)
  replaces the H.8 placeholder.
- **Visual density.** Caps section labels → sentence-case + indigo
  accent dot. Table rows 36 px with subtle hover lift. Stripe
  removed. KPI tiles 0 / "—" → compact chips; non-zero keep full
  tile. "Zobraziť aj prázdne" toggle persisted.

### Added

- **Kanban view toggle** on `/queue` — 4-column board (Otvorené /
  V riešení / Čaká / Vyriešené), native drag-to-transition,
  lazy-loaded (5.17 kB raw / 2.16 kB gzip). Choice persisted in
  `localStorage["sdm.workspace.queue.view"]`.
- **Smart age formatter** — < 24h `~Nh`, 1–90d `Nd`, > 90d
  Slovak Intl `pred N rokmi`. Absolute date in `title=` tooltip.
- **Workspace i18n** grew 738 → 763 keys (Kanban + view toggle +
  queue detail + age formatter).

### Changed

- Card elevation pass — `.surface` + `.interactive` ship thin
  border + 1-px ground shadow; `.subtle` flat.

### Deferred to v1.5+

- BFF predicates for `?scope=inbox` / `?starred=true` / `?assignee=me`.
- Real-time Kanban auto-rearrange on SSE push.
- BFF status PATCH endpoints (UI ready since v1.3).

## [1.3.0] - 2026-06-14

"Live + Identity" surprise pass. Built atop v1.2.x after owner brief
"stále nie som spokojný s dizajnom a komplexitou UI. Prekvap ma!".
Three pillars: brand visual identity refresh, live SSE notification
center, JSM-style inline status transitions. See
[`RELEASE-NOTES-v1.3.0.md`](./RELEASE-NOTES-v1.3.0.md) for the full
post-mortem and [`docs/plans/L.1-v1.3.md`](./plans/L.1-v1.3.md) for
the per-chunk breakdown.

### Added

- **`Wordmark` primitive** in `@sdm/design-system/brand`. Two stacked
  rounded indigo squares (primary-500 front, primary-700 back, 4-px
  offset) + tightened "SDM" wordmark in Inter Variable 600 / -0.04em
  letter-spacing. GSAP entry on first mount (opacity + scale +
  per-letter y stagger). Replaces the hardcoded `<span>SDM</span>`
  block in portal top-bar, portal mobile drawer, workspace top-bar.
- **`NotificationPopover` primitive** — 360-px anchored dropdown,
  GSAP fade+lift, contiguous same-ticket clustering (3+ → "+N more"),
  outside-click + Escape close.
- **Live notification center** — top-bar bell (hardcoded 0 since
  v1.1.4) wired to J.3 SSE `/api/events`. `useNotifications` hook in
  each shell with `lastReadAt` persisted in `localStorage`. Maps
  `tenant.suspended` → danger row, `session.expired` → warning row.
  Bell is a real `<button>` with `aria-expanded` / `aria-haspopup`.
- **`useCountUp` hook** — gsap-driven `textContent` tween with snap-to-
  integers. Applied to every KPI tile in portal HeroStats (3 tiles) +
  workspace QueueStats (5 tiles). `prefers-reduced-motion` short-
  circuits to immediate set.
- **JSM-style inline status transitions** — `StatusBadge` gets
  `transitionable` mode + `allowedTransitions` + `onTransition`. Click
  opens a popover menu listing the allowed CA SDM next states (coloured
  dot + label + lucide icon). Keyboard nav (Arrow / Home / End / Enter
  / Escape). GSAP fade+lift, reduced-motion safe. Backward-compatible
  with read-only callsites.
- **`CA_SDM_TRANSITIONS` lifecycle map** — exported constant documenting
  legal next states per K.1 brief §6.4.
- **Wired transitions** in workspace queue rows, ticket detail H1,
  problem detail H1, change detail H1. Optimistic TanStack mutations
  with snapshot rollback + per-feature toast bus.

### Changed

- **Brand gradient on portal home hero** — subtle radial indigo (10 %
  alpha light / 18 % dark, capped 340 px) lifts the hero without
  dominating.
- **Serif accent on H1 hero / reader headings** — Charter / Source
  Serif Pro / Iowan / Apple Garamond / Georgia fallback chain (system
  serif, no new font @font-face). Applied to portal HeroGreeting H1,
  KB ArticleHeader H1, workspace Queue H1. Inter stays for everything
  else.
- **EventSourceProvider** in both shells extended with
  `AppEventsContext` + `useAppEvents()` fan-out. Single `EventSource`
  connection preserved — listeners stored in a ref Set, fan-out fires
  after the existing DOM dispatchers.
- **i18n** — `notifications.*` keys added in both apps;
  `status.transition.*` added in both. Workspace 738 keys, portal 234.

### Known limitations / deferred to v1.4+

- `PATCH /api/tickets/:type/:id` is MSW-only; `PATCH /api/problems/:id`
  - `PATCH /api/changes/:id { status }` are not yet wired server-side.
    FE shows the localised "Backend zatiaľ neumožňuje túto zmenu" toast +
    console.warn on the unsupported path. UI is ready for v1.4 catch-up.
- `GET /api/events?since=<lastReadAt>` backlog hydration endpoint
  doesn't exist on BFF. Fresh tabs start with empty queue and fill as
  SSE pushes.
- `/notifications` route not yet built. Popover hides its footer link.
- Ticket-level SSE events not yet emitted by BFF — `NotificationEvent`
  primitive has the `ticketRef` / `ticketHref` slots wired and ready.

## [1.2.0] - 2026-06-13

Full redesign half of Phase K. v1.1.4 shipped the quick-wins bundle;
v1.2.0 closes the loop with dark mode, a Linear-style command palette,
the workspace left-rail nav, illustration assets, multi-page polish
across every detail route, and an a11y audit that lands axe-clean.
See [`RELEASE-NOTES-v1.2.0.md`](./RELEASE-NOTES-v1.2.0.md) for the
full post-mortem.

### Added

- **Dark mode** — `data-theme` attribute + `localStorage` +
  `prefers-color-scheme` first-visit detect. `<ThemeToggle>` primitive
  in the top bar (portal) / user menu (workspace). `useTheme()` React
  hook with live media-query subscription. FOUC-safe inline script in
  both `index.html`.
- **CommandPalette (cmd+K)** — Linear-style full modal. Grouped results
  (Recent / Navigate / Actions / Tickets / KB / CMDB), keyboard-first
  navigation (`↑/↓`, `Enter`, `Tab`, `cmd+1..9`), mode prefixes
  (`>`, `#`, `?`), GSAP enter / exit animation, recent-5 persisted
  in `localStorage`. Pluggable action registry — primitives stay
  router-agnostic; mounts wire `useNavigate()`.
- **Workspace left-rail nav** — 240-px persistent column with workspace
  switcher, cmd+K trigger chip, 5 collapsible groups (TOP / INCIDENTS /
  CHANGES / KNOWLEDGE / CMDB) persisted per-user in `localStorage`,
  user menu (ThemeToggle + language switcher + sign out).
- **Portal mobile nav** — slide-in left drawer with the 4 destinations
  - ESC + backdrop close + focus trap; sticky bottom-nav bar with
    4 icon-only tabs (filled-on-active) below `md`. Desktop horizontal
    nav row stays for `md+`.
- **Illustration system** — `vite-plugin-svgr` adoption + 10 placeholder
  empty-state SVGs (`currentColor` + `<title>` + tree-shakeable named
  exports). EmptyState wired across 10+ surfaces. Bundle: ~4.3 KB raw
  / ~2.9 KB gzipped.
- **GSAP motion engine** — `staggerListRows()` upgraded from Web
  Animations API to GSAP; new `usePageTransition()` route crossfade
  hook (80 ms out / 120 ms in); `HOVER_LIFT_*` constants;
  `prefers-reduced-motion` early-returns.
- **Skip-link** in both shells (off-screen → visible on `:focus`).
- **`useTheme()` + `ThemeToggle` + `CommandPalette`** new design-system
  primitives. DS test count grew 95 → 126.

### Changed

- **Typography fallback metrics** — Inter Variable `@font-face` now
  ships `size-adjust 107%` + `ascent-override 90%` + `descent-override
22%` + `line-gap-override 0%` so `system-ui` fallback paints at the
  same line metrics as Inter. Eliminates the residual font-swap CLS
  that K.2 had to absorb via a relaxed LHCI threshold.
- **Every detail route polished** — Portal: `/new-incident`,
  `/catalog`, `/catalog/:id`, `/kb`, `/kb/article/:id`, `/tickets`,
  `/tickets/:id`. Workspace: `/changes`, `/changes/calendar`,
  `/changes/:id`, `/cmdb`, `/cmdb/ci/:id`, `/kb` (browse + editor +
  analytics), `/problems`, `/problems/:id`, `/tickets/:id`. Universal:
  DS primitives over raw markup, Skeleton loading (no "Loading…" text),
  tabular numerals on IDs/dates/counts, staggerListRows on list mounts,
  usePageTransition on route mount, token-only colours.
- **Dark-mode token parity** — semantic ramps re-aligned (50 = subtle
  bg, 900 = strongest fg, semantic parity with light ramp). New dark
  `--color-primary-*` override (lighter shades, AA-safe on dark
  surfaces). Dark `--color-text-tertiary` bumped to `#8b8b94` (5.2:1
  on `#0f0f11`).
- **Workspace `/queue` LeftRail slot reservation** — pre-reserve
  240 px via `.sdm-app-shell[data-rail-ready="false"] .sdm-app-shell-main
{ margin-left: 240px }`. CLS 0.179 → 0.023 on `/queue` (3-run
  desktop LHCI). LHCI per-URL `/queue` override removed; strict
  global 0.06 floor restored.

### Fixed

- **Axe zero serious/critical** — portal 6/6 + workspace 11/11 routes
  pass. Specific fixes: portal `/kb` mid-fade contrast (axe spec
  now emulates `prefers-reduced-motion: reduce`), workspace
  `/tickets/:id` context-rail `text-tertiary` → `text-secondary`
  (4.41:1 → 7.5:1).

### Known limitations

- Service Worker still does not register on staging (plain HTTP).
  Deferred to v2.0 alongside the reverse-proxy / HTTPS story.
- Portal `/` mobile LHCI performance score 0.83 vs the 0.88 floor —
  pre-existing K.3.E regression (illustration + EmptyState polish
  payload). Confirmed via baseline stash. v1.2-polish follow-up:
  lazy-load empty-state illustrations off the FCP path.
- Illustration assets are placeholder-grade. Real unDraw downloads
  via a future `scripts/fetch-undraw.sh` are a v1.2-polish task.
- BFF `dueDate` + `slaState` projection onto `UiQueueItem`, BFF
  activity-feed endpoint, status-as-button transition control on
  `StatusBadge` — all v2.0.

## [1.1.4] - 2026-06-13

Quick-wins UX bundle + v1.1.3 live-deploy bug fixes. Synthesised from
the K.1 design brief (ServiceNow / JSM / Freshservice / Linear / Notion
scouts). See [`RELEASE-NOTES-v1.1.4.md`](./RELEASE-NOTES-v1.1.4.md) for
the full post-mortem. v1.2 ships the full redesign (dark mode, GSAP
motion, sidebar nav, axe audit, multi-page polish).

### Added

- **Portal home dashboard** — 7-widget grid layout (HeroGreeting +
  KbSearchBar + popular chips, HeroStats KPIs, QuickActions tiles,
  OpenTicketsCard, AnnouncementsCard, CatalogTeaser, RecentActivity).
  KB autocomplete via TanStack Query against `/api/kb?q=…`, debounced
  200 ms, suggestions in ≤ 300 ms.
- **Workspace queue dashboard** — KPI strip (Otvorené / Moje / Po SLA /
  < 1h / Dnes), saved-view + filter chips + "Iba moje" toggle,
  RecentActivity card, ChangeCalendar teaser. Dense-table row height
  tightened to 32 px with tabular numerals.
- **Top nav row** + **breadcrumbs** on both apps. Portal: Domov ·
  Moje tickety · Katalóg · Pomocník. Workspace: Fronta · Zmeny ·
  Problémy · CMDB · Znalosti.
- **Cmd+K hint chip** + **notification bell** placeholders in the
  top bar (full command palette + SSE wiring in v1.2).
- **Avatar primitive** in the user pill with deterministic colour
  hash, image fallback, initials, then lucide `User` icon.
- **Design-system primitives** — `Tile`, `NavLink`, `Avatar` +
  `AvatarGroup`, `EmptyState`, `Breadcrumbs`, `Skeleton`, `ToastFlyout`
  - `ToastViewport`.
- **Tokens** — full semantic 50/100/500/700/900 scales for success /
  warning / danger / info; `--color-primary-*` alias ramp;
  `--motion-easing-out-expo` + `-spring`; `@keyframes sdm-skeleton-shimmer`.
- **Motion utility** `staggerListRows()` (Web Animations API,
  `prefers-reduced-motion` honoured) for list-item entrance animation.
- **CA SDM status mapping** — `StatusBadge` `caCode` prop resolves
  12 lifecycle codes (`OP`, `WIP`, `HD`, `WC`, `WV`, `RE`, `CL`,
  `CN`, `RJ`, `AP`, `AR`, `SC`) to canonical statuses with optional
  lucide glyph via `withIcon`.

### Changed

- **`PriorityBadge` mapping** — `critical` renders solid red with
  white text and no dot (Polaris severity rule); `medium` → `info`;
  `low` → `neutral` (per K.1 brief §6.5).
- **`StatusBadge` mapping** — `in_progress` → `brand` (primary);
  `open` → `info` (per K.1 brief §6.4).
- **`Card.interactive`** — hover lift now applies a 2 px translate +
  primary-400 border, suppressed under `prefers-reduced-motion`.

### Fixed

- **`/api/kb/articles` and `/api/cmdb/cis` 404s** — list-alias routes
  registered ahead of `:id` parameterised handler so the literal
  segment wins. Regression tests added.
- **PWA `manifest.webmanifest` MIME type** — nginx now serves it as
  `application/manifest+json` (was `application/octet-stream`).
- **`/config` dev metadata leak** — `BFF_APP_VERSION` + `BFF_BUILD_ID`
  threaded as build-args in `release.yml`; `BFF_PUBLIC_ORIGIN` +
  `BFF_DEPLOYED_AT` forwarded by `compose.staging.yml` from
  `.env.staging`.

### Known limitations

- Service Worker still does not register on staging (plain HTTP).
  Deferred to v1.2 alongside the broader HTTPS / reverse-proxy story.
- SLA tile in workspace queue degrades to `—`; full SLA wiring needs
  `dueDate` + `slaState` projection in the BFF aggregator.

## [1.1.3] - 2026-MM-DD

Feature follow-up release. Replaces the `/tickets` placeholder ("Zoznam
tvojich ticketov dorazí v H.2.") with a working "My tickets" full-list
page in the portal SPA. See
[`RELEASE-NOTES-v1.1.3.md`](./RELEASE-NOTES-v1.1.3.md) for the full
post-mortem.

### Added

- Portal `/tickets` route now renders the user's full ticket list (up
  to 50 rows from `/api/incidents?customer=me`), each row linked to the
  v1.1.2 detail page. Reuses the home's row markup + the existing
  `myTicketsQuery` / `myAllTicketsQuery` factories. New SK + EN i18n
  keys under `myTickets.*` (title, loading, empty, error, count plural).

### Removed

- `apps/portal/src/routes/placeholders/my-tickets.tsx` placeholder
  component and the matching `placeholders.myTickets` /
  `placeholders.myTicketsTitle` i18n entries.

### Deployment

- `ghcr.io/spigotek/sdm-portal:1.1.3` (also `1.1`, `latest`) — multi-arch.
- `ghcr.io/spigotek/sdm-bff:1.1.3` / `sdm-workspace:1.1.3` — unchanged
  source, re-cut at the new tag for chart parity.
- Helm chart (OCI): `oci://ghcr.io/spigotek/charts/sdm` version `1.1.3`.

[1.1.3]: https://github.com/Spigotek/SDM-Rewrite/releases/tag/v1.1.3

## [1.1.2] - 2026-MM-DD

Hotfix release. Single-line fix in the portal SPA's `parseTicketParam` so the
home "My active tickets" → ticket detail click works against the live BFF
talking to real CA SDM 17.4 (raw numeric IDs). See
[`RELEASE-NOTES-v1.1.2.md`](./RELEASE-NOTES-v1.1.2.md) for the full
post-mortem.

### Fixed

- Portal `parseTicketParam` now accepts bare numeric IDs (`/tickets/407804`)
  and defaults them to `incident`. Without this branch, every home → ticket
  detail click on a live deploy rendered the SPA's 404 page despite the
  underlying BFF endpoint being healthy. MSW path is unaffected (fixtures
  still produce colon-prefixed IDs).

### Deployment

- `ghcr.io/spigotek/sdm-portal:1.1.2` (also `1.1`, `latest`) — multi-arch.
- `ghcr.io/spigotek/sdm-bff:1.1.2` / `sdm-workspace:1.1.2` — unchanged source,
  re-cut at the new tag for chart parity.
- Helm chart (OCI): `oci://ghcr.io/spigotek/charts/sdm` version `1.1.2`.

[1.1.2]: https://github.com/Spigotek/SDM-Rewrite/releases/tag/v1.1.2

## [1.1.1] - 2026-MM-DD

Hotfix release. Single-line `apps/bff/Dockerfile` `CMD` fix to make the BFF
production image actually startable. See
[`RELEASE-NOTES-v1.1.1.md`](./RELEASE-NOTES-v1.1.1.md) for the full
post-mortem.

### Fixed

- BFF Dockerfile `CMD` switched from the chunk-1-era stub
  `node --import tsx/esm src/index.ts` to the production
  `node dist/index.js`. The stub crashed every container start with
  `ERR_MODULE_NOT_FOUND: Cannot find package 'tsx'` because
  `pnpm deploy --prod` correctly prunes `tsx` (a dev dep). The defect was
  present in every BFF image since v1.0; J.0 staging smoke surfaced it on
  2026-06-05 (first time the image was exercised against a real runtime).

### Deployment

- `ghcr.io/spigotek/sdm-bff:1.1.1` (also `1.1`, `latest`) — multi-arch.
- `ghcr.io/spigotek/sdm-portal:1.1.1` / `sdm-workspace:1.1.1` — unchanged
  source, re-cut at the new tag for chart parity.
- Helm chart (OCI): `oci://ghcr.io/spigotek/charts/sdm` version `1.1.1`.

[1.1.1]: https://github.com/Spigotek/SDM-Rewrite/releases/tag/v1.1.1

## [1.1.0] - 2026-MM-DD

Phase J closure release. 8 merged chunks (J.1-J.8) graduate v1.0 deferred items + add
real-time tenant push, KB binary upload, portal PWA, calendar drag-resize, and portal mobile
LCP fix. J.0 (staging validation) remains deferred until cluster provisioned. J.2 + J.4
closed as N/A. See [`RELEASE-NOTES-v1.1.md`](./RELEASE-NOTES-v1.1.md) for the full
per-persona view.

### Added

- **J.1** Workspace `linux/arm64` image via native `ubuntu-22.04-arm` GHA runner (PR #49).
  `release.yml` workspace job split into canonical Docker multi-platform 3-job pattern:
  `workspace-image-amd64` + `workspace-image-arm64` push by digest; `workspace-manifest`
  merges via `docker buildx imagetools create` over metadata-action tag matrix.
- **J.3** Server-Sent Events tenant push — `GET /api/events` (`streamSSE`) emits
  `tenant.suspended` + `session.expired` (PR #50). New
  `apps/bff/src/platform/event-bus.ts` module-level pub/sub keyed by `sessionId`.
  Dev/admin endpoints `POST /api/admin/tenants/:id/{suspend,unsuspend}` gated by
  `tenant.admin` permission. FE: `AppEventSource` (api-client) + `EventSourceProvider` in
  portal + workspace shells. Audit composed under `authz.tenant.switch.denied` +
  `details.op` discriminators (no new event names).
- **J.5** KB binary image upload (PR #51): `POST /api/attachments/kb` multipart (5 MB cap,
  magic-number-validated MIME, SVG `sanitize-html` allowlist, JPG EXIF APP-marker strip) +
  `GET /api/attachments/kb/:id` serve (404 on cross-tenant). Hand-rolled
  `apps/bff/src/platform/attachments/` — zero new runtime deps. TipTap drag-drop +
  paste-clipboard handlers in workspace KB editor. Audit under `data.kb.write` +
  `details.op="attachment.upload"`.
- **J.6** Calendar drag-resize on `/changes/calendar` (PR #52) — `editable: true` when
  `change.schedule` permission present; `eventDrop` + `eventResize` → `useReschedule` hook +
  `ConflictConfirmModal` on overlap. BFF `PATCH /api/changes/:id/schedule` with zod
  end-after-start refinement; pre-fetches current change for `previous_*` audit fields.
  Audit under `data.chg.write` + `details.op="schedule.update"`.
- **J.7** Portal installable PWA + read-only offline (PR #53): `vite-plugin-pwa` devDep
  generates Workbox SW with precache + runtime cache strategies (SWR `/api/*` GET,
  NetworkFirst `/me` + `/config`, CacheFirst `/api/attachments/kb/*`). Conditional
  registration via `VITE_USE_MOCKS` gate so MSW remains the dev/CI controller. 4 PNG icons.
  Workspace exempt (desktop-first).

### Changed

- **J.1** v1.0 workspace was `linux/amd64` only (QEMU SIGILL on cross-compile, workaround
  per commit `6ff143a`); v1.1 ships true multi-arch via native arm64 runner.
  `RELEASE-NOTES-v1.0.md` + `CHANGELOG.md` [1.0.0] doc bug corrected (had falsely claimed
  v1.0 workspace was multi-arch).
- **J.3** `isActiveTenant` / `filterActiveTenants` / `assertTenantActive` now route through
  `resolvedTenantStatus` so admin-suspended tenants disappear from `/me/tenants` reads
  without session re-bootstrap (post-merge patch `6fb08f3`).
- **J.6** `lib/full-calendar-config.ts` `editable: false` → permission-gated `editable`
  flag.
- **J.7** `apps/portal/index.html` head gained `<link rel="apple-touch-icon">` (manifest +
  theme-color auto-injected by `vite-plugin-pwa`).
- **J.8** Portal `home.subgreeting` i18n string expanded from ~22 chars to multi-line
  welcoming paragraph (~200 chars) in SK + EN (PR #54). `.sdm-home-hero-sub` CSS gained
  `max-width: 28rem` + `line-height: 1.5` so the paragraph wraps to 2-3 lines on mobile
  preset.

### Documentation

- **J.0** deferred — no container runtime on deploy host (`10.11.36.21`); unblock criteria
  in `docs/plans/J.0.md`.
- **J.2** closed N/A — covered by I.5; CA SDM 17.4 dev backend single-tenant per
  `real-backend-contracts.md §6`.
- **J.4** closed N/A — F.4 audit taxonomy frozen; no production traffic signal source.
- `docs/agents/devex-devops/runtime-config.md` updated with `BFF_ATTACHMENTS_DIR` env var
  (J.5) + PWA / service worker section (J.7).
- `docs/agents/performance/performance.md` gained §2.1 — LCP target rationale (J.8).
- `docs/agents/qa-test-strategy/acceptance-coverage.md` drag-resize row → pass (J.6).

### Deployment

Multi-arch (`linux/amd64` + `linux/arm64`):

- `ghcr.io/spigotek/sdm-bff:1.1.0` (also `1.1`, `latest`)
- `ghcr.io/spigotek/sdm-portal:1.1.0` (also `1.1`, `latest`)
- `ghcr.io/spigotek/sdm-workspace:1.1.0` (also `1.1`, `latest`) — **NEW multi-arch; v1.0
  workspace was amd64-only.**

Helm chart (OCI): `oci://ghcr.io/spigotek/charts/sdm` version `1.1.0`.

### Known issues

See [`RELEASE-NOTES-v1.1.md`](./RELEASE-NOTES-v1.1.md) § Known issues. Notably: J.0
staging validation pending — cluster runtime not provisioned on the on-prem host as of
2026-06-04. Attachments storage (`BFF_ATTACHMENTS_DIR`) requires operator-mounted PVC for
persistence; Helm chart does not provision one by default.

### Migration notes

None — v1.0 → v1.1 is an in-place chart upgrade with no API breaking changes.

[1.1.0]: https://github.com/Spigotek/SDM-Rewrite/releases/tag/v1.1.0

---

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
- **Portal mobile LCP closed via HeroGreeting copy redesign in v1.1 (J.8).** SSR via Vite SSR plugin remains an option for v2.0 if future regressions surface.
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
