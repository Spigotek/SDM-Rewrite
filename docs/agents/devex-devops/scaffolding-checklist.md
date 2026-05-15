# Scaffolding checklist — Phase C súbory

## Changelog (round 2)

- Pridaná sekcia **`apps/bff/`** (~25 súborov) — 04 r2 ADR-01 finalizoval BFF;
  Architecture `monorepo-layout.md` autoritatívny pre adresárovú štruktúru.
- Pridané `turbo.json` (root config) a `tools/coverage/check-thresholds.ts`,
  `tools/axe/config.ts`, `lighthouserc.json`, `size-limit.config.js` per ci-cd r2.
- Pridané **self-hosted fonts** (`apps/portal/public/fonts/`, `apps/workspace/public/fonts/`)
  — Inter + JetBrains Mono v2 woff2 — zhodne so 07 r1 (žiadny CDN, CSP-friendly).
- Pridané `packages/api-types/` a `packages/i18n/` (zo 04 monorepo-layout) — predtým chýbali.
- Per Otvorené závislosti uzavreté `[04-architecture]` BFF + monorepo tool + repo layout,
  `[06-tech-stack-selector]` React 19, `[09-qa-test-strategy]` test runner.
- Sumár súborov rastie z **~115** na **~150** (BFF ~25, nové packages ~10, tools ~5,
  fonts a config skripty).

> Tento dokument je **finálny zoznam súborov**, ktoré sa fyzicky vytvoria
> v Phase C (post-convergence). Round 1 produkuje iba dokumentáciu v
> `docs/agents/devex-devops/`. Reálny scaffolding (package.json, vite.config.ts,
> apps/pm/, atď.) sa píše až po konvergencii všetkých agentov.

## Konvencie

| Symbol | Význam |
|---|---|
| **new** | Súbor v repe neexistuje — vytvoriť |
| **update** | Súbor existuje — modifikovať |
| **template** | Šablóna v `repo-bootstrap.md` ako referencia |
| **opt** | Voliteľný — vynechať ak nepotrebné v MVP |

## Root úroveň

| Stav | Cesta | Zdroj template | Účel |
|---|---|---|---|
| new | `package.json` | `repo-bootstrap.md` § Koreňový package.json | Root workspace manifest (turbo scripts) |
| new | `pnpm-workspace.yaml` | `repo-bootstrap.md` § pnpm-workspace.yaml | Workspace topológia (`apps/bff` explicit) |
| new | `turbo.json` | `repo-bootstrap.md` § Turborepo config | Task orchestrator + cache config (04 r2 ADR-02) |
| new | `tsconfig.json` | `repo-bootstrap.md` § Base tsconfig | Base TS config — extends per workspace |
| new | `eslint.config.js` | `repo-bootstrap.md` § ESLint flat | ESLint flat config |
| new | `.prettierrc.json` | `repo-bootstrap.md` § Prettier | Formatter config |
| new | `.prettierignore` | — | `dist`, `coverage`, `.vite`, lockfile |
| new | `commitlint.config.js` | `repo-bootstrap.md` § Commitlint | (opt) Conventional commits |
| update | `.gitignore` | `repo-bootstrap.md` § .gitignore | Pridať dist/, .vite/, .env, atď. |
| new | `.editorconfig` | `repo-bootstrap.md` § .editorconfig | Editor consistency |
| new | `.nvmrc` | `repo-bootstrap.md` § .nvmrc | Node version pin (`v22`) |
| new | `.env.example` | `repo-bootstrap.md` § .env.example | Env template |
| new | `playwright.config.ts` | `ci-cd.md` § E2E | Playwright konfig |
| new | `vitest.config.ts` | `ci-cd.md` § test | Root Vitest config (workspace project array) |
| new | `lighthouserc.json` | `ci-cd.md` § Lighthouse CI | LHCI config (per stránka prahy z 09 perf.md) |
| new | `size-limit.config.js` | `ci-cd.md` § Bundle size budget | Initial bundle size assertions |
| new | `dev-setup.sh` | `dev-environment.md` § dev-setup.sh | One-shot bootstrap skript |

