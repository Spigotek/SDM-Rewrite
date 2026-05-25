Pokračujeme SDM-Rewrite. Najbližší chunk: F.6 — Ticket-detail B-E probe
(linked / attachments / activity). Optional uzáver Phase F — odstraňuje posledné
`_unsupported: true` markery z F.3 ticket-detail aggregator-i.

Plán (Inputs / Outputs / Done-when / 3-fázová Stratégia / Open questions):
→ docs/plans/F.6.md

Phase F overview + cross-chunk rozhodnutia D1–D6:
→ docs/plans/F.md

Real B-E contract evidence (CA SDM 17.4 captured F.1+F.2, F.6 appendne §22-§24):
→ docs/agents/devex-devops/real-backend-contracts.md
• §1-11 = auth + cnt + role + tenant + in + error taxonomy + smoke script template
• §12-21 = entity mutating shapes + chg/KD/nr divergence + filter conventions

Anticipated factory mená (api-analyst hypotézy — F.6 ich overí proti real B-E):
→ docs/agents/api-analyst/endpoints.md
• §incident /act_log + /attachments BREL navigation
• §change /chg/{id}/act_log → chgalg, /chg/{id}/attachments
• §attachments — attmnt factory + /file-resource binary endpoint (mimo F.6 scope)

F.1-F.5 deliverables na ktorých F.6 stojí (top JSDoc + signatures stačia):
→ apps/bff/src/aggregator/ticket-detail.ts — current MVP stub (F.3)
→ apps/bff/src/aggregator/shapers/ui-ticket-detail.ts — \_unsupported: true emit (F.3)
→ apps/bff/src/api/rest-proxy.ts — proxyToSdm helper (F.2)
→ apps/bff/src/api/cache.ts — TtlCache (F.2)
→ apps/bff/src/api/endpoints/\_shape.ts — liftAttrs / toFkRef / epochSecToIso (F.2)
→ apps/bff/src/api/endpoints/{incidents,requests,problems}.ts — mapXRow exported (F.2)
→ apps/bff/src/platform/audit/emit.ts — auditEvent helper (F.4)
→ packages/api-types/src/index.ts — UiTicketDetail{Linked,Attachments,Activity},
UiActivityEntry, UiAttachmentMeta (no shape change)

Sample ticket IDs (F.3 smoke captured — re-verify pred probe):
→ 17 incidents v `in`, 7 requests v `cr`, 1 problem v `pr`, 0 changes v `chg`
• Pre `chg` buď POST sample order alebo skip activity/attachments probe na chg
(probe samotného shape detail je už zachytený v real-backend-contracts.md §15)

Status + PR-flow + creds (deploy + real CA SDM B-E):
auto-loaduje sa z MEMORY.md (per-project auto-memory, mimo repo).
NIKDY nepúšťaj heslá do repo / commit / PR body.

Postup:

1. Prečítaj docs/plans/F.6.md + docs/plans/F.md (Phase overview).
2. Otvor Input súbory zo sekcie Inputs v F.6.md — najmä:
   • real-backend-contracts.md §10 (open questions for Phase B) + §18 (reference-factory digest)
   • endpoints.md §incident BREL list (act_log, attachments, related entities)
   • apps/bff/src/aggregator/ticket-detail.ts (current parent-only fetch)
   • apps/bff/src/aggregator/shapers/ui-ticket-detail.ts (empty linked/attachments/activity emit)
3. Krátky plán (~5 viet) — confirm 3-fáz approach z F.6.md + identify ktoré ticket IDs
   na probe (curl `GET /caisd-rest/in?size=1` pre fresh ID list, nepoužívaj F.3 cached).
