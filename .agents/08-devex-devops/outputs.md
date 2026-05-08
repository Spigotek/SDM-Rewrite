# Outputs — DevEx / DevOps Agent

Cieľový adresár: `docs/agents/devops/` + reálne súbory v repe (ten agent
súčasne robí dokumentáciu **a** scaffolding).

## Dokumentácia

| Cesta | Účel |
|---|---|
| `docs/agents/devops/repo-bootstrap.md` | Kroky setupu repa |
| `docs/agents/devops/ci-cd.md` | Pipeline definícia |
| `docs/agents/devops/dev-environment.md` | Lokálny dev (porty, proxy, MSW) |
| `docs/agents/devops/mock-strategy.md` | Mock backend stratégia (MSW) |
| `docs/agents/devops/pm-runtime.md` | Ako PM funguje cez Claude Agent SDK |
| `docs/agents/devops/pm-git-strategy.md` | Branch isolation, worktree management, merge a PR flow PM |

## Scaffolding (reálne súbory)

| Cesta | Účel |
|---|---|
| `package.json` | root manifest (workspaces) |
| `pnpm-workspace.yaml` (alebo nx.json / turbo.json) | monorepo config |
| `tsconfig.base.json` + per-package `tsconfig.json` | TS config |
| `.eslintrc.cjs` + `.prettierrc` | lint/format |
| `apps/portal/`, `apps/workspace/`, `apps/pm/` | app stuby |
| `apps/pm/src/orchestrator.ts` | hlavný loop PM (round 1 → refinement → konvergencia) |
| `apps/pm/src/git.ts` | git modul PM — branch create, worktree add/remove, commit, merge --no-ff, `gh pr create` |
| `apps/pm/src/revision.ts` | revision-prompt assembler (delta výstupov + revision request) |
| `apps/pm/src/convergence.ts` | parser `## Otvorené závislosti`, cross-artifact diff, oscillation detection |
| `apps/pm/src/state.ts` | atomický I/O nad `.agents/state.json` |
| `packages/api-client/`, `packages/domain/`, `packages/design-system/`, `packages/auth/` | package stuby |
| `apps/portal/public/config.json` | **runtime config** pre portál (api endpoint, tenanty, feature flags) |
| `apps/workspace/public/config.json` | **runtime config** pre workspace |
| `apps/portal/public/config.example.json` | šablóna pre nasadenie |
| `apps/workspace/public/config.example.json` | šablóna pre nasadenie |
| `.env.example` | build-time premenné (`VITE_API_BASE_URL` ako fallback) |
| `packages/api-client/src/config.ts` | bootstrap loader runtime configu (fetch `/config.json`) |
| `tools/pm-hooks/log-write.js` | PM hook skript |
| `tools/pm-hooks/on-subagent-start.js` | PM hook skript |
| `tools/pm-hooks/on-subagent-stop.js` | PM hook skript |
| `tools/pm-hooks/log-bash.js` | PM hook skript |
| `dev-setup.sh` | jeden-príkazový dev start |
| `.github/workflows/ci.yml` (alebo GitLab equiv.) | CI pipeline |

## Runtime config — kontrakt

```json
// apps/<app>/public/config.json (mení sa per deployment, bez rebuildu)
{
  "apiBaseUrl": "https://sdm.example.org/caisd-rest",
  "auth": { "mode": "sso-oidc", "issuer": "https://idp.example.org" },
  "tenants": { "defaultMode": "user-profile" },
  "features": { "kbEditor": false, "cmdbVisualizer": false }
}
```

`packages/api-client/src/config.ts` načíta `config.json` cez `fetch('/config.json')`
**pri štarte** (pred prvým API volaním). Build-time `.env` premenná je iba
**fallback** pre dev / mock-only mode.

## Povinná záverečná sekcia v každom artefakte

Každý markdown artefakt zo zoznamu vyššie **musí končiť** sekciou
`## Otvorené závislosti` podľa kontraktu v `.agents/README.md`. PM ju parsuje
v refinement loope a podľa nej rozhoduje o opätovnej invokácii. Ak žiadne
flagy nemáš, napíš `Žiadne. Artefakt je samonosný.`.

## Validácia (PM)

- `package.json` má `workspaces` field a všetky dirs existujú.
- `pnpm install` (alebo ekv.) prejde bez chyby v sandbox-e.
- `npx tsc --noEmit` prejde.
- `apps/pm/src/index.ts` importuje `@anthropic-ai/claude-agent-sdk`.
- `apps/pm/src/git.ts` exportuje aspoň: `createBranch`, `addWorktree`,
  `removeWorktree`, `commitInWorktree`, `mergeBranch`, `openPullRequest`.
- CI workflow má aspoň 4 joby (lint, typecheck, test, build).
- `pm-git-strategy.md` obsahuje konkrétne `git` a `gh` príkazy pre každý krok
  z GOAL §7.6 (žiadne pseudokód-only popisy).