## `.husky/`

| Stav | Cesta | Účel |
|---|---|---|
| new | `.husky/pre-commit` | `pnpm exec lint-staged` |
| new | `.husky/commit-msg` | (opt) `pnpm exec commitlint --edit "$1"` |

## `.github/workflows/`

| Stav | Cesta | Zdroj template |
|---|---|---|
| new | `.github/workflows/ci.yml` | `ci-cd.md` § ci.yml — 9 jobov vrátane coverage + a11y + lhci |
| new | `.github/workflows/codeql.yml` | `ci-cd.md` § codeql.yml |
| new | `.github/workflows/agent-pipeline.yml` | `ci-cd.md` § agent-pipeline.yml |
| new | `.github/workflows/release.yml` | `ci-cd.md` § release.yml |
| new | `.github/workflows/nightly.yml` | `ci-cd.md` § Nightly (full LHCI + axe sweep) |
| new | `.github/PULL_REQUEST_TEMPLATE.md` | (opt) Convention |
| new | `.github/dependabot.yml` | (opt) Weekly deps update |

## `.vscode/`

| Stav | Cesta | Zdroj template |
|---|---|---|
| new | `.vscode/settings.json` | `dev-environment.md` § VS Code |
| new | `.vscode/extensions.json` | `dev-environment.md` § VS Code |

## `apps/portal/`

| Stav | Cesta | Účel |
|---|---|---|
| new | `apps/portal/package.json` | App manifest, dev/build/test scripts |
| new | `apps/portal/tsconfig.json` | Extends root, jsx, paths |
| new | `apps/portal/vite.config.ts` | Per `repo-bootstrap.md` § vite.config + `/api` proxy → BFF :5174 |
| new | `apps/portal/index.html` | Vite entry |
| new | `apps/portal/public/config.json` | Runtime config (per `runtime-config.md`) |
| new | `apps/portal/public/mockServiceWorker.js` | `pnpm exec msw init public/ --save` |
| new | `apps/portal/public/fonts/Inter-Regular.woff2` | Self-hosted (07 r1 — žiadny CDN, CSP `font-src 'self'`) |
| new | `apps/portal/public/fonts/Inter-Medium.woff2` | Self-hosted |
| new | `apps/portal/public/fonts/Inter-SemiBold.woff2` | Self-hosted |
| new | `apps/portal/public/fonts/JetBrainsMono-Regular.woff2` | Self-hosted (code blocks, KB monospace) |
| new | `apps/portal/src/main.tsx` | React entry + MSW bootstrap |
| new | `apps/portal/src/App.tsx` | Root component |
| new | `apps/portal/src/mocks/browser.ts` | Re-export `@sdm/api-mocks/browser` |
| new | `apps/portal/vitest.config.ts` | Per-app Vitest |
| new | `apps/portal/vitest.setup.ts` | MSW node setup |

## `apps/workspace/`

(Identicky štruktúre `apps/portal/` — port **5175** v r2, viď `dev-environment.md`.)

| Stav | Cesta | Účel |
|---|---|---|
| new | `apps/workspace/package.json` | |
| new | `apps/workspace/tsconfig.json` | |
| new | `apps/workspace/vite.config.ts` | `/api` proxy → BFF :5174 |
| new | `apps/workspace/index.html` | |
| new | `apps/workspace/public/config.json` | |
| new | `apps/workspace/public/mockServiceWorker.js` | |
| new | `apps/workspace/public/fonts/Inter-Regular.woff2` | Self-hosted (zhodné s portal) |
| new | `apps/workspace/public/fonts/Inter-Medium.woff2` | Self-hosted |
| new | `apps/workspace/public/fonts/Inter-SemiBold.woff2` | Self-hosted |
| new | `apps/workspace/public/fonts/JetBrainsMono-Regular.woff2` | Self-hosted |
| new | `apps/workspace/src/main.tsx` | |
| new | `apps/workspace/src/App.tsx` | |
| new | `apps/workspace/src/mocks/browser.ts` | |
| new | `apps/workspace/vitest.config.ts` | |
| new | `apps/workspace/vitest.setup.ts` | |

