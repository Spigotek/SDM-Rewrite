# Phase H — Feature modules (MVP)

> Cieľ: dotiahnuť MVP per `GOAL.md §3` — Incident, Request, Problem, Change, KB
> (read), CMDB (read), Multi-tenancy — funkčne pokryté v portal + workspace SPA
> proti reálnemu BFF + CA SDM. **Najdlhšia faza** projektu: 17 chunkov
> (H.0 routing → H.16 acceptance smoke).

## Phase H entry criteria

- ✅ Phase G merged (5/5 chunks: tokens, fonts, i18n, observability, perf budgets).
- ✅ BFF endpoints existujú per F.2 (entity proxies) + F.3 (aggregators) + F.4 (audit).
- ✅ Design system má 12 base komponentov + tokens; i18n má SK/EN catalogs s 88 keys (extension per H.X chunk).
- ⏳ Apps nemajú React Router — single root `<App />` render. H.0 to napraví.
- ⏳ Tenant switcher je P0 wireframe stub od E.3, ale fully wired tenant switch (s permission cache invalidation + BFF round-trip) ide do H.1.

## Phase H exit criteria (Done-when celá H)

- Všetky 18 user journeys z `qa-test-strategy/acceptance-criteria.md §2` pass v integration alebo browser-test mode (overené v H.16).
- Portal pokrýva `home → new-incident → ticket-detail → catalog → KB search`.
- Workspace pokrýva `queue → ticket-detail (agent) → changes + calendar + CAB → problems → CMDB CI + graph → KB browse`.
- Multi-tenancy: tenant switch end-to-end (UI dropdown → BFF `/me/active-tenant` → reload session state → updated permissions).
- LHCI thresholds z `performance.md §2` zelené pre **všetky realne navigovateľné routes** (numeric TTI/LCP graduate-uje z `warn` na `error` per route).
- ROADMAP Phase H → ✅ DONE; next-up = Phase I (acceptance + production hardening).

## Cross-chunk decisions

### D1 — Per-chunk PR-flow (per memory `pr-flow`)

Identicky ako F/G: branch z fresh main, jedna PR per chunk, squash --admin
--delete-branch. **Žiadne stacked PR**. Subagent dispatch pattern (proven
v Phase G) ostáva — general-purpose subagent dostane self-contained brief

- H.X.md plán, parent agent verify + merge.

### D2 — Sequencing (H.0 → H.16, blocking arrows)

```
H.0 routing
 ├→ H.1 tenant switch
 │   ├→ H.2 portal home
 │   ├→ H.7 workspace queue          ← agent persona centerpiece
 │   └→ (ostatne tickets módy nezávislé)
 ├→ H.3 portal new-incident
 ├→ H.4 portal ticket-detail
 ├→ H.5 portal service catalog + new-request
 ├→ H.6 portal KB search + article
 ├→ H.8 workspace ticket-detail (agent split-view)   ← blokuje na H.7 (queue routes use)
 ├→ H.9 workspace changes list + detail
 ├→ H.10 workspace change calendar    ← blokuje na H.9 (route /changes/calendar)
 ├→ H.11 workspace CAB approval        ← blokuje na H.9
 ├→ H.12 workspace problems + link-to-incident
 ├→ H.13 workspace CMDB CI list + detail
 ├→ H.14 workspace CMDB graph          ← blokuje na H.13 (route /cmdb/ci/:id tab)
 ├→ H.15 workspace KB browse + read
 └→ H.16 acceptance smoke              ← blokuje na všetkých H.0-H.15
```

Foundation (H.0/H.1) prvé. Portal feature batch (H.2-H.6) môže ísť **paralelne**
v rámci jednej session ale **jedna PR per chunk** — žiadne stacked PR. Workspace
feature batch (H.7-H.15) tiež. H.16 ako uzáver.

**Recommended dispatch order pre subagent flow**:
H.0 → H.1 → H.7 → H.8 → H.2 → H.4 → H.3 → H.5 → H.6 → H.9 → H.11 → H.10 → H.12 → H.13 → H.14 → H.15 → H.16.
Workspace agent journey má precedence (väčší persona pokrytie), portal nasleduje.

### D3 — Tech stack final (zmrazený od G.x)

**No new library evaluation v Phase H**. Stack je per `library-recommendation.md` r2:

