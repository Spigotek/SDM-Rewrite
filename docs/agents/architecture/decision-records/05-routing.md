# ADR-05 — Routing

**Status**: accepted (konkrétna knižnica finalizovaná v r2)
**Dátum**: 2026-05-15
**Autor**: 04-architecture agent (runId 20260508-192438, round 1+2)

## Changelog (round 2)

- 06 v `tech-stack-selector/libraries.md` zvolil **React Router v6 data router**.
- ADR aktualizovaný: knižnica `react-router-dom` v6 data router mode (nie legacy
  `<BrowserRouter>` API; `createBrowserRouter` + `RouterProvider`).
- Doplnený rationale + dôsledky pre `apps/*/src/routes/` štruktúru.
- Flag `routing-library` `[resolved-in-round-2]`.

## Kontext

Obe SPA majú netriviálny route inventory (UX/`screen-inventory.md`):
- Portal: 12 obrazoviek, 6 P0 / 4 P1 / 2 P2.
- Workspace: 20 obrazoviek, 6 P0 / 9 P1 / 5 P2.

Niektoré route-y sú entity-scoped (`/tickets/:id`, `/changes/:id`,
`/cmdb/ci/:id`), iné list / dashboard, niektoré modálne overlay-ové
(command palette `⌘K`, hot-key cheat sheet `?`).

Requirements:
- **Deep-link share-able URLs** (UX: `[04-architecture]` Routing stratégia
  v `screen-inventory.md` Otvorené závislosti).
- **Route-level code-splitting** (P9 performance budget).
- **Konzistencia s data-fetching** — route enter triggeruje prefetch dát
  pre danú page.
- **No SSR** — obe SPA sú client-rendered, runtime config z BFF.

GOAL §5 NFR — browsery posledné 2 verzie evergreens.

## Rozhodnutie

**Client-side routing s konfiguráciou (config-based, nie file-based).
Knižnica: `react-router-dom` v6 data router mode** (`createBrowserRouter` +
`RouterProvider` + per-route `loader` / `action` / `errorElement`).

Architekt-úroveň pravidlá:
1. **Routing config je centralizovaný** per app (`apps/portal/src/routes.ts`,
   `apps/workspace/src/routes.ts`) — nie file-based. Dôvody:
   - Explicitnosť: jeden zoznam = jeden zdroj pravdy.
   - Permission gating: každá route deklaruje required permission v config-u,
     `<RouteGuard>` komponent ich konzumuje.
   - Lazy import: `() => import('./features/queue/QueuePage')` per route.
2. **Žiadny SSR / no hydration**.
3. **Hash routing nie**. History API (clean URLs).
4. **Modal-only views NIE sú v route inventory** — command palette,
   cheat sheet, confirm dialogs sú prekryté nad route, nezachytávajú URL.
5. **Per-route prefetching** — pri route enter sa zavolá `loader()` funkcia
   (TanStack Query `prefetchQuery`), aby UI nevisel na waterfalle.
6. **Browser back/forward = TanStack Query refetch on stale**. Žiadne special
   handlers — natívne správanie funguje.

### Konkrétne API (React Router v6 data router)

```ts
// apps/portal/src/routes/index.ts
import { createBrowserRouter } from "react-router-dom";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    errorElement: <RootErrorBoundary />,
    loader: appShellLoader,           // /me, /config preloaded
    children: [
      {
        path: "tickets/:id",
        lazy: () => import("../features/tickets/TicketDetailRoute"),
        // RouteGuard wraps inside the lazy component
      },
      {
        path: "queue",
        lazy: () => import("../features/queue/QueueRoute"),
      },
      // ...
    ],
  },
]);
```

**Štruktúra `apps/<app>/src/routes/`**:
```
apps/portal/src/
├── routes/
│   ├── index.ts              # createBrowserRouter export
│   ├── guards.ts             # <RouteGuard requires={["..."]}> + loader helpers
│   └── error-boundaries.tsx  # RootErrorBoundary, NotFoundElement
├── features/
│   ├── tickets/
│   │   ├── TicketDetailRoute.tsx   # default export: { Component, loader, action }
│   │   └── ...
│   └── ...
```

**Lazy route convention**: každý feature route file exportuje
`{ Component, loader?, action?, ErrorBoundary? }`. React Router v6 data router
`lazy:` import to očakáva nativne. Loader spustí `queryClient.ensureQueryData()`
pre primary data → žiadny waterfall pri prvom paint route.

### 06 rationale (od Tech Stack agenta — pre úplnosť)

06 zamietol TanStack Router pre menšiu komunitu + chýbajúci data router
mode v stable verzii (v MVP horizonte). React Router v6 data router je
de-facto štandard 2024+ s explicit `loader` / `action` / `errorElement`
API, ktoré zapadá do nášho per-route prefetching pravidla.

## Dôsledky

**Pozitívne**:
1. **Explicit route registry** — onboarding developer si jedným pohľadom
   pozrie všetky routes, ich permissions, lazy bundles.
2. **Lazy chunks** — heavy moduly (KB editor, change calendar, CMDB graph)
   nezaťažujú initial bundle.
3. **Permission gating na route level** — `<RouteGuard requires={["INCIDENT_MODIFY"]}>`
   pred render-om route. Žiadny flash unauthorized content.
4. **Deep-link share** — Anna pošle Marekovi URL `/tickets/INC-1042` v Slacku,
   funguje aj keď Marek otvorí v novom tabe.

**Negatívne**:
1. **Manuálna údržba route config** — pridať novú page = pridať route entry.
   Mitigácia: code-gen generator v `tools/` (post-MVP nice-to-have).
2. **Knižnica-specific koncepty** (loaders v React Router, file-routes v
   TanStack Router) sú abstrahované za `routes.ts` config, ale tím musí
   poznať konkrétny dialect.

## Alternatívy

### A) File-based routing (Next.js / Nuxt / Remix style)

**Prečo zamietnuté pre MVP**:
- Pekná DX, ale konkrétne implementácie (Next, Nuxt) vyžadujú framework
  lock-in (ADR-01 alternatíva D).
- Vlastný file-based router v Vite (`unplugin-vue-router`, `vite-plugin-pages`)
  je možný, ale pridáva build-time generation a debug overhead.
- Permission gating cez file-based je clumsy — vyžaduje per-page export.

### B) SSR / Edge SSR

**Prečo zamietnuté**:
- ADR-01 alternatíva D detailne.
- Nepotrebujeme — TTI cieľ dosiahneme client-side.

### C) Hash routing (`#/queue`)

**Prečo zamietnuté**:
- 2010-éra hack pre legacy browsery. Naše target browsery podporujú History
  API.
- Šľapavé URLs, nepekné pre share.

### D) Jeden gigantický `<Switch>` bez code-splittingu

**Prečo zamietnuté**:
- Initial bundle by mal 2 MB+ — bije TTI cieľ.

## Otvorené závislosti

| # | Flag | Smer | Popis | Status |
|---|---|---|---|---|
| 1 | `routing-library` | (vlastné) | React Router v6 data router. | `[resolved-in-round-2]` — 06 stack pick. |
| 2 | `code-split-boundaries` | → 08-devex-devops | Per-route chunk size budgets + bundle visualizer. | open — 08 vlastní v `ci-cd.md` (size-limit gate). |
| 3 | `permission-guard-impl` | → 05-security | `<RouteGuard requires={...}>` komponenta. 05 dodal permission catalog v `rbac.md`. | `[resolved-in-round-2]` — permission code map je v `security/rbac.md`. Implementáciu komponenty robí Phase C. |
