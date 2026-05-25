# SDM-Rewrite — Developer Handbook

> Vývojárska príručka: od špecifikácie k implementácii. Pre vývojárov, ktorí
> prispievajú do repa. Pre vyššiu úroveň (čo systém robí a prečo) pozri
> [`docs/system-overview.md`](system-overview.md).
> Status: round 2 (post-konvergencia).

## TOC

1. Repo layout
2. Coding conventions
3. Ako pridať nový feature — krok-za-krokom
4. Test strategy
5. CI/CD
6. ADR index
7. Riešenie typických problémov (FAQ)
8. Otvorené závislosti

## 1. Repo layout

```
sdm-rewrite/
├── apps/
│   ├── portal/                # Self-service SPA (Lucia)
│   ├── workspace/             # Agent / specialist SPA (Anna, Marek, ...)
│   └── bff/                   # Backend for Frontend (Hono 4 + Node 22)
├── packages/
│   ├── api-client/            # @sdm/api-client — typovaný klient
│   ├── api-types/             # @sdm/api-types — typy z domain
│   ├── api-mocks/             # @sdm/api-mocks — MSW handlers + faktória
│   ├── domain/                # @sdm/domain — entity, state machines, validátory
│   ├── design-system/         # @sdm/design-system — tokens + components
│   ├── auth/                  # @sdm/auth — session refresh, role guards
│   ├── i18n/                  # @sdm/i18n — react-i18next + ICU
│   └── utils/                 # @sdm/utils — pure utility
├── docs/
│   ├── ca-service-management-17-4.pdf    # CA SDM dokumentácia
│   ├── agents/                            # výstupy 9 analytických agentov
│   ├── spec/                              # per-modul konsolidované specs
│   ├── system-overview.md
│   ├── dev-handbook.md                    # tento súbor
│   └── onboarding.md
├── tools/                     # build tooling
├── .agents/                   # agent prompty + run state
├── .github/workflows/         # CI/CD
├── GOAL.md
├── README.md
├── pnpm-workspace.yaml
├── turbo.json
├── package.json
├── tsconfig.json              # base, refs apps + packages
└── .nvmrc                     # Node version pin
```

Detail per directory:
[`docs/agents/architecture/monorepo-layout.md`](agents/architecture/monorepo-layout.md).

### 1.1 Package boundaries

Žiadne cyklické závislosti, žiadne implicitné re-exporty. ESLint boundaries
rule (post-MVP) vynúti. MVP: jednoduchý script v `tools/boundaries-check/`.

Závislosti (allowed imports):

| Konzument | Smie importovať z |
|---|---|
| `apps/portal`, `apps/workspace` | `@sdm/*` packages |
| `apps/bff` | `@sdm/api-client`, `@sdm/api-types`, `@sdm/domain`, `@sdm/utils`, `@sdm/i18n` (pre error msg lokalizáciu) |
| `@sdm/api-client` | `@sdm/api-types`, `@sdm/utils` |
| `@sdm/domain` | `@sdm/utils`, `@sdm/api-types` |
| `@sdm/design-system` | `@sdm/utils`, `@sdm/i18n` |
| `@sdm/auth` | `@sdm/api-client`, `@sdm/domain`, `@sdm/utils` |

### 1.2 Naming conventions

| Element | Konvencia | Príklad |
|---|---|---|
| Package | `@sdm/<kebab-case>` | `@sdm/api-client` |
| Dir | `kebab-case` | `apps/workspace/src/features/change-calendar/` |
| TS file | `kebab-case.ts` | `ticket-detail-page.tsx` |
| TS type | `PascalCase` | `Incident`, `UiQueueItem` |
| TS variable / function | `camelCase` | `useTicketDetail()` |
| Constant | `SCREAMING_SNAKE_CASE` | `MAX_ATTACHMENT_MB` |
| Test file | `*.test.ts` / `*.itest.ts` / `*.ctest.ts` | `incident-state-machine.test.ts` |
| Storybook | `*.stories.tsx` | `tenant-switcher.stories.tsx` |

## 2. Coding conventions

### 2.1 TypeScript

`tools/tsconfig-base/tsconfig.json`:

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