- **Routing**: React Router 6 (data router API). Code-split per route cez `React.lazy()`.
- **Server state**: TanStack Query v5 (introduced v H.0 alebo H.2 — prvý chunk čo to potrebuje).
- **Forms**: React Hook Form 7 + Zod 3 + `@hookform/resolvers/zod`.
- **Tables**: TanStack Table v8 (basic mode — < 100 rádkov per view, žiadna virtualizácia per GOAL §5).
- **Date utils**: date-fns 3 (modular per use).
- **Drag-drop**: dnd-kit 6 (FileUpload, calendar drag-resize v1+).
- **Editor**: TipTap 2 — len pre `Composer` (ticket reply); KB editor mimo MVP scope.
- **Graph**: Cytoscape 3 + react-cytoscapejs (lazy chunk per H.14).
- **Calendar**: FullCalendar 6 (dayGrid + timeGrid + interaction; lazy chunk per H.10).
- **Markdown**: react-markdown 9 + remark-gfm + rehype-sanitize (read-side iba; per H.4/H.6).
- **Keyboard shortcuts**: react-hotkeys-hook (queue + ticket-detail).

### D4 — `apps/<app>/src/features/<feature>/` štruktúra

Per ADR-04 + ROADMAP `Outputs per chunk`:

```
apps/portal/src/
├── App.tsx                          # router setup (H.0)
├── routes/                          # route components (lazy-loaded)
│   ├── home.tsx
│   ├── new-incident.tsx
│   ├── ticket-detail.tsx
│   ├── catalog.tsx
│   ├── catalog-item.tsx
│   └── kb-*.tsx
├── features/                        # feature-scoped logic
│   ├── tickets/{api,hooks,components,types}
│   ├── catalog/{...}
│   └── kb/{...}
├── shell/                           # AppShell + nav (already from E.3 + G.x)
├── bootstrap/                       # config + i18n + Sentry init
└── main.tsx                         # bootstrap pipeline
```

Identicky `apps/workspace/src/`. Subagent each chunk pridáva 1-2 routes

- 1 feature folder.

### D5 — MSW handler reuse (E.1 + F.5 baseline)

`packages/api-mocks` má handlery pre `/me`, `/me/tenants`, `/api/incidents`,
`/api/requests`, `/api/problems`, `/api/changes`, `/api/kb`, `/api/cmdb`,
`/api/audit`, `/config`. Phase H **doplní handlery LEN ak chýbajú konkrétne
endpointy** — napríklad `/api/incidents/{id}/comments` POST pre H.4 composer.
Žiadny refactor existujúcich handlerov.

### D6 — BFF endpoint reuse + augmentation (F.2-F.4 baseline)

BFF má entity proxies (`/api/incidents`, `/api/requests`, `/api/problems`,
`/api/changes`, `/api/kb`, `/api/cmdb`) + aggregator (`/api/queue`,
`/api/tickets/:type/:id`) + auth (`/me`, `/me/tenants`, `/auth/*`) +
platform (`/config`, `/readyz`). Phase H **pridáva LEN nové endpointy
potrebné per feature** (napr. `/api/comments` POST, `/api/changes/:id/approve`).
Žiadny redesign existujúcich.

### D7 — Audit emit cez F.4 taxonomy

Každá mutation v Phase H emit-uje `data.<entity>.{write,delete}` event cez
existujúce `auditEmitter` z `apps/bff/src/platform/audit/`. Žiadne nové
event names mimo F.4 taxonomy — ak by feature potrebovala nový event, je
to **scope kreep do Phase I.2** (security audit), nie H.

### D8 — i18n string scope per chunk

Per G.2 plán: feature module strings idú per chunk. Každý H.X chunk pridá
do `packages/i18n/catalogs/{portal,workspace}/{sk,en}.json` len **strings
ktoré jeho feature renderuje**. `pnpm i18n:check` gate-uje parity per PR.
Reference copy: `microcopy.md §2-§13` per feature.

### D9 — Sentry instrumentation

Phase H NEpridáva nové Sentry calls priamo — G.3 ErrorBoundary + `setUser`

- correlation ID flow už pokrývajú. Per-feature errors sa loguju automaticky
  cez `@sdm/api-client` HttpClient interceptor (existing). Špeciálne sensitive
  actions (bulk close, change approve, tenant switch) emit-uju cez existing
  audit taxonomy, NIE cez Sentry.

### D10 — LHCI threshold gating per route

