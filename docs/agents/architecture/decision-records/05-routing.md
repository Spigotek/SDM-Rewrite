# ADR-05 — Routing

**Status**: accepted
**Dátum**: 2026-05-15
**Autor**: 04-architecture agent (runId 20260508-192438, round 1)

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

**Client-side routing s konfiguráciou (config-based, nie file-based) — výber
konkrétnej knižnice patrí 06 Tech Stack Selector.**

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

**Kandidáti pre 06 Tech Stack** (zoznam je informačný, výber 06):

| Kandidát | Pluses | Minuses |
|---|---|---|
| React Router 6 (data router mode) | de facto štandard React; loaders, actions, error elements | Aktívna 6 → 7 migrácia, drobné breaking changes |
| TanStack Router | Type-safe routes, integrated with TanStack Query | Mladšia knižnica, menšia komunita |
| Vue Router 4 | de facto Vue | (ak Tech Stack zvolí Vue) |
| Angular Router | Built-in, robust | (ak Tech Stack zvolí Angular) |

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

| # | Flag | Smer | Popis |
|---|---|---|---|
| 1 | `routing-library` | → 06-tech-stack-selector | React Router 6 vs. TanStack Router vs. Vue Router atď. |
| 2 | `code-split-boundaries` | → 06-tech-stack-selector, 08-devex-devops | Bundle visualizer + per-route chunk size budgets. |
| 3 | `permission-guard-impl` | → 05-security | `<RouteGuard requires={...}>` komponenta — Security agent finalizuje permission catalog (per ADR-04 v `entities.md` Otvorené závislosti). |
