# Repo bootstrap — run-book

## Changelog (round 2)

- Pridaná sekcia **Turborepo config** (`turbo.json` template, root scripts cez `turbo run …`) — 04 r2 ADR-02 finalizovalo **pnpm 9 workspaces + Turborepo**.
- `pnpm-workspace.yaml` rozšírené o `apps/bff/` ako prvotriedny package (04 r2 ADR-01 finalizoval BFF).
- Root `package.json` scripts prebalené do `turbo run …` (cache + topological orchestration).
- Build poradie v Kroku 4 pridáva `apps/bff` ako 6. krok (pred SPA buildmi).
- `## Otvorené závislosti` aktualizované — uzavreté `[04-architecture]` (BFF, monorepo tool, layout) ako `[resolved-in-round-2]`, `[06-tech-stack-selector]` (React 19 default).
- Pridaný `engines.node` minor bump na **20.11+ / 22.x LTS** zhodne s 04 layoutom.

> Run-book pre **prvé úspešné nasadenie** monorepa SDM-Rewrite na čistej
> vývojárskej stanici. Cieľ: od `git clone` po zelené `pnpm build` + `pnpm test`
> za menej ako 10 minút, bez ručných zásahov mimo `.env`.

## Predpoklady — host machine

| Komponent | Minimum | Odporúčaná | Inštalácia |
|---|---|---|---|
| **Node.js** | 20.11 LTS | 22.x LTS | `nvm install --lts && nvm use --lts` |
| **pnpm** | 9.x | 9.x latest | `corepack enable && corepack prepare pnpm@latest --activate` |
| **git** | 2.40 | 2.45+ | OS package manager |
| **gh** (GitHub CLI) | 2.40 | latest | `brew install gh` / `apt install gh` |
| **Docker** (voliteľné) | 24.x | latest | Pre lokálny Playwright kontajner |

Verifikácia:

```bash
node --version    # v20.11.0 alebo vyššie
pnpm --version    # 9.x
git --version     # 2.40+
gh --version      # 2.40+
```

**Engines lock** v koreňovom `package.json` zabezpečí, že `pnpm install` zlyhá
na nesprávnej verzii Node:

```jsonc
{
  "engines": {
    "node": ">=20.11.0 <23",
    "pnpm": ">=9.0.0"
  },
  "packageManager": "pnpm@9.12.0"
}
```

## Krok 1 — Klon a corepack

```bash
git clone git@github.com:Spigotek/SDM-Rewrite.git sdm-rewrite
cd sdm-rewrite
corepack enable
corepack prepare pnpm@9.12.0 --activate
```

## Krok 2 — Environmenty

Skopíruj `.env.example` na `.env` a vyplň lokálne tajomstvá.

```bash
cp .env.example .env
```

Cieľový obsah `.env.example`:

```env
# Anthropic API key pre PM CLI (Claude Agent SDK)
ANTHROPIC_API_KEY=

# Cieľový API endpoint (build-time fallback; runtime config.json prebije)
VITE_API_BASE_URL=http://localhost:5173

# BFF origin (Vite proxy /api/* a /auth/* /me/* target). Default lokálny BFF.
VITE_BFF_ORIGIN=http://localhost:5174

# FE-side MSW fallback (bez bežiaceho BFF). Default OFF — BFF beží lokálne.
VITE_USE_MOCKS=false

# Telemetria / observability (Sentry DSN; voliteľné v lokálnom dev)
VITE_SENTRY_DSN=

# BFF runtime
BFF_PORT=5174
BFF_SESSION_STORE_MODE=in-memory             # in-memory | redis
BFF_REDIS_URL=                                 # vyžadované ak STORE_MODE=redis
BFF_CA_SDM_URL=https://sdm-staging.example.org  # cieľová CA SDM inštancia (alebo prázdne pre upstream mocks)
BFF_CA_SDM_USE_MOCKS=true                     # BFF upstream MSW mocks ON/OFF

# PM CLI log level (debug | info | warn | error)
PM_LOG_LEVEL=info
```