## `apps/bff/`

BFF server per 04 ADR-01 + `components/bff.md`. Runtime: Node 22 + zvolený
framework (Hono / Fastify — finálne 04/06 r2; predvolene **Hono** ako tenký
Web Fetch-based framework s vynikajúcou TS ergonomiou). Bundle: tsup.

| Stav | Cesta | Účel |
|---|---|---|
| new | `apps/bff/package.json` | Manifest, `bin`/`start` skripty, deps (hono / fastify, ioredis, openid-client, pino) |
| new | `apps/bff/tsconfig.json` | Extends root, Node target, `module: "Node16"` |
| new | `apps/bff/tsup.config.ts` | Bundle config (single ESM file, target node22) |
| new | `apps/bff/src/index.ts` | Entry — HTTP gateway bootstrap, graceful shutdown, signal handling |
| new | `apps/bff/src/config.ts` | Runtime config loader (z `BFF_CONFIG_PATH` env alebo `./config.json`) |
| new | `apps/bff/src/middleware/session.ts` | Cookie session middleware (HttpOnly + Secure + SameSite=Lax) |
| new | `apps/bff/src/middleware/tenant.ts` | `X-Tenant` header validator vs. `session.activeTenantId` (ADR-11) |
| new | `apps/bff/src/middleware/csrf.ts` | Double-submit token (Security agent autoritative) |
| new | `apps/bff/src/middleware/rate-limit.ts` | Per-session rate limit (defenzívne) |
| new | `apps/bff/src/middleware/audit.ts` | Request → audit-log per `audit-and-compliance.md` |
| new | `apps/bff/src/middleware/error-shaper.ts` | CA SDM 401/4xx → `AppError` taxonomy |
| new | `apps/bff/src/routes/auth/login.ts` | `POST /auth/login` — OIDC start redirect |
| new | `apps/bff/src/routes/auth/callback.ts` | `GET /auth/callback` — OIDC code → session + Access Key broker |
| new | `apps/bff/src/routes/auth/refresh.ts` | Silent access-key refresh endpoint |
| new | `apps/bff/src/routes/auth/logout.ts` | `POST /auth/logout` — destroy session + DELETE rest_access |
| new | `apps/bff/src/routes/auth/me.ts` | `GET /me`, `POST /me/active-tenant` |
| new | `apps/bff/src/routes/proxy/incidents.ts` | `/api/incidents/*` → CA SDM `/caisd-rest/in/*` |
| new | `apps/bff/src/routes/proxy/requests.ts` | `/api/requests/*` → CA SDM `/caisd-rest/cr/*` |
| new | `apps/bff/src/routes/proxy/problems.ts` | `/api/problems/*` → CA SDM `/caisd-rest/pr/*` |
| new | `apps/bff/src/routes/proxy/changes.ts` | `/api/changes/*` → CA SDM `/caisd-rest/chg/*` |
| new | `apps/bff/src/routes/proxy/knowledge.ts` | `/api/kb/*` → CA SDM `/caisd-rest/SKELETONS/*` + BUI suggested |
| new | `apps/bff/src/routes/proxy/cmdb.ts` | `/api/ci/*` → CA SDM `/caisd-rest/nr/*` |
| new | `apps/bff/src/routes/proxy/attachments.ts` | `/api/attachments/*` (streaming multipart) |
| new | `apps/bff/src/routes/aggregator/me-tenants.ts` | `GET /me/tenants` — multi-call fan-out (per ADR-01 + components/bff.md) |
| new | `apps/bff/src/routes/aggregator/queue.ts` | `GET /api/queue` — incidents + requests + problems merge |
| new | `apps/bff/src/routes/aggregator/ticket-detail.ts` | `GET /api/tickets/:type/:id` — fan-out ticket + linked |
| new | `apps/bff/src/routes/platform/config.ts` | `GET /config` — runtime config endpoint (FE konzument) |
| new | `apps/bff/src/routes/platform/health.ts` | `GET /health` (liveness), `GET /ready` (readiness) |
| new | `apps/bff/src/lib/session-store.ts` | Session store interface — Redis (ioredis) + in-memory adapter pre dev |
| new | `apps/bff/src/lib/access-key-broker.ts` | POST `/caisd-rest/rest_access` + cache + refresh + DELETE |
| new | `apps/bff/src/lib/audit-log.ts` | Pino JSON line logger per 05 audit-and-compliance taxonomy |
| new | `apps/bff/src/lib/ca-sdm-client.ts` | Typed HTTP klient nad CA SDM REST (interný, BFF-only) |
| new | `apps/bff/src/lib/reference-cache.ts` | TTL cache pre priorities/severities/statuses (5–15 min) |
| new | `apps/bff/src/lib/error-taxonomy.ts` | `AppError` shape + CA SDM 401 disambiguation |
| new | `apps/bff/src/types.ts` | Zdielané typy (Session, AppError, AuditEvent) |
| new | `apps/bff/tests/middleware/tenant.test.ts` | X-Tenant header validation tests |
| new | `apps/bff/tests/routes/auth.test.ts` | OIDC callback + session lifecycle tests |
| new | `apps/bff/tests/routes/aggregator.test.ts` | `/me/tenants` fan-out tests |
| new | `apps/bff/tests/lib/error-taxonomy.test.ts` | 401 → AUTH_EXPIRED vs AUTH_FORBIDDEN |
| new | `apps/bff/README.md` | Bootstrap, ENV vars, dev port :5174 |

