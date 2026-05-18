# F.3 — `/clear` prompt

> Copy-paste do nového chatu po `/clear`. Žiadny implicitný kontext z minulých session-ov —
> všetko čo treba je v `docs/plans/F.3.md` + linkované Inputs + auto-loaded memory.

```text
Pokračujeme SDM-Rewrite. Najbližší chunk: F.3 — BFF Aggregator endpoints.

Plán (Inputs / Outputs / Done-when / Stratégia / Open questions):
→ docs/plans/F.3.md

Phase F overview + cross-chunk rozhodnutia D1–D6 (najmä D4 = /me/tenants
shape embedded v /me, F.3 rozhoduje o splite vs aliase):
→ docs/plans/F.md

Real B-E contract evidence (CA SDM 17.4 captured v F.1+F.2):
→ docs/agents/devex-devops/real-backend-contracts.md
   • §1-11 = auth + cnt + role + tenant + in + error taxonomy
   • §12-21 = entity mutating shapes + chg/KD/nr schema divergence + filter conventions

F.2 deliverables na ktorých F.3 stojí (prečítaj top JSDoc + signatures, netreba celé):
→ apps/bff/src/api/rest-proxy.ts        — proxyToSdm + paginationToCaSdm + readCollection
→ apps/bff/src/api/cache.ts             — TtlCache (in-memory, single-instance MVP)
→ apps/bff/src/api/endpoints/_shape.ts  — toFkRef + liftAttrs + epochSecToIso + toCaSdmXmlBody
→ apps/bff/src/api/error-shaper.ts      — classifySdmResponse (zdielaný auth + proxy)
→ apps/bff/src/session/load.ts          — requireActiveSession (extrahované z F.1 /me)
→ apps/bff/src/aggregator/me.ts         — F.1 /me canonical shape (D4 — F.3 sa rozhoduje o /me/tenants splite)

Status + PR-flow + creds (deploy + real CA SDM B-E):
auto-loaduje sa z MEMORY.md (per-project auto-memory, mimo repo).
NIKDY nepúšťaj heslá do repo / commit / PR body.

Postup:
1. Prečítaj docs/plans/F.3.md + docs/plans/F.md + rest-proxy.ts (aspoň top JSDoc + exports).
2. Otvor súbory zo sekcie Inputs v F.3.md (najmä bff.md §2.4 + ticket-detail spec).
3. Krátky plán (~5 viet) — pivot vs F.3.md + sanity check + 3 F.2→F.3 carry-overs
   (viď A, B, C nižšie); netvor špec znova.
4. `git checkout -b chunk/F.3-aggregator` od main (F.2 už merged ako commit b282a31).
5. Implementácia main thread, ŽIADNE subagenty (per F.3.md §Stratégia — logika je
   sekvenčne závislá od F.2 RestProxy interface-u):
   - shapers/ui-queue-item.ts + shapers/ui-ticket-detail.ts (pure functions, najprv testy)
   - me-tenants.ts (single CA SDM /cnt_role + /tenant join, cache 5 min)
   - queue.ts (Promise.all([in, cr, pr]) + merge + sort by priority+lastActivityAt, cache 30 s)
   - ticket-detail.ts (parent fetch → Promise.all(linked, attachments, activity))
   - routes.ts register + wire v apps/bff/src/index.ts
   - integ testy cez MSW Node (zarovnané s F.2 patternom v api-endpoints.integration.test.ts)
6. Verifikácia: pnpm -r typecheck/lint/build/test + live smoke proti real B-E
   (queue vráti ≥ 1 incident + 1 request + 1 problem z dev test data).
7. ROADMAP refresh "Aktuálny stav" pointer (stale po F.2 merge — F.3 commit ho refreshne)
   + F.3 status header → ✅ DONE.
8. Push branch + gh pr create. NIE push direct na main (per memory feedback_pr_flow).

F.2 → F.3 carry-overs ktoré F.3.md ešte nezachytáva:

A. Cache invalidácia na tenant switch. F.3 plán v §Open questions ostáva nedohodnutý:
   "audit event hookup vs TTL stačí". MVP rozhodnutie: **TTL stačí** (5 min me-tenants,
   30 s queue — pri tenant switch user vidí stary view max 30 s, akceptovateľné). Aktívna
   invalidácia ide do F.4 audit event bus. Cache key musí obsahovať
   `(tenantId, userId)` aby súbežné session-y rôznych tenantov nezdielali cache —
   single user switching tenants stále chytí starý view kým TTL nevyprší, ale to je MVP-acceptable.

B. /me/tenants split vs alias (D4 carry-over). F.1 /me embedduje tenants[] do canonical
   shape per auth-flow.md §4.5. F.3.md hovorí: "ak FE chce reload tenant listu bez full
   /me reload, treba samostatný endpoint s vlastným cache TTL". Predpoklad: áno, oddelený
   endpoint /me/tenants (cache 5 min) — refresh tenants po tenant-admin operáciách bez
   full /me roundtripu (žiadny app re-bootstrap). Aliasovať nie. Toto je judgment call —
   ak agent uvidí dôvod ostať pri aliase, nech to zapíše do PR body.

C. Shaper reuse vs fresh. F.2's apps/bff/src/api/endpoints/{incidents,requests,problems}.ts
   majú per-súbor private mapRow ktorý vracia { id, ref, summary, status, priority,
   customer, openedAt: ISO, ... }. F.3 queue má **uniform UI shape** naprieč typmi
   (in/cr/pr) per `@sdm/api-types UiQueueItem` — preto F.3 plán predpokladá fresh shapers
   v aggregator/shapers/. Skutočná otázka: exportnúť F.2 mapRow-y aby si F.3 shapery
   mohli reusnúť normalizáciu FK fieldov (toFkRef + epochSecToIso)? Odporúčam:
   ÁNO — exportnúť mapRow z incidents.ts/requests.ts/problems.ts ako pure function-y,
   F.3 shapery ich postvolajú a doplnia uniform-shape transformáciu. Bez duplikácie
   logiky pre customer/assignee/status remap.

Ak narazíš na nejasnosť v pláne (najmä carry-over A — TTL vs aktívna invalidácia, B —
/me/tenants split, alebo open question na linked-tickets factory lrel_* ktoré F.2 ešte
nezachytilo v real-backend-contracts.md), povedz pred začatím implementácie, nehádaj.
```

