# Konkrétne knižnice — voľby per oblasť

> Round 1, fresh. Voľba pochádza zo `decision.md` (React 19 + TS strict). Pre každú knižnicu uvádzam: verzia, licencia, aktivita (overené 2026-05-15), alternatívy, dôvod výberu, odporúčaný usage.
>
> **Konvencie**:
> - Cesty inštalácie predpokladajú `pnpm workspaces` (default — viď `decision.md` Otvorené závislosti).
> - Bundle size hodnoty sú **gzipped + minified**, z bundlephobia (overené 2026-05-15).
> - „weekly downloads" sú približné — z npmjs.com k dátumu overenia.

## 1. Bundler / dev server

| Voľba | `vite@5.x` (resp. `vite@6.x` stable LTS) |
|---|---|
| URL | https://vitejs.dev / https://github.com/vitejs/vite |
| Licencia | MIT |
| Aktivita | ~22M weekly downloads; pravidelné releases (mesačný cadence); v6.x stable január 2026. |
| Alternatívy | Rspack (Bytedance), Turbopack (Vercel — pre-stable), Webpack 5, Parcel 2. |
| Dôvod | Native ESM dev server (HMR < 1 s pre stredný projekt), Rollup-based prod build, zero-config TS/JSX/CSS modules, plugin ecosystem (PWA, MSW, env). |

### Konfigurácia (high-level)

- `vite.config.ts` per app (`apps/portal/vite.config.ts`, `apps/workspace/vite.config.ts`).
- `vite-plugin-svgr` pre SVG-as-React-component (Lucide icons sú default).
- `@vitejs/plugin-react` (alternatívne `@vitejs/plugin-react-swc` ak DevOps preferuje SWC — neutrálna voľba).
- Runtime config: `public/config.json` (per `GOAL.md` §5 NFR) načítaný pri boot-e, žiadny rebuild pri zmene endpointu.

## 2. Data fetching / async cache

| Voľba | `@tanstack/react-query@5.x` |
|---|---|
| URL | https://tanstack.com/query/latest |
| Licencia | MIT |
| Aktivita | ~10M weekly downloads; mesačné minor releases; v5.x stable október 2024. |
| Alternatívy | RTK Query (vyžaduje Redux), Apollo (GraphQL-only — CA SDM nemá GraphQL), SWR (jednoduchší ale menej mature pre per-tenant invalidation). |
| Dôvod | `queryKey` ako prvotriedny tenant-scope; optimistic updates pre R-012 polling; SSR neutral (mimo MVP, ale future-friendly); `useSuspenseQuery` integrácia s React 19. |
| Bundle | ~14 kB |

### Konvencia tenant scoping

```ts
// packages/api-client/queryKeys.ts
export const qk = {
  incidents: {
    list: (tenantId: string, filter: object) =>
      ["tenants", tenantId, "incidents", "list", filter] as const,
    detail: (tenantId: string, id: string) =>
      ["tenants", tenantId, "incidents", "detail", id] as const,
  },
};

// Tenant switch:
queryClient.invalidateQueries({
  predicate: (q) => q.queryKey[0] === "tenants" && q.queryKey[1] !== newTenantId,
});
```

## 3. Forms

| Voľba | `react-hook-form@7.x` + `zod@3.x` + `@hookform/resolvers@3.x` |
|---|---|
| URL | https://react-hook-form.com / https://zod.dev |
| Licencia | MIT |
| Aktivita | RHF ~12M weekly; Zod ~25M weekly. Aktívne udržiavané. |
| Alternatívy | Formik (legacy, slabší TS), TanStack Form (v0.x — alpha; nie pre MVP), Final Form (nizšia aktivita). |
| Dôvod | Uncontrolled forms = vysoký perf pre 15+ fields v Service Catalog (R-001); Zod schéma deklaratívna a sharable s BFF; `@hookform/resolvers/zod` adapter zrelý. |
| Bundle | RHF ~12 kB; Zod ~13 kB |

