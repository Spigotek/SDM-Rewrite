# F.3 — BFF Aggregator endpoints

> **Status**: 🔜 (blokované na F.2 merge)
> **Branch**: `chunk/F.3-aggregator` (od `main` po F.2 merge)
> **PR**: —

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

- [ ] Unit testy pre shapery (raw → UI typ)
- [ ] Integration testy: queue fan-out s 3 paralelnými calls, merge invariant (priority desc,
      lastActivityAt desc), pagination cross-factory
- [ ] Ticket-detail s missing parts (linked changes empty, no attachments) — žiadny crash
- [ ] Cache hit/miss telemetry log (pino)
- [ ] Live smoke proti real B-E: queue endpoint vráti ≥ 1 incident + 1 request + 1 problem ak
      sú v test data
- [ ] ROADMAP + F.3 status → ✅ DONE

## Stratégia

Main thread, žiadne subagenty (logika je sekvenčne závislá od F.2 RestProxy interface-u).

1. `shapers/ui-queue-item.ts` + `shapers/ui-ticket-detail.ts` (pure functions, test-friendly)
2. `me-tenants.ts` — single CA SDM call s join na `cnt_role` + `tenant`
3. `queue.ts` — `Promise.all([in, cr, pr])` + merge + sort + pagination
4. `ticket-detail.ts` — sekvenčné loady (parent first, potom paralelne linked + attachments + activity)
5. `routes.ts` register + integ testy

## Open questions / risks

- **Activity log pagination**: ticket-detail include first page activity. Subsequent pages →
  samostatný endpoint `GET /api/tickets/:type/:id/activity?page=N`? Riešenie: áno, pridať do F.3
  ak je triviálne.
- **`X-Obj-Attrs` trimming**: CA SDM podporuje header na trim fields. Performance optimization —
  ak baseline timing > 500 ms, pridať trim. Inak neskôr (G.4 Performance budgets).
- **Cache invalidation**: queue 30s TTL je acceptable per `bff.md §2.4`. Ale pri tenant switch
  treba flush. Implementácia: cache key obsahuje `tenantId` + `userId`; tenant switch v F.1
  emituje `auth.tenant.switched` event → cache invalidator počúva? V MVP TTL stačí, no aktívna
  invalidácia. Audit.
- **Multi-tenant fan-out**: ak user má v session 2+ tenantov, queue **vždy** scopuje na
  `session.activeTenantId`. Žiadny "all tenants" view v MVP.
