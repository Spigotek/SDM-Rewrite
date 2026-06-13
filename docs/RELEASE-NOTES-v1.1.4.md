# Service Desk Management v1.1.4

**Service Desk Management v1.1.4** — quick-wins release bundling the bug fixes
surfaced by the J.0 live-deploy walkthrough on 2026-06-12 plus the ten
"chcem všetko" UX improvements scoped in `docs/plans/K-prompt.md`.

> Released 2026-06-13. Source tag: [`v1.1.4`](https://github.com/Spigotek/SDM-Rewrite/releases/tag/v1.1.4).
> Full changelog: [`docs/CHANGELOG.md`](./CHANGELOG.md).

## Build metadata — `/config` no longer leaks dev defaults

Up to v1.1.3 the BFF's `GET /config` endpoint shipped placeholder values on
staging — `apiBaseUrl: http://localhost:5174`, `meta.appVersion: "0.0.0-dev"`,
`meta.buildId: "local"` — because `release.yml` did not thread the release
tag and commit SHA into the BFF image, and `compose.staging.yml` did not
forward the public origin. v1.1.4 splits these four envs into a build-time
half baked into the image and a runtime half supplied by the deploy host.

| Env                 | Where it's set                                           | Surfaces in `/config` as                                 | Why this layer                                                 |
| ------------------- | -------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------- |
| `BFF_APP_VERSION`   | **Build-time** `--build-arg` in `release.yml`            | `meta.appVersion`                                        | Tied to the release tag — frozen with the image, never edited. |
| `BFF_BUILD_ID`      | **Build-time** `--build-arg` in `release.yml`            | `meta.buildId`                                           | Tied to the commit SHA — frozen with the image.                |
| `BFF_DEPLOYED_AT`   | **Runtime** in `.env.staging` (operator sets per-deploy) | `meta.deployedAt`                                        | Independent of the image; one image re-deployed twice.         |
| `BFF_PUBLIC_ORIGIN` | **Runtime** in `.env.staging` (host-dependent)           | `auth.bffOrigin` + `apiBaseUrl` (when the file omits it) | Host-dependent; same image runs on different front-door URLs.  |

### Build-time wiring

`apps/bff/Dockerfile` declares `ARG BFF_APP_VERSION` and `ARG BFF_BUILD_ID`
in the runtime stage and promotes both to `ENV`, so `applyEnvOverrides` in
`apps/bff/src/platform/config/load.ts` picks them up at process start with
no extra runtime wiring. `.github/workflows/release.yml` passes
`BFF_APP_VERSION=${{ steps.meta.outputs.version }}` and
`BFF_BUILD_ID=${{ github.sha }}` to `docker buildx build`.

### Runtime wiring

`deploy/docker/compose.staging.yml` forwards `BFF_PUBLIC_ORIGIN` and
`BFF_DEPLOYED_AT` into the BFF container. The operator sets both in
`.env.staging` (see `.env.staging.example`):

```bash
BFF_PUBLIC_ORIGIN=http://10.11.36.21:88
export BFF_DEPLOYED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
SDM_TAG=1.1.4 docker compose -f compose.staging.yml --env-file .env.staging up -d --pull always
```

When `BFF_DEPLOYED_AT` is unset the BFF falls back to `new Date().toISOString()`
at process start.

### Feature flags

`/config`'s `features` object (`kbEditor`, `cmdbVisualizer`, `bulkOperations`,
`changeCalendar`, `reportingWidgets`) defaults every flag to `false` per the
zod schema in `apps/bff/src/platform/config/types.ts`. These flags are read
from `config.json` (or the in-memory default in `createConfigLoader`), **not**
from individual `BFF_FEATURE_*` envs. To flip a flag for staging, ship a
`config.json` next to the BFF binary or bind-mount one over the image's
working directory; an env-based override is a separate v1.2 task.

## UX overhaul — portal home + workspace queue dashboard

Per `docs/plans/K.1-design-brief.md` (synthesised from ServiceNow, JSM,
Freshservice, Zendesk and Linear/Notion design scouts), v1.1.4 ships the
"quick wins bundle" against the owner's verdict that the v1.1.3 portal
felt "lacný, strohý, ako keby do školy". The full redesign — typography
pass, dark mode, GSAP motion, sidebar nav, axe-clean a11y audit — lands
in v1.2.

### Portal — `apps/portal/src/features/home/HomeRoute.tsx`

