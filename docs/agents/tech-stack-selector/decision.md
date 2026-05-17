# Rozhodnutie — Tech stack pre SDM-Rewrite

## Changelog (round 2)

- 04 r2 potvrdilo **BFF = YES** (ADR `01-bff.md` `accepted`), 04 doplnilo BFF
  runtime (viď `libraries.md` § BFF runtime).
- 04 r2 potvrdilo **monorepo tool** — `pnpm workspaces + Turborepo` (ADR `02`).
- 04 r2 potvrdilo **data fetching** — TanStack Query (ADR `03`).
- 04 r2 potvrdilo **routing** — React Router v6 data router (ADR `05`).
- 04 r2 potvrdilo **dynamic forms** — JSON-schema-driven + RHF + Zod (ADR `06`).
- 04 r2 potvrdilo **i18n** — react-i18next + ICU MessageFormat (ADR `07`).
- 04 r2 potvrdilo **observability** — Sentry + štruktúrované BFF JSON logy (ADR `09`).
- 04 r2 potvrdilo **build pipeline** — Vite (ADR `10`).
- 07 r1 potvrdilo **Radix UI primitives + TanStack Table + TipTap + Lucide + Inter**
  ako komponentový základ.
- 08 r1 potvrdilo **pnpm 9 + Node 22 LTS + TypeScript 5.7 strict + Vite + Vitest +
  Playwright + MSW**.
- 09 r1 potvrdilo test pyramídu (75 % Vitest unit, 20 % integration, 5 % Playwright
  e2e), MSW v CI a coverage targets.
- 05 r2 doriešilo CSP design (nonce-based `script-src`/`style-src` per response) —
  Radix portály a Sentry replay sú kompatibilné.

**Všetky moje r1 default predpoklady zostali platné.** Rozhodnutie sa nemení,
flagy sa uzatvárajú. Detail v `libraries.md` (nové sekcie: BFF runtime, Markdown
sanitizácia, Charts) a `risks.md` (R-T-04, R-T-12, R-T-17 zavreté).

---

> Round 1, fresh. Toto je výstup rozhodnutia podľa kritérií z `GOAL.md` §6.
> Detail scoring v `comparison.md`.

## TL;DR

**Zvolený framework: `react@19.x` + `typescript@5.x` strict mode.**

Bundler: **Vite 5.x**. Data fetching: **TanStack Query v5**. Forms:
**React Hook Form + Zod**. Tables: **TanStack Table v8** (basic mode).
Routing: **React Router v6 (data router)**. i18n: **react-i18next** s
**ICU MessageFormat**. Tests: **Vitest** (unit) + **Playwright** (e2e).
Mock backend: **MSW**. Error tracking: **Sentry**. HTTP klient: **fetch**
(natívny) abstrahovaný cez TanStack Query mutations.

Detail per oblasť v `libraries.md`.

## Prečo React

Súhrn z `comparison.md`:

1. **K3 + K4 (priorita per `GOAL.md` §11)** — Service Catalog dynamic form (`R-001`,
   `Gap #3`) a tenant plumbing (`R-006`, `R-007`) sú v Reacte riešené najprirodzenejšie:
   - **RHF + Zod schema-driven form rendering** je defacto-štandard a má najväčšiu
     komunitnú podporu.
   - **TanStack Query** poskytuje per-tenant `queryKey` cache scoping z box-u — tenant
     switch je `queryClient.invalidateQueries({ predicate: q => q.queryKey[1] === oldTenantId })`,
     a každé volanie automaticky kontextové cez React Context provider.
2. **K9, K10, K11 (UX-critical knižnice)** — TanStack Table v React je najzrelšia
   verzia (Angular adapter je stále beta per 2026-05-15); TipTap má referenčný React
   adapter; FullCalendar React adapter je oficiálne udržiavaný.
3. **K8 (krivka učenia)** — React je dominantný v SK / CZ regióne; hire-ability vyššia
   než Angular alebo Vue 3. Onboarding nových členov tímu je rýchlejší.
4. **K14 (a11y)** — Radix UI + Headless UI + React Aria sú **React-first** a sú
   najpriamejšia cesta k WCAG 2.1 AA (`R-101`). Žiadny direct ekvivalent v Angular
   / Vue.
5. **K6 (udržateľnosť)** — Najväčší ekosystém, najmenší risk osamotenia kľúčových
   knižníc; Meta-backed core, množstvo prispievateľov mimo Meta.

## Prečo nie Angular

- **K1 / K7** — Pre dáta "rádovo desiatky" je Angular over-engineered. Bundle ~155 kB
  baseline ohrozuje TTI < 2 s na portáli (mobile-first, `GOAL.md` §5).
