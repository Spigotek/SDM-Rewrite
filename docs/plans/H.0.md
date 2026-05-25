# H.0 — Routing infrastructure (React Router v6 data router)

> **Status**: 🔜 NEXT (Phase H entry chunk)
> **Branch**: `chunk/H.0-routing` (od fresh `main` po Phase G merge)
> **PR**: TBD
> **Cieľ**: zaviazať `react-router-dom@6` data router (`createBrowserRouter` +
> `RouterProvider`) v oboch SPA s code-split per route, route-level loaders
> integrované s TanStack Query, `<RouteGuard>` permission gating napojený na
> existing `@sdm/auth` infrastructure. Po H.0 majú apps reálne navigovateľné
> URL-y; routes zatiaľ placeholder komponenty — feature obsah pridáva H.2+.

## Pivot vs ROADMAP

ROADMAP Phase H matrix nezmieňuje H.0 explicit — je to **foundational chunk**
ktorý zavádza infraštruktúru pre všetky následujúce H.x. Bez H.0 portal aj
workspace sú single-page apps bez navigácie. Per `H.md §D2 sequencing`, H.0
je first chunk a blokuje všetko ostatné.

## Inputs

- **`docs/agents/architecture/decision-records/05-routing.md`** — autoritatívny ADR pre `react-router-dom@6` data router (`createBrowserRouter` + `RouterProvider`), config-based (nie file-based), per-route lazy import, route-level loaders, `<RouteGuard>` integration.
- **`docs/agents/design-system/library-recommendation.md` §Routing** — confirms React Router 6 + lazy imports + `TanStack Query` prefetch pattern.
- **`docs/agents/ux-persona-analyst/screen-inventory.md`** — full route inventory (portal 12 routes, workspace 20 routes; len P0 routes wired v H.0 ako placeholder, ostatné v H.X).
- **`apps/portal/src/App.tsx`** + **`apps/workspace/src/App.tsx`** — current single-render shells (post-G.x).
- **`apps/{portal,workspace}/src/shell/app-shell.tsx`** — `<AppShell>` z E.3 (musí dostať `<Outlet />` slot pre routes).
- **`packages/auth/src/<RouteGuard>` + `<ScreenGuard>`** — z E.2; ich `permission` props budú konzumovať route config.
- **`packages/api-client/src/*`** — HttpClient pre TanStack Query default fetcher.

## Outputs

```
apps/portal/package.json                  # +deps: react-router-dom@6, @tanstack/react-query@5
apps/portal/src/
├── App.tsx                               # ZMENA: wrap s <RouterProvider router={router}> + <QueryClientProvider>
├── routes/
│   ├── index.ts                          # createBrowserRouter export + route config
│   ├── guards.ts                         # routeGuard() helper wrapping @sdm/auth <RouteGuard>
│   ├── error-boundaries.tsx              # RootErrorBoundary, NotFoundElement
│   └── placeholders/
│       ├── home.tsx                      # H.2 will replace
│       ├── new-incident.tsx              # H.3 will replace
│       ├── ticket-detail.tsx             # H.4 will replace
│       ├── catalog.tsx                   # H.5 will replace
│       ├── catalog-item.tsx              # H.5 will replace
│       └── kb.tsx                        # H.6 will replace
├── shell/app-shell.tsx                   # MOD: add <Outlet /> slot
└── lib/query-client.ts                   # NEW: QueryClient with defaults (5min stale, retry x1, no refetch on focus)

apps/workspace/  # identicky:
├── src/App.tsx
├── src/routes/{index.ts,guards.ts,error-boundaries.tsx}
├── src/routes/placeholders/{queue,ticket-detail,changes,changes-calendar,changes-detail,problems,cmdb,cmdb-ci,kb}.tsx
├── src/shell/app-shell.tsx
└── src/lib/query-client.ts

apps/{portal,workspace}/.size-limit.json  # +per-feature lazy chunk caps (placeholder 80 KB per route)
apps/{portal,workspace}/lighthouserc.json # +URLs graduating from _url_todo_phase_h → url for routes existing in H.0

packages/i18n/catalogs/{portal,workspace}/{sk,en}.json  # +navigation labels (5-10 keys per app)

docs/ROADMAP.md                           # H.0 → ✅ DONE; Phase H ⏳ IN-FLIGHT
docs/plans/H.0.md                         # tento súbor → Status DONE
```

## Done-when

- [ ] `react-router-dom@6` + `@tanstack/react-query@5` ako runtime deps v `apps/portal` + `apps/workspace`.
- [ ] `createBrowserRouter(routesConfig)` per app v `src/routes/index.ts`; root route `<AppShell />` má `errorElement={<RootErrorBoundary />}` + `loader: appShellLoader` (preloads `/me` via existing session bootstrap).
- [ ] Každý nested route má `lazy: () => import(...)` pre code-split. Per `performance.md §3` lazy chunk per route budget: 80 KB gzip.
- [ ] **Portal routes wired v H.0** (placeholder content, real content per H.X):
  - `/` → home placeholder
  - `/new-incident` → form placeholder
  - `/tickets/:id` → detail placeholder
  - `/tickets` → my-tickets list placeholder
  - `/catalog` → catalog placeholder
  - `/catalog/:itemId` → catalog item placeholder
  - `/kb` → kb search placeholder
  - `/kb/article/:id` → kb article placeholder