### Pattern dynamic form (Service Catalog R-001)

- Backend (CA SDM Service Catalog) vráti **field metadata** (typ, validation rules) — viď `api-analyst/gaps.md` Gap #3.
- FE prevedie metadata → Zod schema runtime cez `field-type registry`:

```ts
// packages/domain/serviceCatalog/buildSchema.ts
function buildZodSchema(fields: CatalogField[]): z.ZodObject<any> { /* registry per type */ }
```

- `useForm({ resolver: zodResolver(schema) })` zaregistruje validation. Field render je per-type komponent (`<TextField/>`, `<DatePicker/>`, `<CiPicker/>`).

## 4. Tables

| Voľba | `@tanstack/react-table@8.x` |
|---|---|
| URL | https://tanstack.com/table/v8 |
| Licencia | MIT |
| Aktivita | ~3M weekly downloads; aktívne udržiavané. |
| Alternatívy | AG Grid (Community je MIT, ale je over-engineered pre desktopovú veľkosť; Enterprise je komerčný), Material React Table (MUI dep), TanStack Table v9 (alpha). |
| Dôvod | Headless = ladí s Design Systemom; basic mode + manual pagination dosatočný pre ~50 row queue; column resizing, sorting, filtering, row selection (bulk R-018) v core. |
| Bundle | ~14 kB |

**Žiadna virtualizácia** v MVP (per `GOAL.md` §5). Ak by sa neskôr ukázalo nutné (over 200 rows), `@tanstack/react-virtual` je drop-in v adapteri.

## 5. Routing

| Voľba | `react-router@6.x` (data router API) |
|---|---|
| URL | https://reactrouter.com/en/main |
| Licencia | MIT |
| Aktivita | ~13M weekly downloads; v6.x stable, v7 v betach 2026-Q1 (kompatibilný upgrade path). |
| Alternatívy | TanStack Router (mladší, lepšie TS, ale menej zrelý pre nested layout patterns), Wouter (príliš minimal). |
| Dôvod | Data loaders / actions (per route), nested layouts pre 3-pane workspace ticket detail (`W-02`), `Cmd+K` overlay ako modal route. |
| Bundle | ~14 kB |

### Code-splitting per route

- `React.lazy(() => import(...))` na route úrovni — TipTap, FullCalendar, Cytoscape lazy-load len pre cesty `/kb/editor`, `/changes/calendar`, `/cmdb/ci/*`.
- Wireframe `screen-inventory.md` enumeruje heavy chunks v sekcii "Otvorené závislosti" P-12 / W-04 / W-03 / W-05.

## 6. i18n

| Voľba | `react-i18next@15.x` + `i18next@23.x` + `i18next-icu` |
|---|---|
| URL | https://react.i18next.com |
| Licencia | MIT |
| Aktivita | ~8M weekly downloads; aktívne udržiavané. |
| Alternatívy | `@formatjs/intl` (FormatJS rodina — solídna, ale väčší boilerplate), `lingui` (compile-time — menšia komunita). |
| Dôvod | ICU MessageFormat pre plurály a vnorené hodnoty; namespace per modul (`incident`, `request`, ...); lazy-loaded locale JSON-y per route. |
| Bundle | ~25 kB (jadro + ICU plugin) |

### R-102 — dynamic backend values

Backend (CA SDM) vystavuje labels per-tenant (status names, category names) — i18next funguje primárne s **kľúčmi**, ale dynamic backend hodnoty sú zhubo pripravené v `tenant-scoped` namespacoch:

- Static keys: `pages.incident.title` → `"Incident"`.
- Dynamic backend values: zostávajú v backend response a sú dispatched cez `<BackendLabel/>` komponent, nie cez `t()`.

## 7. UI primitives / a11y