Rebuilt around CSS Grid `grid-template-areas`. **Seven distinct widgets**
in a multi-column layout on `lg+` viewports, single-column stack on
mobile:

1. **HeroGreeting + KbSearchBar + popular-topic chips** — full-width
   row 1. KB autocomplete debounced 200 ms via TanStack Query against
   `/api/kb?q=…&size=6`; suggestions land in ≤ 300 ms per acceptance.
2. **HeroStats** — 3-up KPI tiles (Otvorené, Čakajúce na odpoveď,
   Vybavené tento týždeň) derived client-side from `myAllTicketsQuery`.
   Tabular-nums on every count.
3. **QuickActions** — 3 large `<Tile>` primitives (Nahlásiť problém,
   Hardvér / Softvér, Reset hesla). Routes through `useNavigate()` for
   SPA semantics.
4. **OpenTicketsCard** + **AnnouncementsCard** — 2-col split row 4,
   2fr/1fr on `lg+`. OpenTicketsCard reuses the v1.1.3 row markup with
   the new `<StatusBadge withIcon>` lucide-glyph variant.
5. **CatalogTeaser** — 4 category tiles + "Všetko →" link.
6. **RecentActivity** — top 10 status-change events on the user's
   tickets, derived client-side from `myAllTicketsQuery` (no new BFF
   endpoint).

### Workspace — `apps/workspace/src/features/queue/QueueRoute.tsx`

`/queue` becomes Anna's home dashboard (the workspace `/` already
redirects there). Five widgets wrap the existing dense queue table:

1. **QueueStats** — 5-up KPI strip (Otvorené, Moje, Po SLA, < 1h, Dnes).
   "Po SLA" degrades to `—` with a "Bez SLA" subtitle until the BFF
   projects `dueDate`/`slaState` onto `UiQueueItem` (one-liner in
   `apps/bff/src/aggregator/queue.ts` — v1.2 task).
2. **QueueFilters** — saved-view `<select>`, removable active filter
   chips, "Iba moje" toggle, "+ Pridať filter" placeholder (full
   composer in v1.2).
3. **Dense queue table** — row height tightened to 32 px, alternating
   stripe, tabular-nums on every numeric column, `data-row` attribute
   on every `<tr>` so the new `staggerListRows()` motion primitive
   animates rows on mount.
4. **RecentActivityCard** — last 10 ticket-assignment / status-change
   events involving the current agent, derived from the queue dataset.
5. **ChangeCalendarTeaser** — next 5 scheduled changes (reuses
   `changesListQuery`), links to `/changes/calendar`.

### Shared shell upgrades (both apps)

- **Top nav row** — horizontal `<NavLink>` row under the top bar.
  Portal: Domov · Moje tickety · Katalóg · Pomocník. Workspace: Fronta ·
  Zmeny · Problémy · CMDB · Znalosti. Active-state detection via
  pathname prefix-match; SPA navigation preserved via `useNavigate()`
  with modifier-key/middle-click honoured.
- **Breadcrumbs** under the nav row on every non-root route, derived
  synchronously from `useLocation().pathname` (avoids `useMatches()`
  flicker on lazy chunk loads). Last crumb is always non-link
  `aria-current="page"`.
- **Cmd+K hint chip** — visual-only placeholder in the top bar. The
  command palette modal itself ships in v1.2.
- **Notification bell** — clickable icon with a count badge, currently
  hardcoded to 0. SSE wiring (`/api/events` from J.3) lands in v1.2.
- **Avatar** in the user pill — design-system `<Avatar>` primitive with
  deterministic colour hash from `session.displayName`, image fallback,
  initials, then lucide `User` icon.

### Design-system extensions — `packages/design-system/src/`

- **New primitives** (all under `src/primitives/`): `Tile`, `NavLink`,
  `Avatar` + `AvatarGroup`, `EmptyState`, `Breadcrumbs`, `ToastFlyout`
  - `ToastViewport`, `Skeleton`. All wired through the package barrel;
    consumers tree-shake via the existing `exports` map.
- **Token additions** in `src/tokens/tokens.css`: full 50/100/500/700/900
  semantic scales for `success` / `warning` / `danger` / `info`
  (additive — existing `-fg`/`-bg`/`-border`/`-solid` aliases kept);
  `--color-primary-*` alias ramp for the indigo `--color-brand-*`;
  `--motion-easing-out-expo` + `--motion-easing-spring`;
  `--motion-duration-page` alias; `@keyframes sdm-skeleton-shimmer`.
