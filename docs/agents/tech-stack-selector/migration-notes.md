# Migration notes — pre prípadný neskorší prechod

## Changelog (round 2)

- Žiadna zmena obsahu. Stack-resilience princípy zostávajú platné (doménový
  kód oddelený od framework kódu; žiadny CSS-in-JS; Zod schémy ako zdieľaný
  kontrakt FE+BFF; žiadny `dangerouslySetInnerHTML`; žiadny `any` v
  produkčnom kóde).
- Pridanie BFF runtime (Hono — viď `libraries.md` § 0) nemení stack-resilience
  predpoklady: BFF je tenký proxy + aggregátor s **rovnakou** Zod schémou
  ako FE, takže výmena BFF runtime (Hono → Fastify → Bun) je low-effort
  migrácia (HTTP route registration prepis, žiadny business logic move).

---

> Round 1, fresh. High-level notes pre prípad, že by sme v budúcnosti potrebovali
> zmeniť framework alebo kľúčové knižnice. Nie je to plán — je to *escape hatch*
> dokumentácia pre stack-resilience.

## 1. Princípy pre stack-resilience

Aby budúca migrácia bola realizovateľná (nie ľahká — žiadna migrácia FE
nie je ľahká), držme sa týchto princípov **od day one**:

1. **Doménový kód oddelený od framework kódu**.
   - `packages/domain/*` (entity, validátory, state machines, computed selectors) má **0 React imports**.
   - `packages/api-client/*` má 0 React imports.
   - Iba `apps/*` a `packages/design-system/*` obsahujú React.
2. **Žiadny `dangerouslySetInnerHTML`**.
3. **Žiadny CSS-in-JS** (Emotion, styled-components). CSS variables + CSS Modules.
   Tým nie sme uzamknutí na React render lifecycle pri stylingu.
4. **Žiadne React-only utility knižnice** v doménovej vrstve (use cases ako
   `formatDate`, `parseTenantId` musia bežať v Node.js tests aj v inom UI runtime).
5. **API klient (`packages/api-client`) má jasné kontrakty cez Zod schemu**.
   Schema reuse v Node.js (BFF, mock, tests) je samozrejmosť.
6. **Žiadny global singleton state**. Kontext, hooks → ak by sa stack zmenil,
   nahradenie context-u inou DI je mechanická práca.

## 2. Hypotetický scenár — React → SolidJS / Svelte

| Layer | Migration impact |
|---|---|
| `packages/domain` | **0** — žiadny React import. |
| `packages/api-client` | **0** — fetch + Zod + TanStack Query (Solid má `@tanstack/solid-query`, Svelte `@tanstack/svelte-query`). |
| `packages/design-system` | **High** — všetky komponenty preprestylované. Tokens (CSS variables) sú reusable. |
| `apps/portal`, `apps/workspace` | **High** — celý routing, lifecycle, forms. |
| Tests | **Med** — Vitest framework-neutral; `@testing-library/*` má adapter pre Solid a Svelte. |

**Odhad effort** (extrapolácia): rebuild apps/ vrstva ~6-9 človekomesiacov pri 2 inžinieroch s expertise v target frameworku. Doménová vrstva netreba meniť.

## 3. Hypotetický scenár — React 19 → Next.js / Remix (SSR / RSC)

| Layer | Migration impact |
|---|---|
| `packages/domain` | **0**. |
| `packages/api-client` | **Low** — Next/Remix majú server-side fetch primitives. TanStack Query support pre RSC sa stabilizoval 2025. |
| `packages/design-system` | **Low-Med** — komponenty fungujú v RSC ak nie sú interaktívne; client components môžu zostať. |
| `apps/*` | **Med** — Vite → Next/Remix toolchain. Routing prerobiť na file-based. |
| Tests | **Low** — Playwright e2e prejdú bez zmeny; Vitest unit prejdú bez zmeny. |

Tento prechod je realistický ako follow-up v v1+, ak by sme potrebovali SSR pre SEO (KB articles) alebo lepšie TTI na portáli.

## 4. Hypotetický scenár — TanStack Query → SWR

| Layer | Impact |
|---|---|
| API call sites | **Med** — `useQuery` / `useMutation` adapter mapper; querykey logika sa prepíše. |
| Tenant invalidation | **Med** — SWR nemá `predicate` API; treba custom logiku. |
| Bundle | **Low** — SWR je menšia (~3 kB), Query je 14 kB. |

**Závery**: TanStack Query je vlepší (queryKey predicate + retry config + suspense), ale výmena nie je dramatická.

## 5. Hypotetický scenár — RHF → TanStack Form