**Cov target**: line 80 % / branch 70 % (per `ci-cd.md` § Coverage thresholds).

## `apps/pm/`

PM CLI — viď `pm-runtime.md`.

| Stav | Cesta | Účel |
|---|---|---|
| new | `apps/pm/package.json` | CLI manifest, `bin` field |
| new | `apps/pm/tsconfig.json` | |
| new | `apps/pm/tsup.config.ts` | Bundle config |
| new | `apps/pm/bin/sdm-pm.mjs` | Shebang entry |
| new | `apps/pm/src/cli.ts` | argv parsing, commander |
| new | `apps/pm/src/orchestrator.ts` | Pipeline state machine |
| new | `apps/pm/src/agent-runner.ts` | SDK `query()` wrapper |
| new | `apps/pm/src/revision.ts` | Revision request assembler |
| new | `apps/pm/src/convergence.ts` | Convergence checks |
| new | `apps/pm/src/validation.ts` | Outputs.md kontrakt validátor |
| new | `apps/pm/src/git.ts` | Git/worktree manager |
| new | `apps/pm/src/state.ts` | state.json read/write |
| new | `apps/pm/src/flags.ts` | "## Otvorené závislosti" parser |
| new | `apps/pm/src/config.ts` | pipeline.yaml loader |
| new | `apps/pm/src/logger.ts` | JSONL logger |
| new | `apps/pm/src/types.ts` | Shared interfaces |
| new | `apps/pm/src/prompts/revision-request.md.tpl` | Revision prompt template |
| new | `apps/pm/src/prompts/convergence-diff.md.tpl` | Cross-artifact diff prompt |
| new | `apps/pm/tests/flags.test.ts` | |
| new | `apps/pm/tests/revision.test.ts` | |
| new | `apps/pm/tests/convergence.test.ts` | |
| new | `apps/pm/tests/state.test.ts` | |
| new | `apps/pm/tests/git.test.ts` | |
| new | `apps/pm/README.md` | CLI usage |

## `packages/api-client/`