4. `git checkout main && git pull --ff-only && git checkout -b chunk/F.6-ticket-detail-probe`.
5. Stratégia: SEKVENČNE main thread (per F.6.md §Stratégia Fáza A decision — probe vyžaduje
   incremental decision-making, subagent nemá pridanú hodnotu).

   Fáza A — Probe + dokumentácia:
   • Napíš `tools/sdm-probe/probe-ticket-detail.sh` — bash skript ktorý pre každý
   factory + sample ID urobí probe sekvenciu BREL navigácií (act_log/alg, attachments,
   affected_incidents, affected_changes, related_problems, …).
   • Zachyť responses: pre 200 → log shape (XML default → JSON cez Accept), pre 404/400 → log
   "relation neexistuje" verdict.
   • Append §22 (activity), §23 (attachments), §24 (linked) do real-backend-contracts.md
   s overenými URL pattern + row attribute mapping + edge cases (empty collection,
   paginácia).
   • Decision point: ak niektorá vetva nedostupná na tomto instance → F.6 dokumentuje
   a ostáva pri `_unsupported: true` pre tú konkrétnu vetvu (môže flipnúť len 2 z 3).

   Fáza B — Implementácia (main thread, sekvenčné):
   • `apps/bff/src/api/endpoints/activity-log.ts` — mapAlgRow(raw): UiActivityEntry
   (per-factory varianta ak `chgalg` diverguje od `act_log`/`alg`).
   • `apps/bff/src/api/endpoints/attachments.ts` — mapAttmntRow(raw): UiAttachmentMeta.
   • `apps/bff/src/aggregator/ticket-detail.ts` — po parent fetch
   `Promise.allSettled([fetchActivity, fetchAttachments, fetchLinked])` (NIE Promise.all
   — partial-failure tolerant per F.3 carry-over). Per-relation TTL cache: activity 30 s,
   attachments 5 min, linked 5 min.
   • `apps/bff/src/aggregator/shapers/ui-ticket-detail.ts` — \_unsupported: false pre uspeté
   vetvy, true pre fallback. `activity.hasMore` real (nie hardcoded false).
   • Tests: unit shaper (one empty + one with-data per ticket type), integration cez
   `msw/node` upstream mock.

   Fáza C — Verifikácia + ROADMAP + PR:
   • pnpm -r typecheck/lint/test/build green.
   • Live smoke proti `10.11.35.35:8050` pre všetky 4 ticket types — probe-ticket-detail.sh
   re-run + manuálne curl /api/tickets/{type}/{id} cez BFF.
   • Browser-test MSW mode 5/5 zelené (žiaden FE shape change — UI invariant ostáva).

6. ROADMAP refresh — F.6 → ✅ DONE; "Next up" = G.1 Design system tokens; Phase G presunúť
   z "🔜 (~5 chunks, after F.6)" na "🔜 NEXT (~5 chunks)".
7. F.6.md status → ✅ DONE, doplň PR číslo, mark Open questions resolutions.
8. Push branch + gh pr create (squash --admin --delete-branch merge per memory).
9. Po merge → next chunk = G.1 (Design system tokens + base komponenty per
   docs/agents/design-system/{tokens,components,theming}.md).

F.6 Open questions na rozhodnutie pri impl (rough preview — detail v F.6.md):

A. `act_log` vs `alg` vs `chgalg` factory name — probe rozhodne ktorý vracia 200 na BREL
navigáciu (`/in/{id}/act_log` vs `/in/{id}/alg`). Ak ani jeden nefunguje → activity
ostáva `_unsupported: true` v F.6 a posuvka do follow-up chunku.

B. Linked tickets relation mená — Problem→Incident, Incident→Change, Problem→KE
majú mnoho BREL kandidátov. Pre MVP scope F.6 by mal pokryť **aspoň**
Problem→affected_incidents (najčastejší use-case per spec/problem-management.md).
Ostatné linked vetvy môžu ísť do post-MVP ak probe nájde >3 unsupported relácií.

C. Attachment binary download — `/caisd-rest/attmnt/{id}/file-resource` je mimo F.6 scope
(BFF proxy + streaming je Phase H feature work s download button-om). F.6 vracia iba
metadata cez `UiAttachmentMeta`. Dokumentuje endpoint v real-backend-contracts.md §23
pre Phase H pickup.

D. Activity log paginácia — `UiTicketDetailActivity.hasMore`. Pre MVP simplicity:
`?size=100` + `hasMore = total > 100`. Deep-paginate (samostatný
`/api/tickets/:type/:id/activity?page=N` endpoint) odložený do feature chunku ak
UX požaduje.

E. Audit taxonomy F.4 — emit pri `/api/tickets/:type/:id` jeden `data.ticket.read`
event s `details: { fetched: ["parent", "activity", "attachments", "linked"] }`?
Alebo granular per-relation (`data.ticket.attachments.read`)? Recommendation:
single parent event — granular eventy zvyšujú log volume bez compliance gain.

F. Performance budget — paralelný fan-out 4 CA SDM calls per ticket open. CA SDM 17.4
nemá dokumentovaný rate limit; prudent default = max 4 concurrent + 2 s per-call
timeout (consistent s F.4 /readyz probe). Cache TTL amortizuje.

Ak narazíš na nejasnosť v pláne (najmä Open questions A-F vyššie alebo BREL relation
discovery v Fáze A), povedz pred začatím implementácie, nehádaj.
