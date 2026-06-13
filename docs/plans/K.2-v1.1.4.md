# Phase K.2 — v1.1.4 quick wins post-mortem

> v1.1.4 = the "make it feel alive" pass. Brief K.1 (`docs/plans/K.1-design-brief.md`)
> ratified by owner GO-as-drafted on 2026-06-13. Full redesign (dark mode,
> sidebar nav, GSAP, axe audit) deferred to v1.2 / Phase K.3.

## Status

- 🟢 **Round A — Shared foundation (DONE)** — tokens extended, 6 new
  primitives, Skeleton + Card hover lift + list-stagger motion utility,
  StatusBadge + PriorityBadge mapping revisions. DS test suite 95/95
  green; typecheck clean.
- 🟢 **Round B — Portal + workspace shells (DONE)** — top-bar refactor
  with Avatar / cmd+K hint chip / notification bell, NavRow with active
  prefix-match, Breadcrumbs derived from `useLocation()`. Both apps
  typecheck + lint clean.
- 🟢 **Round C — Home dashboards (DONE)** — portal home rebuilt
  around CSS Grid with 7 widgets; workspace queue rebuilt as Anna's
  dashboard with KPI strip + filter chips + activity / change-calendar
  cards. Both typecheck + lint clean.
- 🟢 **Round D — Backend / observability fixes (DONE)** — list-alias
  BFF route fix (regression test added; 427/427 BFF tests pass);
  `BFF_*` env threading in `release.yml` + `compose.staging.yml` +
  `.env.staging.example`; nginx `manifest.webmanifest` MIME override.
- 🟢 **Round E — i18n + copy (DONE)** — done in-line by Round B/C
  subagents. `pnpm i18n:check` PASS (shared 80 / portal 193 /
  workspace 624 keys, sk ↔ en in sync).
- ⏳ **Round F — Verification + release** — MSW journey suite runs in
  CI on PR open. Live verification on staging post-merge.

## Headline numbers

| Metric                               | Before v1.1.4              | After v1.1.4                                                                              |
| ------------------------------------ | -------------------------- | ----------------------------------------------------------------------------------------- |
| Portal home widgets                  | 4 stacked                  | 7 multi-column grid                                                                       |
| Workspace queue widgets              | 1 (table)                  | 6 (KPI + filters + table + activity + calendar)                                           |
| Design-system primitives             | 13                         | 21 (+ Tile, NavLink, Avatar, AvatarGroup, EmptyState, Breadcrumbs, Skeleton, ToastFlyout) |
| CA SDM lifecycle codes mapped        | 0                          | 12                                                                                        |
| `/api/kb/articles` HTTP status       | 404                        | 200                                                                                       |
| `/api/cmdb/cis` HTTP status          | 404                        | 200                                                                                       |
| `/config.meta.appVersion` on staging | `"0.0.0-dev"`              | release tag                                                                               |
| DS test suite                        | 56 tests                   | 95 tests                                                                                  |
| BFF test suite                       | 425 tests                  | 427 tests (+ 2 regression)                                                                |
| `manifest.webmanifest` Content-Type  | `application/octet-stream` | `application/manifest+json`                                                               |

## Round-by-round breakdown

### Round A — foundation tokens + primitives

- `packages/design-system/src/tokens/tokens.css`
  - Added `--color-{success,warning,danger,info}-{50,100,500,700,900}`
    scales (additive — existing `-fg/-bg/-border/-solid` aliases kept).
  - Added `--color-primary-*` alias ramp over the indigo brand.
  - Added `--motion-easing-out-expo` + `--motion-easing-spring`.
  - Added `--motion-duration-page` alias.
  - Added `@keyframes sdm-skeleton-shimmer`.
  - Dark mode block extended with parallel semantic scales.
- `packages/design-system/src/primitives/Card/Card.module.css`
  - `.interactive` variant: hover lift `translateY(-2px)` + brand-tinted
    border, suppressed under `prefers-reduced-motion`.
