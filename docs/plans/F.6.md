# F.6 — Ticket-detail B-E probe (linked / attachments / activity)

> **Status**: 🔜 NEXT (blokované na F.5 merge — PR #17)
> **Branch**: `chunk/F.6-ticket-detail-probe` (od `main` po F.5 merge)
> **PR**: —

## Pivot vs ROADMAP

ROADMAP nemá F.6 ako samostatný riadok; v Phase F bola položka „Scope-out (deferred z F.x)"
zachytávajúca technický dlh — F.6 je **dobrovoľný uzáver Phase F** ktorý odstraňuje posledné
`_unsupported: true` markery z F.3 ticket-detail aggregatori. Bez F.6 je MVP funkčný (FE
renderuje empty state); s F.6 sa ticket detail dostane na "feature-complete" pre Phase H.

Per `docs/plans/F.3.md` §Open questions:

> "Linked tickets / attachments / activity log factory mená nie sú v `real-backend-contracts.md`.
> F.3 vystavuje shape s `_unsupported: true` na týchto blokoch a empty arrays. Pred ich oživením
> treba probe proti `10.11.35.35:8050`."

## Inputs

- `docs/agents/devex-devops/real-backend-contracts.md` — F.1+F.2 captured shapes; F.6 pridá
  §22 (activity log) + §23 (attachments) + §24 (linked tickets) sections.
- `docs/agents/api-analyst/endpoints.md` §incident/§request/§change — anticipované factory mená
  (`act_log`, `alg`, `chgalg`, `attmnt`, BREL navigation `/in/{id}/act_log`, `/chg/{id}/attachments`).
- `apps/bff/src/aggregator/ticket-detail.ts` — current MVP stub.
- `apps/bff/src/aggregator/shapers/ui-ticket-detail.ts` — current `_unsupported: true` emit.
- `apps/bff/src/api/rest-proxy.ts` + `apps/bff/src/api/cache.ts` — existing infra na CA SDM volania.
- `packages/api-types/src/index.ts` — `UiTicketDetailLinked`, `UiTicketDetailAttachments`,
  `UiTicketDetailActivity`, `UiActivityEntry`, `UiAttachmentMeta` types (no shape change expected —
  iba `_unsupported` flag flip-ne na `false`).

## Outputs

```
docs/agents/devex-devops/real-backend-contracts.md   # §22-§24 nové sections
tools/sdm-probe/probe-ticket-detail.sh               # opt — re-runnable probe script (alebo inline §11 update)

apps/bff/src/aggregator/ticket-detail.ts             # parallel fan-out: parent + activity + attachments + linked
apps/bff/src/aggregator/shapers/ui-ticket-detail.ts  # _unsupported: false, real data shapers

apps/bff/src/api/endpoints/                          # opt: ak treba reusable activity/attmnt mappers
├── activity-log.ts                                  # mapAlgRow / mapActLogRow
└── attachments.ts                                   # mapAttmntRow

apps/bff/tests/aggregator/ticket-detail.test.ts      # extended pre nové fan-out vetvy
packages/api-mocks/src/handlers/                     # MSW: pridať activity/attachments fixtures pre dev parity
└── ticket-detail-extras.ts                          # opt nový handler subor

docs/ROADMAP.md                                      # F.6 → ✅ DONE; (opt) Phase F note: feature-complete
docs/plans/F.6.md                                    # tento súbor → Status DONE
```

## Done-when

- [ ] `real-backend-contracts.md` §22-§24 zachytávajú **overené** factory mená + shape pre activity log,
      attachments, linked tickets pre všetky 4 ticket type-y (in, cr, pr, chg). Negative case (žiadne
      attachments / žiadny activity log) tiež zdokumentovaný.
- [ ] `ticket-detail.ts` paralelne fan-out-uje (parent first → potom `Promise.allSettled` na
      activity + attachments + linked) — partial-failure tolerant (per F.3 carry-over: keď jedna
      vetva zlyhá, vraciame ostatné s warning v audit logu, nie 500).
- [ ] `ui-ticket-detail.ts` vracia `_unsupported: false` so skutočnými dátami. `UiTicketDetail*`
      typy v `api-types` nemenia shape — len semantika `_unsupported` sa flipne.
- [ ] Vitest jednotka pre nové shapery + integ test pre `/api/tickets/:type/:id` s aspoň jednou
      vetvou s dátami a jednou bez (empty linked / no attachments / no activity).
- [ ] Live smoke proti `10.11.35.35:8050` pre všetky 4 ticket type-y zelený — pozri F.6
      Done-when log nižšie pre konkrétny test set.
- [ ] MSW handler-y (opt) majú parity — `VITE_USE_MOCKS=true` mode tiež vracia nejaké
      attachment/activity dáta aby browser-test mocks-mutation-roundtrip mohol verifikovať shape.
- [ ] `audit-and-compliance §2` events: pridať `data.ticket.attachments.read` ak nie sú v F.4
      taxonomy (pravdepodobne stačí re-use `data.ticket.read` per F.4 — F.6 to neznásobuje).
- [ ] F.5 PR #17 merged ⇒ branch od freshnutého `main`.
- [ ] ROADMAP toggle: F.6 → ✅ DONE.

## Stratégia

### Fáza A — Probe + dokumentácia (sekvenčné, jeden hlavný thread)

Subagent nemá pridanú hodnotu — probe vyžaduje incremental decision-making (skús factory X →
ak 404, skús Y → ak success, mapuj shape). Main thread + curl.

1. Setup: napíš `tools/sdm-probe/probe-ticket-detail.sh` (bash) ktorý urobí:
   - Pre každý factory (`in`, `cr`, `pr`, `chg`): vyber existujúci ticket ID (mám 17 incidents,
     7 requests, 1 problem, 0 changes per F.3 smoke — pre `chg` treba najprv POST sample order
     alebo skip).
   - Probe sequence per ticket:
     ```
     GET /caisd-rest/{factory}/{id}/act_log  (BREL → act_log alebo alg)
     GET /caisd-rest/{factory}/{id}/attachments  (BLREL → attmnt collection)
     GET /caisd-rest/{factory}/{id}/affected_incidents  (Problem → Incident)
     GET /caisd-rest/{factory}/{id}/affected_changes
     GET /caisd-rest/{factory}/{id}/related_problems
     ... (skús zoznam pravdepodobných BREL mien per endpoints.md §incident)
     ```
   - Pre každý 200: capture full body shape (`X-Obj-Attrs` zoznam, FK projection, paginácia).
   - Pre 404 / 400 (unknown rel): log it — to je "this relation doesn't exist on this instance".
2. Append `real-backend-contracts.md` §22 (activity), §23 (attachments), §24 (linked) s:
   - URL pattern (e.g. `GET /caisd-rest/in/{id}/act_log`)
   - Response shape (XML default → JSON via Accept: application/json)
   - Row attribute mapping pre Ui-shape
   - Edge cases: empty collection (`<collection><@COUNT="0"/></collection>` vs missing entirely)
   - Pagination behavior (čítame celé alebo `?size=N&start=K`)
3. Decision point: ak niektorá vetva probe-ne nedostupná (napr. linked relations nemajú deklarovaný
   BREL na tomto instance) → **dokumentovať a ostať pri `_unsupported: true` pre tú konkrétnu
   vetvu**. F.6 nemusí flipnúť všetky tri — môže flipnúť len activity+attachments a linked nechať
   na post-MVP.

### Fáza B — Implementácia

Hierarchia code changes:

1. **Mappers** v `apps/bff/src/api/endpoints/`:

   - `activity-log.ts` — `mapAlgRow(raw): UiActivityEntry` (alebo per-factory varianta ak `chgalg`
     diverguje).
   - `attachments.ts` — `mapAttmntRow(raw): UiAttachmentMeta`.
   - Linked: per-relation simple FK extraction → `FkRef`.

2. **Aggregator** v `apps/bff/src/aggregator/ticket-detail.ts`:

   - Po parent fetch: spustiť `Promise.allSettled([fetchActivity, fetchAttachments, fetchLinked])`.
   - Každú vetvu cache-nuť per (type, id, rel) s vlastným TTL (activity 30s — krátke kvôli volatilite;
     attachments 5min; linked 5min).
   - Partial failure: log warn + audit event, vrátiť ten blok s `_unsupported: true` (back-compat
     escape hatch). Ostatné OK.

3. **Shaper** v `apps/bff/src/aggregator/shapers/ui-ticket-detail.ts`:

   - `_unsupported: false` keď vetva uspela, `true` keď fallback.
   - `activity.hasMore` real (nie `false`).

4. **Tests**:
   - Unit shaper testy (jedna empty, jedna with-data per ticket type).
   - Integration test cez `msw/node` upstream mock (Vitest).
   - Browser-test scenár opt — `mocks-mutation-roundtrip` rozšírený o attachment list assert?

### Fáza C — Verifikácia + ROADMAP + PR

1. `pnpm -r typecheck/lint/test/build` green.
2. Live smoke proti `10.11.35.35:8050` pre all 4 ticket types (manuálne curl alebo cez `tools/sdm-probe/probe-ticket-detail.sh`).
3. Browser-test scenarios MSW mode 5/5 stále zelené.
4. ROADMAP "Aktuálny stav" + F.6 → ✅ DONE; (opt) Phase F note "feature-complete".
5. PR per memory PR-flow.

## Open questions / risks

- **`act_log` vs `alg` vs `chgalg` factory name**: F.3 plan a api-analyst endpoints.md spomínajú
  všetky tri. Probe v Fáze A musí zachytiť ktorý z nich vracia 200 na BREL navigáciu — pravdepodobne
  `act_log` na `in/cr/pr` a `chgalg` na `chg`. Risk: ak ani jeden nefunguje na tomto instance, F.6
  nechá activity ako `_unsupported: true` a posunie sa do follow-up chunku.
- **Linked tickets relation mená**: pre Problem→Incident, Incident→Change existuje mnoho možných
  BREL mien (`affected_incidents`, `caused_by_chg`, `chg_problems`, …). Pre MVP scope F.6 by mal
  pokryť **aspoň** Problem→affected_incidents (najčastejší use-case per `spec/problem-management.md`).
  Ostatné linked vetvy môžu ísť do post-MVP ak probe nájde >3 unsupported relácií.
- **Attachment binary download**: `GET /caisd-rest/attmnt/{id}/file-resource` je separate endpoint
  pre file body. F.6 vracia **iba** metadata (`UiAttachmentMeta`); ne-streamuje file body — to
  patrí do Phase H feature work (download button). F.6 dokumentuje endpoint pre Phase H ale
  neimplementuje BFF proxy.
- **Activity log paginácia**: `hasMore` field je v `UiTicketDetailActivity`. Ak má ticket >100
  activity entries, pravdepodobne treba paginovať. F.6 môže buď (a) fetch celého collection-u
  s `?size=100` a `hasMore = total > 100` flag-om, alebo (b) zaviesť samostatný endpoint
  `/api/tickets/:type/:id/activity?page=N`. **Recommendation**: (a) pre MVP simplicity, (b) sa
  presunie do feature chunku ak UX požaduje deep paginate.
- **Audit taxonomy F.4**: emit-uje sa pri `/api/tickets/:type/:id` jeden `data.ticket.read` event,
  alebo separate per-relation (attachment list = `data.ticket.attachments.read`)? **Recommendation**:
  jeden parent event s `details: { fetched: ["parent", "activity", "attachments", "linked"] }` —
  granular per-relation eventy by zvýšili log volume bez compliance gain.
- **Performance budget**: paralelný fan-out na 4 CA SDM calls pri každom ticket open. CA SDM
  17.4 nemá rate limit dokumentovaný, ale prudent default = max 4 concurrent calls per request,
  každý 2 s timeout (consistent s F.4 `/readyz` probe). Cache TTL pomáha amortizovať.

## Notes

F.5 PR #17 musí byť merged pred štartom F.6, aby:

1. Branch `chunk/F.6-ticket-detail-probe` mohla ísť od fresh `main` (nie stacked).
2. F.5 zmeny v MSW handler-och nekolidovali s F.6 ticket-detail MSW updates.

Probe v Fáze A nepotrebuje žiadne FE zmeny — celý F.6 je BFF + dokumentácia. FE shape sa nemení
(len `_unsupported` flag), takže Phase H feature work môže pokračovať paralelne ak treba.
