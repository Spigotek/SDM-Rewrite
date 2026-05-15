# Scaffolding checklist — Phase C súbory

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
| new | `package.json` | `repo-bootstrap.md` § Koreňový package.json | Root workspace manifest |
| new | `pnpm-workspace.yaml` | `repo-bootstrap.md` § pnpm-workspace.yaml | Workspace topológia |
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
| new | `dev-setup.sh` | `dev-environment.md` § dev-setup.sh | One-shot bootstrap skript |

## `.husky/`

| Stav | Cesta | Účel |
|---|---|---|
| new | `.husky/pre-commit` | `pnpm exec lint-staged` |
| new | `.husky/commit-msg` | (opt) `pnpm exec commitlint --edit "$1"` |

## `.github/workflows/`

| Stav | Cesta | Zdroj template |
|---|---|---|
| new | `.github/workflows/ci.yml` | `ci-cd.md` § ci.yml |
| new | `.github/workflows/codeql.yml` | `ci-cd.md` § codeql.yml |
| new | `.github/workflows/agent-pipeline.yml` | `ci-cd.md` § agent-pipeline.yml |
| new | `.github/workflows/release.yml` | `ci-cd.md` § release.yml |
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
| new | `apps/portal/vite.config.ts` | Per `repo-bootstrap.md` § vite.config |
| new | `apps/portal/index.html` | Vite entry |
| new | `apps/portal/public/config.json` | Runtime config (per `runtime-config.md`) |
| new | `apps/portal/public/mockServiceWorker.js` | `pnpm exec msw init public/ --save` |
| new | `apps/portal/src/main.tsx` | React entry + MSW bootstrap |
| new | `apps/portal/src/App.tsx` | Root component |
| new | `apps/portal/src/mocks/browser.ts` | Re-export `@sdm/api-mocks/browser` |
| new | `apps/portal/vitest.config.ts` | Per-app Vitest |
| new | `apps/portal/vitest.setup.ts` | MSW node setup |

## `apps/workspace/`

(Identicky štruktúre `apps/portal/` — port 5174.)

| Stav | Cesta | Účel |
|---|---|---|
| new | `apps/workspace/package.json` | |
| new | `apps/workspace/tsconfig.json` | |
| new | `apps/workspace/vite.config.ts` | |
| new | `apps/workspace/index.html` | |
| new | `apps/workspace/public/config.json` | |
| new | `apps/workspace/public/mockServiceWorker.js` | |
| new | `apps/workspace/src/main.tsx` | |
| new | `apps/workspace/src/App.tsx` | |
| new | `apps/workspace/src/mocks/browser.ts` | |
| new | `apps/workspace/vitest.config.ts` | |
| new | `apps/workspace/vitest.setup.ts` | |

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
| new | `packages/api-client/src/client.ts` | CA SDM REST client |
| new | `packages/api-client/src/types/` | Generované TS typy zo schém 01-api-analyst |

> Hlavná zodpovednosť: **04-architecture** (kontrakt) + **01-api-analyst** (typy).
> DevOps len bootstrap-uje balík + config loader.

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
| new | `packages/auth/src/sso.ts` | Z 05-security |
| new | `packages/auth/src/token.ts` | Z 05-security |

> Hlavná zodpovednosť: **05-security**. DevOps len scaffold.

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
| Root config | ~14 |
| `.husky/` | 2 |
| `.github/workflows/` | 4 (+ 2 opt) |
| `.vscode/` | 2 |
| `apps/portal/` | 11 |
| `apps/workspace/` | 11 |
| `apps/pm/` | ~22 (vrátane testov) |
| `packages/api-client/` | 5 |
| `packages/domain/` | 4 (+ obsah z 03) |
| `packages/design-system/` | 4 (+ obsah z 07) |
| `packages/auth/` | 5 (+ obsah z 05) |
| `packages/api-mocks/` | ~25 |
| `tools/pm-hooks/` | 3 (+ 1 opt) |
| `e2e/` | 4 |
| **Spolu** | **~115 súborov** |

## Phase C — poradie volaní

1. Root config (package.json, tsconfig, eslint, prettier, husky).
2. `apps/pm/` (PM CLI musí byť ready, lebo bude orchestrovať budúce re-runy).
3. `packages/api-mocks/` (mock backend pre dev).
4. `apps/portal/` + `apps/workspace/` (FE skelet).
5. `packages/api-client/`, `domain/`, `design-system/`, `auth/` (zdielané balíky).
6. `.github/workflows/` (CI).
7. `tools/pm-hooks/` (Hook skripty).
8. `e2e/` (Playwright skelet).
9. `dev-setup.sh` + `.env.example` + finalize `.gitignore`.

## Validačné kritériá pre Phase C (post-bootstrap)

Po dokončení Phase C platí:

1. `pnpm install --frozen-lockfile` → exit 0.
2. `pnpm typecheck` → exit 0.
3. `pnpm lint` → exit 0.
4. `pnpm build` → exit 0, `apps/portal/dist/index.html` + `apps/workspace/dist/index.html` existujú.
5. `pnpm test` → exit 0 (aj keď reálny test count je nízky — len skeleton tests).
6. `pnpm dev` štartuje paralelne portal:5173 + workspace:5174.
7. `pnpm pm --help` → exit 0.
8. CI pipeline `ci.yml` → všetkých 5+ jobov zelených na PR.

## Otvorené závislosti

- `[04-architecture]` Tento checklist predpokladá **pnpm workspaces + apps + packages** layout. Ak Architecture rozhodne pre BFF, pribudne `apps/bff/` (~15 súborov: server entry, route handlers, middleware, BFF-only mocks). Ak Architecture preferuje Turborepo, pribudne `turbo.json` v root.
- `[06-tech-stack-selector]` Predpoklad React 19. Pri Angular by sa `apps/<x>/` štruktúra zmenila zásadne (žiadny `index.html`+`main.tsx`, namiesto toho `angular.json`+`main.ts`+`app.module.ts`). Mock setup analogicky cez `msw` browser worker (Angular je framework-agnostic z MSW pohľadu).
- `[07-design-system]` `packages/design-system/src/components/` štruktúra (atómy, moleky, organizmy) je zodpovednosť 07. Bootstrap len vytvorí prázdny `index.ts` a `package.json`.
- `[09-qa-test-strategy]` `e2e/` štruktúra a počet sample spec-ov sú placeholder. 09 dodá finálny strom (per modul folder, page objects, fixtures).
- `[05-security]` `packages/auth/` sa scaffolduje s 2 placeholder súbormi. Reálne SSO impl (OIDC / SAML) dodá 05.
- `[?]` `apps/portal/public/config.json` a `apps/workspace/public/config.json` — default hodnoty pre lokálny dev. Pre staging/prod sa runtime config nahradí pri deploy (`runtime-config.md`).