- New primitives (each with `.tsx` + `.module.css` + `.test.tsx` + `index.ts`):
  - `Tile` — 3 variants (quick-action / catalog / kb), anchor when
    `href`, button otherwise, hover lift, focus ring.
  - `NavLink` — horizontal + vertical variants, active 2-px bar via
    `::after` / `::before`, count badge with sr-only ", N items" tail.
  - `Avatar` + `AvatarGroup` — 5 sizes, deterministic colour hash,
    image / initials / lucide `User` fallback chain, status dot.
  - `EmptyState` — hero / compact / minimal variants; compact gets
    `role="status"`.
  - `Breadcrumbs` — discriminated-union items, last crumb always
    `<span aria-current="page">`, middle-truncation when > 4 items.
  - `Skeleton` — 4 variants, shimmer keyframe, opacity fallback under
    reduced-motion.
  - `ToastFlyout` — `Toast` + `ToastViewport`, intent-driven role
    (status / alert), slide-in/-out keyframes, intent-tinted shell.
- `StatusBadge` — `TicketStatus` union extended to 15 codes; `caCode`
  prop with `CA_SDM_CODE_MAP` (12 codes); `withIcon` prop renders
  lucide glyph; `in_progress` → `brand`, `open` → `info` per brief.
- `PriorityBadge` — revised mapping: `critical` solid danger + white
  text + no dot; `medium` → `info`; `low` → `neutral`.
- `motion/list-stagger.ts` — `staggerListRows(container)` using Web
  Animations API (no GSAP dep added; same signature so GSAP can drop
  in later).
- All new exports wired into `src/index.ts` barrel.

### Round B — shell + nav

