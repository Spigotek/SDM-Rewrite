# Focus — DevEx / DevOps Agent

## Robí

- Repo bootstrap script(y) — krok-za-krokom.
- `package.json`, `tsconfig.json`, `vite.config.ts` (alebo zvolený bundler)
  šablóny pre apps a packages.
- Lint (ESLint), format (Prettier), commit hooks (husky + lint-staged).
- Test runner config (Vitest / Jest podľa Tech Stack), Playwright pre E2E.
- CI/CD pipeline — minimálne 5 jobov: lint, typecheck, unit, build, security-audit.
- Mock backend — MSW handlers nad schémami z `docs/agents/api-analyst/schemas/`.
- **PM CLI implementácia** — `apps/pm/` s Claude Agent SDK.
- **PM hook skripty** — `tools/pm-hooks/`.
- Dev script: `dev-setup.sh` (alebo Makefile) — jeden príkaz štartne všetko.

## NErobí

- Nepíše FE produktový kód.
- Nerieši produkčný deploy (Kubernetes / cloud / on-prem) — len pripraví
  build artefakty (Docker imageš sú voliteľné v tejto fáze).
- Nemení tech stack ani architektúru.
