# F.6 — Ticket-detail B-E probe (linked / attachments / activity)

> **Status**: ⏳ IN-FLIGHT (PR pending)
> **Branch**: `chunk/F.6-ticket-detail-probe` (od fresh `main` po F.5 merge)
> **PR**: TBD (linked po `gh pr create`)
>
> **Outcome**: activity log + attachments flipped to `_unsupported: false` (real B-E
> shapes wired); linked tickets stay `_unsupported: true` — `real-backend-contracts.md §24`
> documents that NO BREL relation works for Problem↔Incident↔Change navigation on this
> CA SDM 17.4 instance. Re-opening linked would require a CA SDM customisation or a
> server-side WC query layer; out of F.6 scope.

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

- [x] `real-backend-contracts.md` §22-§24 zachytávajú **overené** factory mená + shape pre activity log,
      attachments, linked tickets pre všetky 4 ticket type-y (in, cr, pr, chg). Negative case (žiadne
      attachments / žiadny activity log) zdokumentovaný; linked verdict = no BREL works (§24).
- [x] `ticket-detail.ts` paralelne fan-out-uje (parent first → potom `Promise.allSettled` na
      activity + attachments) — partial-failure tolerant: failed branch → `_unsupported: true`,
      parent stále 200; warning v pino log s `branch=…`, error=…`.
- [x] `ui-ticket-detail.ts` vracia `_unsupported: false` so skutočnými dátami pre activity +
      attachments; linked stays `_unsupported: true` (per §24 verdict). `UiTicketDetail*` typy
      v `api-types` shape unchanged — len semantika `_unsupported` sa flipne.
- [x] Vitest jednotka pre nové shapery (`activity-log.test.ts` 6 testov, `attachments.test.ts`
      8 testov) + integ test pre `/api/tickets/:type/:id` 9 testov pokrýva: empty branches,
      populated alg/chgalg, two-step attmnt enrichment, branch failure → `_unsupported: true`.
- [x] Live smoke proti `10.11.35.35:8050` pre všetky 4 ticket type-y zelený —
      `scripts/smoke-f6.sh` re-runnable. Verified ticket IDs: `in/2800` (6 alg entries, mix
      public/system), `cr/2851` (empty), `pr/406621` (2 alg entries, system kind), `chg/2781`
      (4 chgalg entries, mix public/system). Cache hit ~2 ms.
- [N/A] MSW handler-y — F.5 cleanup už zarovnal MSW na canonical `/me`, ticket-detail shape
  neexistujúci v MSW handlers (queue iba, ticket-detail je BFF-only endpoint per F.3). FE
  shape sa nemenila, browser-test mode passthrough.
- [N/A] `audit-and-compliance §2` events — `data.<entity>.read` patrí pod §3 "0% sampling
  (covered by reverse-proxy access log)". F.4 audit taxonomy už neeviduje read events;
  F.6 nezavedie nové.
- [x] F.5 PR #17 merged (squash --admin --delete-branch) ⇒ branch od fresh `main`.
- [ ] ROADMAP toggle: F.6 → ✅ DONE (po PR merge).

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

## Open questions / risks — resolutions

- **`act_log` vs `alg` vs `chgalg` factory name** — **RESOLVED**: probe potvrdil
  `/{factory}/{id}/act_log` funguje pre všetky 4 typy. Inner collection je `collection_alg`
  pre `in`/`cr`/`pr` (row factory = `alg`) a `collection_chgalg` pre `chg` (row factory =
  `chgalg`). Row attribute set je identický. Detail: real-backend-contracts.md §22.
- **Linked tickets relation mená** — **VERDICT: NO BREL WORKS**. Probe vyskúšal: `problem`,
  `rootcause`, `change`, `parent`, `children`, `affected_incidents`, `affected_changes`,
  `affected_problems`, `incidents`, `problems`, `rootcause_chg`. Iba `children` vrátil 200
  (returns `collection_cr` — nepotvrdená semantika, sample data empty). F.6 zachováva
  `linked._unsupported: true`; flip vyžaduje CA SDM customisation alebo server-side WC layer.
  Detail: real-backend-contracts.md §24.
- **Attachment binary download** — confirmed out-of-scope. `/caisd-rest/attmnt/{id}/file-resource`
  endpoint dokumentovaný v §23.6 pre Phase H pickup. F.6 vracia iba `UiAttachmentMeta`.
- **Activity log paginácia** — **RESOLVED: option (a)**: `?size=100` + `hasMore = @TOTAL_COUNT > 100`.
  `UiTicketDetailActivity.hasMore` flipne true pri prekročení. Deep-pagination odložený do
  Phase H feature chunku ak FE UX požaduje.
- **Audit taxonomy F.4** — **RESOLVED**: F.6 NEemit-uje read events. `audit-and-compliance §3`
  hovorí `data.<entity>.read` má 0% sampling (covered by reverse-proxy access log). F.4 taxonomy
  v `apps/bff/src/platform/audit/events.ts` exponuje iba `data.<entity>.write` + `data.<entity>.delete`
  factories — F.6 to neznásobuje.
- **Performance budget** — confirmed conservative defaults: parent fetch + activity (1 call) +
  attachments lrel (1 call) + per-attmnt enrichment (max 8 parallel, capped at `size=50`).
  Worst-case ticket = 2 + ⌈50/8⌉ × 8 = 58 calls; cache TTL=60 s amortizuje. Branch fan-out je
  `Promise.allSettled` na 2 vetvy (activity, attachments) — partial failure = degrade to
  `_unsupported: true`, no 500.
- **Linked follow-up** — single bullet v `docs/plans/H.md` (Phase H seed): "Linked tickets
  unblock requires CA SDM customisation; alternative: BFF-side WC query layer that derives
  Problem→Incidents via `cr.rootcause_id` SREL column." Out of MVP scope.

## Notes

F.5 PR #17 musí byť merged pred štartom F.6, aby:

1. Branch `chunk/F.6-ticket-detail-probe` mohla ísť od fresh `main` (nie stacked).
2. F.5 zmeny v MSW handler-och nekolidovali s F.6 ticket-detail MSW updates.

Probe v Fáze A nepotrebuje žiadne FE zmeny — celý F.6 je BFF + dokumentácia. FE shape sa nemení
(len `_unsupported` flag), takže Phase H feature work môže pokračovať paralelne ak treba.