- [ ] **Workspace routes wired v H.0** (placeholder):
  - `/` → redirect na `/queue`
  - `/queue` → queue placeholder
  - `/tickets/:id` → ticket detail placeholder (split-view pattern, H.8)
  - `/changes` → changes list placeholder
  - `/changes/calendar` → calendar placeholder
  - `/changes/:id` → change detail placeholder
  - `/problems` → problems list placeholder
  - `/cmdb` → CMDB list placeholder
  - `/cmdb/ci/:id` → CI detail placeholder
  - `/kb` → KB browse placeholder
- [ ] `<RouteGuard requires={["..."]}>` wraps každú route ktorá vyžaduje permission per `security/rbac.md §6`. Default: no guard (anonymous OK) pre `/`, `/login`. Permission-guarded routes: per spec wireframe + RBAC matrix.
- [ ] `<QueryClient>` defaults: `staleTime: 5 * 60 * 1000`, `retry: 1`, `refetchOnWindowFocus: false`, `refetchOnReconnect: true` (per ADR-03 data fetching).
- [ ] `appShellLoader` preloads `/me` cez TanStack Query (`queryClient.ensureQueryData(meQuery)`) — žiadny waterfall.
- [ ] Browser back/forward funguje natívne; deep-link na `/tickets/INC-123` z fresh load funguje (loader handles).
- [ ] `i18n` LanguageSwitcher + tenant switcher (z G.2/E.3) ostávajú funkčné po route navigations.
- [ ] LHCI: portal `/` + workspace `/queue` posunuté z warn na error pre TTI/LCP per `performance.md §2`. Placeholders sú malé HTML stránky — TTI/LCP by mali byť dobre pod prahmi.
- [ ] Bundle delta: per-app initial JS + ~14 KB gzip (React Router 6) + ~14 KB gzip (TanStack Query) = +28 KB. Stále pod portal 180 KB budget (G.4 baseline 166 KB → 194 KB **OVER**!). **Mitigation**: lazy-load TanStack Query devtools separately (~5 KB savings) + verify React Router tree-shaking. Ak stále over budget, **lazy-init Sentry** (G.4 deferred trade-off) frees ~26 KB.
- [ ] `pnpm -r typecheck/lint/test/build` green.
- [ ] `pnpm size` v portal + workspace passes.
- [ ] No hardcoded SK strings v new route components — všetko cez `useTranslation("portal" | "workspace" | "shared")`.
- [ ] ROADMAP toggle: H.0 → ✅ DONE; Phase H → ⏳ IN-FLIGHT.

## Stratégia

### Fáza A — Foundation (router skeleton)

1. Install: `pnpm --filter @sdm/portal add react-router-dom@6 @tanstack/react-query@5`. Identicky workspace.
2. `apps/portal/src/lib/query-client.ts`:
   ```ts
   import { QueryClient } from "@tanstack/react-query";
   export const queryClient = new QueryClient({
     defaultOptions: {
       queries: {
         staleTime: 5 * 60 * 1000,
         retry: 1,
         refetchOnWindowFocus: false,
         refetchOnReconnect: true,
       },
     },
   });
   ```
3. `apps/portal/src/routes/error-boundaries.tsx` — `RootErrorBoundary` (Sentry-aware, falls back to `Sentry.captureException(error)` + user-friendly message via `useTranslation("shared")` `errors.boundaryTitle/Body/Refresh` keys from G.3), `NotFoundElement` (404 page).
4. `apps/portal/src/routes/guards.ts`:
   ```ts
   export function routeGuard(permissions: string[] | undefined, Component: React.FC) {
     return function GuardedRoute() {
       if (!permissions) return <Component />;
       return (
         <RouteGuard requires={permissions} fallback={<ForbiddenElement />}>
           <Component />
         </RouteGuard>
       );
     };
   }
   ```
5. `apps/portal/src/routes/placeholders/*.tsx` — every placeholder is a 5-line component:
   ```tsx
   import { useTranslation } from "@sdm/i18n";
   export default function HomeRoute() {
     const { t } = useTranslation("portal");
     return (
       <main>
         <h1>{t("placeholders.home", "Portal home (placeholder)")}</h1>
       </main>
     );
   }
   ```
6. `apps/portal/src/routes/index.ts` — `createBrowserRouter([...])` config.

### Fáza B — Integrácia s AppShell + bootstrap

1. `apps/portal/src/shell/app-shell.tsx` — pridať `<Outlet />` v main slot (replaces hardcoded children).
2. `apps/portal/src/App.tsx`:

   ```tsx
   import { RouterProvider } from "react-router-dom";
   import { QueryClientProvider } from "@tanstack/react-query";
   import { router } from "./routes";
   import { queryClient } from "./lib/query-client";

   export default function App() {
     return (
       <QueryClientProvider client={queryClient}>
         <RouterProvider router={router} />
       </QueryClientProvider>
     );
   }
   ```

