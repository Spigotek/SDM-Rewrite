# Dev environment — one-command local setup

## Changelog (round 2)

- Pridaný **BFF dev port `:5174`** (04 r2 ADR-01 finalizoval BFF). Workspace presunutý z `:5174` na **`:5175`**, port mapa prebalená.
- Pridaný **Vite proxy `/api/* → BFF :5174`** v `apps/portal/vite.config.ts` a `apps/workspace/vite.config.ts`. FE volá `/api/*` (relatívne), Vite proxy posiela na BFF.
- Pridaný **port `9333` (Chrome remote debug)** — pre Playwright + electron-chrome MCP scenár.
- MSW worker beží v BFF dev mode (Node MSW serve-uje CA SDM upstream pre BFF), nie v FE. FE komunikuje s BFF kontraktom `/api/*`.
- `.env.local` rozšírené o `VITE_BFF_ORIGIN`, `BFF_PORT`, `BFF_SESSION_STORE_MODE=in-memory`.
- `dev-setup.sh` doplnené o krok pre BFF (`pnpm --filter @sdm/bff dev` ako background).
- Otvorené závislosti — uzavreté `[04-architecture]` BFF + multi-tenancy, `[06-tech-stack-selector]` React 19.

> Cieľ: vývojár spustí **`pnpm dev`** a má zelený stack — portal na `:5173`,
> BFF na `:5174`, workspace na `:5175`, MSW mock backend aktívny v BFF (Node MSW
> serve-uje CA SDM upstream). Hot reload funguje. Bez Docker. Bez živej CA SDM inštancie.

## Mapa portov

| Port | Služba | URL | Účel |
|---|---|---|---|
| 5173 | `apps/portal` (Vite) | http://localhost:5173 | Self-service SPA |
| 5174 | `apps/bff` (Node + Hono/Fastify) | http://localhost:5174 | BFF dev server (04 r2 ADR-01) |
| 5175 | `apps/workspace` (Vite) | http://localhost:5175 | Agent workspace SPA |
| 5176 | Vitest UI (voliteľné) | http://localhost:5176 | `pnpm test --ui` |
| 9323 | Playwright UI mode | http://localhost:9323 | `pnpm test:e2e --ui` |
| 9333 | Chrome remote debug (CDP) | http://localhost:9333 | Playwright remote + electron-chrome MCP scenárov |
| (none) | MSW Node server | — | V BFF dev procese — serve-uje `/caisd-rest/*` upstream mocky |

Žiadny port mimo `:5173–:5176`, `:9323`, `:9333`. BFF beží lokálne ako Node
proces a interne používa MSW Node server pre CA SDM upstream calls (žiadna
sieť von z dev laptopu).

## `pnpm dev` — čo robí

V koreňovom `package.json`:

```jsonc
"scripts": {
  "dev": "turbo run dev --parallel --filter=@sdm/portal --filter=@sdm/workspace --filter=@sdm/bff"
}
```

Turborepo spúšťa **paralelne** dev servery vo všetkých 3 apps. Stdout je
prefixovaný názvom workspace, logy ostávajú čitateľné:

```
[@sdm/bff]       Hono server listening on http://localhost:5174
[@sdm/bff]       MSW upstream mocks active (CA SDM)
[@sdm/portal]    VITE v6.0.3  ready in 412 ms
[@sdm/portal]    ➜  Local:   http://localhost:5173/
[@sdm/workspace] VITE v6.0.3  ready in 438 ms
[@sdm/workspace] ➜  Local:   http://localhost:5175/
```

Ctrl-C zabije všetkých 3 potomkov.

### Variant — len FE bez BFF

```bash
pnpm dev:fe                              # iba portal + workspace
```

V tomto móde FE pobeží proti **MSW browser worker** (priame mocky `/api/*`),
bez BFF dev servera. Užitočné pre rýchle UI iterácie alebo demo bez Node BFF.

## Per-app `dev` skript

`apps/portal/package.json`:

```jsonc
{
  "name": "@sdm/portal",
  "scripts": {
    "dev":     "vite",
    "build":   "vite build",
    "preview": "vite preview --port 5173",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test":    "vitest run",
    "test:watch": "vitest"
  }
}
```

`apps/workspace/package.json` identicky s portom 5175 (cez `vite.config.ts` →
`server.port`).

`apps/bff/package.json`:

```jsonc
{
  "name": "@sdm/bff",
  "type": "module",
  "scripts": {
    "dev":       "tsx watch src/index.ts",
    "build":     "tsup",
    "start":     "node dist/index.js",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test":      "vitest run",
    "test:watch": "vitest"
  }
}
```

BFF v dev mode používa `tsx watch` pre HMR (Node).

## MSW — mock backend setup

### Štruktúra

