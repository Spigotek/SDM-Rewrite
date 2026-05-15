# Repo bootstrap — run-book

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

# Cieľový CA SDM REST endpoint (build-time fallback; runtime config.json prebije)
VITE_API_BASE_URL=http://localhost:5173/mock

# MSW mock backend ON/OFF (default ON v lokálnom dev)
VITE_USE_MOCKS=true

# Telemetria / observability (Sentry DSN; voliteľné v lokálnom dev)
VITE_SENTRY_DSN=

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
pnpm -r build
```

Build poradie (zarovnané s topológiou pnpm workspaces):

1. `packages/api-client` — typovaný klient nad CA SDM REST.
2. `packages/domain` — entity + state machines + validátory.
3. `packages/design-system` — komponenty, tokens, theming.
4. `packages/auth` — SSO/token helpers.
5. `apps/portal` — Vite build.
6. `apps/workspace` — Vite build.
7. `apps/pm` — TS bundle (tsup) pre CLI.

Cache: pnpm cache + Vite cache (`.vite/`) + tsc incremental cache (`.tsbuildinfo`).

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

Štartuje **paralelne**:

- `apps/portal` na `http://localhost:5173`
- `apps/workspace` na `http://localhost:5174`
- MSW worker (v každom apps) — REST mocky aktívne podľa `VITE_USE_MOCKS=true`.

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
    "dev":         "pnpm -r --parallel --filter './apps/portal' --filter './apps/workspace' dev",
    "build":       "pnpm -r build",
    "test":        "pnpm -r test",
    "test:e2e":    "playwright test",
    "typecheck":   "pnpm -r typecheck",
    "lint":        "eslint . --max-warnings=0",
    "format":      "prettier --write .",
    "format:check":"prettier --check .",
    "pm":          "pnpm --filter @sdm/pm exec sdm-pm",
    "prepare":     "husky install",
    "clean":       "pnpm -r clean && rimraf node_modules"
  },
  "devDependencies": {
    "@playwright/test": "^1.49.0",
    "@types/node":       "^22.10.0",
    "eslint":            "^9.18.0",
    "husky":             "^9.1.7",
    "lint-staged":       "^15.2.10",
    "prettier":          "^3.4.2",
    "rimraf":            "^6.0.1",
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
  - "apps/*"
  - "packages/*"
  - "tools/*"
```

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
      proxy: env.VITE_USE_MOCKS === "true" ? undefined : {
        "/caisd-rest": {
          target: env.VITE_API_BASE_URL,
          changeOrigin: true,
          secure: false,
        },
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

- `[06-tech-stack-selector]` Predpokladám **React 19 + Vite 6 + TS 5.7 strict** ako default stack (najpravdepodobnejší výber z GOAL §6). Ak 06 zvolí Angular/Vue, sekcia "Cieľové config šablóny" (`vite.config.ts`, ESLint react pluginy) sa upraví, ale štruktúra run-booku ostáva. Re-validovať po Phase B.
- `[04-architecture]` Predpokladám **pnpm workspaces** ako monorepo tool (nie Nx/Turborepo) — najjednoduchšie pre 2 SPA + 4 packages bez complex graph buildov. Flag → 04 na potvrdenie. Ak 04 zvolí Turborepo, pridá sa `turbo.json` a `pnpm` skripty sa zabalia do `turbo run ...`.
- `[04-architecture]` Repo layout (`apps/*`, `packages/*`, `tools/*`) podľa GOAL §9. Flag → 04 pre prípadné dolaďovanie cestičiek (napr. `apps/bff/` ak Architecture rozhodne pre BFF).
- `[09-qa-test-strategy]` Test runner: **Vitest + Testing Library + Playwright**. Flag → 09 ak preferuje Jest (málo pravdepodobné pri Vite).
- `[?]` Node engine constraint `<23` — voľný horizont, predpoklad že CA SDM REST klient nemá špecifické LTS requirementy. Ak človek/Security vyžaduje pinned 20.x, znížiť rozsah.