3. `appShellLoader` (per ADR-05 example) — calls `queryClient.ensureQueryData(meQuery)` cez `meQuery` factory; redirect na `/login` ak 401.

### Fáza C — Workspace identicky + verification + PR

1. Repeat A+B pre `apps/workspace/`.
2. `appShellLoader` v workspace: `/` redirect na `/queue` ak signed in (per `screen-inventory.md` `default route` cell).
3. i18n catalog keys: `nav.queue/tickets/changes/calendar/problems/cmdb/kb` + `placeholders.{route}` (`shared` catalog má `errors.boundaryTitle/Body/Refresh` z G.3, NotFound text → `errors.notFoundTitle/Body` new).
4. LHCI assertion graduation: `portal/lighthouserc.json` posunúť `/` z warn na error pre TTI ≤ 1.8 s + LCP ≤ 1.5 s + CLS ≤ 0.05 + score ≥ 0.9. Workspace `/queue` desktop: TTI ≤ 2.5 s, LCP ≤ 2.0 s, score ≥ 0.85.
5. size-limit budget verify — pravdepodobne treba lazy Sentry init (per G.4 trade-off).
6. Browser-test scenario: `tools/browser-test/scenarios/smoke-h0-routing.spec.ts` — navigate cez 3-4 routes, verify URL changes, verify deep-link z fresh load funguje.
7. `pnpm -r typecheck/lint/test/build/size` green; PR per memory.

## Open questions / risks — recommended resolutions

- **Bundle budget**: post-H.0 portal initial JS pravdepodobne presiahne 180 KB (166 KB G.4 baseline + 28 KB router/query = 194 KB). **Mitigation hierarchy**:
  1. Verify tree-shaking — `manualChunks` pridať `vendor-router` (~14 KB), `vendor-state` (~14 KB).
  2. Lazy Sentry init (per G.4 §Open questions deferred trade-off) — `requestIdleCallback` saves ~26 KB from initial.
  3. Ak stále over budget, relax portal budget z 180 → 200 KB v `.size-limit.json` s explicit Open question pre Phase I.
- **TanStack Query devtools**: NIE v production bundle. Conditional import `if (import.meta.env.DEV) await import("@tanstack/react-query-devtools")`.
- **Suspense**: route lazy imports trigger React Suspense. Wrap `<Suspense fallback={<LoadingPlaceholder />}>` v `<AppShell>` `<main>` slot. `LoadingPlaceholder` — minimal centered spinner using `@sdm/design-system` Spinner.
- **404 / not-found**: `errorElement` na root route handles. Per `microcopy.md §3.2` text + nav button späť na `/`.
- **403 / forbidden**: per `microcopy.md §13.1` info-safe — `<ForbiddenElement>` v `guards.ts` shows: "Túto stránku nevidíš v tenante {tenant}. Skontroluj rolu s administrátorom alebo prepni tenant." + tenant switcher prominently.
- **Browser back po tenant switch**: TanStack Query cache invalidates per-tenant cez `queryKey` factory (e.g. `["tickets", tenantId, ...]`). Tenant switch volá `queryClient.removeQueries({ queryKey: ["tickets"] })` (broad invalidation per ADR-04 r2). Implementuje H.1.
- **Deep-link bez signed in**: `appShellLoader` redirect na `/login` (existing F.5 login page) preserving `?return=<orig>` param. Login success → redirect back.
- **Outlet vs explicit children**: `<AppShell>` v E.3 + G.x render-uje children explicit. H.0 to mení na `<Outlet />`. Browser tests musia ostávať zelené — verify že `tools/browser-test/scenarios/smoke-{portal,workspace}.spec.ts` z E.3 ešte pass.

## Notes pre subagenta

- Subagent dispatchovaný cez Agent tool s `subagent_type: "general-purpose"`. Self-contained brief obsahuje:
  - **Routing config je centralizovaný** per ADR-05 — NIE file-based ani Next-style.
  - **Lazy import per route** — žiadny early-load.
  - **Permission gating** cez `<RouteGuard>` — wireup je `routeGuard()` helper okolo lazy components.
  - **Bundle budget mitigation** môže vyžadovať lazy Sentry init — to je acceptable Phase H trade-off (per G.4 deferred decision).
  - **MSW mode**: existing `mocks/browser.ts` ostáva — žiadna interakcia s routes setup, mocks už interceptuju `/api/*`.
- Subagent **NESMIE**:
  - Použiť file-based routing (Next.js / Remix / Solid Start patterns).
  - Použiť `<BrowserRouter>` legacy API — vždy `createBrowserRouter` (data router).
  - Pridať custom URL state management (zustand, jotai) — natívny React Router state stačí.
  - Implementovať feature obsah pre routes — všetko placeholder.
  - Mergovať vlastný PR.