Pravidlá:

- **Žiaden `any`** mimo lokálnych `*.d.ts` augmentation files (pre Cytoscape /
  FullCalendar incomplete types). Pri `unknown` použiť type guard alebo Zod parse.
- **Branded types** pre `TenantId`, `UserId`, `IncidentId`, ... (anti-collision).
- **Discriminated unions** pre stavy entít a varianty (`CiClass`).
- **Result type** (`Result<T, E>` v `@sdm/utils`) pre operácie, ktoré môžu zlyhať
  bez throw.

### 2.2 React

- **Funkčné komponenty** s hooks. Žiadne class komponenty.
- **Local state** v komponentoch (`useState` / `useReducer`). Žiadny globálny
  store (Redux / Zustand) — server-state v TanStack Query.
- **Memoizácia** (`useMemo` / `useCallback`) iba ak je preukázateľný perf
  problém. Default: render naivne.
- **Suspense** boundaries v App Shell + per route.
- **Error boundaries** per app + per kritickú feature.

### 2.3 Styling

- **CSS Custom Properties** (žiadny Tailwind, žiadne CSS-in-JS).
- **Tokens** v `@sdm/design-system/src/tokens/` (light + dark themes).
- **CSS Modules** pre komponent-specific štýly.
- Žiadne hard-coded hex / px hodnoty mimo tokens.

### 2.4 Testing

- **Test name format**: `it("<aktér> <robí> <očakávanie>")`. Slovenčina v
  `describe`, angličtina v `it` (grep cez tagy).
- **Deterministická faktória** (`@faker-js/faker` so seed=42).
- **Žiadne live API calls** v CI — iba MSW.
- **Žiadne random UUID** mimo seeded RNG.

### 2.5 Error handling

- **Fail fast** — `throw new AppError(code, message)` na hraniciach BFF.
- **Typed errors** — `AppError` taxonomy v `@sdm/api-client/errors.ts`.
- **Žiadne silent catches** — každý `catch` musí buď re-throw, alebo logovať +
  user-facing fallback.
- BFF error shape: per ADR-08 jednotná `{ code, message, correlationId }`.

### 2.6 Komentáre a TODO

- **Komentáre vysvetľujú "prečo"**, nie "čo". Self-documenting code preferovaný.
- **Žiadne `TODO:` komentáre** — vytvor issue alebo špec flag namiesto toho.
- **Žiadny commented-out code**.

## 3. Ako pridať nový feature — krok-za-krokom

Predpoklad: feature je definovaný v `docs/spec/<modul>.md` alebo v dohodnutom
PR plan. Ak nie, najprv konzultuj s product owner (PO).

### Krok 1 — Doménový model

Otvor `packages/domain/src/`:

1. Ak feature pridáva nové polia entity → uprav `model.ts` (PascalCase types).
2. Ak feature mení lifecycle → uprav `lifecycles/<entity>.ts` (state machine).
3. Pridaj unit testy pre **každý** nový stav a transition. Use fast-check pre
   property tests pri ≥ 5 stavoch.

```ts
// packages/domain/src/lifecycles/incident.test.ts
import { describe, it, expect } from "vitest";
import { fc } from "fast-check";
import { transition } from "./incident";

describe("Incident lifecycle", () => {
  it("OP → WIP requires assigneeId", () => {
    const result = transition({ status: "OP", assigneeId: null }, "assign");
    expect(result.ok).toBe(false);
  });
});
```

### Krok 2 — Typy a API client

1. Uprav `packages/api-types/src/index.ts` — re-export nových typov z `domain`.
2. Pridaj endpoint do `packages/api-client/src/endpoints/<modul>/`:

```ts
// packages/api-client/src/endpoints/incident.ts
import { z } from "zod";
import { http } from "../http";
import { incidentSchema } from "@sdm/api-types";

export const updateIncident = async (id: IncidentId, patch: Partial<Incident>) => {
  const response = await http.put(`/api/incidents/${id}`, patch);
  return incidentSchema.parse(response.data);
};
```

3. Pridaj contract test (`*.ctest.ts`) overujúci Zod schema vs. MSW handler.

