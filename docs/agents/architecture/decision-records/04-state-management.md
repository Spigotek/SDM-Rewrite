# ADR-04 — State management filozofia

**Status**: accepted
**Dátum**: 2026-05-15
**Autor**: 04-architecture agent (runId 20260508-192438, round 1)

## Kontext

State v SPA má rôzne charaktery (server vs. client, ephemeral vs. persisted,
single-feature vs. cross-feature). Bez explicitnej kategorizácie a defaultov
sa tím zvyčajne zrúti do "global store all the things" anti-patternu
(typický Redux misuse).

GOAL §11 NFR: jednoduchosť, "rádovo desiatky" záznamov — žiadne enterprise
state machines.

## Rozhodnutie

**Tier-based state taxonómia s explicitnými ownermi**:

| Tier | Vlastník | Príklady | Antipattern |
|---|---|---|---|
| **Server data** | TanStack Query (ADR-03) | Tickets, KB articles, CIs, reference data, user profile snapshot | Ukladať v lokálnom state a manuálne sync-ovať. |
| **Form state** | `react-hook-form` (alebo framework-equivalent) | New incident form, Service Catalog dynamic form, ticket inline edit | Ukladať v `useState` chunkmi. |
| **UI ephemeral** | `useState` / `useReducer` lokálne v komponente | Modal open, dropdown selected, scroll position | Lifting do globálneho store. |
| **Cross-feature ephemeral** | React Context (4 kontexty max) | `ConfigContext`, `UserContext`, `TenantContext`, `I18nContext` | Pridávať ďalší context "len tak". |
| **Persisted preferences** | localStorage cez `@sdm/auth` typed wrapper | Last queue filter, language, theme | Cookies; nesériou kľúčovou `userId/tenantId`. |
| **Hot-key registry** | Workspace-only Context (`HotKeyContext`) | `j/k/r/c/e/t` + scope | Globálny event listener bez scope. |

**Pravidlá**:
1. **Žiadny Redux / Zustand / Jotai / Recoil v MVP**. Ak by raz vznikla
   potreba (čo zatiaľ nevidíme), bude to ADR v ďalšom kole.
2. **Server-state nikdy v Context**. `UserContext` obsahuje len `{ userId,
   fullName, locale, isAdmin }` — žiadne tickety, žiadne queues.
3. **Tenant switch flush**: `queryClient.clear()` po success na
   `POST /me/active-tenant` (TanStack Query cache je tenant-scoped implicitne
   cez request, ale defenzívne clear).
4. **Persisted preferences kľúč**: `sdm.${app}.${userId}.${tenantId}.${preferenceKey}`
   — bez `userId/tenantId` by mohol jeden tenant vidieť preferences druhého
   na shared workstation.

## Dôsledky

**Pozitívne**:
1. **Jeden mental model na server-state** — vždy TanStack Query. Žiadne
   "tu sme to dali do Reduxu, tam zase do Context-u".
2. **Žiadny boilerplate Redux** — actions, reducers, selectors, middleware
   = stovky riadkov pre malú benefit-y.
3. **Predvídateľný re-render** — Context je top-level, useState je local.
   React DevTools profiler je dostatočný.
4. **Memory footprint** — TanStack Query cache má GC (`gcTime`), žiadny
   neobmedzene rastúci globálny store.
5. **Testovateľnosť** — feature komponenty sa testujú s `QueryClientProvider`
   wrapom + mock fetch (MSW).

**Negatívne**:
1. **Cross-feature ephemeral je úzkym miestom** — Context re-render všetkých
   consumerov pri každom set. Mitigácia: rozdeľujem `ConfigContext`,
   `UserContext`, `TenantContext` namiesto jedného `AppContext`; každý
   sa mení zriedka.
2. **Žiadny time-travel debugging** ako Redux DevTools. Mitigácia: TanStack
   Query devtools + React DevTools je dostačujúce pre náš debug profil.
3. **Hot-key registry je workspace-only** — duplicate, ak by sa raz portál
   chcel pridať. Mitigácia: presunúť do `@sdm/design-system` ako reusable
   primitive až keď druhý consumer naozaj vznikne (YAGNI).

## Alternatívy

### A) Redux Toolkit + RTK Query (server + client v jednom)

**Prečo zamietnuté**:
- Vyžaduje viac boilerplate ako TanStack Query.
- Globálny store je antipattern pre náš scope (P4).
- Tým, ktorý nepoužívajú Redux denne, ho doladí dlhšie ako lokálne useState.

### B) Zustand pre client-state + TanStack Query pre server-state

**Prečo zamietnuté**:
- Zustand je elegantný, ale **nemáme cross-feature client-state**, ktorý
  by ho potreboval. 4 Context-y stačia.
- Pridávať Zustand "lebo je hipster" je YAGNI violation.

### C) Jotai / Recoil (atomic state)

**Prečo zamietnuté**:
- Atomic state je riešenie pre granular re-render performance v gigantických
  aplikáciách. Náš scope (10 portal screens + 20 workspace screens, "desiatky"
  záznamov) je vzdialený od tohto problému.
- Pridáva concept layer (atoms, selectors) zbytočne.

### D) MobX

**Prečo zamietnuté**:
- Proxy-based reactivity je mocná, ale netradičná. Tím musí vedieť, kedy
  observable, kedy nie. Príkrejšia learning curve.
- Nehodí sa do "explicit data flow" princípu, ktorý je čitateľnejší pre
  novokomerov.

## Otvorené závislosti

| # | Flag | Smer | Popis |
|---|---|---|---|
| 1 | `form-library` | → 06-tech-stack-selector | `react-hook-form` ekv. v non-React stacku. |
| 2 | `preferences-schema` | → 07-design-system | Konkrétne kľúče preferences (queue filter shape, theme, density) — Design System + UX zladí. |
| 3 | `context-split-policy` | → 08-devex-devops | Pravidlá pre pridávanie 5+ context-u (žiadosti budeme posudzovať proti P8). |