## Operatívne poznámky (pre tvorcu prompt-u, nie pre LLM)

- **Žiadne subagenty**: F.3.md §Stratégia explicitne hovorí "Main thread, žiadne subagenty
  (logika je sekvenčne závislá od F.2 RestProxy interface-u)". Single stream stačí — žiadne
  ortogonálne paralelné kúsky ako mali F.1 (real B-E probe + session+cookies + config+CSRF)
  alebo F.2 (entity contract discovery + XML→JSON adapter).
- **Real B-E gap pre F.3**: `lrel_attachments_*` + `lrel_*` link relation tables NIE sú
  empiricky probované v F.1/F.2. Ticket-detail aggregation potrebuje "linked tickets" a
  "attachments" zoznam. Ak agent narazí na neznámu shape, dve cesty: (a) ad-hoc curl probe
  proti `10.11.35.35:8050` a append nového § do `real-backend-contracts.md` (krátka extension,
  jeden agent's work, ~10 min), (b) stub linked + attachments empty array, F.3 ich vráti ako
  `linkedTickets: []` + `attachments: []`, follow-up chunk doplní. Plán preferuje (a) ak je
  triviálne.
- **F.3 → F.4 boundary**: audit logger taxonómia (auth._ / authz._ / data.\*) je explicit F.4
  scope per F.md D6. F.3 emituje len basic pino logy s correlationId + cache hit/miss eventy
  (per F.3.md Done-when). NIE plnú audit taxonomy.
- **F.3 → F.5 boundary**: FE shape bit-by-bit alignment s @sdm/api-mocks UiQueueItem je F.5
  cleanup scope (per D4). F.3 buduje BFF-canonical UI shape; F.5 zarovná FE + mocky.
- **Branch hygiene**: F.3 branchne z main (nie stacked) — F.2 už merged. Ak by si potreboval
  hot-fix pre F.2 mid-F.3, klasický feature branch z main.
- **ROADMAP "Aktuálny stav" je stale po F.2 merge**: hovorí "Last merged: E.3" + "In flight:
  F.2 PR pending". Per feedback_pr_flow memory direct push na main zakázaný — F.3 prvý commit
  refreshne pointer ako súčasť chunk-u (rovnaký pattern ako F.2 update F.1 in-flight v 86ac2a3).