### Krok 3 — BFF route

Ak feature je server-bound:

1. Pridaj route handler v `apps/bff/src/api/<modul>.ts`.
2. Implementuj tenant scope filter + audit logging.
3. Pridaj integration test (`*.itest.ts`) s `msw/node` mock CA SDM upstream.

```ts
// apps/bff/src/api/incidents.ts
app.put("/api/incidents/:id", csrfGuard, async (c) => {
  const tenantId = c.var.session.activeTenantId;
  const id = c.req.param("id");
  const patch = updateIncidentSchema.parse(await c.req.json());
  const result = await sdmClient.updateIncident(id, patch, {
    tenantFilter: tenantId,
    accessKey: c.var.session.accessKey,
  });
  c.var.audit({ event: "incident.update", id, tenantId, actor: c.var.session.userId });
  return c.json(result);
});
```

### Krok 4 — MSW handler

1. Pridaj handler do `packages/api-mocks/src/handlers/<modul>.ts` zodpovedajúci
   CA SDM REST response shape.
2. Použi faktóriu z `packages/api-mocks/src/factories/`:

```ts
import { http, HttpResponse } from "msw";
import { makeIncident } from "../factories/incident";

export const incidentHandlers = [
  http.put("/caisd-rest/in/:id", async ({ params, request }) => {
    const patch = await request.json();
    const updated = { ...makeIncident({ id: params.id }), ...patch };
    return HttpResponse.json(updated, { status: 200 });
  }),
];
```

### Krok 5 — UI komponent

1. Ak chýba komponent v Design Systeme → pridaj do `packages/design-system/src/`.
   Storybook story (`*.stories.tsx`) je povinný.
2. Feature komponent v `apps/<app>/src/features/<modul>/`.
3. Použi `Can` wrapper pre permission-guarded UI:

```tsx
<Can permission="incident.transition.status">
  <Button variant="primary" onClick={onClose}>Zavrieť ticket</Button>
</Can>
```

4. Pridaj integration test (`*.itest.tsx`) s MSW.

### Krok 6 — i18n catalogs

Pridaj všetky nové reťazce do `packages/i18n/catalogs/<app>/{sk,en}.json`.
ICU MessageFormat pre pluralizáciu.

CI gate: `pnpm i18n:check` validuje, že SK a EN majú identické kľúče.

### Krok 7 — RBAC permission key (ak treba)

Ak feature pridáva novú permission:

1. Pridaj kľúč do `packages/domain/src/permissions/index.ts` (`Permission`
   union type).
2. Uprav `RoleCode → Permission[]` mapping v `permissions/mapping.ts`.
3. Pridaj do `docs/agents/security/rbac.md` §6.x.

### Krok 8 — E2E (ak feature je v master journey mappingu)

Pridaj alebo aktualizuj `e2e/<modul>/<journey-id>.spec.ts` s povinnými tagmi:
`@scenario:<id> @persona:<persona> @module:<modul>`.

### Krok 9 — Audit + observability

Každá mutácia → audit event do BFF JSON log (pino). Per
[`docs/agents/security/audit-and-compliance.md`](agents/security/audit-and-compliance.md).

### Krok 10 — Pull request

```bash
git checkout -b feat/<modul>-<short-description>
# implementácia
pnpm lint && pnpm typecheck && pnpm test
git commit -m "feat(<modul>): <description>"
git push -u origin feat/<modul>-<short-description>
gh pr create --title "feat(<modul>): <description>" --body "..."
```

Required status checks musia byť zelené (lint, typecheck, test, coverage, build,
a11y, security-audit). Aspoň 1 review approval.

## 3a. Local dev modes — MSW vs BFF

SDM-Rewrite SPAs (`portal`, `workspace`) run in **two** local dev modes. The
switch is the `VITE_USE_MOCKS` env var read by `main.tsx`. Both modes consume
the canonical `/me` §4.5 shape so the runtime code is identical — the only
difference is who answers `/api/*`, `/auth/*`, `/me`, `/config`.

### Mode A: `VITE_USE_MOCKS=true` (default, no BFF needed)

