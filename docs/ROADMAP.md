# SDM-Rewrite Roadmap

> Jediný zdroj pravdy pre **post-bootstrap sequencing**. Strategický plán, nie day-to-day
> tracker (tým sú GitHub Pull Requests + Issues). Aktualizuje sa **per merge** — každý
> chunk po merge prepne svoj status, neaktualizuje sa kontinuálne počas práce.

## Ako tento dokument použiť

**Pre nový chat session (po `/clear` alebo kompakcii):**

1. Prečítaj sekciu [Aktuálny stav](#aktuálny-stav) — vieš kde si.
2. **Ak má chunk per-chunk plán** v `docs/plans/<Phase>.<N>.md` (Phase F+), prečítaj ten — má Inputs/Outputs/Stratégiu pre `/clear` workflow. Žiadne ďalšie pre-loading.
3. Inak prečítaj `Inputs` najbližšieho `🔜 NEXT` chunku v tomto dokumente — vieš čo robíš.
4. Pracuj proti `Outputs` a `Done-when` kritériám — vieš kedy si hotový.

Per-chunk plány (od Phase F) sú v `docs/plans/`. Index: [docs/plans/README.md](./plans/README.md).

**Princíp vrstvenia:** každý chunk má explicit `Inputs` (čo treba prečítať) a `Outputs`
(čo bude existovať po merge). Žiadne implicitné vedomosti z prechádzajúcich chat
session-ov. Nový chat sa orientuje cez tento dokument + linkované špec docs + `git log`.

## Aktuálny stav

- **Last merged:** Chunk G.4 (LHCI + size-limit + manualChunks tuning, PR #23). Predchádzajúce: PR #22 — G.3 Sentry; PR #21 — G.2 i18n.
- **In flight:** —
- **Next up:** Phase H — Feature modules (najdlhšia, MVP scope). Phase G ✅ DONE (5/5).

Posledná revízia tohto dokumentu: Phase G DONE (2026-05-25).

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

### Phase D — Primary libraries ✅ DONE (PR #4)

- **Inputs:** `docs/agents/domain-modeller/model.ts`, `docs/agents/architecture/decision-records/08-error-handling.md`, `docs/agents/security/auth-flow.md` §session shape
- **Outputs:**
  - `@sdm/domain` — canonical typed model (891 LOC), branded ID factories, RBAC stub
  - `@sdm/api-client` — `HttpClient` s `X-Correlation-ID` + `X-CA-SDM-Tenant`, `AppError` taxonómia
  - `@sdm/auth` — `<Can>` + `<RouteGuard>`, session shape, login helpers
  - Vitest infrastructure (29 unit tests baseline)
- **Done-when:** `pnpm -r test` zelené, 29 testov pass

### Phase E — Dev productivity unlock 🔜 NEXT (3 chunks)

> Cieľ fázy: `pnpm dev` otvorí použiteľné portál + workspace UI **bez bežiaceho BFF**.

#### E.1 — `@sdm/api-mocks` MSW handlers ✅ DONE (commit `aa574a2`)

- **Inputs:** `docs/agents/devex-devops/mock-strategy.md`, `docs/agents/api-analyst/endpoints.md` + `schemas/*`
- **Outputs:** `packages/api-mocks/src/handlers/{auth,users,tenants,incidents,requests,problems,changes,knowledge,cmdb,audit,config}.ts` (BFF layer, paths v `/api/*` + `/me/*` + `/auth/*` + `/config`), deterministic fixtures (~300 záznamov, faker seed 42/43), in-memory store, `browser.ts` + `node.ts` worker bootstraps, `apps/{portal,workspace}/{public/mockServiceWorker.js,src/mocks/browser.ts}` + conditional `main.tsx` bootstrap pri `VITE_USE_MOCKS=true`
- **Done-when:** `VITE_USE_MOCKS=true pnpm dev` otvorí SPA bez BFF, MSW intercept-uje `/api/*` a `/me/*`; nové vitest test-y pre handler shapes (28 testov, tenant scope + pagination + filtre)
- **Scope deviation vs mock-strategy.md:** upstream `/caisd-rest/*` mocky (pre BFF integration testy) sa **odkladajú do Phase F** — bez bežiaceho BFF nie sú v práve teraz použité; chunk si zachoval 10 handler modulov, ale len BFF vrstvu. `@mswjs/data` vynechané — plain in-memory arrays pre 300 fixture-rekordov bez nákladu na typovú integráciu

#### E.2 — Reálne RBAC mapping ✅ DONE (PR #5)

- **Inputs:** `docs/agents/security/rbac.md` (8 UI rolí × 31 obrazoviek matrix, round 2)
- **Outputs:**
  - `@sdm/domain` model — `UIRole` (8 hodnôt vrátane `requester_external` subtype), `Permission` ~70 dot-notation kľúčov
  - `@sdm/domain` permissions.ts — `ROLE_PERMISSIONS` map, 31-screen visibility tabuľka, multi-role aggregation, 20 per-screen / per-action guard helpers
  - `@sdm/auth` — `<Can>`, `<RouteGuard>`, nový `<ScreenGuard>` (view/edit mode + multi-role aggregation)
  - `@sdm/api-mocks` users — re-seed na nové UI role + 4 noví používatelia (kb_editor, cmdb_owner, requester, sp_admin)
- **Done-when:** 170/170 testov zelených; `<Can>` × každá rola × 10 kľúčových permissions/screens kombinácie verifikované

#### E.3 — SPA App Shell + bootstrap ✅ DONE

- **Inputs:** `docs/agents/architecture/monorepo-layout.md` §apps, `docs/agents/ux-persona-analyst/wireframes/shared/`, `docs/agents/devex-devops/runtime-config.md`
- **Outputs:**
  - `apps/{portal,workspace}/src/bootstrap/{config,session}.ts` — `/config` loader (mini shape, full `RuntimeConfig` per `runtime-config.md` odložené do F.4) + `/me` + `/me/tenants` aggregator → typed `Session` (roles + permissions derived via `getPermissionsForRole`)
  - `apps/{portal,workspace}/src/shell/{app-shell,error-boundary,session-context,top-bar,tenant-switcher,styles.css}` — top bar, brand, tenant dropdown (P0 per shared wireframe), user pill, React `ErrorBoundary`
  - SPA-owned active tenant (localStorage + `X-CA-SDM-Tenant` header injection) — mirroruje reálne BFF tenant context správanie; obchádza MSW SW Set-Cookie limit
  - `tools/browser-test/scenarios/{smoke-portal,smoke-workspace,mocks-tenant-isolation,mocks-mutation-roundtrip,auth-session-cookie}.spec.ts` — re-aligned na nový shell (testid `top-bar` / `active-tenant` / `tenant-display` / `tenant-row-<id>`)
- **Done-when:** 170 unit testov + 5 browser-test scenárov pass; `pnpm typecheck`/`lint`/`build` zelené; tenant switch end-to-end overený (Acme → Globex) pre portal aj workspace

### Phase F — BFF real implementation ✅ DONE (6 chunks)

> Cieľ fázy: SPA prepneme z MSW na bežiaci BFF. End-to-end loop funguje proti reálnemu CA SDM
> backend-u (`10.11.35.35:8050` v dev). Detailný plán + cross-chunk rozhodnutia: [docs/plans/F.md](./plans/F.md).

- **F.1 Auth module ✅ DONE** — Basic Auth → access_key broker, in-memory session store, `/auth/*`, `/me` canonical shape, CSRF Origin check. Live smoke proti real `10.11.35.35:8050` zelený. Plán: [F.1.md](./plans/F.1.md).
- **F.2 REST proxy ✅ DONE** — shared `SdmHttpClient`, error shaper (HTTP 400 + "Invalid REST Access Key" → AUTH_EXPIRED, HTTP 409 + "Invalid number of rows (0) affected" → NOT_FOUND, JSON+XML error bodies), tenant scoping (single-tenant placeholder skip per `real-backend-contracts.md` §6), XML→JSON adapter (`fast-xml-parser` w/ shared options), and 7 entity proxies covering `in`/`cr`/`pr`/`chg`/`KD`/`nr` + reference factories (TTL 15 min in-memory cache). Live smoke proti real `10.11.35.35:8050` zelený (list / detail / cache / schema-divergent `chg` / uppercase `KD` / 404 error path). Plán: [F.2.md](./plans/F.2.md).
- **F.3 Aggregator endpoints ✅ DONE** — `/me/tenants` separate endpoint (5 min TTL, derives from `session.tenants[]` until multi-tenant rollout), `/api/queue` parallel fan-out (`in`+`cr`+`pr`, merge by priority desc + openedAt desc, 30 s TTL, partial-failure tolerant), `/api/tickets/:type/:id` MVP stub (parent fetch only, linked/attachments/activity = `_unsupported: true` arrays — `lrel_*`/`attmnt`/`act_log` factory probe deferred to a follow-up B-E discovery chunk). Carry-overs A/B/C resolved (TTL-only invalidation, separate /me/tenants endpoint, F.2 mapRow reuse exported). Live smoke proti real `10.11.35.35:8050` zelený (17 incident + 7 request + 1 problem v queue, ticket-detail shape ok). Plán: [F.3.md](./plans/F.3.md).
- **F.4 Platform ✅ DONE** — audit module (`platform/audit/{events,redact,emit}.ts`, canonical 40-event taxonómia per `audit-and-compliance.md §2`, PII redaction + SHA256 pseudonymize per §4, 1:100 sampling for `session.heartbeat` per §3) hooked into auth/login+logout+heartbeat+session-expired + me/tenant-switch + csrf-violation + entity-routes `data.<entity>.{write,delete}`. `/config` endpoint serves canonical `RuntimeConfig` per `runtime-config.md` (lazy re-read of `process.cwd()/config.json` + env overrides for deploy-injected meta, fallback defaults in dev). `/readyz` two-step probe: cached broker bootstrap (5 min refresh) + `GET /pri?size=1` with 2 s timeout. Live smoke proti real `10.11.35.35:8050` zelený (positive + negative path). Plán: [F.4.md](./plans/F.4.md).
- **F.5 Cleanup MSW vs BFF ✅ DONE** — `/me` canonical §4.5 shape (single fetch, FE no longer derives permissions; `effectivePermissions[]` z BFF); `/config` canonical RuntimeConfig (Phase F.4 wire). Minimal `LoginPage` v oboch SPA (portal + workspace own each its `/login`), `Heartbeat` (30 s debounced na user-events) + `IdleModal` (29 min warning, 30 min redirect) shell komponenty, cross-tab sync cez `@sdm/api-client/cross-tab.ts` (BroadcastChannel + Safari iOS < 15.4 fallback). MSW handler-y (`users.ts`/`tenants.ts`/`config.ts`) zarovnané na canonical shape v jednom kroku — no dual-shape compat. CSRF wiring: Origin-only (per F.1 baseline) — `Session.csrfToken` field zachovaný len pre §4.5 paritu (BFF vracia `""`). Failover doc nový (`docs/agents/devex-devops/failover.md`) — BFF restart = re-login acceptable v MVP, Redis deferred. Plán: [F.5.md](./plans/F.5.md).
- **F.6 Ticket-detail B-E probe ✅ DONE** — probe `act_log` (BREL → `alg` / `chgalg`) + `attachments` (BLREL → `lrel_attachments_{requests,changes}` join + per-row `/attmnt/{id}` enrichment) proti `10.11.35.35:8050` (skript `tools/sdm-probe/probe-ticket-detail.sh`). Append `§22-§24` do `real-backend-contracts.md` — activity + attachments (live shapes), linked (verdict: no BREL on this CA SDM 17.4 instance, stays `_unsupported: true`). Aggregator `ticket-detail.ts` paralelný fan-out cez `Promise.allSettled` (partial-failure tolerant: failed branch → `_unsupported: true`, parent stále 200). Nové mappery `apps/bff/src/api/endpoints/{activity-log,attachments}.ts` — kind derivácia z `internal` + `aty.REL_ATTR`, MIME z `file_type` whitelist. Live smoke proti CA SDM zelený pre všetky 4 typy (in/2800: 6 activity, cr/2851: empty, pr/406621: 2, chg/2781: 4). Plán: [F.6.md](./plans/F.6.md), PR #18.
- **Scope-out (deferred z F.x):** Redis session store, OIDC SSO (čaká na corp IdP), SAML, CI neighborhood BFS, bulk MFA step-up.
- **Done-when:** SPA proti BFF (`VITE_USE_MOCKS=false`) — full login → queue → ticket → logout loop, oba módy MSW/BFF funkčné, audit eventy emit-ujú.

### Phase G — Cross-cutting concerns ✅ DONE (5 chunks)

- **G.1 Design system tokens + base komponenty ✅ DONE** — `@sdm/design-system` plne naplnený: `tokens.css` (typography, light/dark/hc colors, spacing, radius, shadow, motion, z-index, breakpoints, layout, borders), `reset.css`, FOUC-safe inline script v `apps/{portal,workspace}/index.html`, 12 base komponentov (Icon, Button, IconButton, Link, Badge, StatusBadge, PriorityBadge, Card, TextField, TextArea, Select, Checkbox) — každý s CSS Module + 3+ vitest tests + `data-component` attr (39 testov spolu). Forms `Select`/`Checkbox` na Radix primitives, `Icon` na lucide-react. Shell login + top-bar v portal aj workspace teraz konzumujú `Button` + `Card` z `@sdm/design-system`. Bundle delta +31 KB gzip (Radix Select/Checkbox) deferred to G.4 manualChunks + size-limit budgets. Plán: [G.1.md](./plans/G.1.md), PR #19.
- **G.2 i18n provider + catalogs (sk/en) ✅ DONE** — `@sdm/i18n` plne naplnený: `i18next@23 + react-i18next@15 + i18next-icu + intl-messageformat@11` adapter. Catalogs JSON: `shared/{sk,en}.json` (52 keys: actions, status, priority, meta, errors, validation, session, plurals, time, language), `portal/{sk,en}.json` (16 keys: shell, nav, catalog, greeting, empty, feedback), `workspace/{sk,en}.json` (20 keys: shell, queue, actions, composer, sla) — 88 keys spolu, 100% SK ↔ EN parity. Public API: `I18nProvider`, `bootstrapI18n`, `changeLocale`, `useTranslation`, `useLocale`, `useDynamic`, `Trans`, `dynamic`, `formatDate`, `formatNumber`, `formatRelative`, `detectLocale`/`persistLocale`. ICU MessageFormat overené pre SK 3+exact-form plurals (`=0`, `one`, `few`, `other`) v `plurals.test.ts`. Locale persisted v `localStorage.sdm.locale`, `<html lang>` updated on switch (FOUC-safe — bootstrap je await-ed pred React render). Shell migrované: `login-page` + `idle-modal` + `tenant-switcher` + `top-bar` + `app-shell` v oboch SPA cez `useTranslation()`; žiadne hardcoded SK strings v `apps/{portal,workspace}/src/shell/*`. `LanguageSwitcher` v topbar — SK/EN dropdown s lazy-load druhého locale. Bundle delta: +28.6 KB gzip (portal index 91.5 → 120.1 KB gzip), catalogs chunked per-locale. CI gate `pnpm i18n:check` (pure-Node stdlib script v `tools/i18n-check/src/cli.js`) blokuje merge pri SK ↔ EN drift. Plán: [G.2.md](./plans/G.2.md), PR TBD.
- **G.3 Observability ✅ DONE** — `@sentry/react@8` v portal + workspace (DSN cez runtime `/config` → `observability.sentryDsn`, no-op pri `null`/missing), `beforeSend` deep PII strip pre 16 substring fragments (`email`, `displayName`, `firstName`, `lastName`, `fullName`, `name`, `description`, `summary`, `body`, `text`, `customer`, `analyst`, `assignee`, `requester`, `phone`, `address`), Sentry user context: `setUser({ id: SHA-256(tenantId+userId) prefix 16 })` per-tenant salt anti-cross-tenant correlation. ULID (Crockford base32, 26 chars) ako default `X-Correlation-ID` formát v `@sdm/api-client/HttpClient` (per ADR-09 r2). `Sentry.ErrorBoundary` wraps shell tree v oboch SPA s i18n fallback (`errors.boundaryTitle/Body/Refresh` v shared sk/en catalogs). `@sentry/vite-plugin@2` conditional na `SENTRY_AUTH_TOKEN` env (gated v CI cez `secrets.SENTRY_AUTH_TOKEN` detection step), `sourcemap: "hidden"` — maps v Sentry, NIE servované zo `public/`. Bundle delta: +42 KB gzip (portal 120.1 → 162.6 KB gzip) — Sentry React + browserTracingIntegration; v rámci G.4 LHCI tolerance headroom. **Follow-up**: user musí pridať `SENTRY_AUTH_TOKEN`/`SENTRY_ORG`/`SENTRY_PROJECT_*` GitHub repo secrets aby source-maps upload v CI bežal — bez secret-u step skip-uje. Plán: [G.3.md](./plans/G.3.md), PR #22.
- **G.4 Performance budgets ✅ DONE** — `size-limit@12` + `@size-limit/preset-app` per app (`apps/{portal,workspace}/.size-limit.json`) enforces 180 KB portal / 350 KB workspace initial JS + 30 / 60 KB initial CSS + per-vendor caps (vendor-react 70 KB, vendor-i18n 35 KB, vendor-ds 35 KB, vendor-observability 45 KB). Vite `manualChunks(id)` splits node_modules into `vendor-react` / `vendor-i18n` / `vendor-ds` / `vendor-observability` chunks (predictable file-name pattern, pnpm `.pnpm/<pkg>@<ver>/...` aware). `rollup-plugin-visualizer@7` emits `dist/stats.html` per app, uploaded as `bundle-stats` CI artifact (14-day retention). `@lhci/cli@0.15` runs 3 audits per route via `scripts/lhci-collect.sh` (portal mobile form-factor + custom slow-4G + 4x CPU throttling; workspace desktop preset). Per-PR LHCI asserts `CLS ≤ 0.05` + `categories:accessibility ≥ 0.9` + `categories:best-practices ≥ 0.9` as **blocking error** (robust against Phase G bootstrap-failed state); numeric TTI/LCP/score from `performance.md §2` are listed as `warn` (graduate to `error` in Phase H once React Router lands and bootstrap is reachable in CI). Routes asserted today: portal `/` mobile, workspace `/` desktop. Routes commented as TODO Phase H: portal `/new-incident`, `/tickets`, `/tickets/:id`, `/catalog`, `/catalog/:itemId`, `/kb`, `/kb/article/:id`; workspace `/queue`, `/tickets/:id`, `/changes`, `/changes/calendar`, `/changes/:id`, `/cmdb`, `/cmdb/ci/:id`, `/kb/editor`. Final bundle (gzip): portal index 11.69 + vendor-react 58.57 + vendor-i18n 27.58 + vendor-ds 27.40 + vendor-observability 41.33 = **166.32 KB initial JS** (within 180 KB); workspace symmetric **166.34 KB** (within 350 KB) — no Sentry lazy-init needed. New `.github/workflows/perf-nightly.yml` runs full LHCI sweep nightly + on `main` push (informational; rolling baseline deferred post-MVP per `performance.md §6`). Plán: [G.4.md](./plans/G.4.md), PR #23.
- **G.5 Self-host fonts ✅ DONE** — Inter Variable + JetBrains Mono Variable woff2 (latin + latin-ext subsets) v `apps/{portal,workspace}/public/fonts/`, extrahované z `@fontsource-variable/{inter,jetbrains-mono}` (NIE runtime dep — len build-time source). `@font-face` deklarácie v `packages/design-system/src/tokens/fonts.css` s `font-display: swap`, `font-weight: 100 900` (Inter) / `100 800` (JBM) variable axis, canonical Google Fonts `unicode-range` per subset. `<link rel="preload">` pre `inter-variable-latin.woff2` v `<head>` oboch SPA. License files committed (`OFL-Inter.txt` + `OFL-JetBrainsMono.txt`, SIL OFL 1.1). Žiadny CDN call. Plán: [G.5.md](./plans/G.5.md), PR TBD.
- **Done-when:** brand visual identity konzistentná, sk+en kompletné, LHCI prahy pass, Sentry beží.

### Phase H — Feature modules 🔜 NEXT (najdlhšia, MVP scope)

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