`.env` je v `.gitignore`. **Žiadne secrety v repe.**

## Krok 3 — Inštalácia závislostí

```bash
pnpm install --frozen-lockfile
```

Očakávaný čas: 60–120 s (cache hit) / 3–5 min (cold).

Inštalácia automaticky spustí `prepare` hook → husky pre git hooks:

```bash
# package.json (root) → scripts.prepare
"prepare": "husky install"
```

## Krok 4 — Build all packages

```bash
pnpm build                               # alias na: turbo run build
```

Turborepo prepočíta dependency graph a stavia v topologickom poradí
s globálnym cache (lokálne `.turbo/`, voliteľne remote cache server).

Cieľové poradie (Turborepo vyrieši automaticky z `dependsOn`):

1. `packages/domain` — entity + state machines + validátory (žiadne FE deps).
2. `packages/utils` — pure helpers (žiadne deps).
3. `packages/api-types` — re-export z `domain`.
4. `packages/api-client` — typovaný klient (deps: api-types, utils).
5. `packages/auth` — SSO/token helpers (deps: api-client).
6. `packages/design-system` — komponenty, tokens, theming (deps: utils).
7. `packages/i18n` — i18n provider + catalogs (deps: utils).
8. `apps/bff` — BFF server (deps: domain, api-client, auth) — tsup bundle.
9. `apps/portal` — Vite build (deps: api-client, design-system, auth, i18n, domain).
10. `apps/workspace` — Vite build (deps: rovnaké ako portal).
11. `apps/pm` — TS bundle (tsup) pre CLI (deps: žiadne workspace deps).

Cache (3-vrstvová):
- **Turborepo cache** (`.turbo/`) — hashuje vstupy (src + tsconfig + lockfile) + výstupy.
- **pnpm store** (content-addressable) — žiadny duplicate `node_modules`.
- **Vite cache** (`.vite/`) + **tsc incremental** (`.tsbuildinfo`) per-app.

## Krok 5 — Testy

```bash
pnpm -r test            # unit + komponentové (Vitest, paralelne)
pnpm -r typecheck       # tsc --noEmit per workspace
pnpm -r lint            # ESLint
pnpm test:e2e           # Playwright (len root, ovláda apps cez Vite preview)
```

Očakávaný čas first run: 4–6 min (Playwright stiahne browsery), subsequent < 2 min.

## Krok 6 — Dev server

```bash
pnpm dev
```

Štartuje **paralelne** (cez Turborepo):

- `apps/portal` na `http://localhost:5173`
- `apps/bff` na `http://localhost:5174`
- `apps/workspace` na `http://localhost:5175`
- BFF interný MSW Node — CA SDM upstream mocky (žiadny port, in-process).
- FE volá `/api/*` (Vite proxy → BFF :5174).

Detail v `dev-environment.md`.

## Krok 7 — PM CLI sanity check

```bash
pnpm pm --help                       # vypíše available commands
pnpm pm pipeline --dry-run           # validuje pipeline.yaml + agent contracts
```

Bez `ANTHROPIC_API_KEY` v `.env` `--dry-run` prejde, **`pipeline` (live run) zlyhá**.

## Cieľové config šablóny

### Koreňový `package.json`