```
pnpm --filter @sdm/portal dev       # http://localhost:5173
pnpm --filter @sdm/workspace dev    # http://localhost:5175
```

`@sdm/api-mocks` MSW worker starts in the browser and intercepts every
backend call. `/me` auto-returns the seeded default user (`anna.analyst`,
`agent_l1` in both ACME + Globex per `packages/api-mocks/src/fixtures/users.ts`).
No login is required — the SPA lands on the home page.

### Mode B: `VITE_USE_MOCKS=false` (live BFF)

```
pnpm --filter @sdm/bff dev          # http://localhost:5174
VITE_USE_MOCKS=false pnpm --filter @sdm/portal dev
VITE_USE_MOCKS=false pnpm --filter @sdm/workspace dev
```

The Vite dev server proxies `/api`, `/auth`, `/me` to the BFF (`server.proxy`
in `apps/{portal,workspace}/vite.config.ts`), so the browser sees same-origin
calls and the BFF cookie sticks. The BFF talks to real CA SDM at the configured
upstream (default `10.11.35.35:8050` per `[01-api-analyst]` discovery).

In Mode B the SPA shows the **login form** until `/auth/login` succeeds —
credentials are validated against CA SDM `POST /caisd-rest/rest_access` (F.1).

### CSRF — `BFF_TRUSTED_ORIGINS`

BFF protects mutating routes with an Origin / Referer check
(`apps/bff/src/security/csrf.ts`) per F.1 baseline — no double-submit token,
no `X-CSRF-Token` on the wire. The browser attaches `Origin` automatically on
cross-origin fetches; for same-origin (via Vite proxy in dev, or single-host
in prod) the BFF allows the request unconditionally.

Configure `BFF_TRUSTED_ORIGINS` to the set of origins the BFF will accept on
same-origin requests where Origin is absent (typically GET → mutating
preflight). In Vite-proxy dev the proxy sets `changeOrigin: true`, so the BFF
sees its own origin (`http://localhost:5174`); no extra config needed. In
production deploys with separate FE/BFF hostnames, list both:

```
# .env.bff (dev)
BFF_TRUSTED_ORIGINS=http://localhost:5174,http://localhost:5173,http://localhost:5175

# .env.bff (prod single-host)
BFF_TRUSTED_ORIGINS=https://sdm.example.org

# .env.bff (prod split-host)
BFF_TRUSTED_ORIGINS=https://sdm.example.org,https://portal.example.org,https://workspace.example.org
```

### Live BFF smoke tests

`tools/browser-test/scenarios/smoke-bff-{portal,workspace}.spec.ts` exercise
the login → /me → logout cycle against a real BFF. They self-skip unless
`SDM_BFF_SMOKE_USER` and `SDM_BFF_SMOKE_PASS` are set. Credentials never live
in the repo — pass them via env at run time. See
[`docs/agents/devex-devops/failover.md`](agents/devex-devops/failover.md) for
the BFF restart / re-login behaviour these tests cover.

## 4. Test strategy

Pyramída 75 / 20 / 5 (unit / contract+integration / e2e):

| Layer | Scope | Runner | Lokácia |
|---|---|---|---|
| **Unit (pure)** | Funkcie, validátory, formatters, BFF utils | Vitest (node) | `packages/<pkg>/src/**/*.test.ts` |
| **Unit (state machine)** | Lifecycles z 03 + fast-check property tests | Vitest + fast-check | `packages/domain/src/lifecycles/*.test.ts` |
| **Unit (hooks / utils)** | React hooks, formatters | Vitest + Testing Library (jsdom) | `apps/<app>/src/**/*.test.ts` |
| **Component (UI)** | Design system + feature komponenty | Vitest + Testing Library + vitest-axe | `packages/design-system/src/**/*.test.tsx` |
| **Integration (per app)** | Feature → TanStack Query → api-client → MSW | Vitest + msw/node | `apps/<app>/src/features/<modul>/__tests__/*.itest.tsx` |
| **Integration (BFF)** | Route handler → session → tenant scope → REST proxy → MSW CA SDM | Vitest (node) + msw/node | `apps/bff/src/routes/**/*.itest.ts` |
| **Contract** | api-client ↔ MSW handler vs. Zod schema | Vitest + msw/node + zod | `packages/api-client/src/**/__contracts__/*.ctest.ts` |
| **E2E** | Kritické journeys cez Playwright | Playwright | `e2e/<modul>/*.spec.ts` |
| **a11y** | axe-core v komponentoch + E2E | Vitest-axe + @axe-core/playwright | per-component + `e2e/**/*.spec.ts` |
| **Performance** | Lighthouse CI v PR (4 stránky) + nightly (17) | @lhci/cli | `lighthouserc.json` |