Pri každom H.X PR ktoré pridáva novú route (H.0, H.2-H.15), subagent
**aktualizuje** `apps/{portal,workspace}/lighthouserc.json` posúvajúc URL
z `_url_todo_phase_h` array do `url` array + pridajúc per-route assertion
graduation z `warn` → `error` pre TTI/LCP/score. Per `performance.md §2`
hodnoty.

## Outputs Phase H (high-level)

```
apps/portal/src/{App.tsx, routes/, features/, ...}      # H.0-H.6
apps/workspace/src/{App.tsx, routes/, features/, ...}   # H.0, H.7-H.15
apps/bff/src/{api/endpoints,aggregator,...}             # incremental per H.X
packages/api-mocks/src/handlers/                        # incremental
packages/i18n/catalogs/{portal,workspace}/{sk,en}.json  # +keys per chunk
tools/browser-test/scenarios/                           # +1-2 per chunk
docs/plans/H.{0..16}.md                                 # detail plans (this dir)
docs/ROADMAP.md                                         # toggle per chunk
```

## Per-chunk index

| Chunk    | Title                                  | Spec                                               | Primary wireframe                            | Persona              |
| -------- | -------------------------------------- | -------------------------------------------------- | -------------------------------------------- | -------------------- |
| **H.0**  | Routing infrastructure                 | ADR-05, library-recommendation.md                  | —                                            | both apps            |
| **H.1**  | Tenant switcher activation             | spec/multi-tenancy.md                              | shared/tenant-switcher.md                    | both apps            |
| H.2      | Portal: home dashboard                 | spec/incident-management.md §portal                | portal/01-home-dashboard.md                  | Lucia                |
| H.3      | Portal: new-incident                   | spec/incident-management.md                        | portal/02-new-ticket.md                      | Lucia                |
| H.4      | Portal: ticket-detail                  | spec/incident-management.md, request-management.md | portal/04-ticket-detail.md                   | Lucia                |
| H.5      | Portal: service catalog + new-request  | spec/request-management.md                         | portal/03-service-catalog.md                 | Lucia                |
| H.6      | Portal: KB search + article            | spec/knowledge-management.md                       | portal/05-kb-search.md                       | Lucia                |
| H.7      | Workspace: queue                       | spec/incident-management.md §workspace             | workspace/01-queue.md                        | Anna                 |
| H.8      | Workspace: ticket-detail (agent)       | spec/{incident,request,problem}-management.md      | workspace/02-ticket-detail.md                | Anna, Marek          |
| H.9      | Workspace: changes list + detail       | spec/change-management.md                          | workspace/03-change-calendar.md §detail      | Peter                |
| H.10     | Workspace: change calendar             | spec/change-management.md                          | workspace/03-change-calendar.md              | Peter                |
| H.11     | Workspace: CAB approval flow           | spec/change-management.md §CAB                     | workspace/03-change-calendar.md §approvals   | Peter                |
| H.12     | Workspace: problems + link-to-incident | spec/problem-management.md                         | (no dedicated wireframe — derived from spec) | Marek                |
| H.13     | Workspace: CMDB CI list + detail       | spec/cmdb.md                                       | workspace/05-cmdb-ci-detail.md               | Robert               |
| H.14     | Workspace: CMDB relationships graph    | spec/cmdb.md §relationships                        | workspace/05-cmdb-ci-detail.md §graph        | Robert               |
| H.15     | Workspace: KB browse + read            | spec/knowledge-management.md §workspace            | workspace/04-kb-editor.md §read              | Jana (read-only MVP) |
| **H.16** | Acceptance criteria smoke              | qa-test-strategy/acceptance-criteria.md            | —                                            | all 18 journeys      |

## Notes

- **Detail plány H.0-H.16** sa píšu v rovnakom session ako tento overview
  (user's preference) — všetkých 17 H.X.md súborov so Inputs/Outputs/Done-when/
  Strategy/Open questions/Notes pre subagenta.
- **Subagent pattern** (proven Phase G): parent agent merguje, subagent NIKDY.
- **Out of MVP scope** (per ROADMAP matrix, deferred to v1+):
  - Workspace queue bulk operations (close, take, assign multiple)
  - KB editor write (TipTap composer)
  - Advanced Change Calendar (cross-tenant conflict overlay, drag-resize)
  - CAB meeting big-screen mode (`CalendarPresenter`)
  - CMDB editor + visualizer integrácia
  - KB analytics widgets
  - Mobile-first PWA features (offline draft auto-save)
- **Phase I** picks up post-H: e2e Playwright suite, security audit, multi-tenancy
  edge cases, release v1.0 dry-run, semver tag.