- **Card.module.css** — `interactive` variant now applies a 2 px upward
  translate + brand-tinted border on hover, suppressed under
  `prefers-reduced-motion`.
- **StatusBadge** — extended `TicketStatus` union to 15 codes covering
  every CA SDM 17.4 lifecycle state. New `caCode` prop (e.g. `WIP`,
  `WC`, `AP`) resolves to canonical statuses via the documented
  CA SDM → status map. New `withIcon` prop renders a lucide glyph
  matched to the status family. Mapping changes per K.1 brief §6.4:
  `in_progress` → `brand` (was `warning`), `open` → `info` (was
  `warning`).
- **PriorityBadge** — revised mapping per K.1 brief §6.5:
  `critical` is now rendered as a solid red lozenge with white text
  and **no dot** (Polaris severity rule); `medium` → `info` (was
  `warning`); `low` → `neutral` (was `success`).
- **Motion primitive** — new `staggerListRows(container)` utility in
  `src/motion/list-stagger.ts`. Web Animations API (no GSAP dep added).
  20 ms per row, 480 ms total cap, `prefers-reduced-motion` honoured.

## Fixes

- **PWA manifest MIME type** — `apps/portal/nginx.conf` now serves
  `manifest.webmanifest` as `application/manifest+json` via an explicit
  `location =` block with a scoped `default_type`. Without this, nginx's
  stock `mime.types` falls back to `application/octet-stream`, which Chrome
  refuses to honor as a Web App Manifest (the install prompt silently
  fails and DevTools logs `Manifest: Line: 1, column: 1, Unexpected token.`).

- **`/api/kb/articles` + `/api/cmdb/cis` 404s** —
  `apps/bff/src/api/endpoints/_entity-routes.ts` now accepts an optional
  `listAlias` field on the per-entity config. When set, the list handler
  is registered both at `${route}` (e.g. `/api/kb`) and at
  `${route}/${listAlias}` (e.g. `/api/kb/articles`), ordered BEFORE the
  parameterised `:id` route so the literal segment wins under Hono's
  RegExpRouter. `kb.ts` sets `listAlias: "articles"`; `cmdb.ts` sets
  `listAlias: "cis"`. Response shape identical to the existing list
  routes — SPA + MSW handlers unaffected. Regression tests added in
  `apps/bff/tests/api-endpoints.integration.test.ts`.

## Known limitations

- **Service Worker does not register on staging.** The staging host
  (`http://10.11.36.14:88`) serves the portal over plain HTTP on a custom
  port. The
  [Service Worker spec][sw-spec]
  restricts registration to secure contexts — i.e. HTTPS origins, or
  `http://localhost` / `http://127.0.0.1` — so Chrome (and every other
  evergreen browser) refuses to register `/sw.js` on the staging origin.
  Symptoms observed in DevTools:

  > `An SSL certificate error occurred when fetching the script.` > `Failed to register a ServiceWorker: The URL protocol of the current
origin ('http://10.11.36.14:88') is not supported.`

  Consequences while staging stays on plain HTTP:

  - No offline shell, no Workbox runtime caching (`api-v1`,
    `session-v1`, `kb-attachments-v1` strategies declared in
    `apps/portal/vite.config.ts` are dormant).
  - The `vite-plugin-pwa` `autoUpdate` lifecycle is a no-op — users won't
    see the "new version available" prompt and depend on a full reload.
  - The fixed manifest still parses and renders the install prompt on
    desktop Chrome over plain HTTP, but iOS Safari "Add to Home Screen"
    requires HTTPS too and is therefore also unavailable until the host
    gets a TLS certificate.

  Deferred to **v1.2** alongside the dark-mode toggle and the broader
  HTTPS / reverse-proxy story (likely Caddy or Traefik in front of the
  existing compose stack, with Let's Encrypt or an internal CA).

[sw-spec]: https://www.w3.org/TR/service-workers/#start-register

## Affected artefacts

- `ghcr.io/spigotek/sdm-portal:1.1.4` (also `1.1`, `latest`) — multi-arch
  (`linux/amd64` + `linux/arm64`).
- `ghcr.io/spigotek/sdm-bff:1.1.4` / `sdm-workspace:1.1.4` — re-cut for
  chart parity.
- Helm chart `oci://ghcr.io/spigotek/charts/sdm:1.1.4` — chart version +
  `appVersion` bumped, no template changes for this fix.
