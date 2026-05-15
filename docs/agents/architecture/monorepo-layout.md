# Monorepo layout — SDM-Rewrite

> Finálna repo štruktúra. Rozšírenie GOAL §9 (počiatočný náčrt). Implementácia
> a build orchestration: pnpm workspaces + Turborepo (ADR-02). Hranice
> packages a kto čo importuje: `boundaries.md`.

## 1. Strom adresárov

```
sdm-rewrite/
├── apps/
│   ├── portal/                      # Self-service SPA (Lucia)
│   │   ├── src/
│   │   │   ├── main.tsx             # entry (alebo .ts pre Vue/iný)
│   │   │   ├── App.tsx              # App Shell
│   │   │   ├── bootstrap/           # config fetch, i18n init, session
│   │   │   ├── routes.ts            # central route registry (ADR-05)
│   │   │   ├── features/            # feature moduly per route
│   │   │   │   ├── home/
│   │   │   │   ├── new-incident/
│   │   │   │   ├── catalog/
│   │   │   │   ├── ticket-detail/
│   │   │   │   ├── kb-search/
│   │   │   │   ├── my-tickets/
│   │   │   │   ├── notifications/
│   │   │   │   └── profile/
│   │   │   ├── shell/               # top bar, error boundary, layouts
│   │   │   └── styles/              # global CSS reset, app-level vars
│   │   ├── public/                  # index.html, static assets
│   │   ├── tests/                   # unit + integration testy (Vitest)
│   │   ├── vite.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── workspace/                   # Agent / specialist SPA (Anna, Marek, ...)
│   │   ├── src/
│   │   │   ├── main.tsx
│   │   │   ├── App.tsx
│   │   │   ├── bootstrap/
│   │   │   ├── routes.ts
│   │   │   ├── features/
│   │   │   │   ├── queue/
│   │   │   │   ├── ticket-detail/
│   │   │   │   ├── problems/
│   │   │   │   ├── changes/
│   │   │   │   ├── change-calendar/
│   │   │   │   ├── kb-editor/
│   │   │   │   ├── kb-browse/
│   │   │   │   ├── cmdb/
│   │   │   │   ├── reports/
│   │   │   │   ├── settings/
│   │   │   │   └── command-palette/
│   │   │   ├── shell/
│   │   │   ├── hot-keys/            # HotKeyContext + cheat sheet
│   │   │   └── styles/
│   │   ├── public/
│   │   ├── tests/
│   │   ├── vite.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── bff/                         # Backend for Frontend (ADR-01)
│       ├── src/
│       │   ├── index.ts             # entry, HTTP gateway, graceful shutdown
│       │   ├── config/              # config.json loader + watcher
│       │   ├── auth/                # SSO callback, session, access key broker
│       │   ├── api/                 # REST proxy, SOAP adapter, error shaper
│       │   ├── aggregator/          # /me/tenants, queue, ticket-detail
│       │   ├── platform/            # health, audit logger, /config endpoint
│       │   ├── session-store/       # in-memory + Redis adapter
│       │   └── types.ts             # shared BFF types
│       ├── tests/
│       ├── tsconfig.json
│       └── package.json
│
├── packages/
│   ├── api-client/                  # @sdm/api-client
│   │   ├── src/
│   │   │   ├── index.ts             # public API
│   │   │   ├── http.ts              # fetch wrapper, X-Correlation-ID, X-Tenant
│   │   │   ├── endpoints/           # typed endpoints (per resource)
│   │   │   └── errors.ts            # AppError throw helper
│   │   ├── tests/
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── api-types/                   # @sdm/api-types — re-export z domain
│   │   ├── src/
│   │   │   └── index.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── domain/                      # @sdm/domain
│   │   ├── src/
│   │   │   ├── model.ts             # canonical types (entities, lifecycles)
│   │   │   ├── lifecycles/          # state machines per entity
│   │   │   ├── permissions/         # RoleCode → Permission[] mapping
│   │   │   ├── validators/          # pure validation functions
│   │   │   ├── forms/               # DynamicFormSchema (ADR-06)
│   │   │   └── computed/            # derived selectors (UI views)
│   │   ├── tests/
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── design-system/               # @sdm/design-system
│   │   ├── src/
│   │   │   ├── tokens/              # CSS custom properties (light + dark)
│   │   │   ├── primitives/          # Button, Input, Select, Modal, ...
│   │   │   ├── composites/          # DataTable, TenantSwitcher, Toast, ...
│   │   │   ├── forms/               # JsonSchemaForm renderer (ADR-06)
│   │   │   ├── icons/               # Lucide ekv. wrapped
│   │   │   └── index.ts
│   │   ├── tests/
│   │   ├── stories/                 # Storybook (DevOps configures host)
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── auth/                        # @sdm/auth
│   │   ├── src/
│   │   │   ├── session.ts           # session refresh hook
│   │   │   ├── role-guard.tsx       # <Can permission="..."> + RouteGuard
│   │   │   ├── login.ts             # redirect helpers
│   │   │   └── preferences.ts       # typed localStorage wrapper
│   │   ├── tests/
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── i18n/                        # @sdm/i18n (ADR-07)
│   │   ├── src/
│   │   │   ├── provider.tsx
│   │   │   ├── hook.ts
│   │   │   ├── format.ts            # date / number / relative formatters
│   │   │   └── dynamic.ts           # backend-provided label adapter
│   │   ├── catalogs/
│   │   │   ├── portal/
│   │   │   │   ├── sk.json
│   │   │   │   └── en.json
│   │   │   ├── workspace/
│   │   │   │   ├── sk.json
│   │   │   │   └── en.json
│   │   │   └── shared/
│   │   │       ├── sk.json
│   │   │       └── en.json
│   │   ├── tests/
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── utils/                       # @sdm/utils
│       ├── src/
│       │   ├── date.ts
│       │   ├── string.ts
│       │   ├── object.ts
│       │   ├── result.ts            # Result<T, E> helper
│       │   └── index.ts
│       ├── tests/
│       ├── tsconfig.json
│       └── package.json
│
├── docs/
│   ├── ca-service-management-17-4.pdf      # zdrojová dokumentácia
│   └── agents/                              # výstupy agentov (§7 GOAL)
│       ├── api-analyst/
│       ├── ux-persona-analyst/
│       ├── domain-modeller/
│       ├── architecture/                    # tento agent
│       ├── security/
│       ├── tech-stack-selector/
│       ├── design-system/
│       ├── devex-devops/
│       ├── qa-test-strategy/
│       └── documentation-author/            # post-konvergencia
│
├── tools/                                   # shared tooling
│   ├── eslint-config/                       # @sdm/eslint-config
│   ├── tsconfig-base/                       # @sdm/tsconfig
│   ├── i18n-check/                          # CI script — catalog parity
│   ├── boundaries-check/                    # CI — import boundaries
│   └── scaffold/                            # plop / degit templates
│
├── .agents/                                 # agent definitions + state
│   ├── 00-project-manager/
│   ├── 01-api-analyst/
│   ├── ...
│   ├── pipeline.yaml
│   └── README.md
│
├── .github/
│   └── workflows/
│       ├── ci.yml                           # lint, typecheck, test, build
│       ├── preview.yml                      # PR preview deploy (post-MVP)
│       └── release.yml
│
├── GOAL.md
├── README.md
├── pnpm-workspace.yaml
├── turbo.json                               # Turborepo task graph
├── package.json                             # root scripts
├── tsconfig.json                            # base TS config (refs apps + packages)
├── .gitignore
├── .editorconfig
└── .nvmrc                                   # Node version pin
```

