# Service Desk Management v1.4.0

**Service Desk Management v1.4.0** — "Queue overhaul". v1.3.0
shipped brand identity + live SSE + JSM transitions. Owner walked the
staging build and flagged that filter clicks didn't filter rows, the
left-rail items were inert, the split-pane right column still said
"Plný detail ticketu dorazí v H.8.", and the UI density was hard to
scan. v1.4 fixes all four head-on and ships a Kanban view as the
surprise.

> Released 2026-06-14. Source tag: [`v1.4.0`](https://github.com/Spigotek/SDM-Rewrite/releases/tag/v1.4.0).
> Full changelog: [`docs/CHANGELOG.md`](./CHANGELOG.md).

## What changed

### Fixed (the four flagged regressions)

- **Filter chip now actually filters rows.** The status-filter chip
  (e.g. "Stav: Otvorený") emits a logical-status URL param, but BFF
  rows carry CA SDM codes (`OP`, `WIP`, `SUBMITTED`, …). A new
  `statusMatchesFilter()` helper + `CA_CODE_TO_LOGICAL` map bridges
  the two so every chip now selects matching rows.
- **Left-rail items wired.** Every nav-link in the workspace rail
  was previously navigating to `?view=…` which the queue route
  ignored. Rewritten to the real `?status=…` contract — Triáž =
  `new`, V riešení = `in_progress`, Čaká = `waiting_customer +
waiting_vendor + hold`, Vyriešené = `resolved + closed`, etc.
  Inbox / My queue / Starred remain URL-only stubs until the BFF
  ships the matching predicates in v1.5.
- **Split-pane detail.** The `queue-split-pane-placeholder` ("Plný
  detail ticketu dorazí v H.8.") is gone. The right column now hosts
  a real `QueueDetailPane` — Header with transitionable StatusBadge
  - PriorityBadge + customer Avatar, 3 tabs (Detail / Activity /
    Comments), "Otvoriť plný detail" CTA. Skeleton + error states.
- **Visual density.** Section labels lost their dated all-caps
  treatment in favour of sentence-case with a 6-px indigo accent
  dot. Table rows back to 36 px with the subtle hover lift. The
  alternating zebra stripe is gone. KPI tiles with 0 / "—" values
  collapse into compact 28-px chips; only tiles with real numbers
  draw the full block. Toggle "Zobraziť aj prázdne" persists per
  user.

### Added

- **Kanban view toggle.** The `+ Nový` row gained a Table / Kanban
  toggle. Kanban renders 4 columns (Otvorené / V riešení / Čaká /
  Vyriešené) with cards showing ref + priority + summary + Avatar +
  relative date. Drag cards between columns to fire the v1.3.0
  status-transition mutation. Forbidden transitions silently snap
  back; a small info toast explains. View choice persisted in
  `localStorage["sdm.workspace.queue.view"]`. The Kanban component
  is lazy-loaded (5.17 kB raw / 2.16 kB gzip).
- **Smart age formatter.** The age column now formats:
  - < 24 h → `~Nmin` / `~Nh`
  - 1 – 90 days → `Nd`
  - > 90 days → Slovak Intl-aware `pred N rokmi` / `pred N mesiacmi`
  - Every cell carries a `title=` tooltip with the absolute date.

### Changed

- Card elevation pass — `.surface` + `.interactive` ship a single
  thin border + 1-px ground shadow; `.subtle` is flat. Dark mode
  parity preserved.

## Affected artefacts

- `ghcr.io/spigotek/sdm-{bff,portal,workspace}:1.4.0` — multi-arch.
- Helm chart `oci://ghcr.io/spigotek/charts/sdm:1.4.0`.

## Deferred to v1.5+

- BFF predicates for `?scope=inbox`, `?starred=true`, `?assignee=me`.
- Changes filter parser symmetry — accept logical names alongside
  raw CA codes (currently raw-only).
- Real-time Kanban auto-rearrange on SSE push (cards re-position
  automatically as live events arrive — currently requires a manual
  refresh).
- BFF `PATCH` endpoints for tickets / problems / changes status
  (still v1.4's "Backend zatiaľ neumožňuje túto zmenu" toast on
  failure).
- Ticket-level SSE events on BFF (notification primitive ready).
- Real unDraw illustration downloads.

## Known limitations

Same as v1.3.x.
