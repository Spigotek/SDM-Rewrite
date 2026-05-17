# Riziká stacku a mitigácie

## Changelog (round 2)

- **R-T-04 (Bundle size shrinkage na portáli)** — `[resolved-in-round-2]`.
  08 r1 `ci-cd.md` + 09 r1 `coverage-targets.md` potvrdili bundle budget
  ako CI gate; vlastníctvo prešlo na 08 (DevOps detail). Mitigačná stratégia
  zostáva (lazy load, code-splitting, Vite preload).
- **R-T-12 (React Compiler opt-in)** — `[resolved-in-round-2]` v kontexte
  "table virtualization"-tematicky: 09 r1 `test-strategy.md` potvrdil že
  žiadna virtualizácia nie je potrebná (dáta sú **rádovo desiatky** položiek;
  TanStack Table basic mode dosatočný). Opt-in React Compileru zostáva
  post-MVP review item, ale nie je blocker.
- **R-T-17 (Strict CSP a inline styles)** — `[resolved-in-round-2]`. 05 r2
  `headers-and-csp.md`: **nonce-based** `script-src` a `style-src` per
  response; Radix portály a Sentry replay sú kompatibilné cez nonce
  injection. Žiadne `'unsafe-inline'` v produkcii.
- **R-T-07 (i18n dynamic backend values)** — **pretrváva**. Vyžaduje
  post-MVP API discussion (01-api-analyst + 04-architecture) o formálnom
  kontrakte (backend-provided labels vs. i18n key strategy). MVP rieši
  `<BackendLabel/>` komponent pattern, čo je stačí pre delivery, ale
  formalizácia kontraktu ostáva open.
- Aktualizovaná § Otvorené závislosti.

---

> Round 1, fresh. Riziká spojené so zvolením React 19 + TanStack family + RHF + Radix + Vite + TipTap + FullCalendar + Cytoscape stack-u. Zameranie: tech-stack-špecifické riziká; UX/domain riziká sú vlastnené `02-ux-persona-analyst/risks.md`.
>
> **Skala**: P = pravdepodobnosť (Low / Med / High), I = dopad (Low / Med / High).

## R-T-01 — React 19 ekosystémová maturity

| | |
|---|---|
| **Popis** | React 19.x je stable od 2024-12. 3rd party knižnice môžu mať `peerDependencies` uzamknuté na `^18`. Niektoré (TipTap extensions, react-cytoscapejs) reagujú pomalšie. |
| P / I | Med / Med |
| Trigger | Build chyba pri `pnpm install --strict-peer-deps`; runtime warning v dev mode. |
| Mitigácia | Pri bootstrape DevOps overí kompatibilitu kľúčových knižníc: Radix UI, TipTap React, FullCalendar React, react-i18next, react-router. Žiadny **stable known issue** k 2026-05-15. Ak by sa objavil, `overrides` v `package.json` umožní uzamknúť React 18 LTS dočasne. |
| Vlastník | `08-devex-devops` |

## R-T-02 — Headless library composition risk

| | |
|---|---|
| **Popis** | TanStack Table / RHF / Radix sú headless — bez Design System tokensov vzniká estetická fragmentácia (každý vývojár tvorí svoj wrapper). |
| P / I | High / Med |
| Trigger | Inkonzistentné UI v queue vs. ticket detail; dvojnásobné komponenty pre rovnaký vzor. |
| Mitigácia | Úzka spolupráca s `07-design-system`. Design System dodá oficiálne wrappery (`<DataTable/>`, `<Field/>`, `<Dialog/>`, ...). Lint pravidlo: import iba z `@sdm/design-system`, nie priamo z `@radix-ui/*`. |
| Vlastník | `07-design-system` + Tech stack guardrails |

## R-T-03 — TanStack vendor concentration

| | |
|---|---|
| **Popis** | Query, Table, Form (alpha), Router (alternatíva) — jeden vendor (Tanner Linsley + komunita). |
| P / I | Low / Med |
| Trigger | Hypotetické: Tanner pauznul vývoj. |
| Mitigácia | API v5 Query / v8 Table je veľmi stabilné a má mnoho prispievateľov mimo Tanner-a. Fallback: TanStack Table → react-data-grid; TanStack Query → SWR. Žiadne **runtime** coupling medzi týmito knižnicami — môžeme vymeniť jednu bez prepisu celej app. |
| Vlastník | Tech stack (review v rounds 2+) |

## R-T-04 — Bundle size shrinkage na portáli `[resolved-in-round-2]`