Coverage thresholds per package (per
[`docs/agents/qa-test-strategy/coverage-targets.md`](agents/qa-test-strategy/coverage-targets.md)):

| Package | Line | Branch |
|---|---|---|
| `packages/domain` | 90 % | 85 % |
| `packages/api-client` | 80 % | 70 % |
| `packages/design-system` | 75 % | 65 % |
| `packages/auth` | 85 % | 75 % |
| `packages/api-mocks` | 70 % | 60 % |
| `apps/portal` | 60 % | 50 % |
| `apps/workspace` | 60 % | 50 % |
| `apps/bff` | 80 % | 70 % |

`pnpm test -- --coverage` lokálne; CI skript `tools/coverage/check-thresholds.ts`
blokuje merge pri zlyhaní.

a11y severity policy:

| Severity | Block merge |
|---|---|
| `critical`, `serious` | YES |
| `moderate` | warning, block po 7 dňoch |
| `minor` | warning only |

Detail: [`docs/agents/qa-test-strategy/test-strategy.md`](agents/qa-test-strategy/test-strategy.md) a [`docs/agents/qa-test-strategy/a11y-tests.md`](agents/qa-test-strategy/a11y-tests.md).

## 5. CI/CD

GitHub Actions pipeline (`.github/workflows/ci.yml`):

| Job | Trigger | Blokuje merge |
|---|---|---|
| `install` | každé spustenie | yes |
| `lint + format` | po install | yes |
| `typecheck` | po install | yes |
| `test (unit + component)` | po install | yes |
| `coverage thresholds` | po test | yes |
| `build all` | po lint+typecheck+test | yes |
| `e2e (Playwright)` | po build | warning only (flaky-tolerant) |
| `a11y (axe-core)` | po build | yes |
| `lighthouse-ci` | po build | warning only (rolling baseline post-MVP) |
| `security-audit` | po install | yes |

Target end-to-end PR pipeline: **< 10 min** typicky (s Turborepo cache hit < 6 min).

Detail: [`docs/agents/devex-devops/ci-cd.md`](agents/devex-devops/ci-cd.md).

## 6. ADR index

Žije v `docs/agents/architecture/decision-records/`. Status all `accepted`
(post-konvergencia round 2).

| ADR | Téma | Rozhodnutie |
|---|---|---|
| [01](agents/architecture/decision-records/01-bff.md) | BFF + technológia | **Hono 4 + Node 22 LTS + TypeScript 5.7 strict**. BFF je v MVP. |
| [02](agents/architecture/decision-records/02-monorepo-tool.md) | Monorepo tool | **pnpm 9 workspaces + Turborepo**. |
| [03](agents/architecture/decision-records/03-data-fetching.md) | Data fetching | **TanStack Query v5**. |
| [04](agents/architecture/decision-records/04-state-management.md) | State management | **Server-state v TanStack Query**, **client-state lokálne**. Žiadny globálny store. |
| [05](agents/architecture/decision-records/05-routing.md) | Routing | **React Router v6 data router**. Route-level code-splitting povinný. |
| [06](agents/architecture/decision-records/06-dynamic-forms.md) | Dynamic forms (Service Catalog) | **JSON-schema-driven + RHF 7 + Zod 3**. |
| [07](agents/architecture/decision-records/07-i18n.md) | i18n | **i18next + react-i18next + ICU plugin**. SK default, EN switch. |
| [08](agents/architecture/decision-records/08-error-handling.md) | Error boundary + globálne errors | **Per-app error boundary** + typovaná `AppError` taxonomy. |
| [09](agents/architecture/decision-records/09-observability.md) | Observability | **Sentry React** (FE) + **pino 9 JSON stdout** (BFF). |
| [10](agents/architecture/decision-records/10-build-pipeline.md) | Build pipeline | **Vite 5/6** pre obe SPA. BFF bez bundleru (`tsc --build`, `tsx` watch). |
| [11](agents/architecture/decision-records/11-multi-tenancy.md) | Multi-tenancy | **Server-side activeTenant v BFF session** + `X-CA-SDM-Tenant` header + defensive WC filter. |
| [12](agents/architecture/decision-records/12-runtime-config.md) | Runtime config | **`/config` endpoint** + fallback `window.__SDM_CONFIG__`. Žiadne build-time hardcoding API endpointu. |

