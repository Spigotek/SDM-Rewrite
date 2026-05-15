# Porovnávacia matica frameworkov — React vs. Angular vs. Vue 3

## Changelog (round 2)

- **Scoring je stabilný** — žiadna zmena hodnotenia kandidátov. Všetci peer
  agenti (04 r2, 05 r2, 07 r1, 08 r1, 09 r1) potvrdili kompatibilitu
  s **React 19 + Vite + TanStack Query + RHF/Zod + Radix UI + Vitest /
  Playwright** stackom.
- Aktualizovaná § Otvorené závislosti — `[04-architecture]` flagy uzatvorené.

---

> Round 1, fresh. Hodnotenie kandidátov pre **frontend SDM-Rewrite** (portal + workspace SPA, BFF-backed CA SDM 17.4 REST). Kritériá pochádzajú z `GOAL.md` §5 (NFR) a §6 (kritériá výberu), validované oproti výstupom Phase A:
> - `docs/agents/api-analyst/auth.md`, `multi-tenancy.md`, `gaps.md`,
> - `docs/agents/ux-persona-analyst/screen-inventory.md`, `risks.md`,
> - `docs/agents/domain-modeller/entities.md`.
>
> **Škála**: 0 (nevhodné) — 5 (excellent). Each rating má dôvod, nielen číslo.

## 1. Kandidáti — verzia a charakter

| Framework | Aktuálna stable | LTS / udržateľnosť | Charakter |
|---|---|---|---|
| **React** | `react@19.1.x` (riadne)<br/>`19.2.x` (stable) | Meta + komunita; verzia 18 podporovaná, 19 stable od 2024-12 | Knižnica + ekosystém. Bez prescriptive struktúry. (overené 2026-05-15 cez react.dev) |
| **Angular** | `@angular/core@19.x` (stable; 20 v Q2/2026) | Google long-term, predikovateľný cycle ~6 mes. major (LTS 18 mes.) | Plný framework: DI, RxJS, router, forms, schematics. |
| **Vue 3** | `vue@3.5.x` (stable) | Evan You + komunita; 3.x backward-stable | Knižnica + opcionálna oficiálna sada (Pinia, Router, Vite default). |

## 2. Kritériálna matica