| Stav | Cesta | Účel |
|---|---|---|
| new | `packages/api-client/package.json` | |
| new | `packages/api-client/tsconfig.json` | |
| new | `packages/api-client/src/index.ts` | Public API |
| new | `packages/api-client/src/config.ts` | `fetch('/config.json')` loader |
| new | `packages/api-client/src/client.ts` | HTTP klient → BFF `/api/*` (X-Tenant inject) |
| new | `packages/api-client/src/queryKeys.ts` | TanStack Query keys (tenant-scoped) |
| new | `packages/api-client/src/errors.ts` | AppError throw helper |

> Hlavná zodpovednosť: **04-architecture** (kontrakt) + **01-api-analyst** (typy).
> DevOps len bootstrap-uje balík + config loader.

## `packages/api-types/`

| Stav | Cesta | Účel |
|---|---|---|
| new | `packages/api-types/package.json` | |
| new | `packages/api-types/tsconfig.json` | |
| new | `packages/api-types/src/index.ts` | Re-export typov z `@sdm/domain` (consume CA SDM schémy z 01) |

> Hlavná zodpovednosť: **01-api-analyst** (typy) + **04-architecture** (re-export shape).

## `packages/domain/`

| Stav | Cesta | Účel |
|---|---|---|
| new | `packages/domain/package.json` | |
| new | `packages/domain/tsconfig.json` | |
| new | `packages/domain/src/index.ts` | |
| new | `packages/domain/src/entities/` | Z 03-domain-modeller |
| new | `packages/domain/src/state-machines/` | Z 03-domain-modeller |

> Hlavná zodpovednosť: **03-domain-modeller**. DevOps len scaffold.

## `packages/design-system/`

| Stav | Cesta | Účel |
|---|---|---|
| new | `packages/design-system/package.json` | |
| new | `packages/design-system/tsconfig.json` | |
| new | `packages/design-system/src/index.ts` | |
| new | `packages/design-system/src/tokens/` | Z 07-design-system |
| new | `packages/design-system/src/components/` | Z 07-design-system |

> Hlavná zodpovednosť: **07-design-system**. DevOps len scaffold.

## `packages/auth/`

| Stav | Cesta | Účel |
|---|---|---|
| new | `packages/auth/package.json` | |
| new | `packages/auth/tsconfig.json` | |
| new | `packages/auth/src/index.ts` | |
| new | `packages/auth/src/session.ts` | Session refresh hook (z 05) |
| new | `packages/auth/src/role-guard.tsx` | `<Can permission="…">` + RouteGuard (z 05 + 07 r2) |
| new | `packages/auth/src/login.ts` | Redirect helpers (z 05) |
| new | `packages/auth/src/permissions.ts` | RoleCode → Permission[] mapping (z 05) |
| new | `packages/auth/src/preferences.ts` | Typed localStorage wrapper |

> Hlavná zodpovednosť: **05-security**. DevOps len scaffold.

## `packages/i18n/`

| Stav | Cesta | Účel |
|---|---|---|
| new | `packages/i18n/package.json` | |
| new | `packages/i18n/tsconfig.json` | |
| new | `packages/i18n/src/provider.tsx` | I18nProvider (react-i18next wrap) |
| new | `packages/i18n/src/hook.ts` | `useTranslation` re-export |
| new | `packages/i18n/src/format.ts` | Date / number / relative formatters |
| new | `packages/i18n/src/dynamic.ts` | Backend-provided label adapter |
| new | `packages/i18n/catalogs/portal/sk.json` | |
| new | `packages/i18n/catalogs/portal/en.json` | |
| new | `packages/i18n/catalogs/workspace/sk.json` | |
| new | `packages/i18n/catalogs/workspace/en.json` | |
| new | `packages/i18n/catalogs/shared/sk.json` | |
| new | `packages/i18n/catalogs/shared/en.json` | |

> Hlavná zodpovednosť: **04-architecture** (ADR-07 i18n) + **07-design-system** (microcopy).

## `packages/utils/`