- **K8** — Krivka učenia je strmšia, RxJS je v queue / form scenároch zbytočná
  komplexita pre náš use-case.
- **K10 / K14** — `ngx-tiptap` je menej maintained, žiadny ekvivalent Radix.
- **Score 54 / 70** — Žiadne kritérium nemá Angular ako jediný winner; React je
  paritne vyšší vo všetkých priorítnych (K3, K4, K8, K10, K14).

## Prečo nie Vue 3

- Bundle size je výhoda Vue (K7 = 5), ale **rozdiel ~10 kB v gzipped baseline**
  nezmení faktickú TTI — primárny perf bottleneck je network latency a BFF round-trip
  na tenant aggregation (per `api-analyst/multi-tenancy.md` § 5).
- **K3 / K9 / K10** — Ekosystém je menší. Pre dynamic forms (FormKit / VeeValidate) má
  Vue solídne knižnice, ale s podstatne menšou komunitou než RHF + Zod. TanStack
  Table má Vue adapter, ale pre headless-table je React adapter cieľová verzia
  upstreamu.
- **K8** — Hire-ability v SK regióne nižšia.
- **Vendor / personality risk** — Vue 3 je primárne maintained Evan You & malou skupinou.
  Nie je to red flag, ale 5-ročný horizont desktop B2B aplikácie favorizuje viac
  diverzifikovaný vendor base (React).

## Zhrnutie kľúčových volieb

| Oblasť | Voľba | Krátky dôvod |
|---|---|---|
| **Framework** | `react@19.x` | Score 63/70; K3+K4 winners; ekosystém. |
| **Jazyk** | TypeScript strict mode | API analyst už dodal 12 schém; tenants/users sú branded types. |
| **Bundler** | `vite@5.x` | Dev rýchlosť, native ESM, HMR < 1 s pre 100+ komponentov; produkčný Rollup build. |
| **Data fetching / cache** | `@tanstack/react-query@5.x` | `queryKey` ako tenant-scope; suspense; optimistic updates pre R-012. |
| **Forms** | `react-hook-form@7.x` + `zod@3.x` + `@hookform/resolvers` | Performance (uncontrolled); schema-driven dynamic forms (R-001). |
| **Validation** | `zod@3.x` | Spoločná schéma FE + BFF; runtime type guards z TS. |
| **Tables** | `@tanstack/react-table@8.x` | Headless; basic mode dosatočný pre `~50` riadkov queue (R-018). |
| **Routing** | `react-router@6.x` (data router) | Loader / action API; deep-linkovateľné URL (per `02-ux` screen-inventory). |
| **i18n** | `react-i18next@15.x` + ICU plugin | SK + EN s ICU MessageFormat (R-102). |
| **State (klient-only)** | React Context + `useReducer` | Pre tenant + auth slice. Žiadny Redux / Zustand (KISS). |
| **Styling** | CSS variables + CSS Modules | Žiadne CSS-in-JS — runtime overhead a Design System bude tokens-driven. |
| **A11y primitives** | Radix UI + React Aria | Headless, WCAG 2.1 AA hotovo. |
| **WYSIWYG** | `@tiptap/react@2.x` | Modular extensions, R-010 vlastnená. |
| **Calendar** | `@fullcalendar/react@6.x` | W-03 Change Calendar. |
| **Graph viz** | `cytoscape@3.x` + `react-cytoscapejs` | R-011 CMDB CI relationships, canvas mode. |
| **Tests — unit** | `vitest@1.x` + `@testing-library/react@16.x` | Native Vite integrácia. |
| **Tests — e2e** | `playwright@1.x` | Cross-browser, network mocking, accessibility audits. |
| **Mock backend** | `msw@2.x` (service worker + Node) | DevEx + Vitest integration; `08-devex-devops` ho použije pre dev mode. |
| **Error tracking** | `@sentry/react@8.x` | Source map upload v CI; per-tenant tags pre filtrovanie. |
| **HTTP klient** | natívny `fetch` (cez TanStack Query) | Žiadny axios. Stredný bundle save, native AbortController. |

## Riziká voľby

> Aspoň tri (kontrakt z `agent.md`). Plný zoznam v `risks.md`.

1. **React 19 maturity v ekosystéme** — Niektoré knižnice (3rd party) môžu mať `peerDependencies`
   uzamknuté na 18. **Mitigácia**: pri bootstrape (DevOps) overiť kompatibilitu kľúčových knižníc
   (Radix UI, TipTap, FullCalendar, react-i18next). Žiadne stable known issue k 2026-05-15.