| Voľba | **Radix UI Primitives** (`@radix-ui/react-*`) + voliteľne **React Aria** (`@react-aria/*`) pre extra-náročné komponenty (combo boxes, date picker grids) |
|---|---|
| URL | https://www.radix-ui.com / https://react-spectrum.adobe.com/react-aria/ |
| Licencia | MIT (Radix), Apache 2.0 (React Aria) |
| Aktivita | Radix ~2M weekly per komponent; React Aria Adobe-backed, mesačné release-y. |
| Alternatívy | Headless UI (Tailwind tým, menej komponentov), MUI base (väčší bundle), Mantine (opinionated styling). |
| Dôvod | Headless + bezbariérovo by default; primitives vyhovujú akémukoľvek Design Systemu (07); WCAG 2.1 AA (R-101) sa stavia "zhora" na Radix-e bez fighting frameworku. |
| Bundle | ~5 kB per komponent (tree-shakable). |

> Final call o komponentovej knižnici je u **Design System agenta**. Tu konštatujem dostupnosť primitives pre prípad custom Design Systemu, čo je default predpoklad per `GOAL.md` §11.

## 8. WYSIWYG editor (KB)

| Voľba | `@tiptap/react@2.x` + extensions (`StarterKit`, `Image`, `Link`, `CodeBlockLowlight`) |
|---|---|
| URL | https://tiptap.dev |
| Licencia | MIT |
| Aktivita | ~600k weekly; v2.x stable; aktívne. |
| Alternatívy | Lexical (Meta-backed, ale React adapter je menej dokumentovaný), ProseMirror (low-level base, na ktorom TipTap stojí), SlateJS (vyspelá, ale pomalšie iterujúca). |
| Dôvod | Wrapper okolo ProseMirror; modulárne extensions; React-friendly API; markdown serialization plugin (R-010). |
| Bundle | ~70 kB jadro + per-extension granular (lazy-loaded na `/kb/editor` route only). |

## 9. Kalendár

| Voľba | `@fullcalendar/react@6.x` + `@fullcalendar/daygrid` + `@fullcalendar/timegrid` |
|---|---|
| URL | https://fullcalendar.io |
| Licencia | MIT (open-source build; Scheduler plugin je komerčný — **nevyžadujeme** v MVP). |
| Aktivita | ~600k weekly; v6.x stable. |
| Alternatívy | React Big Calendar (jednoduchší ale staršie UX), custom canvas (overkill). |
| Dôvod | Drag-drop, rôzne views (week / month), risk-color blocking pre Change Calendar W-03. Lazy-load na `/changes/calendar`. |
| Bundle | ~95 kB (lazy-loaded). |

## 10. Graph viz

| Voľba | `cytoscape@3.x` + `react-cytoscapejs@2.x` (alebo direct mount cez `useEffect`) |
|---|---|
| URL | https://js.cytoscape.org |
| Licencia | MIT |
| Aktivita | ~150k weekly; aktívne. |
| Alternatívy | vis-network (canvas), Sigma.js (najmä veľké grafy, overkill), React Flow (node-editor — iný use case). |
| Dôvod | CMDB CI relationships (R-011, W-05). Canvas mode pre 100+ nodes; layout algorithms (cose-bilkent) bez fightu. |
| Bundle | ~110 kB jadro + layout (lazy). |

## 11. Unit testing

| Voľba | `vitest@1.x` + `@testing-library/react@16.x` + `@testing-library/user-event@14.x` |
|---|---|
| URL | https://vitest.dev / https://testing-library.com |
| Licencia | MIT |
| Aktivita | Vitest ~7M weekly; TL ~10M weekly. |
| Alternatívy | Jest (slower for ESM-native projektov), Playwright Component Testing (mladší). |
| Dôvod | Native Vite integration (zdieľa transformer s `vite.config.ts`); jsdom env default; in-source testing pre helper funkcie. |
| Bundle | dev-only |

## 12. E2E testing

