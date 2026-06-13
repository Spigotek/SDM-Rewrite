# Service Desk Management v1.2.0

**Service Desk Management v1.2.0** — the full redesign half of Phase K.
v1.1.4 (2026-06-13) shipped the quick-wins bundle; v1.2.0 closes the
loop with dark mode, a Linear-style command palette, the workspace
left-rail nav, illustration assets, multi-page polish across every
detail route, and an a11y audit that lands axe-clean.

> Released 2026-06-13. Source tag: [`v1.2.0`](https://github.com/Spigotek/SDM-Rewrite/releases/tag/v1.2.0).
> Full changelog: [`docs/CHANGELOG.md`](./CHANGELOG.md).
> Design brief: [`docs/plans/K.1-design-brief.md`](./plans/K.1-design-brief.md).
> Post-mortem: [`docs/plans/K.3-v1.2.md`](./plans/K.3-v1.2.md).

## Highlights

- **Dark mode** — `data-theme` + `localStorage` + `prefers-color-scheme`.
  Toggle in the top bar (portal) / user menu (workspace) via the new
  `<ThemeToggle>` primitive. FOUC-safe inline script in both `index.html`
  files. `useTheme()` React hook with live media-query subscription.
- **Command palette (cmd+K)** — Linear-style full-modal launcher. Grouped
  results (Recent / Navigate / Actions / Tickets / KB / CMDB),
  keyboard-first (`↑/↓`, `Enter`, `Tab`, `cmd+1..9`), mode prefixes
  (`>`, `#`, `?`), GSAP enter / exit animation, `prefers-reduced-motion`
  honoured. Pluggable action registry — primitives stay router-agnostic.
- **Workspace left-rail nav** — 240-px persistent column with workspace
  switcher, cmd+K trigger chip, 5 collapsible groups (TOP / INCIDENTS /
  CHANGES / KNOWLEDGE / CMDB) persisted per-user in `localStorage`,
  settings link, user menu (ThemeToggle + language switcher + sign out).
  Mobile hamburger keeps the rail reachable below `lg`.
- **Portal mobile nav** — slide-in left drawer with the 4 destinations,
  ESC + backdrop close, focus trap; sticky bottom-nav bar with 4
  icon-only tabs (filled-on-active) below `md`. Desktop horizontal
  nav row stays for `md+`.
- **Illustration system** — `vite-plugin-svgr` adoption + 10 placeholder
  empty-state SVGs (`currentColor` + `<title>` + tree-shakeable named
  exports). Total bundle: ~4.3 KB raw / ~2.9 KB gzipped. Real unDraw
  downloads tracked as a v1.2-polish follow-up.
- **Multi-page polish** — every detail route in both apps now uses
  the v1.2 design language: DS primitives over raw markup, Skeleton
  loading (no "Loading…" text), tabular numerals on IDs/dates/counts,
  staggerListRows on list mounts, usePageTransition crossfade on
  every route mount, token-only colours.
- **A11y audit** — axe sweeps 6/6 portal + 11/11 workspace serious-or-critical
  violations cleared. New skip-link in both shells. Focus rings, ARIA
  current state on tabs/chips, prefers-reduced-motion honoured.
- **LHCI CLS retighten** — workspace `/queue` CLS dropped from 0.179
  to 0.023 by reserving the LeftRail's 240-px slot before `status ===
"ready"`. Strict global 0.06 floor restored; per-URL belt-and-braces
  override removed.
- **GSAP motion engine** — `staggerListRows()` (Web Animations API
  → GSAP), new `usePageTransition()` hook, `HOVER_LIFT_*` constants,
  `prefers-reduced-motion` early-returns.
- **Typography fallback metrics** — Inter Variable `@font-face` ships
  `size-adjust 107%` + `ascent-override 90%` + `descent-override 22%`
  - `line-gap-override 0%` so the system-ui fallback paints at the
    same line metrics as Inter; eliminates the residual font-swap CLS
    K.2 had to absorb.

## Affected artefacts

- `ghcr.io/spigotek/sdm-portal:1.2.0` (also `1.2`, `latest`) — multi-arch
  (`linux/amd64` + `linux/arm64`).
- `ghcr.io/spigotek/sdm-bff:1.2.0` and `sdm-workspace:1.2.0` — re-cut
  for chart parity.
- Helm chart `oci://ghcr.io/spigotek/charts/sdm:1.2.0` — chart version
  - `appVersion` bumped, no template changes.

## Deferred to v2.0+

- Real unDraw illustration downloads (placeholders ship in v1.2.0).
- BFF `dueDate` + `slaState` projection onto `UiQueueItem` so the
  workspace "Po SLA" KPI tile shows real values.
- BFF activity-feed endpoint for the RecentActivity widget (currently
  client-side derived from `myAllTicketsQuery`).
- Status-as-button transition control on `StatusBadge` (JSM lozenge
  pattern).
- Service Worker registration over HTTPS (blocked on reverse-proxy
  story — Caddy / Traefik + Let's Encrypt or internal CA).
- Real-time toast bus (global `<ToastViewport>` driven by SSE
  notifications + per-feature contributions).
- Portal `/` mobile LHCI performance recovery — currently 0.83 avg vs
  0.88 floor (pre-existing K.3.E regression). Likely lever: trim
  illustration bundle import paths + lazy-load the EmptyState
  illustrations on routes that don't need them at FCP.

## Known limitations

- **Service Worker still does not register on staging.** The host
  serves over plain HTTP on port 88; Service Worker spec requires
  HTTPS or `localhost`. Per-route behaviour (cache strategies,
  install prompt, autoUpdate) all blocked. Documented in
  RELEASE-NOTES-v1.1.4. v2.0 unblocks via the reverse-proxy story.
- **Illustration aesthetic is placeholder-grade.** The 10 SVGs are
  minimal geometric glyphs. A future v1.2.1 / polish PR swaps them
  for the catalogued unDraw downloads via a small helper script.
