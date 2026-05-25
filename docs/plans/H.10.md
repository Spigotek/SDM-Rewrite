# H.10 — Workspace: change calendar (FullCalendar lazy)

> **Status**: 🔜 (blokované na H.9 — uses changes routes)
> **Branch**: `chunk/H.10-change-calendar` > **Persona**: Peter
> **Cieľ**: route `/changes/calendar` — FullCalendar 6 lazy chunk (~95 KB)
> rendering changes ako event blocks coloured per risk tier (severity colors).
> Day / Week / Month views. Click event → `/changes/:id`.

## Pivot vs ROADMAP

ROADMAP workspace feature `change-calendar`. H.10 zaviazať FullCalendar
(per `library-recommendation.md` r2 — FullCalendar 6, NOT react-big-calendar).

## Inputs

- **`docs/agents/ux-persona-analyst/wireframes/workspace/03-change-calendar.md`** — autoritatívny calendar wireframe (Week view).
- **`docs/spec/change-management.md` §scheduling**.
- **`docs/agents/design-system/components.md` §Calendar, CalendarBlock**.
- **`apps/bff/src/api/endpoints/changes.ts`** — `GET /api/changes?start=&end=` time-range query.

## Outputs

```
apps/workspace/src/routes/changes-calendar.tsx
apps/workspace/src/features/changes/
├── ChangeCalendarRoute.tsx                     # lazy-loaded
├── components/
│   ├── CalendarView.tsx                        # FullCalendar wrapper
│   ├── CalendarFilters.tsx                     # risk tier, status, env filter
│   └── EventTooltip.tsx                        # hover content
├── api.ts                                      # add changesInRangeQuery(start, end)
└── lib/full-calendar-config.ts                 # FullCalendar plugins + options

apps/workspace/lighthouserc.json                # /changes/calendar graduates (TTI ≤ 3.0 s — heavier per performance.md §2)
packages/i18n/catalogs/workspace/{sk,en}.json   # +changes.calendar.* (~10)
apps/workspace/.size-limit.json                 # +heavy lazy chunk rule (calendar ~95 KB gzip)
tools/browser-test/scenarios/h10-change-calendar.spec.ts
```

## Done-when

- [ ] Route `/changes/calendar` lazy-loads FullCalendar chunk only on first visit.
- [ ] FullCalendar plugins: `@fullcalendar/daygrid` + `@fullcalendar/timegrid` + `@fullcalendar/interaction` (per `library-recommendation.md`).
- [ ] Day / Week / Month view switch (top-right Tabs `segmented` variant).
- [ ] Each event block: coloured per `risk_tier` mapping to `color.severity.*` tokens.
- [ ] Click event → navigate `/changes/:id`.
- [ ] Hover event → tooltip with title + risk + schedule.
- [ ] `<CalendarFilters>` — chips: risk tier, status, env. Filter `changesInRangeQuery` params.
- [ ] Mobile fallback: "Pre kalendár otvor desktop" banner; redirect na `/changes` list.
- [ ] LHCI `/changes/calendar` desktop TTI ≤ 3.0 s, LCP ≤ 2.5 s, score ≥ 0.80 (heavier per `performance.md §2`).
- [ ] Calendar lazy chunk size-limit: 150 KB gzip (per `performance.md §3 heavy chunks`).
- [ ] Browser test: navigate to calendar → switch view → click event → verify URL change.

## Stratégia

1. **A**: Install FullCalendar 6 + plugins; route + lazy import; api factory for range queries.
2. **B**: CalendarView component + plugin config + event rendering.
3. **C**: Filters + tooltip + mobile fallback + test + LHCI graduate + size-limit budget + PR.

## Open questions

- **Drag-resize events** (`@fullcalendar/interaction`): per spec, change_manager can drag-resize schedule. **MVP scope**: read-only events; drag-resize → v1+. Plugin imported but interaction disabled.
- **Cross-tenant conflict overlay**: per `wireframe §UI prvky calendar`. **MVP scope**: skip; v1+. (Per ROADMAP "Advanced Change Calendar" je v1.)
- **Time zone**: per session locale or per-tenant TZ? Default UTC, display in user's browser TZ.

## Notes pre subagenta

- FullCalendar je MIT open-source (Scheduler plugin commercial — NEpoužívať).
- Lazy import critical — first page load nesmie ťahať calendar bundle.
- Subagent **NESMIE** merge own PR.