2. **Headless library stack — DIY composition risk** — TanStack Table / RHF / Radix sú headless.
   Bez Design System tokensov môže vzniknúť **estetická fragmentácia**. **Mitigácia**: úzka spolupráca
   so `07-design-system`; Design System dodá wrappery (`<Field/>`, `<DataTable/>`) ktoré skrývajú
   headless API.
3. **Vendor lock-in na TanStack ekosystém** — Query, Table, Form (v8 alpha) sú od jednej skupiny.
   **Mitigácia**: API je veľmi stabilné (v5 Query); fallback je ESM-replace bez framework change.
   Žiadna runtime dependence medzi týmito knižnicami.
4. **Bundle size na portáli** — React baseline 44 kB + tenant context + i18n + Sentry + RHF + Query
   môže ľahko narásť k ~150 kB gzipped. **Mitigácia**: code-splitting per route (`React.lazy`),
   tree-shake unused i18n locales, **lazy-load** TipTap / FullCalendar / Cytoscape iba na cestách,
   kde sa naozaj použijú. Detail v `risks.md` R-T-04.
5. **TypeScript strict mode friction s 3rd party** — Cytoscape, FullCalendar majú nedokonalé types.
   **Mitigácia**: lokálne `*.d.ts` augmentation files v `packages/api-client` (alebo dedicated
   `packages/types-shim`).

## Otvorené závislosti

- `[04-architecture]` BFF cookie session vs. client-side OIDC —
  `[resolved-in-round-2]`. 04 r2 ADR `01-bff.md` `accepted`: BFF + HttpOnly
  session cookie. FE má len redirect-on-401, žiadna OIDC knižnica.
- `[04-architecture]` Monorepo tool — `[resolved-in-round-2]`. 04 r2 ADR `02`:
  pnpm workspaces + Turborepo.
- `[04-architecture]` Data fetching layer — `[resolved-in-round-2]`. 04 r2 ADR
  `03`: TanStack Query.
- `[04-architecture]` Routing — `[resolved-in-round-2]`. 04 r2 ADR `05`: React
  Router v6 (data router API).
- `[04-architecture]` Dynamic forms — `[resolved-in-round-2]`. 04 r2 ADR `06`:
  JSON-schema-driven + React Hook Form + Zod.
- `[04-architecture]` i18n — `[resolved-in-round-2]`. 04 r2 ADR `07`:
  react-i18next + ICU MessageFormat.
- `[04-architecture]` Observability — `[resolved-in-round-2]`. 04 r2 ADR `09`:
  Sentry + štruktúrované BFF JSON logy.
- `[04-architecture]` Build pipeline — `[resolved-in-round-2]`. 04 r2 ADR `10`:
  Vite.
- `[04-architecture]` **Backend label vs. i18n key strategy (R-T-07)** —
  **pretrváva**. Vyžaduje akciu od 01 (post-MVP API discussion) alebo 04.
  Stratégia v `risks.md` (BackendLabel komponent) zostáva platná pre MVP,
  ale formalizácia kontraktu je open.
- `[05-security]` CSP design (R-T-17) — `[resolved-in-round-2]`. 05 r2
  `headers-and-csp.md`: nonce-based `script-src`/`style-src` per response;
  Radix portály a Sentry replay sú kompatibilné cez nonce injection.
- `[07-design-system]` Final komponentová knižnica — `[resolved-in-round-2]`.
  07 r1 `library-recommendation.md`: **Radix UI primitives + custom skin**
  (presne moja r1 voľba).
- `[08-devex-devops]` Bootstrap repo (pnpm workspaces, Vite per app, MSW
  handlers) — `[resolved-in-round-2]`. 08 r1 `repo-bootstrap.md` + `ci-cd.md`
  potvrdili pnpm 9 + Node 22 LTS + TS 5.7 strict + Vitest + Playwright + MSW.
- `[08-devex-devops]` **Bundle budget v CI (R-T-04)** — pretrváva. DevOps
  detail: konkrétny `<= 250 kB initial chunk` enforcement v `pnpm build` +
  Lighthouse CI gate. Vlastní 08, nie 06.
- `[09-qa-test-strategy]` Coverage čísla — `[resolved-in-round-2]`. 09 r1
  `coverage-targets.md` + 08 r1 sa zhodli (75/20/5 pyramída).
- `[?]` **Charts knižnica pre v1 KB analytics (W-10)** — `[resolved-in-round-2]`
  pre framework-level voľbu: **Recharts** (viď `libraries.md` § Charts). v1
  rozhodnutie je už dokumentované; konkrétne dashboard wireframy ostávajú
  responsibility v1 plánovania.