| Stav | Cesta | Účel |
|---|---|---|
| new | `packages/utils/package.json` | |
| new | `packages/utils/tsconfig.json` | |
| new | `packages/utils/src/date.ts` | Date helpers (formatters, comparators) |
| new | `packages/utils/src/string.ts` | String helpers |
| new | `packages/utils/src/object.ts` | Object/array helpers |
| new | `packages/utils/src/result.ts` | `Result<T, E>` helper |
| new | `packages/utils/src/index.ts` | Public exports |

> Hlavná zodpovednosť: **04-architecture** (utility shape). DevOps scaffold.

## `packages/api-mocks/`

MSW mock backend — viď `mock-strategy.md`.

| Stav | Cesta | Účel |
|---|---|---|
| new | `packages/api-mocks/package.json` | |
| new | `packages/api-mocks/tsconfig.json` | |
| new | `packages/api-mocks/src/index.ts` | Public exports |
| new | `packages/api-mocks/src/browser.ts` | setupWorker |
| new | `packages/api-mocks/src/node.ts` | setupServer |
| new | `packages/api-mocks/src/db.ts` | @mswjs/data factory |
| new | `packages/api-mocks/src/handlers/index.ts` | |
| new | `packages/api-mocks/src/handlers/auth.ts` | |
| new | `packages/api-mocks/src/handlers/tenants.ts` | |
| new | `packages/api-mocks/src/handlers/incidents.ts` | |
| new | `packages/api-mocks/src/handlers/requests.ts` | |
| new | `packages/api-mocks/src/handlers/problems.ts` | |
| new | `packages/api-mocks/src/handlers/changes.ts` | |
| new | `packages/api-mocks/src/handlers/knowledge.ts` | |
| new | `packages/api-mocks/src/handlers/cmdb.ts` | |
| new | `packages/api-mocks/src/handlers/service-catalog.ts` | |
| new | `packages/api-mocks/src/fixtures/tenants.ts` | |
| new | `packages/api-mocks/src/fixtures/users.ts` | |
| new | `packages/api-mocks/src/fixtures/incidents.ts` | |
| new | `packages/api-mocks/src/fixtures/requests.ts` | |
| new | `packages/api-mocks/src/fixtures/problems.ts` | |
| new | `packages/api-mocks/src/fixtures/changes.ts` | |
| new | `packages/api-mocks/src/fixtures/knowledge.ts` | |
| new | `packages/api-mocks/src/fixtures/ci.ts` | |
| new | `packages/api-mocks/src/fixtures/catalog.ts` | |
| new | `packages/api-mocks/src/utils/tenant.ts` | |
| new | `packages/api-mocks/src/utils/pagination.ts` | |
| new | `packages/api-mocks/src/utils/errors.ts` | |

## `tools/pm-hooks/`

PM hook skripty — viď `pm-hooks.md`.

| Stav | Cesta | Účel |
|---|---|---|
| new | `tools/pm-hooks/log-write.js` | PostToolUse Write/Edit logger |
| new | `tools/pm-hooks/on-subagent-start.js` | SubagentStart logger |
| new | `tools/pm-hooks/on-subagent-stop.js` | SubagentStop + quickValidate |
| new | `tools/pm-hooks/_shared.js` | (opt) Common utils |

## `tools/coverage/`

Coverage threshold enforcement skript — viď `ci-cd.md` § Coverage thresholds.

| Stav | Cesta | Účel |
|---|---|---|
| new | `tools/coverage/check-thresholds.ts` | Per-package + per-modul prah validation (z 09 coverage-targets.md) |
| new | `tools/coverage/package.json` | (opt) Standalone tool package |

## `tools/axe/`

axe-core shared config — viď `ci-cd.md` § axe-core.

| Stav | Cesta | Účel |
|---|---|---|
| new | `tools/axe/config.ts` | WCAG 2.1 AA rules + TAGS (z 09 a11y-tests.md) |
| new | `tools/axe/playwright-helpers.ts` | `injectAxe(page)` + `checkA11y(page, severity)` helpers |