```jsonc
{
  "name": "sdm-rewrite",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=20.11.0 <23",
    "pnpm": ">=9.0.0"
  },
  "packageManager": "pnpm@9.12.0",
  "scripts": {
    "dev":          "turbo run dev --parallel --filter=@sdm/portal --filter=@sdm/workspace --filter=@sdm/bff",
    "dev:fe":       "turbo run dev --parallel --filter=@sdm/portal --filter=@sdm/workspace",
    "dev:bff":      "turbo run dev --filter=@sdm/bff",
    "build":        "turbo run build",
    "test":         "turbo run test",
    "test:e2e":     "playwright test",
    "typecheck":    "turbo run typecheck",
    "lint":         "turbo run lint && eslint . --max-warnings=0",
    "format":       "prettier --write .",
    "format:check": "prettier --check .",
    "pm":           "pnpm --filter @sdm/pm exec sdm-pm",
    "prepare":      "husky install",
    "clean":        "turbo run clean && rimraf node_modules .turbo"
  },
  "devDependencies": {
    "@playwright/test": "^1.49.0",
    "@types/node":       "^22.10.0",
    "eslint":            "^9.18.0",
    "husky":             "^9.1.7",
    "lint-staged":       "^15.2.10",
    "prettier":          "^3.4.2",
    "rimraf":            "^6.0.1",
    "turbo":             "^2.3.3",
    "typescript":        "^5.7.2"
  },
  "lint-staged": {
    "*.{ts,tsx,js,jsx}": ["eslint --fix", "prettier --write"],
    "*.{json,md,yml,yaml,css}": ["prettier --write"]
  }
}
```

### `pnpm-workspace.yaml`

```yaml
packages:
  - "apps/portal"
  - "apps/workspace"
  - "apps/bff"
  - "apps/pm"
  - "packages/*"
  - "tools/*"
```

`apps/bff` je explicit (nie cez `apps/*`), aby pnpm filter `--filter=@sdm/bff` bol
rýchly aj bez Turborepo. `packages/*` zachytí všetky 8 zdielaných balíkov
(api-client, api-types, domain, design-system, auth, i18n, utils, api-mocks).

## Turborepo config

04 r2 ADR-02 finalizovalo **pnpm 9 workspaces + Turborepo** ako monorepo
stack. Turborepo orchestruje tasks (`build`, `test`, `lint`, `typecheck`)
s cache + topological dependency graph. pnpm zostáva package manager
(content-addressable store, strict deps, `workspace:*` protocol).

### `turbo.json`

```jsonc
{
  "$schema": "https://turbo.build/schema.json",
  "ui": "stream",
  "globalDependencies": [
    ".env",
    ".env.production",
    "tsconfig.base.json",
    "eslint.config.js",
    ".prettierrc.json"
  ],
  "globalEnv": ["NODE_ENV", "CI", "VITE_USE_MOCKS"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".vite/**", "!.vite/cache/**"],
      "inputs": [
        "src/**",
        "public/**",
        "package.json",
        "tsconfig.json",
        "vite.config.ts",
        "tsup.config.ts",
        "index.html"
      ]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"],
      "inputs": [
        "src/**",
        "tests/**",
        "vitest.config.ts",
        "vitest.setup.ts",
        "package.json"
      ]
    },
    "test:watch": {
      "cache": false,
      "persistent": true
    },
    "typecheck": {
      "dependsOn": ["^build"],
      "outputs": ["*.tsbuildinfo"],
      "inputs": ["src/**", "tsconfig.json", "package.json"]
    },
    "lint": {
      "outputs": [],
      "inputs": ["src/**", "package.json", "../../eslint.config.js"]
    },
    "clean": {
      "cache": false
    }
  }
}
```

Pravidlá:

- **`dependsOn: ["^build"]`** — `^` znamená "rebuild všetky deps prvé". Žiadny
  ručný topological sort v scripts.
- **`outputs`** — Turborepo zhrnie do cache iba tieto adresáre. `dist/**`,
  `coverage/**`, `*.tsbuildinfo` sú typické.
- **`inputs`** — Turborepo počíta cache key iba zo zmien v tomto file glob.
  Zmena `README.md` nevyradí cache.
- **`cache: false`** pre `dev` / `test:watch` — long-running, neprenosné.
- **`persistent: true`** označí task ako "dlhozijúci dev server" (Turborepo
  ho neukončí čakajúc na exit code).
- **`globalDependencies`** — zmena `.env` alebo `eslint.config.js` invaliduje
  cache **všetkých** packages (širokospektrálny dopad).

### `.turbo/` v `.gitignore`

```gitignore
# Turborepo
.turbo/
```

### Selective filter — `--filter`