| | |
|---|---|
| **Popis** | React 19 + Router + Query + RHF + Zod + i18next + Radix ~200 kB initial gzipped (`libraries.md` §19). TTI < 2 s na typickej linke (`GOAL.md` §5) je tesný. |
| P / I | Med / Med |
| Trigger | Lighthouse audit reports TTI > 2 s; CI bundle budget alarm. |
| Mitigácia | <ul><li>Code-splitting per route (`React.lazy`).</li><li>Lazy-load i18n locales (per route namespace).</li><li>Lazy-load Sentry, TipTap, FullCalendar, Cytoscape, Recharts.</li><li>Vite `preload` directives pre kritické moduly.</li><li>**Bundle budget v CI**: `apps/portal` initial < 250 kB gzipped.</li><li>Pre-fetch top 10 Service Catalog items + form schemas pri idle (mitigácia R-016 z UX).</li></ul> |
| Vlastník | `08-devex-devops` (CI budget); Tech stack monitoring |
| **r2 status** | **Resolved**. 08 r1 `ci-cd.md` definuje CI bundle budget gate. 09 r1 `test-strategy.md` potvrdil že tabuľky majú dáta rádovo desiatky položiek (žiadna virtualizácia). Mitigačná stratégia ostáva platná; vlastníctvo na 08. |

## R-T-05 — TypeScript strict mode + 3rd party types friction