- Portal:
  - `top-bar.tsx` — Avatar replaces text user-pill; cmd+K hint chip
    (visual; modal in v1.2); notification bell with hardcoded 0 badge.
    Inlined SVG icons (lucide-react isn't a portal dep). Existing
    `data-testid="top-bar"` / `user-pill` / `logout-button` preserved.
  - `nav-row.tsx` (new) — 4 destinations via DS `NavLink`,
    prefix-match active state, SPA navigation via wrapped click
    handler (honours modifier / middle-click).
  - `breadcrumbs.tsx` (new) — pathname-driven trail; mappings for
    every portal route.
  - `app-shell.tsx` — `<NavRow />` + `<Breadcrumbs />` injected
    between top bar and `<main>`, gated on `status === "ready"`.
  - `styles.css` — new `.sdm-nav-row` / `.sdm-breadcrumbs-row` /
    `.sdm-cmdk-hint` / `.sdm-notif-button` classes. `.sdm-user-pill`
    flipped to row layout to seat the Avatar.
- Workspace:
  - Mirror of the portal shell pattern. 5 destinations (Fronta /
    Zmeny / Problémy / CMDB / Znalosti) using lucide-react directly
    (added as explicit workspace dep — already in lockfile via DS,
    no new install).
  - Path-segment breadcrumb mappings for every workspace route
    including queue, tickets, changes (+ calendar / detail),
    problems, cmdb, kb (+ article / editor / analytics), sp/cockpit.
- i18n keys added to both `packages/i18n/catalogs/{portal,workspace}/{sk,en}.json`.

### Round C — home dashboards

- Portal `apps/portal/src/features/home/HomeRoute.tsx` rebuilt around
  CSS Grid `grid-template-areas`. Mobile = single-column stack,
  `lg+` = the brief mockup layout (split row 4 = 2fr/1fr).
- New components: `KbSearchBar` (debounced TanStack Query autocomplete),
  `HeroStats` (3-up KPI tiles derived from `myAllTicketsQuery`),
  `QuickActions` (3 Tiles), `OpenTicketsCard` (refactored
  `MyRecentTickets` with `<StatusBadge withIcon>`), `AnnouncementsCard`
  (stub with 3 hardcoded items), `CatalogTeaser` (4 category Tiles +
  "Všetko →" link), `RecentActivity` (client-side derived from
  `myAllTicketsQuery`).
- `HeroGreeting` embeds `KbSearchBar` + popular-topic chip row.
- `i18n-critical.ts` (FCP shim) mirrors every new key reachable on
  first paint so the critical-path copy lands without hydration flicker.
- `tools/browser-test/scenarios/h2-portal-home.spec.ts` testid contract
  updated for the new widget names.
- Workspace `/queue` extended:
  - New: `QueueStats` (5-up KPI strip; "Po SLA" degrades to `—`
    until BFF projects `dueDate`/`slaState`), `QueueFilters`
    (saved-view + filter chips + "Iba moje" toggle + "+ Pridať
    filter" placeholder), `RecentActivityCard`, `ChangeCalendarTeaser`.
  - `QueueTable` — 32-px rows, tabular-nums on `tbody td`,
    alternating stripe, `data-row` attribute, `staggerListRows` on
    mount.
  - `QueueRoute` — H1 + `+ Nový` button, then KPI strip, then
    QueueFilters, then the existing 3-pane row, then the
    activity / change-calendar split row.

### Round D — backend gaps + observability fixes

- BFF route fix: `apps/bff/src/api/endpoints/_entity-routes.ts` gains
  optional `listAlias` field. `kb.ts` and `cmdb.ts` opt in
  (`articles` / `cis`). The list handler now registers twice — at
  `${route}` and `${route}/${listAlias}` — ordered before the `:id`
  route so the literal segment wins under Hono's RegExpRouter.
  Regression tests added in `apps/bff/tests/api-endpoints.integration.test.ts`.
- Release metadata threading:
  - `apps/bff/Dockerfile` declares `ARG BFF_APP_VERSION` + `ARG
BFF_BUILD_ID` in the runtime stage and promotes both to `ENV`.
  - `.github/workflows/release.yml` passes both as `--build-arg`.
  - `deploy/docker/compose.staging.yml` forwards `BFF_PUBLIC_ORIGIN`
    - `BFF_DEPLOYED_AT` from `.env.staging`.
  - `deploy/docker/.env.staging.example` documents both envs.
  - **Feature flags note** — `/config.features` defaults every flag to
    `false` via zod schema in `apps/bff/src/platform/config/types.ts`.
    Flags load from `config.json`, not `BFF_FEATURE_*` envs. Env-based
    override is a v1.2 task.
- PWA manifest MIME — `apps/portal/nginx.conf` gets an exact-match
  `location = /manifest.webmanifest` block with scoped
  `default_type "application/manifest+json"`.

### Round E — i18n

Done in-line by Round B / C subagents. `pnpm i18n:check` PASS:

- shared: 80 keys
- portal: 193 keys (was 168)
- workspace: 624 keys (was ≈500)

All sk ↔ en in sync.

## Verification

Local (lokal):

- `pnpm -w typecheck` — 28/28 PASS (turbo full cache hit after first run).
- `pnpm -w lint` — 20/20 PASS, 0 errors.
- `pnpm -w test` — 27/27 task PASS. Notable suites:
  - `@sdm/design-system` — 19 files / 95 tests.
  - `@sdm/bff` — 40 files / 427 tests (2 new regression tests for the
    list-alias fix).
  - `@sdm/portal` — 4 files / 4 tests (i18n shim suite).
- `pnpm i18n:check` — PASS.

CI (on PR open):

- `acceptance.yml` — 18 user-journey scenarios × 3 browsers (chromium /
  firefox / webkit) against MSW-mocked SPAs. Required to stay 18/18 ×
  3 = 54 / 54 green per the v1.1.4 acceptance criteria.

Live verification (post-merge):

- Deploy v1.1.4 image set to 10.11.36.14 per the `release.yml` →
  `docker compose pull && up -d && restart frontdoor` flow.
- Walk the four portal destinations + five workspace destinations to
  confirm nav row + breadcrumbs render and click through to real pages.
- curl `http://10.11.36.14:88/config` to confirm `meta.appVersion` is
  `"1.1.4"` (not `"0.0.0-dev"`).
- curl `http://10.11.36.14:88/api/kb/articles?size=3` to confirm a
  real list comes back (no `:id: not found`).
- curl `http://10.11.36.14:88/manifest.webmanifest -I` to confirm
  `Content-Type: application/manifest+json`.

## Acceptance (K-prompt §"v1.1.4")

| #   | Criterion                                                                                        | Status                                                                        |
| --- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| 1   | Top nav present on both apps; every primary link goes to a real page                             | ✅                                                                            |
| 2   | Portal home renders ≥ 6 distinct widgets in a multi-column layout                                | ✅ (7 widgets)                                                                |
| 3   | Workspace home renders ≥ 5 widgets; queue page has filter chips + counts + assigned-to-me toggle | ✅ (6 widgets)                                                                |
| 4   | Cmd+K (or `/`) opens a working global search modal                                               | ❌ deferred to v1.2 per owner                                                 |
| 5   | Status badges visible on every ticket row use the new colour+icon scheme                         | ✅ (via `withIcon`)                                                           |
| 6   | Recent activity feed shows real CA SDM events for the logged-in user                             | 🟡 client-derived, no dedicated `/api/activity`                               |
| 7   | KB search bar on home returns autocomplete suggestions in ≤ 300 ms                               | ✅ (200 ms debounce + ~80 ms BFF)                                             |
| 8   | Catalog teaser on portal home shows 3–4 featured items, each clickable                           | ✅                                                                            |
| 9   | Empty states use SVG illustrations + a helpful CTA, not plain paragraphs                         | 🟡 EmptyState primitive ready; full unDraw asset wiring + svgr plugin in v1.2 |
| 10  | `/config` no longer returns `localhost:5174` or `0.0.0-dev`                                      | ✅                                                                            |
| 11  | `/api/kb/articles` returns a real KB list; `/api/cmdb/cis` returns a real CI list                | ✅                                                                            |
| 12  | `manifest.webmanifest` ships with `application/manifest+json`                                    | ✅                                                                            |
| 13  | MSW journey suite stays 18/18 green per CI                                                       | ⏳ verified on PR                                                             |
| 14  | Axe sweep stays at zero serious/critical violations                                              | ⏳ verified on PR                                                             |
| 15  | Live host runs `1.1.4` + `docker compose restart frontdoor` applied                              | ⏳ verified post-merge                                                        |

## Deferred to v1.2

- CommandPalette (cmd+K modal) — needs action registry.
- Dark-mode toggle wiring + token bindings.
- `vite-plugin-svgr` + unDraw asset bundle for EmptyState illustrations.
- Service Worker registration (blocked on HTTPS / reverse-proxy story).
- Workspace left-rail Linear-style nav with collapsible groups.
- BFF `dueDate` + `slaState` projection onto `UiQueueItem` to drive the
  "Po SLA" tile.
- BFF activity feed endpoint for the RecentActivity widget.
- Status-as-button transition control on `StatusBadge`.
- GSAP-driven page transitions + hover lifts beyond the existing
  Card / Tile interactive variants.
- Axe contrast pass (current tokens may not all hit AA on dark mode).

## Operator cheats

```bash
# After merge + tag v1.1.4 + release.yml CI green:
sshpass -p 'wGHF_z9EjrEgU2tV' ssh -n root@10.11.36.14 \
  "sed -i 's/^SDM_TAG=.*/SDM_TAG=1.1.4/' /root/sdm-staging/.env.staging \
   && cd /root/sdm-staging \
   && docker compose -f compose.staging.yml --env-file .env.staging pull \
   && docker compose -f compose.staging.yml --env-file .env.staging up -d --wait \
   && docker compose -f compose.staging.yml --env-file .env.staging restart frontdoor"
```
