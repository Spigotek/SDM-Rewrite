# F.3 — BFF Aggregator endpoints

> **Status**: ✅ DONE
> **Branch**: `chunk/F.3-aggregator` (merged)
> **PR**: #13 (squash + delete-branch, commit `c12a602`)

## Pivot vs ROADMAP

ROADMAP: _"Aggregator endpoints — /me/tenants fan-out, queue handler (multi-factory),
ticket-detail aggregation."_

Drobné upresnenie:

- **`/me/tenants` už čiastočne implementovaný v F.1** ako súčasť `/me`. F.3 ho **buď** premiestni
  do samostatného endpointu (per `bff.md §2.4` route inventory) **alebo** ho zachová embedded a
  `/me/tenants` necháva ako alias/passthrough. Rozhodnutie pri impl: ak FE chce reload tenant listu
  bez full `/me` reload, treba samostatný endpoint s vlastným cache TTL (5 min).
- **Paralelný fan-out** = `Promise.all` na CA SDM volania (in + cr + pr pre queue; parent + linked
  - attachments + activity pre ticket-detail). Žiadny external orchestrator (Temporal/queue) v MVP.
- **CI neighborhood** (BFS depth N) = **post-MVP**, vynechaná v F.3.

## Inputs

- `docs/agents/architecture/components/bff.md` §2.4 (Aggregator module)
- `docs/agents/ux-persona-analyst/wireframes/{portal,workspace}/` — UI views pre queue + ticket-detail
- `docs/spec/{incident-management,request-management,problem-management,change-management}.md` —
  ticket-detail aggregation pravidlá
- `docs/agents/api-analyst/multi-tenancy.md` §3.1 (`/me/tenants` flow)
- `apps/bff/src/api/rest-proxy.ts` — F.2 deliverable (per-entity RestProxy callable)
- `apps/bff/src/api/cache.ts` — F.2 deliverable (TTL cache wrapper)

## Outputs

```
apps/bff/src/aggregator/
├── me-tenants.ts         # GET /me/tenants — refresh tenant + role list (cache 5 min)
├── queue.ts              # GET /api/queue — fan-out in+cr+pr, merge, sort, paginate (cache 30 s)
├── ticket-detail.ts      # GET /api/tickets/:type/:id — parent + contacts + linked + attachments + activity
├── shapers/
│   ├── ui-queue-item.ts  # CA SDM raw → UiQueueItem (per @sdm/api-types)
│   └── ui-ticket-detail.ts
└── routes.ts             # register aggregator endpoints

apps/bff/src/tests/aggregator/
├── me-tenants.test.ts
├── queue.test.ts
├── queue.fanout.integration.test.ts
└── ticket-detail.integration.test.ts
```

## Done-when

- [x] Unit testy pre shapery (raw → UI typ) — `tests/aggregator/shapers/{ui-queue-item,ui-ticket-detail}.test.ts`
- [x] Integration testy: queue fan-out s 3 paralelnými calls, merge invariant (priority desc,
      lastActivityAt desc), pagination cross-factory — `tests/aggregator/queue.test.ts`
- [x] Ticket-detail s missing parts (linked/attachments/activity = `_unsupported: true`) — žiadny crash
- [x] Cache hit/miss telemetry log (pino) — `aggregator.queue.{hit,miss}` + `aggregator.ticket_detail.{hit,miss}`
- [x] **Live smoke proti real B-E** (2026-05-19, `scripts/smoke-f3.sh` proti `10.11.35.35:8050`):
      `/me/tenants` ok (sp_admin/Administration), `/api/queue` vrátil **17 incident + 7 request +
      1 problem** (≥1 z každého ticketType — splnené), `/api/tickets/incident/2800` ok s
      `_unsupported: true` markerami na linked/attachments/activity.
- [x] ROADMAP + F.3 status → ✅ DONE

## Stratégia

Main thread, žiadne subagenty (logika je sekvenčne závislá od F.2 RestProxy interface-u).

1. `shapers/ui-queue-item.ts` + `shapers/ui-ticket-detail.ts` (pure functions, test-friendly)
2. `me-tenants.ts` — single CA SDM call s join na `cnt_role` + `tenant`
3. `queue.ts` — `Promise.all([in, cr, pr])` + merge + sort + pagination
4. `ticket-detail.ts` — sekvenčné loady (parent first, potom paralelne linked + attachments + activity)
5. `routes.ts` register + integ testy

## Open questions / risks

- **Linked tickets / attachments / activity log factory mená nie sú v `real-backend-contracts.md`.**
  F.3 vystavuje shape s `_unsupported: true` na týchto blokoch a empty arrays. Pred ich oživením
  potrebný samostatný B-E probe chunk (kandidáti: `lrel_*`, `cr_lrel`, `attmnt`, `act_log`,
  `cnotes`) → §22+ doplniť do `real-backend-contracts.md`. Bez tejto evidencie F.3 ticket-detail
  ostáva MVP stub.
- **Activity log pagination**: pôvodne plánované do F.3 ak triviálne — odložené spolu s
  linked/attachments do post-discovery chunku (`/api/tickets/:type/:id/activity?page=N` ostane
  ako budúci endpoint, MVP detail vracia activity.hasMore=false).
- **`X-Obj-Attrs` trimming**: CA SDM podporuje header na trim fields. Performance optimization —
  ak baseline timing > 500 ms, pridať trim. Inak neskôr (G.4 Performance budgets).
- **Cache invalidation = TTL-only v MVP** (carry-over A vyriešený): queue 30 s, /me/tenants 5 min,
  ticket-detail 60 s. Cache key obsahuje `(tenantId, userId, ...)`. Aktívna invalidácia
  (audit event hookup `auth.tenant.switched` → cache invalidator) ide do F.4 audit event bus.
- **Multi-tenant fan-out**: ak user má v session 2+ tenantov, queue **vždy** scopuje na
  `session.activeTenantId`. Žiadny "all tenants" view v MVP.
- **Cross-factory true pagination**: queue fan-out pulluje fixný buffer 100 per faktorinu;
  pri `total > 100` vystavujeme `hasMore: true`. Skutočná deep-pagination cross-factory
  (balancovaný puling so znalosťou per-factory weightu) je post-MVP — v F.3 doc-comment.