| Voľba | `playwright@1.x` |
|---|---|
| URL | https://playwright.dev |
| Licencia | Apache 2.0 |
| Aktivita | ~6M weekly; aktívne (mesačné releases). |
| Alternatívy | Cypress (slower, single-browser per session), WebdriverIO (verbose). |
| Dôvod | Cross-browser (Chrome/Edge/Firefox/Safari per `GOAL.md` §5); network mocking; **trace viewer** pre debug v CI; accessibility audit cez `@axe-core/playwright`. |
| Bundle | dev-only |

## 13. Mock backend (DevEx)

| Voľba | `msw@2.x` (Mock Service Worker) |
|---|---|
| URL | https://mswjs.io |
| Licencia | MIT |
| Aktivita | ~2M weekly; aktívne. |
| Alternatívy | json-server (príliš jednoduchý), Mirage JS (legacy CommonJS overhead), Nock (Node-only). |
| Dôvod | Browser **aj** Node — používa sa v dev mode (service worker) **aj** v Vitest (request interceptor). Per `GOAL.md` §5, `08-devex-devops` ho implementuje nad schémami z `api-analyst/schemas/*.ts`. |
| Bundle | dev-only (`public/mockServiceWorker.js` v dev mode). |

## 14. Error tracking

| Voľba | `@sentry/react@8.x` + `@sentry/vite-plugin` |
|---|---|
| URL | https://sentry.io |
| Licencia | BSL 1.1 → Apache 2.0 dual (FE SDK je MIT effectively). Self-hosted backend MIT do verzie 21. |
| Aktivita | ~4M weekly; aktívne (týždenné releases). |
| Alternatívy | OpenTelemetry + Honeycomb (overhead pre FE), Rollbar (smaller community), self-hosted GlitchTip. |
| Dôvod | React error boundary integrácia; performance tracing; **per-tenant tags** umožnia filtrovať incidenty per zákazník (kritické pre multi-tenancy support flow). Source map upload via Vite plugin. |
| Bundle | ~75 kB (lazy-loaded; alebo CDN). |

## 15. HTTP klient

| Voľba | **natívny `fetch`** abstrahovaný cez `packages/api-client/http.ts` (volaný z TanStack Query mutations / queries) |
|---|---|
| URL | n/a (browser native) |
| Licencia | n/a |
| Aktivita | n/a |
| Alternatívy | axios (~30 kB nadbytočne), ky (~5 kB wrapper). |
| Dôvod | Žiadny extra bundle; AbortController native pre cancellation; `Response.body.getReader()` ak by sme niekedy streamovali. Pre BFF JSON volania nie je potreba viac. |
| Bundle | 0 kB |

### Konvencia

```ts
// packages/api-client/http.ts
export async function http<T>(input: string, init?: RequestInit & { schema: ZodSchema<T> }): Promise<T> {
  const res = await fetch(input, { credentials: "include", ...init });
  if (!res.ok) throw new HttpError(res.status, await res.text());
  return init?.schema?.parse(await res.json()) ?? (await res.json());
}
```

## 16. SSO / OIDC (predpoklad: BFF cookie session)

| Voľba | **Žiadna** explicitná FE OIDC knižnica v MVP. BFF drží `X-AccessKey`, FE má len HttpOnly session cookie. Redirect-on-401 logika v TanStack Query global `onError` handler. |
|---|---|
| Alternatívne (ak Architecture zvolí client-side OIDC) | `oidc-client-ts@3.x` + `react-oidc-context@3.x`. MIT, aktívne (~200k weekly). |
| Dôvod | `api-analyst/auth.md` §6 odporúča BFF-side token handling kvôli XSS riziku. FE potom nepotrebuje OIDC knižnicu vôbec. |

## 17. Pomocné knižnice

