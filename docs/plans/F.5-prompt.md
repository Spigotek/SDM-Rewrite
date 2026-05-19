# F.5 — `/clear` prompt

> Copy-paste do nového chatu po `/clear`. Žiadny implicitný kontext z minulých session-ov —
> všetko čo treba je v `docs/plans/F.5.md` + linkované Inputs + auto-loaded memory.

```text
Pokračujeme SDM-Rewrite. Najbližší chunk: F.5 — Cleanup MSW vs BFF
(SPA prepnutie + /me shape align + login + idle + cross-tab).
Toto je POSLEDNÝ chunk Phase F.

Plán (Inputs / Outputs / Done-when / Stratégia / Open questions):
→ docs/plans/F.5.md

Phase F overview + cross-chunk rozhodnutia D1–D6 (najmä D4 = canonical /me
shape z F.1, F.5 to teraz zarovná na FE side):
→ docs/plans/F.md

Real B-E contract evidence (CA SDM 17.4 captured F.1+F.2):
→ docs/agents/devex-devops/real-backend-contracts.md
   • §1-11 = auth + cnt + role + tenant + in + error taxonomy
   • §12-21 = entity mutating shapes + chg/KD/nr divergence + filter conventions

F.1-F.4 deliverables na ktorých F.5 stojí (top JSDoc + signatures stačia):
→ apps/bff/src/aggregator/me.ts            — canonical /me §4.5 shape (F.1)
→ apps/bff/src/aggregator/me-tenants.ts    — split endpoint (F.3, D4 carry-over)
→ apps/bff/src/auth/routes.ts              — /auth/login, /auth/logout, /auth/heartbeat
→ apps/bff/src/security/csrf.ts            — Origin/Referer check (CSRF baseline; FE bude posielať header)
→ apps/bff/src/platform/config/endpoint.ts — GET /config canonical RuntimeConfig (F.4)
→ apps/bff/src/platform/audit/emit.ts      — auditEvent helper (F.4)
→ apps/bff/src/platform/health/routes.ts   — /readyz two-step probe (F.4)

FE súčasný stav (E.3 baseline — F.5 ho prerobí):
→ apps/{portal,workspace}/src/bootstrap/{config,session}.ts
   • config.ts používa minimal shape; F.5 ho prepne na canonical RuntimeConfig
     (apiBaseUrl, apiBasePath, auth, tenants, features, observability, meta).
   • session.ts robí TWO fetches (/me + /me/tenants); F.5 prejde na ONE /me fetch
     a prestane FE-side derive-ovať permissions (BFF už vracia effectivePermissions[]).
→ apps/{portal,workspace}/src/shell/*       — TopBar, TenantSwitcher, SessionProvider
→ packages/auth/src/session.ts              — Session typ (rozšíriť o csrfToken)
→ packages/api-client/src/http.ts           — HttpClient (pridať X-CSRF-Token injection)
→ packages/api-mocks/src/handlers/{auth,users,tenants,config}.ts — sync na canonical §4.5 shape

Status + PR-flow + creds (deploy + real CA SDM B-E):
auto-loaduje sa z MEMORY.md (per-project auto-memory, mimo repo).
NIKDY nepúšťaj heslá do repo / commit / PR body.

Postup:
1. Prečítaj docs/plans/F.5.md + docs/plans/F.md.
2. Otvor súbory zo sekcie Inputs v F.5.md (najmä auth-flow.md §2.4 idle, §2.6
   cross-tab, §4.5 /me shape; runtime-config.md VITE_USE_MOCKS semantika).
3. Krátky plán (~5 viet) — pivot vs F.5.md + 3 carry-overs (viď A, B, C
   nižšie); netvor špec znova.
4. `git checkout -b chunk/F.5-msw-cleanup` od main (F.4 už merged).
5. Stratégia: PARALELNÉ subagenty pre orthogonal scaffolding (F.5.md §Stratégia
   Fáza A). Tri subagenty na nezávislých file-trees:
   A1: cross-tab BroadcastChannel module v @sdm/api-client + Safari fallback
       (localStorage event) + vitest s jsdom
   A2: idle modal + heartbeat shell komponenty (portal first; workspace mirror
       neskôr v Fáze B)
   A3: MSW handler shape upgrade (@sdm/api-mocks users.ts + tenants.ts →
       canonical §4.5 shape; backwards-compat pre E.3 browser-test testid-y)
   Pre F.4 sme išli main-thread sequenced (audit hooks zasahovali zdielané
   súbory); pre F.5 sú subagent výstupy v rôznych package-och → kolízie minimálne.
   Po Fáze A → main thread Fáza B na integration body:
   - packages/auth/src/session.ts (extend Session typ o csrfToken + idleTimeoutSec)
   - packages/api-client/src/http.ts (CSRF header injection)
   - apps/{portal,workspace}/src/bootstrap/{config,session}.ts (canonical shape, single /me fetch)
   - apps/portal/src/shell/login-page.tsx (NEW minimal login form)
   - workspace mirror (cross-tab + idle modal + heartbeat zložky portal-first → workspace)
   - tools/browser-test/scenarios/smoke-bff-{portal,workspace}.spec.ts (NEW)
6. Verifikácia:
   - pnpm -r typecheck/lint/build/test green
   - VITE_USE_MOCKS=true pnpm dev + VITE_USE_MOCKS=false pnpm dev (+ BFF up)
     obe fungujú identicky pre tenant switch + queue zobrazenie
   - Idle modal smoke (mock-ujeme idleTimeoutSec na 30s v dev), cross-tab
     smoke (dva taby, tenant switch v A → B v ≤1s zareaguje)
   - Live smoke proti real B-E: full login → queue → ticket → logout loop
7. ROADMAP refresh "Aktuálny stav" + F.5 status header → ✅ DONE,
   Phase F exit criteria checked, next-up = Phase G.
8. Push branch + gh pr create (squash --admin --delete-branch merge per memory).
9. Po merge → samostatne ponúknuť optional follow-up "F.6 — B-E probe pre
   linked/attachments/activity factory mená" ak chce user uzavrieť Phase F
   úplne (otáča _unsupported:true → false v F.3 ticket-detail aggregator-i).

F.4 → F.5 carry-overs ktoré F.5.md ešte úplne nezachytáva:

A. /config shape breaking change. F.4 priniesol canonical RuntimeConfig
   (apiBaseUrl, auth, tenants, features, observability, meta). E.3 FE
   bootstrap/config.ts a MSW config handler stále vracajú minimal shape
   (apiBaseUrl, authMode, features={enableTenantSwitcher,...}, release={version,buildSha}).
   F.5 musí MIGRATE FE consumer-a (bootstrap/config.ts) + MSW handler
   na canonical shape v jednom kroku. Žiadny dual-shape compat — bod B
   Phase F entry criteria: SPA proti BFF funguje s canonical shape.

B. Audit events emit z F.4 — FE-side neexistujú symetrické "client" emity
   v MVP. Ak by F.5 chcel emit-núť napr. "auth.client.idle.warning" pri
   zobrazení idle modal-u, je to mimo F.4 taxonomy (event by patril do
   FE telemetry / Sentry vrstvy, nie BFF audit log-u). MVP = nečinné, log
   ostáva BFF-only. Toto je doc-only carry-over — v F.5.md Open questions
   pridať "FE audit emit ⇒ post-MVP".

C. CSRF header v F.5 = ÁNO. F.1+F.4 CSRF baseline = Origin/Referer check
   middleware (žiadny double-submit token); FE musí poslať `Origin` header
   na mutating volania. Browser to robí automaticky pre cross-origin
   fetch; same-origin fetch ho NEPOSIELA. Konfigurácia BFF_TRUSTED_ORIGINS
   musí zahŕňať origin FE app-u (dev: http://localhost:5173 portal,
   http://localhost:5175 workspace; prod: jeden host). F.5 to dokumentuje
   v dev-handbook.md + adds setup checklist pre dev mode.

Ak narazíš na nejasnosť v pláne (najmä Open questions §login form scope,
§workspace login redirect, §MSW backwards-compat browser-tests, §failover
doc), povedz pred začatím implementácie, nehádaj.
```