| Layer | Impact |
|---|---|
| Form components | **High** — komplet rewrite. RHF používa `useFormContext` + `register`; TanStack Form má form-instance API. |
| Zod resolver | **Low** — TanStack Form má native Zod adapter. |
| Dynamic catalog form | **High** — schema-driven render musí byť reimplementovaný. |

**Odporúčanie**: nemigrácia bez silného dôvodu (TanStack Form v1 stable post-MVP).

## 6. Hypotetický scenár — TipTap → Lexical

| Layer | Impact |
|---|---|
| Editor komponent | **High** — Lexical má iný node model (žiadny ProseMirror schéma). |
| Content storage | **High** — TipTap JSON ≠ Lexical EditorState. Treba migration script v BFF (alebo per-article on-demand). |
| Extensions | **High** — TipTap extension API ≠ Lexical plugins. |

**Odporúčanie**: TipTap je dlhodobá voľba; Lexical migrácia by potrebovala silný catalyst (napr. corner-case bug v ProseMirror).

## 7. Hypotetický scenár — Cytoscape → Sigma.js / Reagraph

| Layer | Impact |
|---|---|
| CMDB graph komponent | **Med** — Cytoscape layout API ≠ Sigma WebGL. |
| Style declarations | **Med** — Cytoscape selector-based ≠ Sigma object-based. |

**Odporúčanie**: Cytoscape je vhodný pre 100+ nodes; Sigma.js by sme potrebovali len pri 1000+ nodes (mimo MVP scope).

## 8. Hypotetický scenár — Vite → Rspack / Turbopack

| Layer | Impact |
|---|---|
| `vite.config.ts` | **High** — Rspack používa Webpack config; Turbopack je Next-only. |
| Vite plugins | **High** — žiadny common ecosystem. |
| Dev experience | **Neutral** — Rspack je 5-10× rýchlejší build, ale Vite je už pohodlne rýchly. |

**Odporúčanie**: Vite je defacto-štandard pre SPA; migrácia bez silného dôvodu (perf bound v build CI) nevýhodná.

## 9. Migrácia jazyková: TypeScript → ReScript / PureScript

**Nikdy**. Nemá biznis-dôvod. (Záznam tu len pre úplnosť.)

## 10. Indikátory, kedy zvážiť migráciu

| Signál | Akcia |
|---|---|
| React baseline bundle > 70 kB v budúcnosti | Posúdiť Preact alias (drop-in 4 kB). |
| TanStack Query maintenance gap (> 6 mes. bez release) | Migrate to SWR. |
| TipTap critical security CVE bez upstream fix | Migrate to Lexical alebo Slate. |
| Service desk vyžaduje SSR | Migrate to Next/Remix (per §3). |
| FE app needs > 1000 row tables | Add `@tanstack/react-virtual`; nemení framework. |
| Performance audit ukazuje React reconciler bottleneck | Skús React Compiler (R-T-12); ak nestačí, posúdiť SolidJS. |

## 11. Versioning a backward compat

- **Major bump kľúčových libs**: React, TanStack Query, RHF, react-router. Vyžaduje
  dedicated PR + smoke test in staging + 1 týždeň monitoring.
- **Minor bump**: auto-merge cez Renovate ak CI green.
- **Pin policies**: `package.json` používa `^` pre minor, **exact** pre Vite a Vite
  plugins (R-T-08).

## 12. Code-base architectural conventions, ktoré uľahčia migráciu

- **Žiadny direct import z `@radix-ui/*` v `apps/*`** — vždy cez `@sdm/design-system`.
- **Žiadny direct fetch v `apps/*`** — vždy cez `@sdm/api-client`.
- **Žiadny `useState` pre cross-component state** — len Context (alebo TanStack Query
  pre server state).
- **Žiadny CSS-in-JS** — len CSS Modules + tokens.
- **Žiadny `any`** — strict mode enforced v CI.

Tieto pravidlá nie sú framework-špecifické; sú o **dobre tvarovanom kóde**, ktorý sa
ľahko migruje akýmkoľvek smerom.

## Otvorené závislosti

- `[04-architecture]` Monorepo layout (`apps/` + `packages/`) —
  `[resolved-in-round-2]`. 04 r2 `monorepo-layout.md` + ADR
  `02-monorepo-tool.md`: pnpm workspaces + Turborepo s `apps/` + `packages/`
  layout. Migrácia notes (najmä §1 princípy) zostávajú platné.
- `[?]` Long-term: kedy zvážiť SSR / RSC — **pretrváva** ako strategické
  rozhodnutie (Product Owner). Mimo MVP scope. Indikátory v §10
  (SEO requirement, alebo TTI tlak ktorý SPA nevie splniť) trigger-ujú
  re-vízu.
