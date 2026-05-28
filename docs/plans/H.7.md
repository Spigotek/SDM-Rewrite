# H.7 — Workspace: queue

> **Status**: ✅ DONE (2026-05-28)
> **Branch**: `chunk/H.7-workspace-queue` (merged, deleted)
> **PR**: #26 — merged squash via `--admin --delete-branch` > **Bundle outcome**: workspace 175.09 KB / 350 KB. Vendor-state cap bumped 20 → 30 KB (TanStack Table v8 add-on to existing TQ chunk).
> **Persona**: Anna (`agent_l1`), Marek (`agent_l2`)
> **Cieľ**: route `/queue` (workspace default landing) — dense `<QueueTable>`
> z G.1 (compact density, 28-32 px rows) + filter bar + saved views + keyboard
> navigation (j/k/Enter/Space). Split-view: row click otvorí ticket-detail
> v right pane (H.8 dependency). Bulk actions deferred (v1+, NIE MVP).

## Pivot vs ROADMAP

ROADMAP workspace feature `queue` — **agent persona centerpiece**.
F.3 aggregator endpoint `/api/queue` už existuje, H.7 implementuje FE consumption

- rich keyboard UX.

## Inputs

- **`docs/agents/ux-persona-analyst/wireframes/workspace/01-queue.md`** — autoritatívny.
- **`docs/spec/incident-management.md` §workspace queue**.
- **`docs/agents/qa-test-strategy/acceptance-criteria.md` §workspace-incident-triage (#4)`** — primary AC.
- **`docs/agents/design-system/components.md` §QueueTable, FilterBar, QueueSidebar, ListRow**.
- **`apps/bff/src/aggregator/queue.ts`** — F.3 endpoint (verify shape + filters).

## Outputs

```
apps/workspace/src/routes/queue.tsx
apps/workspace/src/features/queue/
├── QueueRoute.tsx                              # { Component, loader }
├── components/
│   ├── QueueTable.tsx                          # G.1 QueueTable consumer
│   ├── QueueSidebar.tsx                        # saved views + queue list (left rail)
│   ├── FilterBar.tsx                           # filter chips (status, priority, assignee, type)
│   ├── SavedViewsManager.tsx                   # localStorage-backed saved views CRUD
│   └── ColumnConfig.tsx                        # column visibility/order (Dropdown)
├── api.ts                                      # queueQuery, savedViewsLocal
├── hooks.ts                                    # useQueueFilters, useKeyboardNav (j/k/Enter)
└── types.ts

apps/workspace/lighthouserc.json                # /queue graduates warn → error
packages/i18n/catalogs/workspace/{sk,en}.json   # +queue.* (~25 keys)
tools/browser-test/scenarios/h7-workspace-queue.spec.ts  # keyboard nav + filter + saved view
```

## Done-when

- [ ] `/queue` is workspace default landing (H.0 routing config `/` redirects to `/queue`).
- [ ] `QueueTable` consumes F.3 aggregator `/api/queue?<filters>`; ALL filter params per BFF schema (status, priority, assignee, customer, tenant from session).
- [ ] Columns per `01-queue.md §Default columns`: ID, Type, Status, Priority, Summary, Customer, Assignee, Age, SLA. Persisted column order/visibility v localStorage.
- [ ] **Keyboard shortcuts** (per `components.md DataTable klávesy`):
  - `j` / `↓` next row
  - `k` / `↑` previous row
  - `Enter` open detail in split-view (right pane)
  - `Esc` clear selection
  - `Space` (selection toggle is deferred — bulk-ops v1+)
- [ ] Split-view: row click renders ticket-detail v right pane (NOT route change). URL stays `/queue?selected=:id`. **Note**: H.7 ships placeholder split-pane (real content per H.8). Cell highlights selected row.
- [ ] `FilterBar`: filter chips (`Status: Otvorený`, `Priority: Vysoká`, etc.); click chip → toggle; "Reset filters" button.
- [ ] `SavedViewsManager`: 5-10 saved views in dropdown ("My open", "L1 high prio", "Unassigned"). Persisted localStorage cez `useSyncExternalStore`.
- [ ] Pollovanie 30 s per `04 workspace.md W-01` — TanStack Query `refetchInterval: 30000` keď tab aktívny.
- [ ] Empty state: `microcopy.md §4 queue empty` "🎉 Žiadne tickety v queue…".
- [ ] LHCI `/queue` desktop TTI ≤ 2.5 s, LCP ≤ 2.0 s, score ≥ 0.85.
- [ ] i18n parity + browser test (load → navigate j/k → open detail → filter → save view) + `pnpm -r ... + size` green.
- [ ] ROADMAP.

## Stratégia

### Fáza A — Route + API + loader

1. Replace `/queue` placeholder. Loader prefetch queueQuery + savedViewsLocal.
2. queueQuery uses `queryKey: ["queue", tenantId, filters]` — tenant-scoped per H.1.

### Fáza B — QueueTable + FilterBar + Sidebar

1. `QueueTable` uses G.1 + TanStack Table v8 (sort/filter/column config).
2. `FilterBar` filter chips + reset.
3. `QueueSidebar` (left rail) lists saved views + queue links.

### Fáza C — Keyboard nav + split-view + saved views + PR

1. `useKeyboardNav(rows, onActivate)` — react-hotkeys-hook integration.
2. Split-view: URL search param `selected=:id` triggers right pane; H.7 ships placeholder pane ("Vyber ticket zo zoznamu" or H.8 stub).
3. Saved views CRUD (localStorage, no BFF persistence v MVP).
4. Browser test + LHCI graduate + PR.

## Open questions

- **F.3 aggregator filter coverage**: verify all FilterBar params supported. If gaps, doplniť BFF.
- **Pollovanie tab visibility**: TanStack Query default `refetchOnReconnect` + `refetchInterval` only when document visible.
- **SLA cell**: F.x captures `due_date` per spec? Verify; if missing, defer SLA column to follow-up.
- **Bulk-ops**: explicitly NOT v H.7 (v1+ per ROADMAP). Selection (multi-select checkboxes) skipnuté v MVP.

## Notes pre subagenta

- Reuse G.1 `<QueueTable>`, `<FilterBar>`, `<QueueSidebar>`, `<ListRow>`, `<StatusBadge>`, `<PriorityBadge>`.
- F.3 endpoint je hotový — len consume.
- Subagent **NESMIE** merge own PR.