## `tools/eslint-config/`, `tools/tsconfig-base/`, `tools/scaffold/`, `tools/boundaries-check/`, `tools/i18n-check/`

Per 04 `monorepo-layout.md`. DevOps len scaffolduje package.json/index, owners
sú konkrétni agenti (boundaries-check → 04, i18n-check → 04, scaffold → 08).

| Stav | Cesta | Účel |
|---|---|---|
| new | `tools/eslint-config/package.json` + `index.js` | Zdielaný ESLint preset |
| new | `tools/tsconfig-base/package.json` + `tsconfig.base.json` | Zdielaný TS base |
| new | `tools/scaffold/` | `plop` šablóny pre nový package/feature (substitute za Nx generators) |
| new | `tools/boundaries-check/` | CI script — import boundaries enforcement |
| new | `tools/i18n-check/` | CI script — catalog parity |

## `e2e/` (Playwright)

| Stav | Cesta | Účel |
|---|---|---|
| new | `e2e/portal.spec.ts` | Sample E2E pre portal |
| new | `e2e/workspace.spec.ts` | Sample E2E pre workspace |
| new | `e2e/fixtures.ts` | Test fixtures |
| new | `e2e/playwright.helpers.ts` | Reusable helpers |

> Hlavná zodpovednosť: **09-qa-test-strategy**. DevOps len bootstrap.

## Súbory existujúce v repe (po Phase C bootstrap)

| Stav | Cesta | Akcia |
|---|---|---|
| keep | `GOAL.md` | Bez zmeny |
| keep | `README.md` | (Opt) update s `Quick Start` linkom na `repo-bootstrap.md` |
| keep | `docs/ca-service-management-17-4.pdf` | Bez zmeny |
| keep | `.agents/**` | Bez zmeny |
| keep | `docs/agents/**` | Per-agent výstupy z round 1+ |

## Sumár — počet súborov per kategória

| Kategória | Súbory |
|---|---|
| Root config | ~16 (+ `turbo.json`, `lighthouserc.json`, `size-limit.config.js`) |
| `.husky/` | 2 |
| `.github/workflows/` | 5 (+ 2 opt) |
| `.vscode/` | 2 |
| `apps/portal/` | 15 (+ 4 fonts) |
| `apps/workspace/` | 15 (+ 4 fonts) |
| `apps/bff/` | ~38 (vrátane testov) |
| `apps/pm/` | ~22 (vrátane testov) |
| `packages/api-client/` | 7 |
| `packages/api-types/` | 3 |
| `packages/domain/` | 4 (+ obsah z 03) |
| `packages/design-system/` | 4 (+ obsah z 07) |
| `packages/auth/` | 7 (+ obsah z 05) |
| `packages/i18n/` | 11 (+ obsah z 04 ADR-07) |
| `packages/utils/` | 6 |
| `packages/api-mocks/` | ~25 (10 handler modulov) |
| `tools/pm-hooks/` | 3 (+ 1 opt) |
| `tools/coverage/` | 2 |
| `tools/axe/` | 2 |
| `tools/{eslint-config,tsconfig-base,scaffold,boundaries-check,i18n-check}/` | ~10 |
| `e2e/` | 4 |
| **Spolu** | **~155 súborov** |

## Phase C — poradie volaní