## Operatívne poznámky (pre tvorcu prompt-u, nie pre LLM)

- **Subagent recommendation pre F.5**: F.5.md §Stratégia ich navrhuje a v retrospektíve
  F.3/F.4 to dáva zmysel — A1/A2/A3 sú v rôznych package-och (`@sdm/api-client`,
  `apps/portal/src/shell`, `@sdm/api-mocks`), bez zdielaných touchpoint-ov ako mal F.4
  (audit hooks do auth+aggregator+csrf+entity-routes). Hlavná zdielaná surface je
  `packages/auth/src/session.ts` (typ Session) a `apps/{portal,workspace}/src/bootstrap/session.ts`
  — tieto **idú v Fáze B main-thread**, nie v subagent-och.
- **Phase F exit criteria** sú v `docs/plans/F.md`:
  - SPA proti BFF (`VITE_USE_MOCKS=false`) — full login → queue → ticket → logout loop
  - Vitest + integration testy zelené
  - E2E browser-test scenár pass proti BFF
  - Audit log emit-uje canonical events
    F.5 PR description by mal explicitne odškrtnúť všetky štyri.
- **Optional follow-up po F.5**: B-E probe mini-chunk (curl proti `10.11.35.35:8050`,
  discover `lrel_*` / `attmnt` / `act_log` factory mená, append §22+ do
  `real-backend-contracts.md`, flip `_unsupported: false` v `ticket-detail.ts`
  aggregator-i + napojiť linked/attachments/activity). Triviálny, ~30 min,
  uzatvára F.3 open question. Môže ísť pred F.5 (ak user chce kompletný
  ticket-detail v F.5 demo loop-e) alebo po F.5 ako F.6.
- **Branch hygiene**: F.5 z main (nie stacked) — F.4 merged. ROADMAP "Aktuálny
  stav" hovorí "Last merged: F.4, Next up: F.5" — F.5 prvý commit ho
  prepne na "In flight: F.5, Next up: Phase G".
- **Žiadne heslá do repo**: real CA SDM creds (vueuser:…) sa auto-loadujú z
  per-project MEMORY.md. PR body / commit message / scripts/\* MUSIA brať
  creds z env, nie hardcode.
