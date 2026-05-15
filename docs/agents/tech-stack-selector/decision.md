# Rozhodnutie — Tech stack pre SDM-Rewrite

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

- `[04-architecture]` Potvrdiť BFF cookie-session vs. client-side OIDC. Default
  predpoklad: BFF cookie session (per `api-analyst/auth.md` §6). Pri zmene
  nemení rozhodnutie o frameworku, mení iba auth knižnice v `libraries.md`.
- `[04-architecture]` Potvrdiť monorepo tool. Default: `pnpm workspaces`.
  Voľba Nx/Turborepo nemení framework decision; iba pridá tooling layer
  navrch.
- `[04-architecture]` Potvrdiť **data fetching layer** (TanStack Query vs. RTK
  Query). Tento dokument tvrdí TanStack Query — Architecture nech to validuje
  voči svojim ADR (caching policy, retry policy, BFF endpoint shape).
- `[07-design-system]` Komponentová knižnica — voľba Radix / Headless UI je
  predpoklad. Final call je u Design Systemu; pokiaľ zvolí MUI / Mantine,
  nie je to konflikt s React, len iný DX a bundle náklad. Treba revízne
  okno v Round 2.
- `[08-devex-devops]` Bootstrap repo musí podporovať daný stack (pnpm
  workspaces, Vite per app, MSW handlers per schema). Detail v `migration-notes.md`.
- `[09-qa-test-strategy]` Test pyramída: Vitest unit + Playwright e2e. QA
  agent dolní/horný strop konkrétne čísla coverage.