1. Root config (package.json, tsconfig, eslint, prettier, husky, **`turbo.json`**).
2. `tools/{eslint-config,tsconfig-base}/` — zdielané presets.
3. `apps/pm/` (PM CLI musí byť ready, lebo bude orchestrovať budúce re-runy).
4. `packages/{utils,domain,api-types,api-client,auth,i18n,design-system}/` — zdielané balíky.
5. `packages/api-mocks/` — mock backend (závisí od `api-client` typov).
6. `apps/bff/` — BFF server (závisí od `domain`, `api-client`, `auth`).
7. `apps/portal/` + `apps/workspace/` — FE skelet (závisí od všetkých FE packages).
8. `.github/workflows/` — CI (po príprave `tools/coverage/check-thresholds.ts`, `tools/axe/config.ts`, `lighthouserc.json`).
9. `tools/{pm-hooks,coverage,axe,boundaries-check,i18n-check,scaffold}/` — CI/PM podpora.
10. `e2e/` — Playwright skelet (po BFF + apps existencii).
11. Fonts — `apps/{portal,workspace}/public/fonts/` z dodaných woff2 (Inter + JetBrains Mono).
12. `dev-setup.sh` + `.env.example` + finalize `.gitignore` (`.turbo/`, `.env.local`).

## Validačné kritériá pre Phase C (post-bootstrap)

Po dokončení Phase C platí:

1. `pnpm install --frozen-lockfile` → exit 0.
2. `pnpm typecheck` (`turbo run typecheck`) → exit 0.
3. `pnpm lint` (`turbo run lint`) → exit 0.
4. `pnpm build` (`turbo run build`) → exit 0; existujú `apps/portal/dist/index.html`,
   `apps/workspace/dist/index.html`, `apps/bff/dist/index.js`.
5. `pnpm test` (`turbo run test`) → exit 0 (aj keď reálny test count je nízky — len skeleton tests).
6. `pnpm dev` štartuje paralelne **portal:5173 + BFF:5174 + workspace:5175** (viď `dev-environment.md`).
7. `pnpm pm --help` → exit 0.
8. `pnpm exec lhci autorun --config=./lighthouserc.json` → assert prahy splnené (alebo skip ak `dist/` ešte nemá content).
9. CI pipeline `ci.yml` → všetkých 9 jobov zelených na PR (vrátane coverage, a11y, lhci).
10. `pnpm exec tsx tools/coverage/check-thresholds.ts` → exit 0 (po teste).

## Otvorené závislosti

- `[04-architecture]` Monorepo layout — `[resolved-in-round-2]`. `apps/bff/` (~38 súborov) + Turborepo + extra packages (`api-types`, `i18n`, `utils`, `api-mocks`) zahrnuté.
- `[04-architecture]` BFF technológia (Hono vs Fastify) — pretrváva. Default v `apps/bff/package.json` šablóne: **Hono** (tenký Web Fetch-based framework, vynikajúca TS ergonomia, podporuje cookie session + middleware composition). 06 r2 alebo 04 r2 finalne potvrdí.
- `[06-tech-stack-selector]` React 19 stack — `[resolved-in-round-2]`. 06 r1 `decision.md` potvrdený.
- `[07-design-system]` Design system komponenty (atómy, moleky, organizmy) — pretrváva ako 07 zodpovednosť. Bootstrap vytvorí len index.ts + package.json. 07 r1 dáva 78 komponentov + tokens — naplnenie v Phase C.
- `[07-design-system]` Self-host fonts — `[resolved-in-round-2]`. Inter + JetBrains Mono v woff2 v `apps/{portal,workspace}/public/fonts/`. 07 r1 vybral fonty; **fonty samotné** (woff2 binárie) sa získajú z `rsms/inter` GitHub releases + `JetBrains/JetBrainsMono` (oba SIL OFL 1.1 — open source licensing OK).
- `[09-qa-test-strategy]` `e2e/` štruktúra a počet sample spec-ov sú placeholder. 09 dodá finálny strom (per modul folder, page objects, fixtures) v Phase C.
- `[05-security]` `packages/auth/` scaffoldnutý so 5 modulmi (session, role-guard, login, permissions, preferences). Reálne SSO impl (OIDC) dodá 05 + BFF auth routes (`apps/bff/src/routes/auth/`) v Phase C.
- `[?]` `apps/portal/public/config.json` a `apps/workspace/public/config.json` — default hodnoty pre lokálny dev. Pre staging/prod sa runtime config nahradí pri deploy (`runtime-config.md`).