| # | Kritérium (z `GOAL.md` §6) | React | Angular | Vue 3 |
|---|---|:---:|:---:|:---:|
| K1 | Stredne komplexná SPA, dáta **rádovo desiatky položiek** — žiadna virtualizácia | **5** | 3 | 5 |
| K2 | Silný typový systém vs. CA SDM REST schém (`docs/agents/api-analyst/schemas/*.ts`) | **5** | 5 | 4 |
| K3 | Dynamický Service Catalog form rendering (Gap #3, R-001) | **5** | 4 | 4 |
| K4 | Multi-tenancy plumbing — tenant kontext v každom volaní bez friction | **5** | 4 | 4 |
| K5 | SSO knižnice — OIDC/SAML/Keycloak | 5 | 5 | 4 |
| K6 | Aktívna komunita / dlhodobá udržateľnosť | **5** | 5 | 4 |
| K7 | Bundle size pre portál (TTI < 2 s, mobile) | 4 | 2 | **5** |
| K8 | Krivka učenia tímu (zaužívaný stack v slovenskom .NET / Java prostredí) | **5** | 4 | 3 |
| K9 | Tabuľkové knižnice pre workspace queue (R-018) | **5** | 4 | 4 |
| K10 | WYSIWYG editor pre KB (R-010, TipTap / Lexical) | **5** | 3 | 4 |
| K11 | Kalendárová knižnica pre Change Calendar (W-03) | 5 | 4 | 4 |
| K12 | Graph viz pre CMDB CI relationships (R-011, Cytoscape) | 4 | 4 | 4 |
| K13 | i18n SK + EN s ICU MessageFormat (R-102) | **5** | 4 | 4 |
| K14 | a11y — primitives bez tooling-fight (Radix, Headless UI) | **5** | 3 | 3 |
| | **Σ score (max 70)** | **63** | **54** | **58** |

> Stĺpec **Score** je súčet K1–K14. Tabuľka nepoužíva váhy — kritériá z GOAL §6 boli zamýšľané ako rovnocenné, **okrem K4/K3** (multi-tenancy + dynamic forms), ktoré sú v `GOAL.md` §11 zvýraznené ako MUST. V detailoch nižšie ich oboje zohľadňujem osobitne.

## 3. Odôvodnenie scoringu — per kritérium

### K1 — Veľkosť dát: desiatky položiek
- **React 5**: TanStack Table v "basic mode" + native HTML render je triviálne. Žiadne enterprise grid. Reuse v portal aj workspace.
- **Angular 3**: Material Table je over-engineered pre tento case, `@angular/cdk/scroll` neprinesie hodnotu. Stack je zbytočne ťažký.
- **Vue 3 5**: Lightweight komponenty (Naive UI, PrimeVue) zvládnu identicky ľahko.

### K2 — Typovaný klient nad CA SDM REST
- API analyst už dodal **12 TS schém** (`api-analyst/schemas/*.ts`). Generované z PDF a hand-written. **React aj Angular sú TS-first** (Angular dokonca vyžaduje TS); Vue 3 je TS-friendly cez SFC `<script setup lang="ts">`, ale TS support v template syntaxe (`v-bind`, slot props) je o niečo slabší než JSX.
- **React 5 / Angular 5 / Vue 4** — React JSX je čistý TS expression; Angular má skvelý strict mode + `ng strict`; Vue má volar plugin, ale veci ako `defineProps` runtime cast občas vyžadujú obchádzku.

### K3 — Dynamic forms (Service Catalog)
- **React 5**: React Hook Form + Zod + schema-driven form rendering (custom field registry) je **najrozšírenejší pattern** v ekosystéme. R-001 a Gap #3 sú výslovne `[06-tech-stack-selector]`-vlastnené.
- **Angular 4**: Reactive Forms + dynamic form builder fungujú, ale `FormGroup` builder pre 15+ fieldov rôznych typov vyžaduje viac boilerplate. Žiadny direct ekvivalent RHF + Zod resolveru z box-u.
- **Vue 4**: VeeValidate + Zod (cez `@vee-validate/zod`) ide, ale ekosystém je menej zrelý; FormKit má dynamic schemu pekne, ale komunita podstatne menšia.

### K4 — Multi-tenancy plumbing
- API analyst `multi-tenancy.md` § 3.3: po tenant switch BFF pridáva `X-Role` + WC filter. FE musí mať **globálny tenant kontext** (Context / DI / Pinia store), ktorý sa **automaticky propaguje do každého API volania** (auto-injekcia headerov).
- **React 5**: TanStack Query má `queryKey` ako prvotriedny tenant scoping mechanizmus — `["tenants", tenantId, "tickets"]` cache invalidatuje sa per tenant. Context provider drží `activeTenantId` a `useQueryClient().invalidateQueries({ predicate })` na tenant switch.
- **Angular 4**: HttpInterceptor pridá header z DI `TenantContextService`. Solídne, ale cache invalidation cez RxJS streams je manuálna.
- **Vue 4**: Pinia store + axios interceptor. Funguje, ale cache management bez TanStack Query (alebo Vue Query) je opätovne menej polished.

### K5 — SSO / OIDC / SAML
- Architecture agent ešte nerozhodol o BFF (paralelný stage). Predpokladám **BFF-backed cookie session** (Phase A `api-analyst/auth.md` §6 to odporúča). FE potrebuje len **redirect-on-401** logiku.
- Ak by Architecture zvolila **client-side OIDC** (PKCE bez BFF), potrebné knižnice:
  - React: `oidc-client-ts` + `react-oidc-context` (mature).
  - Angular: `@angular/auth-oidc-client` (mature, dobre integrované s router guards).
  - Vue: `oidc-client-ts` (no direct adapter, glue-code potrebný).
- Skóre: React/Angular 5, Vue 4.

### K6 — Komunita a udržateľnosť
- **React**: ~225k★ GitHub, 25M+ weekly downloads. Najväčší ekosystém (overené 2026-05-15 cez npmjs.com/package/react). 5.
- **Angular**: ~95k★, ~4M weekly downloads. Stabilný Google backing. 5.
- **Vue 3**: ~210k★ (Vue 3 + 2 spolu), ~5M weekly downloads. Solídna, ale evan-you-bound risk. 4.

### K7 — Bundle size (portál mobile)
- Min bundle (hello-world prod, gzipped):
  - React 19 + ReactDOM: **~44 kB** (overené 2026-05-15 cez bundlephobia).
  - Angular 19 (standalone, prod): **~155 kB** baseline; tree-shaking pomáha, ale RxJS + zone.js sú base cost.
  - Vue 3.5: **~34 kB** (najmenší). 5.
- TTI < 2 s na typickej linke (GOAL §5) — Angular vyžaduje viac code-splitting práce, React je pohodlne pod limit, Vue 3 najpohodlnejšie.

### K8 — Krivka učenia tímu
- React JSX je už mainstream v slovenskej / českej dev komunite (väčšina FE bootcampov + univerzít začína Reactom). Hire-ability vysoká.
- Angular: vyžaduje viac onboardingu (DI, RxJS, decorators, schematics).
- Vue 3: kreatívny tým ho preferuje, ale na trhu menej dostupných seniorov v SK regióne. 3.

### K9 — Tabuľkové knižnice (workspace queue R-018)
- **TanStack Table v8** (headless, framework-agnostic — má React/Vue/Angular adaptér; **najzrelší v React**). Workspace queue (`W-01`) má density 28-32 px, bulk actions, saved views, hot-keys.
- React 5, Angular 4 (oficiálny `@tanstack/angular-table` adapter je beta — overené 2026-05-15 cez tanstack.com), Vue 4 (`@tanstack/vue-table` stable).

### K10 — WYSIWYG (KB editor R-010)
- **TipTap** (postavený na ProseMirror) je defacto-štandard. React adapter `@tiptap/react` je referenčný (5). Vue má `@tiptap/vue-3` (4). Angular má `ngx-tiptap`, ale značne menej maintained (3).

### K11 — Calendar (Change Calendar W-03)
- **FullCalendar** má prvotriedne React + Vue + Angular adaptéry. Custom calendar zo scratchu pri 100% custom UI z wireframu by bol overkill — najmä keď GOAL §11 hovorí "rádovo desiatky changes". FullCalendar zvládne všetky 3 frameworky rovnako dobre. React 5, Angular 4, Vue 4.

### K12 — Graph viz (CMDB R-011)
- **Cytoscape.js** je framework-agnostic (canvas-based). Wrapper `react-cytoscapejs` je minimalistický (4). Žiadny official Angular wrapper; Vue rovnako, ale manuálny canvas mount je 30 LoC vo všetkých 3.

### K13 — i18n (SK + EN, ICU)
- **react-i18next** + ICU plugin je defacto-štandard. Angular má `@angular/localize` natívne + `@ngx-translate/core` ako alternatívu; oba podporujú ICU.
- Vue 3 má `vue-i18n@9` s ICU support; menej runtime tooling-u ako react-i18next.
- React 5, Angular 4, Vue 4.

### K14 — a11y primitives
- **Radix UI** + **Headless UI** + **React Aria (Adobe)** — všetky tri sú React-first. Žiadny direct ekvivalent v Angular / Vue (Angular CDK má a11y utilities, ale komponenty nie sú headless).
- WCAG 2.1 AA (R-101) je výrazne ľahšie postaviť cez React Aria base. React 5, Angular 3, Vue 3.

## 4. Iné kritéria (nezapočítané do score, kontextové)

| Aspekt | React | Angular | Vue 3 | Poznámka |
|---|---|---|---|---|
| Server-Side Rendering / SSG | 5 (Next.js, Remix) | 4 (Angular Universal) | 5 (Nuxt 3) | Mimo MVP scope — obe app sú interné SPA. |
| Native mobile (React Native vs. Ionic) | 5 | 4 (Ionic) | 4 (Quasar) | Mobile native je **out of scope** per GOAL §3. |
| State management vendor lock-in | Žiadny (TanStack Query + Context) | RxJS (mandate) | Pinia (opcionálne) | Naša voľba: minimalizovať vendor lock-in. |
| Long-term forward compat | High (React Compiler 2024+) | High (Signals 2024+) | High | Všetky 3 fundamentally OK. |

## 5. Výsledné score

| Framework | Score (max 70) | Pozícia |
|---|:---:|---|
| **React** | **63** | 1. (winner) |
| **Vue 3** | 58 | 2. |
| **Angular** | 54 | 3. |

**Rozdiel React vs. Vue 3** je 5 bodov (~7 %). Najväčší prínos React-u: K3 (dynamic forms), K9 (TanStack Table maturity), K10 (TipTap), K14 (a11y primitives). Najsilnejšia stránka Vue: K7 (bundle size).

**Rozdiel React vs. Angular** je 9 bodov. Angular trpí na K1 (over-engineered pre desktop-veľkosť dát), K7 (bundle), K14 (a11y), K8 (learning curve), K10 (WYSIWYG).

Rozhodnutie v `decision.md`.

## Otvorené závislosti

- `[04-architecture]` BFF rozhodnutie — `[resolved-in-round-2]`. 04 r2 ADR
  `01-bff.md` `accepted`: BFF = YES + cookie session. K5 React zostáva 5
  (žiadna FE OIDC knižnica potrebná, BFF drží Access Key).
- `[04-architecture]` Monorepo tool — `[resolved-in-round-2]`. 04 r2 ADR
  `02-monorepo-tool.md`: pnpm workspaces + Turborepo. Kompatibilné s React
  stackom.
- `[07-design-system]` Komponentová knižnica — `[resolved-in-round-2]`.
  07 r1 `library-recommendation.md`: Radix UI primitives + custom skin.
  Tým je K14 (a11y primitives = 5 pre React) potvrdené ako correct skóre.