## 7. Riešenie typických problémov (FAQ)

### "Tenant switch funguje v jednom tabe, ale druhý tab vidí staré dáta"

BroadcastChannel API funguje len v rámci jedného browseru/origin. Skontroluj:

1. `__Host-sdm.tenantVer` cookie sa rotuje pri switch (BFF zvyšuje, SPA polluje
   každé 2 s).
2. SPA má `useTenantVersionPoll()` hook aktivovaný v `AppShell`.
3. Iný browser (Safari iOS < 15.4) môže mať obmedzený BroadcastChannel — preto
   cookie fallback.

Detail: [`docs/agents/security/auth-flow.md`](agents/security/auth-flow.md) §2.6.

### "PUT request vracia 409 TENANT_MISMATCH"

FE poslal `X-CA-SDM-Tenant: T1`, ale BFF session má `activeTenantId: T2`
(napr. user prepol v inom tabe). Klient (api-client interceptor) má auto-handler:
parse `correctTenantId` z response body, refresh `/me`, retry pôvodný request.
Detail: [`docs/agents/architecture/decision-records/11-multi-tenancy.md`](agents/architecture/decision-records/11-multi-tenancy.md).

### "Test je flaky"

Per [`docs/agents/qa-test-strategy/flaky-policy.md`](agents/qa-test-strategy/flaky-policy.md):

1. **Žiadne retry** na unit testoch. Ak flake → fix root cause.
2. Playwright E2E môže mať max 1 retry per spec (configured globally).
3. Flaky test sa označí `@flaky` tagom — CI ho neblokuje, ale issue sa tracknuje.
4. 3 flaky výskyty / týždeň → quarantine (skip + issue).

### "Bundle size na portáli prekročil budget"

Per `size-limit.config.js`: portal initial JS ≤ 180 kB, CSS ≤ 30 kB.

1. Skontroluj `pnpm exec size-limit --why` (bundle analyzer).
2. Lazy-loadni heavy libs (TipTap, FullCalendar, Cytoscape) — žije iba na
   workspace routách.
3. Tree-shake unused i18n locales (`react-i18next` ICU plugin podporuje
   dynamic import).
4. Eliminuj duplicitné imports (`pnpm dedupe`).

### "Coverage threshold padol pre `packages/domain`"

Domain musí byť 90 / 85. Skontroluj:

1. `pnpm --filter @sdm/domain test --coverage` lokálne.
2. Nové funkcie v `lifecycles/` musia mať fast-check property tests
   (≥ 200 iterations).
3. Pridaj test pre `invalid transitions blocked` (negative case).

### "Cytoscape graph ma 200+ uzlov a brzdí"

Per `RelationshipGraph.maxNodes=200` prop — UI auto-cluster po dosiahnutí.
Ak business case vyžaduje viac, zvýš `maxNodes`, ale rátaj s perf penalty.
Alternative: filter by `directionFilter` alebo `relationType`.

### "PR pipeline je pomalá (> 15 min)"

1. Skontroluj Turborepo cache hit rate (`pnpm build --summarize`).
2. Playwright browser cache musí byť hot v CI (`actions/cache@v4` na
   `~/.cache/ms-playwright`).
3. Vidíš ne-cached `pnpm install`? Cache key musí byť `pnpm-lock.yaml` hash.

## Otvorené závislosti

Žiadne. Artefakt je samonosný.