| | |
|---|---|
| **Popis** | Cytoscape, FullCalendar, niektoré TipTap extensions majú nedokonalé `*.d.ts`. Strict mode (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`) môže vyžadovať type cast / shim. |
| P / I | Med / Low |
| Trigger | `pnpm tsc --noEmit` chyba v packages/api-client. |
| Mitigácia | <ul><li>Lokálne `*.d.ts` augmentation v `packages/types-shim` (alebo per-app).</li><li>`@types/cytoscape` je oficiálne udržiavaný (DT).</li><li>Pre TipTap: type-safe extension factory + ts-pattern matching pre node types.</li><li>Žiadne `@ts-ignore` v produkčnom kóde — len `@ts-expect-error` s odkazom na issue. (Lint rule.)</li></ul> |
| Vlastník | API client owner |

## R-T-06 — MSW v2 service worker scope v dev mode

| | |
|---|---|
| **Popis** | MSW 2.x service worker robí HTTP interception. Pri tenant switching v dev mode môže worker zaostať za state-om a vrátiť dáta z minulého tenanta (ak handlery nemajú per-tenant logiku). |
| P / I | Med / Low |
| Trigger | Dev tester vidí dáta z iného tenanta po switch-i. |
| Mitigácia | MSW handlery v `mocks/handlers/` musia rešpektovať `tenant` query param alebo `X-CA-SDM-Tenant` header. `08-devex-devops` dodá template handler factory; každý mock factory akceptuje `tenantId` ako param. |
| Vlastník | `08-devex-devops` |

## R-T-07 — i18n dynamic backend values (R-102 cross-link) `[persists]`

| | |
|---|---|
| **Popis** | CA SDM exponuje status labels, category names per-tenant konfigurovateľné v EN. UI musí ich preložiť **runtime** alebo akceptovať backend-provided label. |
| P / I | Med / Med |
| Trigger | UI zobrazuje "Open" v EN v rámci SK i18n bundle. |
| Mitigácia | Stratégia: backend label vrátený v response je **single source of truth pre dynamic hodnoty** (žiadne i18n na FE), zabalené v `<BackendLabel/>` komponente. Static UI textuje cez i18n. **R-102 v UX risks je zladený.** Vlastníctvo Architecture (decided per architecture ADR). |
| Vlastník | `04-architecture`, `06-tech-stack-selector` |
| **r2 status** | **Persists**. MVP rieši cez `<BackendLabel/>` pattern (žiadny blocker pre delivery). Formálny kontrakt (label discovery API, per-tenant override storage, fallback when backend label is empty) ostáva **post-MVP API discussion** medzi 01-api-analyst a 04-architecture. Stratégia zostáva platná; cross-link na `libraries.md` § 3 (JSON Schema → Zod note). |

## R-T-08 — Vite plugin chain stability

| | |
|---|---|
| **Popis** | Vite plugin ekosystém je živý. Plugin update môže prelomiť build (typicky pri major release Vite). |
| P / I | Low / Med |
| Trigger | CI build broken after `pnpm update vite`. |
| Mitigácia | <ul><li>Renovate / Dependabot v `auto-merge: minor` mode pre Vite plugins; major updates manuálne.</li><li>Lock vite verzia v `package.json` (no `^`).</li><li>CI smoke test (build + boot + 1 e2e per app).</li></ul> |
| Vlastník | `08-devex-devops` |

## R-T-09 — Cytoscape mobile performance (CMDB graph)

| | |
|---|---|
| **Popis** | CMDB CI graph (`W-05`) môže mať 100+ nodes (R-011). Mobile (P-12 emergency approve) má slabší GPU. |
| P / I | Med / Med |
| Trigger | Cytoscape canvas freeze / FPS < 30 na mobile. |
| Mitigácia | <ul><li>Canvas mode (default) namiesto SVG.</li><li>Auto-cluster pri > 50 nodes.</li><li>Layout: `cose-bilkent` s `nodeRepulsion` tuned.</li><li>Disable animations na touch device.</li><li>Mobile-specific: zobraz iba 1st-degree neighbors, expand on tap.</li></ul> |
| Vlastník | `06-tech-stack-selector` + `07-design-system` |

## R-T-10 — TipTap content schema drift voči CA SDM KCAT body

| | |
|---|---|
| **Popis** | CA SDM `KCAT_BODY` ukladá HTML; TipTap interný JSON nemusí round-tripovať bez straty (napríklad legacy `<font>` tagy). |
| P / I | Med / Med |
| Trigger | KB editor (`W-04`) otvorí starý článok → zobrazí broken layout. |
| Mitigácia | <ul><li>Pri load: HTML → TipTap JSON cez `prosemirror-markdown` + sanitizer (DOMPurify).</li><li>Pri save: TipTap JSON → HTML zachová len whitelisted tagy.</li><li>Tests: round-trip test v Vitest na sample 20 KB articles z mock dát.</li></ul> |
| Vlastník | KB module owner |

## R-T-11 — FullCalendar tree-shaking limitation

| | |
|---|---|
| **Popis** | FullCalendar v6 packuje plugin per package (`@fullcalendar/daygrid`, `@fullcalendar/timegrid`, ...). Default import nepretreshakuje neopuložité views. |
| P / I | Low / Low |
| Trigger | Bundle audit ukazuje nepotrebné views v lazy chunk. |
| Mitigácia | Import len konkrétne views (`daygrid`, `timegrid` — týždeň + mesiac stačí pre W-03). Žiadny `list`, `multimonth`. |
| Vlastník | Change module owner |

## R-T-12 — React Compiler (R-Pact / Forget) opt-in + table virtualization `[resolved-in-round-2]`

| | |
|---|---|
| **Popis** | React 19 prináša React Compiler (auto-memoization). Stále experimental pre niektoré patterns (custom hooks s closure). Ak ho zapneme moc skoro, môžeme dostať runtime regressions. Súvisí s otázkou table virtualization — pri veľkých datasetoch by sme potrebovali optimalizáciu. |
| P / I | Low / Med |
| Trigger | Subtle re-render bugs po `vite build`. |
| Mitigácia | **Neopt-in v MVP.** Opt-in v rounds rounds 5+, keď je compiler stable. Žiadne `useMemo` ako workaround per CI rule. |
| Vlastník | Tech stack (post-MVP review) |
| **r2 status** | **Resolved**. 09 r1 `test-strategy.md` potvrdil že **žiadna virtualizácia nie je potrebná** — dáta sú rádovo desiatky položiek (GOAL §5, `comparison.md` K1). TanStack Table basic mode bez `@tanstack/react-virtual` je dosatočný. React Compiler ostáva post-MVP review item, ale neexistuje urgentný dôvod ho prerábať. Risk dôsledne dropne na **Low / Low**. |

## R-T-13 — Lucide React ikon set update bumps

| | |
|---|---|
| **Popis** | `lucide-react` často mení id-čka ikon medzi minor verziami. |
| P / I | Low / Low |
| Trigger | `Cannot find module 'lucide-react/Foo'`. |
| Mitigácia | Importy z `@sdm/design-system/icons` re-export wrapper. Lock minor verzia. |
| Vlastník | `07-design-system` |

## R-T-14 — Date-fns v ESM tree-shaking limitation

| | |
|---|---|
| **Popis** | `date-fns@3` má lepšiu ESM tree-shaking ako v2, ale niektorí používatelia importujú default exports. |
| P / I | Low / Low |
| Trigger | Bundle obsahuje celé `date-fns/locale`. |
| Mitigácia | Lint rule: only `import { format } from "date-fns"` (named imports). Pre locales: `import sk from "date-fns/locale/sk"` (lazy v locale provider). |
| Vlastník | Tech stack guardrails |

## R-T-15 — Renovate / Dependabot churn

| | |
|---|---|
| **Popis** | Stack má 30+ direct deps; bez renovate je manual update tediózny. S renovate v auto-merge mode môže prelomiť build. |
| P / I | Med / Low |
| Trigger | CI failed after auto-merge. |
| Mitigácia | <ul><li>Renovate config: `auto-merge: minor + patch` len ak CI green.</li><li>Group updates per ekosystém (TanStack family, Radix family, MSW etc.).</li><li>Major updates: dedicated PR, manuálny review.</li></ul> |
| Vlastník | `08-devex-devops` |

## R-T-16 — Service Worker (MSW + Sentry tracing) konflikt v prod

| | |
|---|---|
| **Popis** | MSW v dev používa SW. Ak by sa v produkčnom build-i omylom načítal `mockServiceWorker.js`, prepísal by všetky fetch volania. |
| P / I | Low / High |
| Trigger | Prod build s registered MSW SW; tickety vyzerajú prázdne. |
| Mitigácia | <ul><li>MSW init kód v dev-only `if (import.meta.env.DEV)`.</li><li>Vite build nezahŕňa `public/mockServiceWorker.js` do prod bundlu (alebo s explicitnou exclude).</li><li>E2E test: prod build smoke test bez MSW.</li></ul> |
| Vlastník | `08-devex-devops` |

## R-T-17 — Strict CSP a inline styles (Radix portals, Sentry replay) `[resolved-in-round-2]`

| | |
|---|---|
| **Popis** | Security agent môže navrhnúť striktnú CSP (no `unsafe-inline`). Radix portály a Sentry session replay používajú inline styles. |
| P / I | Med / Med |
| Trigger | CSP violation reports v prod. |
| Mitigácia | <ul><li>Radix: nastaviť `nonce` cez `nonce` prop / globalCSS.</li><li>Sentry session replay: zapnúť `inlineStylesheet: false` alebo akceptovať `style-src 'self' 'nonce-...'`.</li><li>Spolupráca s `05-security` na CSP design.</li></ul> |
| Vlastník | `05-security` + `06-tech-stack-selector` |
| **r2 status** | **Resolved**. 05 r2 `headers-and-csp.md`: **nonce-based** `script-src` a `style-src` per response (BFF / reverse proxy generuje crypto-random nonce per HTML response, injection cez post-build step alebo proxy middleware). Žiadne `'unsafe-inline'` v produkcii. Radix portály prijímajú `nonce` prop; Sentry SDK má `setStyleNonce` API. Implementačný owner: 08 (Nginx config) + Radix provider wrapper (07). |

## R-T-18 — i18n bundle bloat (SK + EN, all namespaces eager-loaded)

| | |
|---|---|
| **Popis** | Ak sa všetky `*.json` translation files load-nú eager, initial bundle môže narásť o 50+ kB. |
| P / I | Med / Low |
| Trigger | Bundle audit po pridaní translations. |
| Mitigácia | `i18next-resources-to-backend` plugin → lazy load namespacov per route. Initial chunk obsahuje len `common` namespace. |
| Vlastník | `08-devex-devops` (init pattern) |

## R-T-19 — Vite SSR / RSC migrácia (post-MVP)

| | |
|---|---|
| **Popis** | Ak budúcnosť potiahne smerom RSC (React Server Components), Vite nepodporuje natívne (Next.js / Remix sí). |
| P / I | Low / Low |
| Trigger | Hypotetické (mimo MVP). |
| Mitigácia | MVP rozhodnutie je SPA-only (per `GOAL.md` §5). Ak by v1+ vyžadovala SSR, prechod na Next.js/Remix je migration project (viď `migration-notes.md`). |
| Vlastník | Tech stack (long-term) |

## R-T-20 — Cytoscape SSR (window dependency)

| | |
|---|---|
| **Popis** | Cytoscape vyžaduje `window` / `document`. SSR by failoval. |
| P / I | Low / Low |
| Trigger | n/a — MVP SPA only. |
| Mitigácia | Dynamic import za `useEffect`; SSR sa nedeje. |
| Vlastník | CMDB module owner |

## Otvorené závislosti

- `[05-security]` CSP design (R-T-17) — `[resolved-in-round-2]`. 05 r2
  `headers-and-csp.md`: nonce-based CSP. Radix + Sentry kompatibilné.
- `[08-devex-devops]` Bundle budget v CI (R-T-04) — **pretrváva** ako
  DevOps detail (vlastní 08, nie 06). Konkrétne CI gate hodnoty
  (`apps/portal initial < 250 kB gzipped`, Lighthouse TTI < 2 s) sú v
  scope 08.
- `[08-devex-devops]` Renovate config (R-T-15), MSW prod guardrail (R-T-16) —
  vlastní 08; tech-stack-selector len konštatuje pattern.
- `[04-architecture / 01-api-analyst]` Backend label vs. i18n key stratégia
  (R-T-07) — **pretrváva**. Vyžaduje post-MVP API discussion. MVP rieši
  cez `<BackendLabel/>` pattern.
- `[?]` Long-term decision o SSR/RSC (R-T-19) — odložené na v1+
  planning. Nie blocker pre MVP.