## 2. Per-dir vysvetlenie

### `apps/`

Deployable artefakty. Tri appy:
- `portal/`, `workspace/` — frontend SPA, build → static assets.
- `bff/` — server proces, build → Node.js bundle (alebo container).

Žiadne ďalšie appy. Príkladné `apps/admin/` či `apps/docs-site/` v MVP nie sú.

### `packages/`

Reusable knižnice. Každý package:
- má `package.json` s `"main": "./src/index.ts"` (TypeScript přimo cez
  consumer-side compile, žiadny build step pre packages — Vite a BFF tsx
  zvládajú TS source);
- má `tsconfig.json` extending `tools/tsconfig-base`;
- vystavuje **jeden public API** cez `src/index.ts`.

**Žiadne re-export medzi packages** mimo declared dependencies. ESLint
boundaries rule (post-MVP) vynúti.

### `docs/`

- `ca-service-management-17-4.pdf` — zdroj pre 01 API Analyst.
- `agents/<name>/` — výstupy 10 agentov.
- Post-konvergencia: `docs/spec/<modul>.md` produkuje 10 Documentation Author.

### `tools/`

Build-tooling helpery — neuvádzajú sa v `apps` runtime dependencies.

### `.agents/`

Agent definície (subagent prompty per role) + run state. Spravuje 00 PM.

