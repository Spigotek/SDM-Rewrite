# Dev environment — one-command local setup

> Cieľ: vývojár spustí **`pnpm dev`** a má zelený stack — portál na `:5173`,
> workspace na `:5174`, MSW mock backend aktívny, hot reload funguje. Bez Docker.
> Bez živej CA SDM inštancie.

## Mapa portov

| Port | Služba | URL | Účel |
|---|---|---|---|
| 5173 | `apps/portal` (Vite) | http://localhost:5173 | Self-service SPA |
| 5174 | `apps/workspace` (Vite) | http://localhost:5174 | Agent workspace SPA |
| 5175 | Vitest UI (voliteľné) | http://localhost:5175 | `pnpm test --ui` |
| 9323 | Playwright UI mode | http://localhost:9323 | `pnpm test:e2e --ui` |
| (none) | MSW worker | — | Service Worker v browseri, žiadny port |

Žiadny port mimo `:5173–:5175` a `:9323`. Žiadny BE proces lokálne — REST volania
zachytáva MSW worker priamo v browseri (alebo Node MSW server v Vitest behu).

## `pnpm dev` — čo robí

V koreňovom `package.json`:

```jsonc
"scripts": {
  "dev": "pnpm -r --parallel --filter './apps/portal' --filter './apps/workspace' dev"
}
```

Spúšťa **paralelne** Vite dev server v každom app workspace. pnpm spája stdout
a prefixuje názvom workspace, takže logy zostávajú čitateľné:

```
[portal]    VITE v6.0.3  ready in 412 ms
[portal]    ➜  Local:   http://localhost:5173/
[workspace] VITE v6.0.3  ready in 438 ms
[workspace] ➜  Local:   http://localhost:5174/
```

Ctrl-C zabije obidvoch potomkov.

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

`apps/workspace/package.json` identicky s portom 5174 (cez `vite.config.ts` →
`server.port`).

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

## Vite proxy — fallback bez MSW

Pre prípady `VITE_USE_MOCKS=false` + ukazovanie proti živej CA SDM inštancii:

```ts
// apps/portal/vite.config.ts
server: {
  proxy: env.VITE_USE_MOCKS === "true" ? undefined : {
    "/caisd-rest": {
      target: env.VITE_API_BASE_URL,     // napr. https://sdm-staging.example/
      changeOrigin: true,
      secure: false,                       // CA SDM staging má často self-signed cert
    },
  },
}
```

Tým si vývojár môže rýchlo prepnúť `VITE_USE_MOCKS=false` v `.env.local` (gitignored)
a debugovať voči konkrétnej staging inštancii bez kompilácie.

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

echo "==> [5/6] MSW worker bootstrap (idempotent)"
[ -f apps/portal/public/mockServiceWorker.js ] || \
  pnpm --filter @sdm/portal exec msw init public/ --save
[ -f apps/workspace/public/mockServiceWorker.js ] || \
  pnpm --filter @sdm/workspace exec msw init public/ --save

echo "==> [6/6] Playwright browsers (cached)"
pnpm exec playwright install chromium

echo ""
echo "Done. Next:"
echo "  pnpm dev          # start portal + workspace"
echo "  pnpm test         # run unit tests"
echo "  pnpm test:e2e     # run Playwright"
```

Spúšťa sa raz pre nového vývojára; opakované spustenie je no-op.

## CA SDM verzia "staging" — bridge config

Ak má vývojár prístup k živej CA SDM staging inštancii (po nasadení na server):

`.env.local`:

```env
VITE_USE_MOCKS=false
VITE_API_BASE_URL=https://sdm-staging.example.org
```

Vite proxy automaticky preroute `/caisd-rest/*` na túto inštanciu. CORS rieši
proxy (server-side), takže žiadny `Access-Control-*` problem v browseri.

## Troubleshooting

| Symptom | Pravdepodobná príčina | Riešenie |
|---|---|---|
| `pnpm dev` zlyhá s "port already in use" | Predošlý Vite dev nezomrel | `lsof -ti:5173,5174 \| xargs kill -9` |
| MSW handlery nefungujú, requesty padajú na 404 | Service Worker nie je registrovaný | DevTools → Application → Service Workers → Unregister; reload |
| `mockServiceWorker.js` 404 | `msw init` nebol spustený | `pnpm --filter @sdm/portal exec msw init public/ --save` |
| TS errors len v IDE, nie v `pnpm typecheck` | IDE používa zlé TS verziu | Cmd-Shift-P → "TypeScript: Select Version" → Workspace |
| HMR reload neresetne state | Vite cache stale | `rm -rf apps/portal/.vite && pnpm dev` |
| Playwright failuje hneď | Browsers chýbajú | `pnpm exec playwright install --with-deps` |

## Otvorené závislosti

- `[04-architecture]` BFF rozhodnutie ovplyvní dev environment. Ak Architecture rozhodne pre BFF (`apps/bff`), pribudne port `:5170` pre BFF dev server a Vite proxy v apps mieri na BFF, nie priamo na CA SDM. MSW handlery sa presunú do BFF dev mockov (rovnaké MSW knižnice, iný runtime — Node `msw/node` namiesto browser SW).
- `[06-tech-stack-selector]` Predpoklad React 19 + Vite 6. Ak Angular → `apps/portal` má `ng serve` + Angular CLI proxy config namiesto Vite, MSW sa nasadzuje cez `@angular/service-worker` hook.
- `[07-design-system]` Storybook port (`:6006`) nie je v port mape — design-system samostatne nemá dev server, ale ak 07 zvolí Storybook ako dokumentačný nástroj, pridá sa.
- `[09-qa-test-strategy]` Playwright `:9323` (UI mode) port je default; ak 09 zvolí iný E2E runner, port mapa sa zmení.
- `[?]` Multi-tenancy kontext v lokálnom dev — predpoklad fixture s 2 tenantmi (`acme-corp`, `globex`) v MSW data; reálna stratégia (header / cookie / route) je 04+05 vec. Po jej rozhodnutí MSW handlery dostanú parsovanie tenant kontextu.