| Oblasť | Knižnica | Licencia | Dôvod |
|---|---|---|---|
| Ikony | `lucide-react@0.4.x` | ISC | Tree-shakable SVG sady; konzistentný štýl pre Design System. |
| Dátum / čas | **`date-fns@3.x`** (modular) alebo natívny `Intl` API | MIT | Service Desk pracuje s timezones (multi-tenant, R-009); modular import minimalizuje bundle. Day.js je alternatíva (~2 kB), ale date-fns má lepšie TS types. |
| URL parsing / query string | natívny `URLSearchParams` | n/a | Žiadna explicitná závislosť. |
| Markdown render (KB read) | `react-markdown@9.x` + `remark-gfm` + `rehype-highlight` | MIT | Bezpečný markdown rendering (žiadny `dangerouslySetInnerHTML`). Used na `/kb/article/:id`. |
| Toast notifikácie | `sonner@1.x` (alebo Radix Toast) | MIT | Lightweight, accessible. |
| Clipboard | `navigator.clipboard` API + `useClipboard` mini-hook | n/a | Žiadna 3rd party. |
| Charts (KB analytics W-10, v1 only) | `recharts@2.x` alebo `visx@3.x` | MIT | v1+ — nie MVP. **Voľba odložená** do v1 (vlastník: Design System + Tech Stack revízia). |

## 18. Lint / formát / type-check

| Tool | Verzia | Účel |
|---|---|---|
| TypeScript | `5.x` strict mode | Type-checking; `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`. |
| ESLint | `9.x` (flat config) + `@typescript-eslint`, `eslint-plugin-react`, `eslint-plugin-jsx-a11y`, `eslint-plugin-react-hooks` | Lint |
| Prettier | `3.x` | Formát |
| Stylelint | `16.x` | CSS Modules lint |
| dprint (alt.) | — | Iba ak DevOps preferuje rýchlejší formatter |
| Husky + lint-staged | `9.x` / `15.x` | Pre-commit hooks |

> Konkrétny config = vlastníctvo `08-devex-devops`. Tu len konštatujem štandard.

## 19. Bundle baseline odhad — pre Portal (mobile-first)

| Vrstva | gzipped kB |
|---|:---:|
| React 19 + ReactDOM | 44 |
| React Router 6 (data router) | 14 |
| TanStack Query v5 | 14 |
| TanStack Table v8 (basic) | 14 |
| RHF + Zod + resolvers | 26 |
| react-i18next + i18next + ICU | 25 |
| Radix UI primitives (~8 komponentov) | 35 |
| Sentry React (async) | ~0 (lazy) |
| App code MVP | ~30 |
| **Spolu (initial chunk po code-splitting)** | **~200** |

> TipTap, FullCalendar, Cytoscape sú **lazy chunks** mimo initial bundle. TTI < 2 s je dosiahnuteľné pri ~200 kB initial + dobre konfigurovaný Vite (preload directives).

## Otvorené závislosti

- `[04-architecture]` Potvrdiť BFF cookie session (riadok 16) — alternatíva
  `oidc-client-ts` zostáva pripravená.
- `[04-architecture]` Confirm data fetching: TanStack Query (default tu)
  vs. RTK Query. Žiadny dôvod meniť, ak Architecture nedospievi k iným
  záverom (Redux ekosystém by sa otvoril, čo nie je v scope §11).
- `[07-design-system]` Final call o komponentovej knižnici (Radix vs. MUI vs.
  Mantine vs. custom). Predpoklad: custom + Radix primitives.
- `[08-devex-devops]` Voľba: `@vitejs/plugin-react` (Babel) vs.
  `@vitejs/plugin-react-swc`. Neutrálna voľba, DX & build speed. Predpoklad:
  SWC pre rýchlejší prod build.
- `[?]` Charts knižnica pre v1 KB analytics (W-10) — odložené z MVP, ale
  mali by sme rozhodnúť pred v1 plánovaním. Kandidáti: `recharts`, `visx`,
  `nivo`.
