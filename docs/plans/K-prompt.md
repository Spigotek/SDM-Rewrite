# Phase K — Portal + Workspace UX overhaul (v1.1.4 + v1.2.0)

> **Use this prompt after `/clear`.** It is intentionally self-contained: paste it
> verbatim into the fresh session. Don't précis — the new agent needs every
> section to start swinging without re-doing discovery.

## Mission

Make SDM-Rewrite **feel professional**. Current portal (`:88`) is an MVP shell —
hero greeting, 2 action cards, a 5-row ticket list, a 4-row KB suggestion list,
no navigation, no overview widgets, no global search, broken links into
unfinished pages. Workspace (`:89`) is denser but visually identical and shares
the same shell. The owner described it as "lacný, strohý, ako keby do školy"
(cheap, plain, school-project look). Fix that.

Deliver two phases:

- **v1.1.4 — Quick wins bundle** (~4-6 h of agent work). One PR, one tag.
  Replace placeholders, add the high-impact widgets and navigation that make
  the portal feel "alive". Both portal and workspace.
- **v1.2.0 — Full redesign** (~1 day+ of agent work). Multi-PR feature branch
  (or one large PR). New color system, typography pass, motion design, dark
  mode toggle, accessibility audit, multi-page polish.

Both portal **and** workspace get the redesign. Core design language is shared
(same colour tokens, typography, components, motion); only layouts differ —
portal = customer-friendly, workspace = agent-dense.

## Where you are

| Field                | Value                                                                                                                                                                                                                  |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Working dir          | `/Users/spigot/Desktop/CC_Projekty/SDM-Rewrite`                                                                                                                                                                        |
| Branch               | `main` (clean tree after v1.1.3 merge)                                                                                                                                                                                 |
| Last tag             | `v1.1.3` (live on staging, see `memory/v1_1_released.md`)                                                                                                                                                              |
| Deploy target        | RHEL 9 host `10.11.36.14` per `memory/deploy_target.md` (root user)                                                                                                                                                    |
| CA SDM backend       | `http://10.11.35.35:8050/caisd-rest` (vueuser / `Vue@user123!`) per `memory/real_backend.md`                                                                                                                           |
| Live URLs            | `http://10.11.36.14:88` portal, `:89` workspace                                                                                                                                                                        |
| Tech stack           | Vite + React 19 + TypeScript strict, CSS Custom Properties (Catppuccin-inspired tokens), `lucide-react` icons, GSAP animations, TanStack Query, `react-router-dom` v6 lazy routes. **No Tailwind. No CSS frameworks.** |
| Browser test rig     | `tools/browser-test/` (Playwright 1.60 chromium/firefox/webkit) — MSW + live modes                                                                                                                                     |
| Design system        | `packages/design-system/` (exports `StatusBadge`, etc. — small primitive set)                                                                                                                                          |
| Branding seen so far | "SDM" wordmark in indigo `#5d4dff`-ish, off-white surface, no dark mode                                                                                                                                                |

**Read these first** (in parallel; each via the `Explore` subagent so you don't
burn main-context tokens):

1. `docs/ROADMAP.md` §Aktuálny stav (v1.1.1 LIVE banner; J.0 ✅ DONE) — gives
   you the whole timeline in 5 lines.
2. `docs/plans/J.0.md` §"Smoke session — 2026-06-07 (closure)" — confirms the
   deploy shape (compose stack on `/root/sdm-staging/`) and the
   mock-vs-real-data divergence pattern.
3. `apps/portal/src/features/home/HomeRoute.tsx` + `home.css` —
   _the_ file to surpass. Currently 4 widgets stacked. New design replaces this
   wholesale.
4. `apps/portal/src/shell/top-bar.tsx` — current "nav" is just the brand,
   tenant pill, language switcher, sign-out. Add a real nav row underneath.
5. `apps/portal/src/routes/index.tsx` + `apps/workspace/src/routes/index.tsx` —
   route maps.
6. `packages/i18n/catalogs/{portal,workspace}/sk.json` — i18n keys; add
   namespaces alongside existing `home.*`, `myTickets.*` etc.
