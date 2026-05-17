# SDM-Rewrite Roadmap

> Jediný zdroj pravdy pre **post-bootstrap sequencing**. Strategický plán, nie day-to-day
> tracker (tým sú GitHub Pull Requests + Issues). Aktualizuje sa **per merge** — každý
> chunk po merge prepne svoj status, neaktualizuje sa kontinuálne počas práce.

## Ako tento dokument použiť

**Pre nový chat session (po `/clear` alebo kompakcii):**

1. Prečítaj sekciu [Aktuálny stav](#aktuálny-stav) — vieš kde si.
2. Prečítaj `Inputs` najbližšieho `🔜 NEXT` chunku — vieš čo robíš.
3. Pracuj proti `Outputs` a `Done-when` kritériám — vieš kedy si hotový.

**Princíp vrstvenia:** každý chunk má explicit `Inputs` (čo treba prečítať) a `Outputs`
(čo bude existovať po merge). Žiadne implicitné vedomosti z prechádzajúcich chat
session-ov. Nový chat sa orientuje cez tento dokument + linkované špec docs + `git log`.

## Aktuálny stav

- **Last merged:** PR #3 `dbfa484` — Bootstrap (Phase C). PR #4 (Phase D) **čaká na merge**.
- **In flight:** Phase D — Primary libraries (PR #4 open, CI green).
- **Next up:** Phase E.1 — `@sdm/api-mocks` MSW handlers.

Posledná revízia tohto dokumentu: po merge PR #3 a otvorení PR #4 (2026-05-17).

---

## Fázy

### Phase 0 — Analytical pipeline ✅ DONE

- **Outputs:** `docs/agents/{01-api-analyst..09-qa-test-strategy}/*` + `docs/spec/<modul>.md` + `docs/{system-overview,dev-handbook,onboarding}.md`
- **Detail:** `.agents/runs/20260508-192438/summary.md`
- **Merge:** PR #1 (kickoff), PR #2 (docs konvergencia)

### Phase C — Bootstrap ✅ DONE

> Phase A/B sú interné fázy round-1 analytického pipeline-u, nie implementačné. Phase C
> je fyzický scaffolding — definovaný v `docs/agents/devex-devops/scaffolding-checklist.md`.

- **Inputs:** `docs/agents/devex-devops/{repo-bootstrap,scaffolding-checklist}.md`, `monorepo-layout.md`
- **Outputs:** hermetic monorepo (18 workspace stubov), 3 Docker images (BFF + portal + workspace), Helm chart (`deploy/helm/sdm/`), CI workflows (ci.yml + release.yml), devcontainer, husky
- **Done-when:** `pnpm install/typecheck/lint/build` zelené, `hadolint`/`actionlint`/`helm lint` čisté, BFF prod smoke (`/health`)
- **Merge:** PR #3

### Phase D — Primary libraries ⏳ IN-FLIGHT (PR #4)

- **Inputs:** `docs/agents/domain-modeller/model.ts`, `docs/agents/architecture/decision-records/08-error-handling.md`, `docs/agents/security/auth-flow.md` §session shape
- **Outputs:**
  - `@sdm/domain` — canonical typed model (891 LOC), branded ID factories, RBAC stub
  - `@sdm/api-client` — `HttpClient` s `X-Correlation-ID` + `X-CA-SDM-Tenant`, `AppError` taxonómia
  - `@sdm/auth` — `<Can>` + `<RouteGuard>`, session shape, login helpers
  - Vitest infrastructure (29 unit tests baseline)
- **Done-when:** `pnpm -r test` zelené, 29 testov pass

### Phase E — Dev productivity unlock 🔜 NEXT (3 chunks)

> Cieľ fázy: `pnpm dev` otvorí použiteľné portál + workspace UI **bez bežiaceho BFF**.

#### E.1 — `@sdm/api-mocks` MSW handlers

- **Inputs:** `docs/agents/devex-devops/mock-strategy.md`, `docs/agents/api-analyst/endpoints.md` + `schemas/*`
- **Outputs:** `packages/api-mocks/src/handlers/{auth,me,incident,request,problem,change,kb,cmdb,catalog,activity}.ts`, fixture data, browser/server worker bootstraps
- **Done-when:** `VITE_USE_MOCKS=true pnpm dev` otvorí SPA bez BFF, MSW intercept-uje `/api/*`; nové vitest test-y pre handler shapes

#### E.2 — Reálne RBAC mapping

- **Inputs:** `docs/agents/security/rbac.md` (7 rolí × 25 obrazoviek matrix)
- **Outputs:** nahrad `packages/domain/src/permissions.ts` stub authoritative mapping + per-screen guard helpers (`canViewQueue`, `canApproveChange`, ...)
- **Done-when:** `<Can>` testy pokrývajú každú rolu × klúčové obrazovky kombinácie

#### E.3 — SPA App Shell + bootstrap

- **Inputs:** `docs/agents/architecture/monorepo-layout.md` §apps, `docs/agents/ux-persona-analyst/wireframes/shared/`, `docs/agents/devex-devops/runtime-config.md`
- **Outputs:** `apps/{portal,workspace}/src/{shell,bootstrap}/*` — App Shell, error boundary, session provider, config fetch (`/config` endpoint), tenant switcher prvotriedne v navigácii
- **Done-when:** SPA sa rendruje s mocked session + tenant switch funguje (žiadny feature obsah, len skeleton)

### Phase F — BFF real implementation 🔜 (~5 chunks)

> Cieľ fázy: SPA prepneme z MSW na bežiaci BFF. End-to-end loop funguje.

- **F.1 Auth module** — SSO callback (OIDC), session manager (Redis + in-memory adapter), CA SDM access key broker. Inputs: `docs/agents/security/auth-flow.md`, `docs/agents/architecture/components/bff.md` §2.1-2.2.
- **F.2 REST proxy** — tenant scoping, `X-Role` injection, XML→JSON adapter, error shaper. Inputs: `bff.md` §2.3, `endpoints.md`.
- **F.3 Aggregator endpoints** — `/me/tenants` fan-out, queue handler (multi-factory), ticket-detail aggregation. Inputs: `bff.md` §2.4, `ux-persona-analyst/wireframes/`.
- **F.4 Platform** — pino audit logger, `/config` endpoint, `/health` + `/readyz` proper checks, CSRF middleware. Inputs: `bff.md` §2.5, `security/audit-and-compliance.md`.
- **F.5 Cleanup MSW vs BFF** — env switch `VITE_USE_MOCKS`, dokument failover.
- **Done-when:** SPA proti BFF (`BFF_CA_SDM_USE_MOCKS=true` upstream mock) — full loop bez MSW v browseri.

### Phase G — Cross-cutting concerns 🔜 (~5 chunks)

- **G.1 Design system tokens + base komponenty** — Inputs: `docs/agents/design-system/{tokens,components,theming}.md`. Output: `packages/design-system/src/{tokens,primitives}/*`.
- **G.2 i18n provider + catalogs (sk/en)** — Inputs: `docs/agents/design-system/microcopy.md`, `architecture/decision-records/07-i18n.md`. Output: `packages/i18n/{src,catalogs}/*`.
- **G.3 Observability** — Sentry SDK init + correlation ID propagation, BFF audit log shipping. Inputs: `security/audit-and-compliance.md`.
- **G.4 Performance budgets** — LHCI, size-limit, manualChunks tuning. Inputs: `qa-test-strategy/performance.md`.
- **G.5 Self-host fonts** — Inter + JetBrains Mono woff2 v `apps/{portal,workspace}/public/fonts/`. Inputs: `design-system/theming.md`.
- **Done-when:** brand visual identity konzistentná, sk+en kompletné, LHCI prahy pass, Sentry beží.

### Phase H — Feature modules 🔜 (najdlhšia, MVP scope)

> MVP scope per `GOAL.md §3`: Incident, Request, Problem, Change, KB (read), CMDB (read), multi-tenancy.
> Každý modul má 1-N chunks per dvojica `(portal-feature, workspace-feature)`.

| Modul         | Spec                                | Portal features                          | Workspace features                                    |
| ------------- | ----------------------------------- | ---------------------------------------- | ----------------------------------------------------- |
| Incident      | `docs/spec/incident-management.md`  | new-incident, my-tickets, ticket-detail  | queue, ticket-detail (agent), bulk-ops\*              |
| Request       | `docs/spec/request-management.md`   | service-catalog, new-request, my-tickets | queue, request-detail                                 |
| Problem       | `docs/spec/problem-management.md`   | — (read-only via incident)               | problems list, problem-detail, link-to-incident       |
| Change        | `docs/spec/change-management.md`    | (read approve, mobile)                   | changes, change-detail, change-calendar, CAB approval |
| KB            | `docs/spec/knowledge-management.md` | kb-search, kb-article                    | kb-browse, (kb-editor v1)                             |
| CMDB          | `docs/spec/cmdb.md`                 | (none)                                   | cmdb (read), ci-detail, relationships                 |
| Multi-tenancy | `docs/spec/multi-tenancy.md`        | tenant-switcher                          | tenant-switcher                                       |

\* v1 scope, nie MVP.

- **Inputs per chunk:** príslušný `docs/spec/<modul>.md` + relevantné `docs/agents/ux-persona-analyst/wireframes/{portal,workspace}/<screen>.md` + `docs/agents/domain-modeller/lifecycles/<entity>.md` (kde existuje)
- **Outputs per chunk:** features pod `apps/<app>/src/features/<feature>/`, integ testy
- **Done-when chunk:** acceptance kritérium z `qa-test-strategy/acceptance-criteria.md` zelené pre danú feature

Granularita: 1 PR ≈ 1 (modul, app) dvojica. Odhad: **~25-35 PR** pre MVP scope.

### Phase I — Acceptance + production hardening 🔜 (~5 chunks)

- **I.1 Playwright e2e suite** — 18 acceptance criteria. Inputs: `qa-test-strategy/{acceptance-criteria,a11y-tests,performance}.md`.
- **I.2 Security audit** — CodeQL + Trufflehog + `pnpm audit` + Snyk/Semgrep eval. Inputs: `security/owasp-mitigations.md`.
- **I.3 Multi-tenancy edge cases** — RLS, cross-tenant data leak prevention, tenant switch state cleanup. Inputs: `docs/spec/multi-tenancy.md`.
- **I.4 Release v1.0 dry-run** — full helm install do staging, smoke run, rollback test. Inputs: `system-overview.md` §Release.
- **I.5 v1.0 cut** — semver tag, image push, helm OCI publish, release notes.

---

## v1 scope (post-MVP)

Tu sa neplánuje granulárne — po MVP cut sa znovu prejde tento dokument. Indicative
fázy (každá vlastné chunks):

- Bulk operations vo workspace queue (per `GOAL.md §3 v1`)
- KB editor (write/publish)
- CMDB editor + Visualizer integrácia
- Pokročilý Change Calendar + CAB workflow
- Reporting widgety

---

## Maintenance pravidlá

1. **Po merge PR-u:** toggle status príslušného chunku (`⏳ IN-FLIGHT` → `✅ DONE`), aktualizuj "Aktuálny stav" hore. Žiadny ďalší update; tento dokument **nie je day-to-day tracker**.
2. **Pri vzniku nového chunku:** pridaj entry s `Inputs` / `Outputs` / `Done-when` v príslušnej fáze.
3. **Pri zmene scope** (napr. v1 → MVP push-up): commit-ni úpravu tohto súboru ako súčasť PR-u, ktorý scope mení. Nepiš sem rozhodnutia v izolácii.
4. **Fázy sú stabilné.** Chunk granularita môže fluctuate (E.1 sa môže rozdeliť na E.1a/E.1b ak je príliš veľký). Phase letters nikdy nemení sémantiku.
5. **Žiadne duplikovanie:** sem nepíš to, čo už je v `docs/spec/*` alebo `docs/agents/*`. Sem patrí **iba poradie a status**; detail je inde.

## Tipy pre `/clear` workflow

- Tento dokument vždy linkuj v prvej správe nového chat-u (system prompt alebo prvý user message).
- Pri spustení nového chunku v novom chate: zadaj odkaz na `Inputs` daného chunku ako kontext, nie celú konverzáciu.
- Status update po merge urob v **tom istom PR-e** ako kód-changes (nie samostatne) — atomicita stavu.