```bash
turbo run build --filter=@sdm/portal              # iba portal + dependencies
turbo run build --filter=@sdm/portal...           # portal + dependencies (rovnaké)
turbo run test  --filter=@sdm/domain^...          # domain + jeho consumers
turbo run lint  --filter=...[origin/main]         # changed vs. main (CI)
turbo run build --filter='!@sdm/pm'               # všetko okrem PM
```

CI optimalizácia (per-PR):

```bash
# Iba balíky zmenené v PR vs. main
turbo run lint typecheck test build --filter=...[origin/main]
```

### Remote cache (voliteľne)

V1: lokálna cache stačí (`.turbo/` per dev + per CI runner s `actions/cache@v4`).

V2 (post-MVP): self-hosted Turborepo remote cache server
([turborepo-remote-cache](https://github.com/ducktors/turborepo-remote-cache)),
deployovaný v rovnakej DMZ ako CI runners. Setup:

```bash
# .env (CI):
TURBO_API=https://turbo-cache.internal.example.org
TURBO_TOKEN=<bearer>
TURBO_TEAM=sdm-rewrite
```

Mitigácia rizika z 04 ADR-02 Otvorené závislosti #1 `turborepo-remote-cache-host` —
**v MVP local-only cache, v1 self-hosted**.

### Vendor lock-in mitigation

Turborepo config je tenký JSON (`turbo.json` ~50 riadkov). Ak by sme v
budúcnosti chceli odísť: pnpm `--recursive` + topological order cez vlastný
skript je funkčný fallback. Žiadny lock-in do proprietárneho jazyka.

### Koreňový `tsconfig.json` — base config

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "incremental": true
  },
  "exclude": ["node_modules", "dist", ".vite", "coverage"]
}
```

Per-workspace `tsconfig.json` rozšíri base a pridá vlastné `include`/`paths`.

### `vite.config.ts` — šablóna pre `apps/portal` a `apps/workspace`

```ts
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react()],
    server: {
      port: env.VITE_DEV_PORT ? Number(env.VITE_DEV_PORT) : 5173,
      strictPort: true,
      proxy: {
        // /api/*, /auth/*, /me/* — BFF (04 r2 ADR-01).
        // Ak VITE_USE_MOCKS=true (fallback bez BFF), MSW browser worker zachytí.
        "/api":  { target: env.VITE_BFF_ORIGIN ?? "http://localhost:5174", changeOrigin: true, secure: false },
        "/auth": { target: env.VITE_BFF_ORIGIN ?? "http://localhost:5174", changeOrigin: true, secure: false },
        "/me":   { target: env.VITE_BFF_ORIGIN ?? "http://localhost:5174", changeOrigin: true, secure: false },
      },
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
    },
    build: {
      target: "es2022",
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks: {
            react: ["react", "react-dom"],
          },
        },
      },
    },
  };
});
```

### ESLint flat config (`eslint.config.js`)

```js
import js from "@eslint/js";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import reactPlugin from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import a11y from "eslint-plugin-jsx-a11y";

export default [
  js.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: { project: true, tsconfigRootDir: import.meta.dirname },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      react: reactPlugin,
      "react-hooks": reactHooks,
      "jsx-a11y": a11y,
    },
    rules: {
      ...tsPlugin.configs.recommendedTypeChecked.rules,
      ...reactHooks.configs.recommended.rules,
      ...a11y.configs.recommended.rules,
      "react/jsx-uses-react": "off",
      "react/react-in-jsx-scope": "off",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/consistent-type-imports": "error",
    },
    settings: { react: { version: "detect" } },
  },
  {
    ignores: ["**/dist/**", "**/.vite/**", "**/coverage/**", "**/node_modules/**"],
  },
];
```

### Prettier config (`.prettierrc.json`)

```json
{
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "singleQuote": false,
  "trailingComma": "all",
  "semi": true,
  "arrowParens": "always"
}
```

### Husky + lint-staged

Súbory:

- `.husky/pre-commit` — `pnpm exec lint-staged`
- `.husky/commit-msg` — `pnpm exec commitlint --edit "$1"` (voliteľné, conventional commits)

`pre-commit` body:

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"
pnpm exec lint-staged
```