7. `packages/design-system/` — extend primitives, don't fork.

Existing browser-test exploration spec from earlier session lives at
`tools/browser-test/scenarios/live-exploration/live-explore.spec.ts` (and its
config `playwright.config.live-explore.ts`). They were never committed; check
`git stash list` — if present, `git stash apply` them. They are descriptive
probes (record-only, all-pass), useful for live verification after deploy.

## Recent shipped fixes (so you know what's already done)

- **v1.1.1** (J.0.1) — BFF Dockerfile CMD: stub `tsx/esm src/index.ts` → `node
dist/index.js`. Without this fix every BFF container crashes on boot.
- **v1.1.2** — portal `parseTicketParam` accepts bare numeric IDs
  (`/tickets/407804`); previously only colon-prefixed worked because MSW
  fixtures shape them that way.
- **v1.1.3** — portal `/tickets` placeholder replaced with full "Moje tickety"
  list page (up to 50 incidents where `customer=me`, links through to the
  v1.1.2 detail route).

After each tag the host needs `docker compose pull && up -d` and then
`docker compose restart frontdoor` (the nginx upstream caches the BFF IP and
goes 502 after a BFF recreate — confirmed lesson learned).

## Outstanding bugs surfaced by the J.0 live walkthrough

Bundle these into **v1.1.4** (they fit the "make it work" goal and need fixing
either way):

1. **`/config` ships dev metadata.** `apiBaseUrl: http://localhost:5174`,
   `appVersion: "0.0.0-dev"`, `buildId: "local"`, all feature flags `false`.
   Root cause: `release.yml` does not pass `BFF_APP_VERSION`, `BFF_BUILD_ID`,
   `BFF_DEPLOYED_AT`, `BFF_PUBLIC_ORIGIN` to the BFF image at build/run time.
   Fix: thread them as `build-args` or runtime envs and re-cut.
2. **`/api/kb/articles` and `/api/cmdb/cis` return 404** despite the BFF route
   table listing them. Error body: `GET /api/kb/:id: not found`. Smells like
   route registration order — the `:id` catch-all wins over the literal
   `articles` segment. Investigate `apps/bff/src/api/endpoints/kb*.ts` and
   `cmdb*.ts`.
3. **PWA `manifest.webmanifest`** served with `Content-Type:
application/octet-stream` (should be `application/manifest+json`). Fix in
   portal's `nginx.conf` (or service-worker registration).
4. **Service Worker does not register on staging** because the deploy is plain
   HTTP — SW requires HTTPS or `localhost`. Defer to v1.2 alongside dark-mode
   work, but document the limitation honestly in the v1.1.4 release notes.

## v1.1.4 scope — Quick wins (all 10)

Implement everything below. Owner explicitly said "chcem všetko". Each item
ships in both portal and workspace where applicable. Where workspace already
has a richer version, reuse its component.

