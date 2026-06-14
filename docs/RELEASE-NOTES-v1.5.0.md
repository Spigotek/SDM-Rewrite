# Service Desk Management v1.5.0

**Service Desk Management v1.5.0** — "Workspace clarity". Direct response
to a second owner staging walk: the status filter still didn't behave, the
inner Queues/saved-views column + permanent detail pane wasted horizontal
space, the design felt flat ("amatérsky"), the left rail was unclear, and
the "default" workspace switcher gave no hint how to switch profiles.
v1.5 addresses every point.

> Released 2026-06-14. Source tag: [`v1.5.0`](https://github.com/Spigotek/SDM-Rewrite/releases/tag/v1.5.0).
> Full changelog: [`docs/CHANGELOG.md`](./CHANGELOG.md).

## Fixed

### Status filter — the real root cause (3rd report)

The filter was reported broken three times and "fixed" twice without
landing. v1.5 reproduced it live (Playwright against an MSW preview)
before touching code. The static filter path was correct all along —
the bug was a **second, divergent status map**:

- `QueueTable.tsx` and `QueueKanban.tsx` each carried a private
  CA-SDM-code → logical-status map that disagreed with the filter's
  authoritative map in `hooks.ts`. `AWU` (the "Doplnenie info" status)
  mapped to `pending` in the table but `waiting_customer` in the filter;
  several codes (`RESOLVED`, `AWV`, `ESC`, `VERIFIED`, …) were missing
  entirely and fell through a `?? "open"` default.
- Net effect: rows the filter correctly admitted were badged with the
  wrong status (an admitted `resolved` row rendered an `open` badge) —
  exactly the "mixed statuses under one filter" the owner saw.
- **Fix**: a single exported `caLogicalStatus()` resolver in `hooks.ts`,
  used by the filter, the table, AND the Kanban board. Both duplicate
  maps deleted. Live Playwright after the fix: every filter
  (`status=resolved,closed`, `=in_progress`, `=new`, etc.) renders only
  matching badges — `OFFENDERS={}`. Permanent regression test added
  (`m2-queue-filter.spec.ts`).

## Changed

### Layout — reclaim the width

- **Removed the inner Queues / saved-views column.** The "Všetky tickety
  / Uložené pohľady / Zatiaľ žiadne uložené pohľady" panel is gone
  (`QueueSidebar` + `SavedViewsManager` deleted). Owner doesn't use saved
  views.
- **Detail pane → right drawer.** The permanent split-pane detail that
  ate ~30 % of the width now opens as a 480-px right-side drawer on row
  click (backdrop + ESC + backdrop-click close, focus trap, GSAP
  slide-in, reduced-motion safe). The ticket list spans the full content
  width by default.

### Vivid section backgrounds

Owner: "farebne živšie pozadie prvkov a sekcií, pôsobí amatérsky".

- New `--color-surface-canvas` token (light `#f5f6fb` indigo-tinted
  off-white, dark `#121214`) on the content area — cards now sit on a
  deliberate surface instead of flat paper.
- **KPI strip** tiles get semantic tints + 3-px coloured left-border:
  Otvorené = brand, Moje = success, Po SLA = danger, < 1h = warning,
  Dnes = info. Reads as a real dashboard, not 5 grey boxes.
- Filter toolbar wrapped in a bordered "controls" panel; dashboard cards
  get a banded header strip + brand accent bar. Active rail items + chips
  get more saturated brand fills.
- Every functional text/tint pair re-checked for WCAG AA (worst case
  4.76:1 light / 5.25:1 dark); KPI labels promoted to `text-body`,
  active-rail text to `text-primary` to clear the new tints.

### Left-rail help + clarity

Owner: "ľavé menu je pre mňa nejasné … doplň prepracovaný help".

- Every rail item carries a Slovak `title` tooltip + composite
  `aria-label` (Inbox = "Nové podania čakajúce na priradenie", Triáž =
  "Nové incidenty na roztriedenie", V riešení = "Incidenty, na ktorých
  sa pracuje", …).
- Each group header (Incidenty / Zmeny / Znalosti / CMDB) gets a
  focusable `Info` help button with a descriptive label.

### Tenant-switcher clarity

Owner: "neviem, čo je 'default' … neviem, ako sa prepnúť do iného
profilu (CAMP, SD, …)".

- A "Pracovný priestor" caption now sits above the value in both shells,
  so "default" reads as a workspace name, not a mystery string.
- The trigger's `aria-label` is "Prepnúť pracovný priestor"; the dropdown
  gains a helper line "Vyber pracovný priestor pre prepnutie kontextu"
  and the tenant list (CAMP, SD, …) marks the current one.

## Affected artefacts

- `ghcr.io/spigotek/sdm-{bff,portal,workspace}:1.5.0` — multi-arch.
- Helm chart `oci://ghcr.io/spigotek/charts/sdm:1.5.0`.

## Deferred to v1.6+

- Prune the now-unused `useSavedViews` hook + its storage helpers
  (kept exported in v1.5 to avoid touching the M.2.A filter surface).
- BFF predicates for `?scope=inbox` / `?starred=true` / `?assignee=me`
  rail items (still URL-only stubs).
- BFF status PATCH endpoints (UI ready since v1.3).
- Real unDraw illustration downloads.

## Known limitations

Same as v1.4.x.