### `.github/`

CI/CD. Detail vlastní DevOps agent (08).

## 3. Workspace declarations

### `pnpm-workspace.yaml`
```yaml
packages:
  - "apps/*"
  - "packages/*"
  - "tools/*"
```

### `turbo.json`
```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"]
    },
    "lint": {},
    "typecheck": {
      "dependsOn": ["^build"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

### `package.json` (root)
```json
{
  "name": "sdm-rewrite",
  "private": true,
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "i18n:check": "node tools/i18n-check/index.js",
    "boundaries:check": "node tools/boundaries-check/index.js"
  },
  "packageManager": "pnpm@9.x"
}
```

## 4. Naming conventions

| Element | Konvencia | Príklad |
|---|---|---|
| Package name | `@sdm/<kebab-case>` | `@sdm/api-client` |
| Dir name | `kebab-case` | `apps/workspace/src/features/change-calendar/` |
| TS file name | `kebab-case.ts` | `ticket-detail-page.tsx` |
| TS type | `PascalCase` | `Incident`, `UiQueueItem` |
| TS variable / function | `camelCase` | `useTicketDetail()` |
| Constant | `SCREAMING_SNAKE_CASE` | `MAX_ATTACHMENT_MB` |
| Test file | `*.test.ts` | `incident-state-machine.test.ts` |
| Storybook | `*.stories.tsx` | `tenant-switcher.stories.tsx` |

## 5. TS config strategy

`tools/tsconfig-base/tsconfig.json` (extended from):
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "lib": ["ES2020", "DOM", "DOM.Iterable"]
  }
}
```

Each `tsconfig.json` v package extends a pridáva `references` na deps:
```json
{
  "extends": "../../tools/tsconfig-base/tsconfig.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "include": ["src"],
  "references": [
    { "path": "../domain" },
    { "path": "../utils" }
  ]
}
```

Project references umožňujú `tsc --build` v topological order.

## Otvorené závislosti

| # | Flag | Smer | Popis |
|---|---|---|---|
| 1 | `package-build-step` | → 06-tech-stack-selector, 08-devex-devops | Či packages publish TS source (žiadny build step) alebo build do `dist/`. MVP: TS source. v1 evaluate. |
| 2 | `framework-specific-suffix` | → 06-tech-stack-selector | `.tsx` vs. `.vue` vs. iné. Tento dokument predpokladá React (`.tsx`); ak Vue, dir layout zostáva. |
| 3 | `mobile-emergency-shared-code` | → 04-architecture (vyriešené tu) | P-12 mobile approve sa routuje do `apps/workspace`. UX/`screen-inventory.md` poznámka. |
| 4 | `storybook-host` | → 07-design-system, 08-devex-devops | Storybook beží v `packages/design-system/stories/` — či sa hostuje (Chromatic / vlastný). |
| 5 | `eslint-boundaries-rule` | → 08-devex-devops | `tools/boundaries-check/` v MVP je jednoduchý script; v1 plný ESLint plugin. |