| #   | What                                    | Portal        | Workspace                                                                                                                                                                                                                          | Notes                                                                                                                                                                                                              |
| --- | --------------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Dashboard widgets (counts + SLA timers) | ✓ home        | ✓ queue page                                                                                                                                                                                                                       | Counts: open / awaiting reply / resolved this week. SLA: top-3 tickets nearest breach (read from CA SDM `due_date` if present, else stub with "no SLA".                                                            |
| 2   | Working top navigation + breadcrumbs    | ✓             | ✓                                                                                                                                                                                                                                  | Portal: Domov · Moje tickety · Katalóg · Pomocník. Workspace: Domov · Queue · Zmeny · CMDB · KB. Use `lucide-react` icons. Breadcrumbs on every detail route.                                                      |
| 3   | Prominent KB search bar on home         | ✓ portal home | ✓ workspace KB page                                                                                                                                                                                                                | Big input + autocomplete dropdown (TanStack Query, 200 ms debounce). Hits `/api/kb` with query param.                                                                                                              |
| 4   | Service catalog teaser on home          | ✓ portal home | —                                                                                                                                                                                                                                  | 3-4 featured catalog cards with icons + price/SLA. Click → /catalog/:id. Pull from `/api/catalog/items?featured=true`.                                                                                             |
| 5   | Recent activity feed                    | ✓ portal home | ✓ workspace home                                                                                                                                                                                                                   | Last 10 timeline events on tickets the user owns/is assigned to. Use `/api/tickets/:type/:id` activity blobs (already returned).                                                                                   |
| 6   | Status badges with colour + icon        | ✓ both        | extend `@sdm/design-system` `StatusBadge` — map every CA SDM status code to a colour family (open=indigo, in-progress=amber, blocked=red, resolved=green, closed=neutral) + lucide icon.                                           |
| 7   | Hero with personalised stats            | ✓ portal      | ✓ workspace                                                                                                                                                                                                                        | Portal: "Máš 4 otvorené, 1 čaká na odpoveď, 2 vyriešené tento týždeň". Workspace: "Pridelených ti je 12, 3 prešli SLA". Counts come from existing `/api/incidents?customer=me` + new `/api/incidents?assignee=me`. |
| 8   | Notifications / message center          | ✓ both        | top-bar icon with unread count badge; dropdown lists last 10 events. Source: SSE `/api/events` (J.3 already shipped, but unwired in the SPA shell) + polling fallback.                                                             |
| 9   | Global search                           | ✓ both        | top-bar `cmd+k` modal (or `/` shortcut) — searches tickets + KB + catalog (portal) or +CMDB (workspace). One BFF aggregator endpoint may be needed; if it doesn't exist, fan out client-side queries with `Promise.all` and merge. |
| 10  | Empty states with illustrations         | ✓ both        | replace all "Zatiaľ žiadne tickety…" plain text with an SVG illustration + helpful CTA. Bundle a tiny inline-SVG set, not a 3rd-party lib.                                                                                         |

Stretch in v1.1.4 if time permits: dark-mode token scaffolding (don't wire the
toggle yet — that's v1.2), polish on detail pages.

## v1.2.0 scope — Full redesign

When v1.1.4 is shipped and live-verified, start v1.2 work on a feature branch
(`feat/v1.2-redesign`). Multi-PR if you prefer; or one PR per slice
(design-system, portal-shell, workspace-shell, dark-mode, motion, a11y).

1. **New colour system.** Replace ad-hoc CSS vars with a proper scale: brand
   primary (indigo) 50→900, neutral 50→900, semantic (success/warning/danger/
   info) 50→900. Define in `packages/design-system/tokens.css`. Wire both
   light and dark mode variants.
2. **Typography pass.** One sans (Inter or system stack) + one mono (JetBrains
   Mono). Scale: 12/14/16/18/20/24/30/36/48. Line heights tight on display,
   relaxed on body. Tabular numerals on ticket refs + counts.
3. **Motion design.** GSAP-driven page transitions, list-item stagger on
   route mount, hover lifts (`transform: translateY(-2px)` + soft shadow),
   skeleton shimmer instead of plain "loading…" text. Respect
   `prefers-reduced-motion`.
4. **Responsive grid refresh.** Sidebar nav on `lg+` viewports (currently top
   nav only). Persistent left rail with collapsible groups. Mobile: hamburger
   - bottom nav for primary actions.
5. **Dark mode.** Toggle in top bar; persists in `localStorage`. Honour
   `prefers-color-scheme` on first visit.
6. **A11y audit.** Targeted: tab order, focus rings, `aria-current` on nav,
   skip-link, contrast ratios ≥ AA on all text, `prefers-reduced-motion`
   honoured. Re-run the existing axe-sweep — should land zero
   serious/critical violations on every route.
7. **Multi-page polish.** Each route gets the same treatment as the home:
   - Portal: `/new-incident`, `/catalog`, `/catalog/:id`, `/kb`,
     `/kb/article/:id`, `/tickets`, `/tickets/:id`.
   - Workspace: `/queue`, `/changes/calendar`, `/cmdb`, `/cmdb/:id`,
     `/kb` (browse + editor), `/changes/:id`.

## Design direction — "best of"

The owner said _"pozbieraj to najlepšie z menovaných a prekvap ma"_. Source
list from the elicitation:

- **ServiceNow Now Platform** — enterprise density + clear status hierarchy.
- **Jira Service Management** — clean SaaS feel, blue accents, icon clarity.
- **Freshservice / Zendesk** — friendly, illustrations, warm.
- **Linear / Notion** — minimalist + polish, gradients, micro-animations.

Synthesise. Don't slavishly copy any one. The bar is "feels like 2026 SaaS",
not "looks like CA SDM 17.4 wearing a CSS hat".

## How to work — agent dispatch plan

Heavy parallel use of subagents in the design phase per the owner's brief
("subagentov hlavne pri návrhu dizajnu"). Implementation is mostly main-agent
work with focused subagent fan-out where files don't conflict.

### Phase 1 — Design exploration (parallel; one message, many `Agent` calls)

Spawn **5 subagents** in parallel via the `Agent` tool with
`subagent_type: "general-purpose"`. Brief each like a designer who's seen
nothing yet — paste the mission, the tech stack, and the constraint that the
target is a B2B ITSM portal for two personas (customer Lucia + agent Anna).

- **subagent: design-scout-servicenow**
  _Role_: senior product designer who studied ServiceNow Now Platform. Output:
  a markdown "moodboard" — colour swatches with hex codes, typography
  notes, spacing scale observations, 3 widget shapes worth borrowing. Save to
  `docs/plans/k-design/scout-servicenow.md`. Cap report ≤ 300 lines.
- **subagent: design-scout-jsm**
  _Role_: same shape, but for Atlassian Jira Service Management.
  Output → `docs/plans/k-design/scout-jsm.md`.
- **subagent: design-scout-freshservice**
  _Role_: same shape, but for Freshservice + Zendesk. Output →
  `docs/plans/k-design/scout-freshservice.md`.
- **subagent: design-scout-linear-notion**
  _Role_: same shape, but for Linear + Notion. Pay attention to motion,
  gradients, micro-typography. Output →
  `docs/plans/k-design/scout-linear-notion.md`.
- **subagent: design-scout-icons-empty**
  _Role_: research the best lightweight illustration / empty-state systems
  (e.g. unDraw, Storyset, Saly, Heroicons, lucide). Recommend a single source
  for SDM, with licence notes. Output →
  `docs/plans/k-design/scout-illustrations.md`.

**Once all 5 reports are back**, spawn:

- **subagent: design-synthesis**
  _Role_: principal product designer. Inputs: the 5 scout reports. Output:
  `docs/plans/k-design/brief.md` — the unified SDM design brief.

  Must contain, concretely:

  1. Brand colour palette (primary scale 50→900 with hex; neutral 50→900;
     semantic success/warning/danger/info 50→900).
  2. Typography choice + scale + tabular numerals rule.
  3. Spacing scale (4/8/12/16/24/32/48/64).
  4. Radius scale (4/8/12/16, full).
  5. Shadow scale (sm/md/lg with rgba).
  6. Component patterns: NavLink, Card, Tile, StatusBadge, Avatar, IconButton,
     EmptyState, ToastFlyout, CommandPalette (cmd+k), Skeleton.
  7. Motion rules: durations (120/180/240ms), easings (linear / ease-out /
     ease-in-out), reduced-motion fallback.
  8. Light + dark mode token specifications.
  9. Two ASCII / mermaid mockups: portal home, workspace queue.

After the synthesis lands, the owner sees it before implementation starts.
**Pause and `AskUserQuestion`** with options: "GO as drafted", "tweak X",
"redo Y".

### Phase 2 — Implementation (mixed parallel + sequential)

After GO:

**Round A — Shared foundation** (sequential; main agent):

- Update `packages/design-system/tokens.css` with the new scale.
- Update `packages/design-system/src/index.ts` to export new primitives:
  `<Card>`, `<Tile>`, `<NavLink>`, `<IconButton>`, `<EmptyState>`,
  `<Skeleton>`, `<CommandPalette>`. Extend existing `<StatusBadge>` with
  the new status→colour→icon mapping.
- Wire `lucide-react` icons systematically (no inline SVG except for
  illustration empty states).

**Round B — Shell + nav** (parallel; spawn 2 subagents, separate file
boundaries):

- **subagent: portal-shell-nav**
  Replace `apps/portal/src/shell/top-bar.tsx` and add a new
  `apps/portal/src/shell/nav-rail.tsx` (or row nav under top-bar) with the
  four primary destinations. Breadcrumbs component under nav for every
  non-root route. CommandPalette modal mounted in shell.
- **subagent: workspace-shell-nav**
  Same for `apps/workspace/src/shell/*`. Workspace nav has more
  destinations and may use a persistent left rail (Linear-style).

**Round C — Home dashboards** (parallel; spawn 2 subagents):

- **subagent: portal-home-dashboard**
  Replace `apps/portal/src/features/home/HomeRoute.tsx` with the new
  multi-widget dashboard. Components: HeroStats, QuickActions (3 large
  tiles), KbSearchBar, OpenTicketsCard, CatalogTeaser, RecentActivity,
  AnnouncementsCard (stub OK). Reuse `myTicketsQuery` for counts; add new
  `myStatsQuery` if needed (BFF endpoint may need a thin aggregator —
  coordinate with backend agent below).
- **subagent: workspace-home-dashboard**
  Equivalent for workspace. Widgets: AssignedQueueCard, SlaBreachCard,
  RecentActivity, ChangeCalendarTeaser, GlobalSearchBar (cmd+k hint).

**Round D — Backend gaps + observability fixes** (parallel):

- **subagent: bff-route-fix**
  Investigate `/api/kb/articles` + `/api/cmdb/cis` 404s. Likely a route
  registration order issue in `apps/bff/src/api/routes.ts` or the kb / cmdb
  endpoint modules. Fix without expanding F.4 audit taxonomy (frozen).
- **subagent: release-meta**
  Patch `.github/workflows/release.yml` to thread `BFF_APP_VERSION`,
  `BFF_BUILD_ID`, `BFF_DEPLOYED_AT`, `BFF_PUBLIC_ORIGIN` (compose env may
  feed the latter at deploy time, but the former three should come from
  the tag). Verify `/config` no longer leaks dev metadata.
- **subagent: pwa-manifest-fix**
  Adjust `apps/portal/nginx.conf` so `manifest.webmanifest` ships with
  `Content-Type: application/manifest+json`. Document SW HTTPS requirement
  in v1.1.4 release notes.

**Round E — i18n + copy** (sequential; main agent):

- Extend `packages/i18n/catalogs/{portal,workspace}/{sk,en}.json` with all
  new strings for nav, dashboard widgets, empty states. Keep namespacing
  consistent (`nav.*`, `dashboard.*`, `notifications.*`, etc.).

**Round F — Polish, motion, accessibility** (sequential; v1.2 only):

- GSAP route transitions, list-stagger, hover lifts. `prefers-reduced-motion`
  guard.
- Dark-mode toggle wired to root `[data-theme]` attribute + `localStorage`.
- Axe sweep — zero serious/critical violations across all routes.

### Phase 3 — Verification + release

Each phase ends with **parallel verification**:

- **subagent: qa-live-verify**
  Drive Playwright headless against `http://10.11.36.14:88` and `:89` with
  a clean context, login as `vueuser` / `Vue@user123!`, walk every route,
  capture screenshots into `tools/browser-test/.playwright/runs/k-verify-<ts>/`,
  report visible issues (broken layouts, console errors, network 4xx/5xx).
  Don't write assertion-based tests yet — descriptive probes only. Cap report
  ≤ 400 words.
- **subagent: qa-msw-suite**
  Run `pnpm --filter @sdm/browser-test exec playwright test scenarios/acceptance/`
  in MSW mode. The 18 journeys must stay green per the PR-flow contract.

Release cadence:

- v1.1.4: one PR, one tag. After CI green → merge with
  `gh pr merge <N> --squash --admin --delete-branch` → tag `v1.1.4` → push →
  `gh run watch` the release workflow → on host
  `cd /root/sdm-staging && docker compose pull && docker compose up -d && docker compose restart frontdoor`.
- v1.2.0: same shape, possibly with multiple intermediate PRs all targeting a
  long-lived `feat/v1.2-redesign` branch, then one final merge to `main` +
  tag.

## Constraints & quality bars

**Do not change**:

- F.4 audit taxonomy (`docs/agents/security/audit-taxonomy.md`). New ops
  compose under existing event names with `details.op` discriminators.
- BFF env var contract (`CASDM_*`, `BFF_*`); compose stack + on-host
  `.env.staging` depend on these exact names.
- MSW handlers' response shapes — the journey suite relies on them.
- Helm chart values structure (only release.yml threading + chart version
  bump per `release.yml` `sed`).

**Use**:

- `lucide-react` for icons (already a dep).
- `gsap` for animations (already a dep).
- CSS Custom Properties + plain CSS files. **No Tailwind. No Emotion.
  No styled-components.**
- TanStack Query for all server state.
- Existing `@sdm/design-system` primitives — extend them, don't fork.
- `pnpm` for package management; never `npm install` or `yarn`.

**Project rules** (from `.claude/rules/*.md`, already in your context):

- TDD-flavoured workflow: understand → plan → implement → test → report.
- Define DoD checklists before coding.
- Don't commit via `git` unless instructed.
- Use mermaid for diagrams, no other graphing libs.
- Refactor continuously; delete dead code; comments explain WHY not WHAT.
- Slovak chat, English code/commits/PRs/docs (per `memory/user_communication.md`).
- Terse responses, no trailing summaries (per the same memory).

**PR discipline** (per `memory/feedback_pr_flow.md`):

- One PR per chunk. No stacked PRs.
- Squash merge with `--admin --delete-branch`.
- Tag pattern `v1.x.y` triggers `release.yml`. The workflow re-builds + pushes
  images, packages helm chart, and creates GitHub release.

## Acceptance criteria

### v1.1.4

- [ ] Top nav present on both apps; every primary link goes to a real page
      (no 404, no placeholder).
- [ ] Portal home renders ≥ 6 distinct widgets in a multi-column layout
      (not a single stacked column on desktop).
- [ ] Workspace home renders ≥ 5 widgets; queue page has filter chips +
      counts + assigned-to-me toggle.
- [ ] Cmd+K (or `/`) opens a working global search modal.
- [ ] Status badges visible on every ticket row use the new colour+icon scheme.
- [ ] Recent activity feed shows real CA SDM events for the logged-in user.
- [ ] KB search bar on home returns autocomplete suggestions in ≤ 300 ms.
- [ ] Catalog teaser on portal home shows 3-4 featured items, each clickable.
- [ ] Empty states use SVG illustrations + a helpful CTA, not plain paragraphs.
- [ ] `/config` no longer returns `localhost:5174` or `0.0.0-dev`.
- [ ] `/api/kb/articles` returns a real KB list (was 404). `/api/cmdb/cis`
      returns a real CI list (was 404).
- [ ] `manifest.webmanifest` ships with `application/manifest+json`.
- [ ] MSW journey suite stays 18/18 green per CI.
- [ ] Axe sweep stays at zero serious/critical violations.
- [ ] Live host runs `1.1.4` + `docker compose restart frontdoor` applied.

### v1.2.0

- [ ] Brand colour scale + neutral + semantic scales in `tokens.css`, used
      everywhere.
- [ ] Dark-mode toggle works + persists; honours `prefers-color-scheme` on
      first visit.
- [ ] GSAP page transitions + list staggers on every route mount.
- [ ] Inter (or chosen sans) + mono font loaded with proper subsetting +
      `font-display: swap`.
- [ ] Sidebar nav on `lg+` viewports for both apps.
- [ ] Mobile hamburger + bottom nav working.
- [ ] Every detail route polished — no naked DOM, no placeholder spacing.
- [ ] Axe sweep zero serious/critical violations.
- [ ] LHCI mobile portal `/` LCP ≤ 2.5 s + Performance score ≥ 0.85 (don't
      regress J.8 baseline).

## Operator helpers (copy/paste cheats)

### SSH to host

```bash
sshpass -p 'wGHF_z9EjrEgU2tV' ssh -n \
  -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile=/dev/null \
  -o LogLevel=ERROR -o PreferredAuthentications=password -o PubkeyAuthentication=no \
  root@10.11.36.14 '<cmd>'
```

### Login as vueuser (cookie capture)

```bash
curl -sS -c /tmp/sdm.txt -H "Content-Type: application/json" \
  -H "Origin: http://10.11.36.14:88" -X POST \
  -d '{"username":"vueuser","password":"Vue@user123!"}' \
  http://10.11.36.14:88/auth/login
C=$(grep sdm.sid /tmp/sdm.txt | awk '{print "sdm.sid="$NF}')
# Use $C as cookie on subsequent calls
```

### Deploy a tag to host

```bash
# Bump the tag in env, pull, recreate, refresh nginx upstream
sshpass -p 'wGHF_z9EjrEgU2tV' ssh -n root@10.11.36.14 \
  "sed -i 's/^SDM_TAG=.*/SDM_TAG=1.1.4/' /root/sdm-staging/.env.staging \
   && cd /root/sdm-staging \
   && docker compose -f compose.staging.yml --env-file .env.staging pull \
   && docker compose -f compose.staging.yml --env-file .env.staging up -d --wait \
   && docker compose -f compose.staging.yml --env-file .env.staging restart frontdoor"
```

(`restart frontdoor` is **mandatory** after a backend container recreate —
nginx caches the BFF IP and goes 502 otherwise. Lesson learned.)

### Local typecheck before pushing

```bash
pnpm --filter @sdm/portal typecheck
pnpm --filter @sdm/workspace typecheck
pnpm --filter @sdm/bff typecheck
```

### CI watch

```bash
gh pr checks <PR> --watch
gh run watch <run-id> --exit-status
```

## Tracking & artefacts

Create these as you go (not all at once):

- `docs/plans/K-prompt.md` — this file. Don't touch it; it's the contract.
- `docs/plans/K.1-design-brief.md` — the synthesised design brief (Phase 1
  output). One file, not five.
- `docs/plans/K.2-v1.1.4.md` — quick-wins post-mortem (per-chunk plan +
  results). Mirror the J.x.md style.
- `docs/plans/K.3-v1.2.md` — full-redesign post-mortem.
- `docs/RELEASE-NOTES-v1.1.4.md`, `RELEASE-NOTES-v1.2.0.md`.
- `docs/CHANGELOG.md` — `[1.1.4]` and `[1.2.0]` sections.
- `docs/ROADMAP.md` — banner update after each tag, Phase K entry under §Fázy.
- `memory/v1_1_released.md` — append v1.1.4 facts.
- `memory/v1_2_released.md` — new memory after v1.2 ships.

Per-chunk file storage for the design scouts → `docs/plans/k-design/*.md`
(can be committed alongside the brief, or kept local — your call, but commit
the final brief).

## Communication style

- Slovak in chat, English in code / commits / PRs / docs (per
  `memory/user_communication.md`).
- Terse; no trailing summaries; no preamble.
- Use `AskUserQuestion` at decision points (design synthesis review,
  significant scope changes). Do **not** ask before each minor edit.
- When you ship something live-verifiable, end with a one-line "Skús to v
  Safari: <URL>" prompt so the owner can sanity-check.

## When you start

1. `git status` + `git log --oneline -5` + `git stash list` to verify a clean
   tree on `main` at `22ddf59` (or later).
2. Dispatch the 5 design-scout subagents in parallel (one `Agent` tool call
   per scout, all in **a single message** so they run concurrently).
3. While they work, do the cheap repo orientation: skim `home.css`,
   `HomeRoute.tsx`, the existing `StatusBadge`, the i18n catalogs. Stay
   inside the main context — don't burn it on deep dives the scouts will do.
4. When all 5 scout reports land, dispatch the synthesis subagent.
5. Present the brief to the owner. Get GO.
6. Implement Round A → Round B (parallel) → Round C (parallel) → Round D
   (parallel) → Round E → verification → release.

Good luck. The bar is "looks like 2026 SaaS, not a school project". The
foundation is solid (J.0 LIVE, real CA SDM data flowing); now make it
look the part.