```
apps/portal/src/mocks/
├── browser.ts         # setupWorker pre browser dev
├── handlers/
│   ├── index.ts       # zlučuje všetky handlery
│   ├── auth.ts
│   ├── incidents.ts
│   ├── requests.ts
│   ├── problems.ts
│   ├── changes.ts
│   ├── knowledge.ts
│   ├── cmdb.ts
│   └── tenants.ts
└── data/              # fixture JSON-y
    ├── incidents.json
    ├── ...
```

Workspace app importuje rovnaké handlery z `@sdm/api-mocks` (zdielaný package).
Per-app handler override iba ak app-specific business logic.

### Bootstrap v `apps/portal/src/main.tsx`

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

async function enableMocks() {
  if (import.meta.env.VITE_USE_MOCKS !== "true") return;
  const { worker } = await import("./mocks/browser");
  return worker.start({
    onUnhandledRequest: "warn",
    serviceWorker: { url: "/mockServiceWorker.js" },
  });
}

enableMocks().then(() => {
  ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
});
```

`public/mockServiceWorker.js` generuje `npx msw init public/ --save` (jednorazovo
po `pnpm install`).

### `VITE_USE_MOCKS` toggle

| Hodnota | Správanie |
|---|---|
| `true` (default v lokálnom `.env`) | MSW worker aktívny, žiadny HTTP fetch nikam von |
| `false` | MSW vypnutý, requesty idú cez `VITE_API_BASE_URL` / Vite proxy |

Detail handlerov v `mock-strategy.md`.

## Vite proxy — `/api/* → BFF :5174`

V dev mode FE volá `/api/*` (relatívne). Vite proxy posiela všetky `/api/*`
requesty na BFF dev server `http://localhost:5174`. Tým získame **CORS-free
fetch** v dev (rovnaký origin pre FE aj proxy target z pohľadu browsera).

```ts
// apps/portal/vite.config.ts (rovnaké pre apps/workspace)
server: {
  port: 5173,                              // apps/workspace: 5175
  strictPort: true,
  proxy: {
    "/api": {
      target: env.VITE_BFF_ORIGIN ?? "http://localhost:5174",
      changeOrigin: true,
      secure: false,
    },
    "/auth": {
      target: env.VITE_BFF_ORIGIN ?? "http://localhost:5174",
      changeOrigin: true,
      secure: false,
    },
    "/me": {
      target: env.VITE_BFF_ORIGIN ?? "http://localhost:5174",
      changeOrigin: true,
      secure: false,
    },
  },
}
```

`VITE_BFF_ORIGIN` je environment variable (default `http://localhost:5174`).

### Fallback proti živej staging inštancii (bez BFF)

Edge case — vývojár chce debugovať priamo voči staging CA SDM **bez BFF**.
V `apps/portal/src/mocks/browser.ts` zapne sa MSW browser worker s mockmi
`/api/*` (kontrakt, ktorý BFF normálne vystavuje). Tým FE nemusí mať bežiaci
lokálny BFF, ale stále hovorí "BFF kontraktom".

```env
# .env.local
VITE_USE_MOCKS=true                        # FE-side MSW browser worker
VITE_BFF_ORIGIN=                           # ignorované, MSW intercept-uje
```

## HMR a state preservation

- React Fast Refresh aktívny cez `@vitejs/plugin-react`.
- Žiadny custom HMR setup — Vite default je dostatočný.
- React Hook Form / Zustand / Context state sa pri HMR **resetne** ak sa zmenia
  exporty komponentu. Pre dlhšie wizard formuláre vývojár použije `pnpm dev --force`
  alebo full reload (Cmd-R).

## Browser DevTools profil

Pre vývoj **odporúčame samostatný Chrome profil** s povolenými extensions:

- React DevTools
- TanStack Query DevTools (in-app overlay, nepotrebuje extension)
- MSW Debugger (in-DevTools "Application → Service Workers" panel)

Žiadny enforced profile — vývojár si nastaví sám.

## VS Code workspace settings (`.vscode/settings.json`)

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit",
    "source.organizeImports": "never"
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "eslint.workingDirectories": [{ "mode": "auto" }],
  "files.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/.vite": true
  }
}
```

`.vscode/extensions.json`:

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "vitest.explorer",
    "ms-playwright.playwright",
    "yzhang.markdown-all-in-one"
  ]
}
```

(Tailwind extension je tam aj keď Tailwind nepoužívame — pre design-tokens utility
classes, ak ich design-system zavedie. Neutrálny.)

## `dev-setup.sh` — bootstrap shell skript

Pre čerstvého vývojára — alternatívne k manuálnemu run-booku:

```bash
#!/usr/bin/env bash
set -euo pipefail

# dev-setup.sh — idempotent bootstrap pre lokálny dev.
# Spustiteľné: ./dev-setup.sh

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO_ROOT"

echo "==> [1/6] Node version check"
node -v | grep -qE "^v(20|21|22)\." || {
  echo "FAIL: Need Node 20–22. Got: $(node -v)" >&2
  echo "Run: nvm install --lts && nvm use --lts"
  exit 1
}

echo "==> [2/6] pnpm enable"
corepack enable
corepack prepare pnpm@9.12.0 --activate

echo "==> [3/6] .env bootstrap"
if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from template. Edit ANTHROPIC_API_KEY before running pnpm pm."
fi

echo "==> [4/6] pnpm install"
pnpm install --frozen-lockfile

echo "==> [5/7] MSW worker bootstrap (idempotent, FE fallback mode)"
[ -f apps/portal/public/mockServiceWorker.js ] || \
  pnpm --filter @sdm/portal exec msw init public/ --save
[ -f apps/workspace/public/mockServiceWorker.js ] || \
  pnpm --filter @sdm/workspace exec msw init public/ --save

echo "==> [6/7] Playwright browsers (cached)"
pnpm exec playwright install chromium

echo "==> [7/7] BFF build (pre prvé spustenie 'pnpm dev')"
pnpm --filter @sdm/bff build || true     # idempotent — fail-soft pri prvom behu

echo ""
echo "Done. Next:"
echo "  pnpm dev          # start portal :5173 + BFF :5174 + workspace :5175"
echo "  pnpm dev:fe       # iba FE (MSW browser worker, bez BFF)"
echo "  pnpm test         # run unit tests"
echo "  pnpm test:e2e     # run Playwright"
```

Spúšťa sa raz pre nového vývojára; opakované spustenie je no-op.

## CA SDM verzia "staging" — bridge config

Ak má vývojár prístup k živej CA SDM staging inštancii (po nasadení na server):

`.env.local`:

```env
VITE_USE_MOCKS=false
VITE_BFF_ORIGIN=http://localhost:5174
BFF_CA_SDM_URL=https://sdm-staging.example.org
BFF_CA_SDM_USE_MOCKS=false
```

BFF dev server (`apps/bff`) sa pripojí na živú CA SDM staging inštanciu;
Vite proxy v FE stále posiela `/api/*` na BFF (`:5174`). CORS rieši BFF
side (server-to-server fetch), žiadny `Access-Control-*` problem v browseri.

## Troubleshooting

| Symptom | Pravdepodobná príčina | Riešenie |
|---|---|---|
| `pnpm dev` zlyhá s "port already in use" | Predošlý Vite/BFF dev nezomrel | `lsof -ti:5173,5174,5175 \| xargs kill -9` |
| FE `/api/*` calls padajú na 404 | BFF nebeží alebo Vite proxy zle nakonfigurovaný | `curl -i http://localhost:5174/health`; ak fail → `pnpm dev:bff` |
| MSW handlery nefungujú v fallback FE mode | Service Worker nie je registrovaný | DevTools → Application → Service Workers → Unregister; reload |
| `mockServiceWorker.js` 404 | `msw init` nebol spustený | `pnpm --filter @sdm/portal exec msw init public/ --save` |
| BFF crash s `Redis connection refused` | Redis nie je nainštalovaný/ nebeží | Default v dev: `BFF_SESSION_STORE_MODE=in-memory` (žiadny Redis potrebný) |
| TS errors len v IDE, nie v `pnpm typecheck` | IDE používa zlé TS verziu | Cmd-Shift-P → "TypeScript: Select Version" → Workspace |
| HMR reload neresetne state | Vite cache stale | `rm -rf apps/portal/.vite && pnpm dev` |
| Playwright failuje hneď | Browsers chýbajú | `pnpm exec playwright install --with-deps` |
| Turbo cache "out of sync" po pull | `.turbo/` zo starej vetvy | `rm -rf .turbo` + `pnpm install` + `pnpm build` |

## Otvorené závislosti

- `[04-architecture]` BFF rozhodnutie + dev port — `[resolved-in-round-2]`. BFF na `:5174`, workspace na `:5175`. Vite proxy `/api/*` → BFF. MSW Node v BFF procese serve-uje CA SDM upstream mocky.
- `[04-architecture]` Multi-tenancy header — `[resolved-in-round-2]`. **`X-CA-SDM-Tenant`** per 04 ADR-11.
- `[06-tech-stack-selector]` React 19 + Vite 6 — `[resolved-in-round-2]`. 06 r1 potvrdený.
- `[07-design-system]` Storybook port (`:6006`) nie je v port mape — design-system samostatne nemá dev server v MVP. Ak 07 r2 pridá Storybook ako dev nástroj, doplníme port.
- `[09-qa-test-strategy]` Playwright `:9323` (UI mode) + `:9333` (CDP debug) — `[resolved-in-round-2]`. Z 09 r1 `test-strategy.md` (Playwright canonical).
- `[?]` BFF session store v dev — default `in-memory` (žiadny Redis dependency). Pre HA dev (multi-laptop debugging) pridáme `redis://localhost:6379` cez `docker-compose.dev.yml` (opt-in).