### `commitlint.config.js` (voliteľné)

```js
export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "subject-case": [0],
    "header-max-length": [2, "always", 120],
  },
};
```

### `.editorconfig`

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false
```

### `.nvmrc`

```
v22
```

### `.gitignore` (kľúčové sekcie)

```gitignore
# Node
node_modules/
.pnpm-store/

# Turborepo
.turbo/

# Build
dist/
.vite/
*.tsbuildinfo

# Test
coverage/
playwright-report/
test-results/

# Env
.env
.env.local
.env.*.local
!.env.example

# Editor
.idea/
.vscode/*
!.vscode/settings.json
!.vscode/extensions.json
.DS_Store

# PM runtime
.agents/runs/
.agents/state.json
.agents/.current-run-id

# Logs
*.log
```

## Idempotentnosť

Všetky kroky sú idempotentné:

- `pnpm install` na nezmenený lockfile = no-op.
- `pnpm -r build` na nezmenené zdroje = cache hit (tsc incremental + Vite cache).
- `pnpm test` = re-run; deterministické (žiadne `Math.random()` v testoch bez seedu).

## Recovery — bad state

Ak sa lokálny stav rozsype:

```bash
pnpm clean                                # zmaže node_modules + dist + .vite
git clean -fdx                            # vyčistí WT (POZOR — zmaže .env)
pnpm install --frozen-lockfile
pnpm -r build
```

## Otvorené závislosti

- `[06-tech-stack-selector]` **React 19 + Vite 6 + TS 5.7 strict** — `[resolved-in-round-2]`. 06 r1 `decision.md` potvrdený, žiadne breaking zmeny očakávané v r2.
- `[04-architecture]` Monorepo tool — `[resolved-in-round-2]`. 04 ADR-02 finalizovalo **pnpm 9 workspaces + Turborepo**. `turbo.json` šablóna pridaná v sekcii `## Turborepo config`.
- `[04-architecture]` Repo layout — `[resolved-in-round-2]`. 04 `monorepo-layout.md` autoritatívny: `apps/{portal,workspace,bff,pm}`, `packages/{api-client,api-types,domain,design-system,auth,i18n,utils,api-mocks}`, `tools/{eslint-config,tsconfig-base,i18n-check,boundaries-check,scaffold,pm-hooks}`.
- `[04-architecture]` BFF rozhodnutie — `[resolved-in-round-2]`. 04 ADR-01 `accepted`, `apps/bff/` zaradené do `pnpm-workspace.yaml` aj do build poradia.
- `[09-qa-test-strategy]` Test runner — `[resolved-in-round-2]`. 09 `test-strategy.md` potvrdil **Vitest + Testing Library + Playwright + axe-core**.
- `[04-architecture]` `turborepo-remote-cache-host` (z ADR-02 #1) — pretrváva, ale **mitigované**. MVP: local cache only; v1: self-hosted [turborepo-remote-cache](https://github.com/ducktors/turborepo-remote-cache). Konkrétna URL = deploy-time rozhodnutie.
- `[04-architecture]` `scaffolding-tool` (z ADR-02 #3) — pretrváva. Default: `tools/scaffold/` s `plop` šablónami (CLI pre nový package/feature). Implementácia v Phase C — žiadny blocker pre bootstrap.
- `[?]` Node engine constraint `<23` — voľný horizont, predpoklad že CA SDM REST klient nemá špecifické LTS requirementy. Ak Security vyžaduje pinned 22.x LTS, znížiť rozsah.
- `[05-security]` `security-audit` pravidlá (Snyk/Semgrep/SonarCloud) — pretrváva. Default: `pnpm audit` + Trufflehog + GitHub CodeQL (zelená baseline). Snyk/Semgrep ako add-on rozhodne 05 r2 alebo post-conv.
