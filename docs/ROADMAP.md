# SDM-Rewrite Roadmap

> Jediný zdroj pravdy pre **post-bootstrap sequencing**. Strategický plán, nie day-to-day
> tracker (tým sú GitHub Pull Requests + Issues). Aktualizuje sa **per merge** — každý
> chunk po merge prepne svoj status, neaktualizuje sa kontinuálne počas práce.

## Ako tento dokument použiť

**Pre nový chat session (po `/clear` alebo kompakcii):**

1. Prečítaj sekciu [Aktuálny stav](#aktuálny-stav) — vieš kde si.
2. **Ak má chunk per-chunk plán** v `docs/plans/<Phase>.<N>.md` (Phase F+), prečítaj ten — má Inputs/Outputs/Stratégiu pre `/clear` workflow. Žiadne ďalšie pre-loading.
3. Inak prečítaj `Inputs` najbližšieho `🔜 NEXT` chunku v tomto dokumente — vieš čo robíš.
4. Pracuj proti `Outputs` a `Done-when` kritériám — vieš kedy si hotový.

Per-chunk plány (od Phase F) sú v `docs/plans/`. Index: [docs/plans/README.md](./plans/README.md).

**Princíp vrstvenia:** každý chunk má explicit `Inputs` (čo treba prečítať) a `Outputs`
(čo bude existovať po merge). Žiadne implicitné vedomosti z prechádzajúcich chat
session-ov. Nový chat sa orientuje cez tento dokument + linkované špec docs + `git log`.

## Aktuálny stav

- **Last merged:** Chunk H.5 (Portal service catalog + new-request — DynamicForm, PR #31). Predchádzajúce: PR #30 — H.3 new-incident; PR #29 — H.4 ticket-detail.
- **In flight:** Phase H — Feature modules (8/17 chunks merged).
- **Next up:** Chunk H.6 — Portal KB search + article per H.md §D2 recommended order.

Posledná revízia tohto dokumentu: H.5 DONE (2026-05-29).

---

## Fázy

### Phase 0 — Analytical pipeline ✅ DONE

- **Outputs:** `docs/agents/{01-api-analyst..09-qa-test-strategy}/*` + `docs/spec/<modul>.md` + `docs/{system-overview,dev-handbook,onboarding}.md`
- **Detail:** `.agents/runs/20260508-192438/summary.md`
- **Merge:** PR #1 (kickoff), PR #2 (docs konvergencia)

### Phase C — Bootstrap ✅ DONE

> Phase A/B sú interné fázy round-1 analytického pipeline-u, nie implementačné. Phase C
> je fyzický scaffolding — definovaný v `docs/agents/devex-devops/scaffolding-checklist.md`.

- **Inputs:** `docs/agents/devex-devops/{repo-bootstrap,scaffolding-checklist}.md`, `monorepo-layout.md`
- **Outputs:** hermetic monorepo (18 workspace stubov), 3 Docker images (BFF + portal + workspace), Helm chart (`deploy/helm/sdm/`), CI workflows (ci.yml + release.yml), devcontainer, husky
- **Done-when:** `pnpm install/typecheck/lint/build` zelené, `hadolint`/`actionlint`/`helm lint` čisté, BFF prod smoke (`/health`)
- **Merge:** PR #3

### Phase D — Primary libraries ✅ DONE (PR #4)

- **Inputs:** `docs/agents/domain-modeller/model.ts`, `docs/agents/architecture/decision-records/08-error-handling.md`, `docs/agents/security/auth-flow.md` §session shape
- **Outputs:**
  - `@sdm/domain` — canonical typed model (891 LOC), branded ID factories, RBAC stub
  - `@sdm/api-client` — `HttpClient` s `X-Correlation-ID` + `X-CA-SDM-Tenant`, `AppError` taxonómia
  - `@sdm/auth` — `<Can>` + `<RouteGuard>`, session shape, login helpers
  - Vitest infrastructure (29 unit tests baseline)
- **Done-when:** `pnpm -r test` zelené, 29 testov pass

### Phase E — Dev productivity unlock 🔜 NEXT (3 chunks)

> Cieľ fázy: `pnpm dev` otvorí použiteľné portál + workspace UI **bez bežiaceho BFF**.

#### E.1 — `@sdm/api-mocks` MSW handlers ✅ DONE (commit `aa574a2`)

- **Inputs:** `docs/agents/devex-devops/mock-strategy.md`, `docs/agents/api-analyst/endpoints.md` + `schemas/*`
- **Outputs:** `packages/api-mocks/src/handlers/{auth,users,tenants,incidents,requests,problems,changes,knowledge,cmdb,audit,config}.ts` (BFF layer, paths v `/api/*` + `/me/*` + `/auth/*` + `/config`), deterministic fixtures (~300 záznamov, faker seed 42/43), in-memory store, `browser.ts` + `node.ts` worker bootstraps, `apps/{portal,workspace}/{public/mockServiceWorker.js,src/mocks/browser.ts}` + conditional `main.tsx` bootstrap pri `VITE_USE_MOCKS=true`
- **Done-when:** `VITE_USE_MOCKS=true pnpm dev` otvorí SPA bez BFF, MSW intercept-uje `/api/*` a `/me/*`; nové vitest test-y pre handler shapes (28 testov, tenant scope + pagination + filtre)
- **Scope deviation vs mock-strategy.md:** upstream `/caisd-rest/*` mocky (pre BFF integration testy) sa **odkladajú do Phase F** — bez bežiaceho BFF nie sú v práve teraz použité; chunk si zachoval 10 handler modulov, ale len BFF vrstvu. `@mswjs/data` vynechané — plain in-memory arrays pre 300 fixture-rekordov bez nákladu na typovú integráciu

#### E.2 — Reálne RBAC mapping ✅ DONE (PR #5)

- **Inputs:** `docs/agents/security/rbac.md` (8 UI rolí × 31 obrazoviek matrix, round 2)
- **Outputs:**
  - `@sdm/domain` model — `UIRole` (8 hodnôt vrátane `requester_external` subtype), `Permission` ~70 dot-notation kľúčov
  - `@sdm/domain` permissions.ts — `ROLE_PERMISSIONS` map, 31-screen visibility tabuľka, multi-role aggregation, 20 per-screen / per-action guard helpers
  - `@sdm/auth` — `<Can>`, `<RouteGuard>`, nový `<ScreenGuard>` (view/edit mode + multi-role aggregation)
  - `@sdm/api-mocks` users — re-seed na nové UI role + 4 noví používatelia (kb_editor, cmdb_owner, requester, sp_admin)
- **Done-when:** 170/170 testov zelených; `<Can>` × každá rola × 10 kľúčových permissions/screens kombinácie verifikované

#### E.3 — SPA App Shell + bootstrap ✅ DONE

- **Inputs:** `docs/agents/architecture/monorepo-layout.md` §apps, `docs/agents/ux-persona-analyst/wireframes/shared/`, `docs/agents/devex-devops/runtime-config.md`
- **Outputs:**
  - `apps/{portal,workspace}/src/bootstrap/{config,session}.ts` — `/config` loader (mini shape, full `RuntimeConfig` per `runtime-config.md` odložené do F.4) + `/me` + `/me/tenants` aggregator → typed `Session` (roles + permissions derived via `getPermissionsForRole`)
  - `apps/{portal,workspace}/src/shell/{app-shell,error-boundary,session-context,top-bar,tenant-switcher,styles.css}` — top bar, brand, tenant dropdown (P0 per shared wireframe), user pill, React `ErrorBoundary`
  - SPA-owned active tenant (localStorage + `X-CA-SDM-Tenant` header injection) — mirroruje reálne BFF tenant context správanie; obchádza MSW SW Set-Cookie limit
  - `tools/browser-test/scenarios/{smoke-portal,smoke-workspace,mocks-tenant-isolation,mocks-mutation-roundtrip,auth-session-cookie}.spec.ts` — re-aligned na nový shell (testid `top-bar` / `active-tenant` / `tenant-display` / `tenant-row-<id>`)
- **Done-when:** 170 unit testov + 5 browser-test scenárov pass; `pnpm typecheck`/`lint`/`build` zelené; tenant switch end-to-end overený (Acme → Globex) pre portal aj workspace

### Phase F — BFF real implementation ✅ DONE (6 chunks)

> Cieľ fázy: SPA prepneme z MSW na bežiaci BFF. End-to-end loop funguje proti reálnemu CA SDM
> backend-u (`10.11.35.35:8050` v dev). Detailný plán + cross-chunk rozhodnutia: [docs/plans/F.md](./plans/F.md).

- **F.1 Auth module ✅ DONE** — Basic Auth → access_key broker, in-memory session store, `/auth/*`, `/me` canonical shape, CSRF Origin check. Live smoke proti real `10.11.35.35:8050` zelený. Plán: [F.1.md](./plans/F.1.md).
- **F.2 REST proxy ✅ DONE** — shared `SdmHttpClient`, error shaper (HTTP 400 + "Invalid REST Access Key" → AUTH_EXPIRED, HTTP 409 + "Invalid number of rows (0) affected" → NOT_FOUND, JSON+XML error bodies), tenant scoping (single-tenant placeholder skip per `real-backend-contracts.md` §6), XML→JSON adapter (`fast-xml-parser` w/ shared options), and 7 entity proxies covering `in`/`cr`/`pr`/`chg`/`KD`/`nr` + reference factories (TTL 15 min in-memory cache). Live smoke proti real `10.11.35.35:8050` zelený (list / detail / cache / schema-divergent `chg` / uppercase `KD` / 404 error path). Plán: [F.2.md](./plans/F.2.md).
- **F.3 Aggregator endpoints ✅ DONE** — `/me/tenants` separate endpoint (5 min TTL, derives from `session.tenants[]` until multi-tenant rollout), `/api/queue` parallel fan-out (`in`+`cr`+`pr`, merge by priority desc + openedAt desc, 30 s TTL, partial-failure tolerant), `/api/tickets/:type/:id` MVP stub (parent fetch only, linked/attachments/activity = `_unsupported: true` arrays — `lrel_*`/`attmnt`/`act_log` factory probe deferred to a follow-up B-E discovery chunk). Carry-overs A/B/C resolved (TTL-only invalidation, separate /me/tenants endpoint, F.2 mapRow reuse exported). Live smoke proti real `10.11.35.35:8050` zelený (17 incident + 7 request + 1 problem v queue, ticket-detail shape ok). Plán: [F.3.md](./plans/F.3.md).
- **F.4 Platform ✅ DONE** — audit module (`platform/audit/{events,redact,emit}.ts`, canonical 40-event taxonómia per `audit-and-compliance.md §2`, PII redaction + SHA256 pseudonymize per §4, 1:100 sampling for `session.heartbeat` per §3) hooked into auth/login+logout+heartbeat+session-expired + me/tenant-switch + csrf-violation + entity-routes `data.<entity>.{write,delete}`. `/config` endpoint serves canonical `RuntimeConfig` per `runtime-config.md` (lazy re-read of `process.cwd()/config.json` + env overrides for deploy-injected meta, fallback defaults in dev). `/readyz` two-step probe: cached broker bootstrap (5 min refresh) + `GET /pri?size=1` with 2 s timeout. Live smoke proti real `10.11.35.35:8050` zelený (positive + negative path). Plán: [F.4.md](./plans/F.4.md).
- **F.5 Cleanup MSW vs BFF ✅ DONE** — `/me` canonical §4.5 shape (single fetch, FE no longer derives permissions; `effectivePermissions[]` z BFF); `/config` canonical RuntimeConfig (Phase F.4 wire). Minimal `LoginPage` v oboch SPA (portal + workspace own each its `/login`), `Heartbeat` (30 s debounced na user-events) + `IdleModal` (29 min warning, 30 min redirect) shell komponenty, cross-tab sync cez `@sdm/api-client/cross-tab.ts` (BroadcastChannel + Safari iOS < 15.4 fallback). MSW handler-y (`users.ts`/`tenants.ts`/`config.ts`) zarovnané na canonical shape v jednom kroku — no dual-shape compat. CSRF wiring: Origin-only (per F.1 baseline) — `Session.csrfToken` field zachovaný len pre §4.5 paritu (BFF vracia `""`). Failover doc nový (`docs/agents/devex-devops/failover.md`) — BFF restart = re-login acceptable v MVP, Redis deferred. Plán: [F.5.md](./plans/F.5.md).
- **F.6 Ticket-detail B-E probe ✅ DONE** — probe `act_log` (BREL → `alg` / `chgalg`) + `attachments` (BLREL → `lrel_attachments_{requests,changes}` join + per-row `/attmnt/{id}` enrichment) proti `10.11.35.35:8050` (skript `tools/sdm-probe/probe-ticket-detail.sh`). Append `§22-§24` do `real-backend-contracts.md` — activity + attachments (live shapes), linked (verdict: no BREL on this CA SDM 17.4 instance, stays `_unsupported: true`). Aggregator `ticket-detail.ts` paralelný fan-out cez `Promise.allSettled` (partial-failure tolerant: failed branch → `_unsupported: true`, parent stále 200). Nové mappery `apps/bff/src/api/endpoints/{activity-log,attachments}.ts` — kind derivácia z `internal` + `aty.REL_ATTR`, MIME z `file_type` whitelist. Live smoke proti CA SDM zelený pre všetky 4 typy (in/2800: 6 activity, cr/2851: empty, pr/406621: 2, chg/2781: 4). Plán: [F.6.md](./plans/F.6.md), PR #18.
- **Scope-out (deferred z F.x):** Redis session store, OIDC SSO (čaká na corp IdP), SAML, CI neighborhood BFS, bulk MFA step-up.
- **Done-when:** SPA proti BFF (`VITE_USE_MOCKS=false`) — full login → queue → ticket → logout loop, oba módy MSW/BFF funkčné, audit eventy emit-ujú.

### Phase G — Cross-cutting concerns ✅ DONE (5 chunks)

- **G.1 Design system tokens + base komponenty ✅ DONE** — `@sdm/design-system` plne naplnený: `tokens.css` (typography, light/dark/hc colors, spacing, radius, shadow, motion, z-index, breakpoints, layout, borders), `reset.css`, FOUC-safe inline script v `apps/{portal,workspace}/index.html`, 12 base komponentov (Icon, Button, IconButton, Link, Badge, StatusBadge, PriorityBadge, Card, TextField, TextArea, Select, Checkbox) — každý s CSS Module + 3+ vitest tests + `data-component` attr (39 testov spolu). Forms `Select`/`Checkbox` na Radix primitives, `Icon` na lucide-react. Shell login + top-bar v portal aj workspace teraz konzumujú `Button` + `Card` z `@sdm/design-system`. Bundle delta +31 KB gzip (Radix Select/Checkbox) deferred to G.4 manualChunks + size-limit budgets. Plán: [G.1.md](./plans/G.1.md), PR #19.
- **G.2 i18n provider + catalogs (sk/en) ✅ DONE** — `@sdm/i18n` plne naplnený: `i18next@23 + react-i18next@15 + i18next-icu + intl-messageformat@11` adapter. Catalogs JSON: `shared/{sk,en}.json` (52 keys: actions, status, priority, meta, errors, validation, session, plurals, time, language), `portal/{sk,en}.json` (16 keys: shell, nav, catalog, greeting, empty, feedback), `workspace/{sk,en}.json` (20 keys: shell, queue, actions, composer, sla) — 88 keys spolu, 100% SK ↔ EN parity. Public API: `I18nProvider`, `bootstrapI18n`, `changeLocale`, `useTranslation`, `useLocale`, `useDynamic`, `Trans`, `dynamic`, `formatDate`, `formatNumber`, `formatRelative`, `detectLocale`/`persistLocale`. ICU MessageFormat overené pre SK 3+exact-form plurals (`=0`, `one`, `few`, `other`) v `plurals.test.ts`. Locale persisted v `localStorage.sdm.locale`, `<html lang>` updated on switch (FOUC-safe — bootstrap je await-ed pred React render). Shell migrované: `login-page` + `idle-modal` + `tenant-switcher` + `top-bar` + `app-shell` v oboch SPA cez `useTranslation()`; žiadne hardcoded SK strings v `apps/{portal,workspace}/src/shell/*`. `LanguageSwitcher` v topbar — SK/EN dropdown s lazy-load druhého locale. Bundle delta: +28.6 KB gzip (portal index 91.5 → 120.1 KB gzip), catalogs chunked per-locale. CI gate `pnpm i18n:check` (pure-Node stdlib script v `tools/i18n-check/src/cli.js`) blokuje merge pri SK ↔ EN drift. Plán: [G.2.md](./plans/G.2.md), PR TBD.
- **G.3 Observability ✅ DONE** — `@sentry/react@8` v portal + workspace (DSN cez runtime `/config` → `observability.sentryDsn`, no-op pri `null`/missing), `beforeSend` deep PII strip pre 16 substring fragments (`email`, `displayName`, `firstName`, `lastName`, `fullName`, `name`, `description`, `summary`, `body`, `text`, `customer`, `analyst`, `assignee`, `requester`, `phone`, `address`), Sentry user context: `setUser({ id: SHA-256(tenantId+userId) prefix 16 })` per-tenant salt anti-cross-tenant correlation. ULID (Crockford base32, 26 chars) ako default `X-Correlation-ID` formát v `@sdm/api-client/HttpClient` (per ADR-09 r2). `Sentry.ErrorBoundary` wraps shell tree v oboch SPA s i18n fallback (`errors.boundaryTitle/Body/Refresh` v shared sk/en catalogs). `@sentry/vite-plugin@2` conditional na `SENTRY_AUTH_TOKEN` env (gated v CI cez `secrets.SENTRY_AUTH_TOKEN` detection step), `sourcemap: "hidden"` — maps v Sentry, NIE servované zo `public/`. Bundle delta: +42 KB gzip (portal 120.1 → 162.6 KB gzip) — Sentry React + browserTracingIntegration; v rámci G.4 LHCI tolerance headroom. **Follow-up**: user musí pridať `SENTRY_AUTH_TOKEN`/`SENTRY_ORG`/`SENTRY_PROJECT_*` GitHub repo secrets aby source-maps upload v CI bežal — bez secret-u step skip-uje. Plán: [G.3.md](./plans/G.3.md), PR #22.
- **G.4 Performance budgets ✅ DONE** — `size-limit@12` + `@size-limit/preset-app` per app (`apps/{portal,workspace}/.size-limit.json`) enforces 180 KB portal / 350 KB workspace initial JS + 30 / 60 KB initial CSS + per-vendor caps (vendor-react 70 KB, vendor-i18n 35 KB, vendor-ds 35 KB, vendor-observability 45 KB). Vite `manualChunks(id)` splits node_modules into `vendor-react` / `vendor-i18n` / `vendor-ds` / `vendor-observability` chunks (predictable file-name pattern, pnpm `.pnpm/<pkg>@<ver>/...` aware). `rollup-plugin-visualizer@7` emits `dist/stats.html` per app, uploaded as `bundle-stats` CI artifact (14-day retention). `@lhci/cli@0.15` runs 3 audits per route via `scripts/lhci-collect.sh` (portal mobile form-factor + custom slow-4G + 4x CPU throttling; workspace desktop preset). Per-PR LHCI asserts `CLS ≤ 0.05` + `categories:accessibility ≥ 0.9` + `categories:best-practices ≥ 0.9` as **blocking error** (robust against Phase G bootstrap-failed state); numeric TTI/LCP/score from `performance.md §2` are listed as `warn` (graduate to `error` in Phase H once React Router lands and bootstrap is reachable in CI). Routes asserted today: portal `/` mobile, workspace `/` desktop. Routes commented as TODO Phase H: portal `/new-incident`, `/tickets`, `/tickets/:id`, `/catalog`, `/catalog/:itemId`, `/kb`, `/kb/article/:id`; workspace `/queue`, `/tickets/:id`, `/changes`, `/changes/calendar`, `/changes/:id`, `/cmdb`, `/cmdb/ci/:id`, `/kb/editor`. Final bundle (gzip): portal index 11.69 + vendor-react 58.57 + vendor-i18n 27.58 + vendor-ds 27.40 + vendor-observability 41.33 = **166.32 KB initial JS** (within 180 KB); workspace symmetric **166.34 KB** (within 350 KB) — no Sentry lazy-init needed. New `.github/workflows/perf-nightly.yml` runs full LHCI sweep nightly + on `main` push (informational; rolling baseline deferred post-MVP per `performance.md §6`). Plán: [G.4.md](./plans/G.4.md), PR #23.
- **G.5 Self-host fonts ✅ DONE** — Inter Variable + JetBrains Mono Variable woff2 (latin + latin-ext subsets) v `apps/{portal,workspace}/public/fonts/`, extrahované z `@fontsource-variable/{inter,jetbrains-mono}` (NIE runtime dep — len build-time source). `@font-face` deklarácie v `packages/design-system/src/tokens/fonts.css` s `font-display: swap`, `font-weight: 100 900` (Inter) / `100 800` (JBM) variable axis, canonical Google Fonts `unicode-range` per subset. `<link rel="preload">` pre `inter-variable-latin.woff2` v `<head>` oboch SPA. License files committed (`OFL-Inter.txt` + `OFL-JetBrainsMono.txt`, SIL OFL 1.1). Žiadny CDN call. Plán: [G.5.md](./plans/G.5.md), PR TBD.
- **Done-when:** brand visual identity konzistentná, sk+en kompletné, LHCI prahy pass, Sentry beží.

### Phase H — Feature modules ⏳ IN-FLIGHT (8/17 chunks DONE — najdlhšia, MVP scope)

- **H.5 Portal service catalog + new-request ✅ DONE** — `/catalog` + `/catalog/:itemId` routes. `CatalogRoute.tsx` (`CategoryTiles` 4-tile grid Hardvér/Softvér/Prístupy/Iné + `FeaturedItemCard` grid) + `CatalogItemRoute.tsx` (`DynamicForm` schema-driven render). `FieldRenderer` per-type dispatch — **12 field types**: text/textarea/number/date/select/multi/radio/checkbox/file/user-picker/ci-picker/markdown-help (registry pattern per libraries.md §3 — adding new type touches union → registry → renderer only). `buildZodSchema(fields)` produces Zod from `CatalogField[]`. Submit → `POST /api/requests { catalogItemId, fields }`. BFF augmentation: new `apps/bff/src/api/endpoints/catalog.ts` (186 LOC) — `GET /api/catalog/items` + `GET /api/catalog/items/:id` (fixture-backed; CA SDM nemá native Service Catalog REST surface). MSW handlers extended: requests.ts +catalog routes, users.ts `?q=` async loadOptions pre user-picker, cmdb.ts `?q=` pre ci-picker. Fixtures `packages/api-mocks/src/fixtures/catalog.ts` — 6 items, 4 categories, všetky field types covered. Deviations: `date` field uses native `<input type="date">` (DS DatePicker R-007 pending); `markdown-help` plain text `whitespace: pre-line` (react-markdown deferred H.6); `file` placeholder + "Upload bude dostupný čoskoro" (per H.3 attachments deferral); LHCI graduation reverted (`staticDistDir` returns 404 pre `/catalog`, blocked on MSW/stub-BFF wiring per H.0 pattern). Bundle: portal **162.16 KB / 180 KB** (flat vs H.3 162.1 KB — CatalogRoute lazy 3.74 KB + CatalogItemRoute lazy 14.62 KB; RHF/Zod re-used from H.3 vendor-state). i18n: +catalog.\* keys SK/EN. Browser test `h5-portal-catalog.spec.ts`. Plán: [H.5.md](./plans/H.5.md), PR #31.

- **H.3 Portal new-incident ✅ DONE** — `/new-incident` route — RHF + Zod form (`react-hook-form@7.54.2` + `@hookform/resolvers@3.10.0` + `zod@^3.23.8`). Fields: `summary` (TextField max 100), `description` (TextArea max 5000), `priority` (inline `<fieldset role="radiogroup">` — G.1 doesn't expose Radio primitive, native radios styled), `category` (Combobox). Helper text per microcopy.md §7; inline RHF field errors via `aria-describedby`. Submit → `POST /api/incidents` → `<SuccessScreen>` s ticket ID + 3 CTAs (View ticket / Report another / Done). PendingChanges register on dirty (H.1 context blocks tenant switch with ConfirmDialog). 401 → redirect `/login`; 4xx → inline RHF errors via `setError`; 5xx → toast. **Attachments deferred** per user default — TODO comment v `NewIncidentForm.tsx:41-46` references future scope (BFF multipart endpoint + virus-scan policy + DS FileUpload primitive). Bundle: portal **162.1 KB / 180 KB** (+0.04 KB vs H.4); `NewIncidentRoute` lazy chunk 24.15 KB (RHF + zod + resolvers contained). i18n: +25 SK/EN `newIncident.*` keys (99 portal parity). Tests: browser scenario `h3-portal-new-incident.spec.ts` (2 cases — fill+submit+success + validation). Plán: [H.3.md](./plans/H.3.md), PR #30.

- **H.4 Portal ticket-detail ✅ DONE** — `/tickets/:id` portal route (Lucia view) — single URL pattern s prefix-based type detection: canonical `incident:`/`request:`/`problem:`/`change:` IDs + ref-based `IN-`/`REQ-`/`PR-`/`CHG-` shorthand pre human-friendly URLs. Invalid prefix → `NotFoundElement`. `TicketDetailRoute` + 5 components: `TicketHeader` (ref + summary + StatusBadge + PriorityBadge + relative time), `TicketBody` (plain text `white-space: pre-wrap` — Markdown deferred to H.6 KB to keep bundle), `ActivityTimeline` (public + system filter, NO internal — defence-in-depth client-side filter), `AttachmentsList` (read-only chips per F.6 §23.6 deferred), `PublicComposer` (single-tab Composer, hidden when ticket closed). 404 → `NotFoundElement`, 403 → `ForbiddenElement` via RR6 error boundaries. `_unsupported: true` branches render empty states + tooltip "Táto sekcia bude dostupná čoskoro." per F.6. Comment POST reuses existing `packages/api-mocks/src/handlers/ticket-detail.ts` endpoint (H.8) — real BFF POST endpoint deferred follow-up Phase I. Bundle: portal **162.06 KB / 180 KB** (+0.13 KB vs H.2); `TicketDetailRoute` lazy chunk 2.90 KB gzip. i18n: +20 SK/EN `ticketDetail.*` keys (66 keys parity). Browser test 3 scenarios (`h4-portal-ticket-detail.spec.ts`): canonical `incident:10001` URL + comment submit + timeline update, `request:20001` type detection, garbage URL → not-found. Plán: [H.4.md](./plans/H.4.md), PR #29.

- **H.2 Portal home dashboard ✅ DONE** — `/` portal Lucia landing — `HomeRoute.tsx` + `homeLoader` + 4 components (`HeroGreeting`, `ActionCards`, `MyRecentTickets`, `KbSuggestions`). Loader pre-fetches `myTicketsQuery` + `kbSuggestionsQuery` cez `queryClient.ensureQueryData(...)` v `Promise.all` (no waterfall). Mobile-first responsive layout — single column < 640 px, 2-col action cards ≥ 640 px (`home.css`, CSS Grid). BFF augmentation: `_entity-routes.ts` gains `customerMeAttr` opt-in — `GET /api/incidents?customer=me` resolves server-side to `WC=customer=<session.contactId>` (incidents + requests opt in). MSW mirror v `incidents.ts` filtruje `requesterId === DEFAULT_USER_ID`. Status mapping mox: BFF `FkRef` + MSW `IncidentStatus` literal → design-system `TicketStatus` vocabulary. Bundle: portal **161.93 KB / 180 KB** (+2.62 KB vs H.1 baseline 159.31 KB); `HomeRoute` lazy chunk 7.10 KB gzip. i18n: +12 SK/EN home.\* keys; unused legacy `greeting` + `placeholders.{home,activeTenant}` removed. Tests: 3 nové BFF integration cases (customer=me happy, AND merge, untouched pass-through) + 2 MSW handler cases + 1 browser scenario (`h2-portal-home.spec.ts`). LHCI portal `/` mobile thresholds zostávajú `warn` (LHCI `staticDistDir` blokuje bootstrap — open follow-up Phase I per H.0 pattern). Deviations: ActionCards 2 (not 3 — KB shortcut covered by panel below); no `<ListRow>`/`<Avatar>` G.1 primitives shipped — semantic `<ul>`/`<li>` + text-only greeting used. Plán: [H.2.md](./plans/H.2.md), PR #28.

### Phase H scope reference (cont.)

- **H.8 Workspace ticket-detail ✅ DONE** — `/tickets/:id` agent route — `TicketDetailRoute.tsx` + 8 components: `AgentTicketHeader` (inline status/priority Combobox edit, optimistic UI), `ActionBar` (Take/Resolve/Escalate/Watch/More), `ActivityTimeline` (filter tabs All/Public/Internal/System — client-side filter na `activity.items`), `Composer` (3-tab: Public reply / Internal note / Resolution), `ContextPanel` (Requester card + CI card + Related records — empty state if `_unsupported: true`), `EscalateModal` + `ResolveModal` (Solution + Category dropdown). **TipTap deferred** per H.md §D3 — plain Textarea + markdown shorthand acceptable v MVP, v1+ wires TipTap. Composer Cmd+Enter submits. Transition actions emit existing F.4 audit (`data.incident.write` / `data.request.write`). New MSW handler `packages/api-mocks/src/handlers/ticket-detail.ts` (461 LOC) — full action endpoints (`take`/`resolve`/`escalate`/`watch`/`comment`). Activity filter tabs operate on already-loaded items (no extra BFF call). Plán: [H.8.md](./plans/H.8.md), PR #27.

### Phase H scope reference (cont.)

- **H.7 Workspace queue ✅ DONE** — `/queue` workspace default landing (`/` redirects), `QueueRoute.tsx` + 5 components (`QueueTable`, `FilterBar`, `QueueSidebar`, `SavedViewsManager`, `ColumnConfig`) consume F.3 aggregator `/api/queue` s filtrami (status/priority/assignee/type/customer/tenant). TanStack Table v8 basic mode (sort/filter/column config), localStorage-backed saved views via `useSyncExternalStore`. Keyboard nav `j`/`k`/`↑`/`↓`/`Enter`/`Esc` cez `react-hotkeys-hook` (introduced v H.1). Split-view URL pattern `?selected=:id` — H.7 ships placeholder right pane (H.8 fills). Pollovanie `refetchInterval: 30000` keď document visible (TQ `refetchIntervalInBackground: false`). MSW handler `packages/api-mocks/src/handlers/queue.ts` (180 LOC) — new handler s 50-line test suite. Empty state per `microcopy.md §4`. Bundle: vendor-state cap bumped 20 → 30 KB (TanStack Table v8 add-on); workspace **175.09 KB / 350 KB** (+15.7 KB vs H.1 baseline; vendor-state 23.4 KB). Tests: MSW handler + h7-workspace-queue browser spec (load → j/k → open detail → filter → save view). Plán: [H.7.md](./plans/H.7.md), PR #26.

### Phase H scope reference (cont.)

- **H.1 Tenant switcher activation ✅ DONE** — BFF `POST /me/active-tenant` validates membership + emits `authz.tenant.switch.{success,denied}` audit + returns full `/me` shape (shared `shapeMeResponse()` helper extracted, used by `GET /me` + `POST /me/active-tenant`). FE `useActiveTenant()` TanStack Query mutation: broad cache nuke via `removeQueries({ predicate: q => q.queryKey[0] !== "me" })` + `setQueryData(["me"], session)` atomic priming. TenantSwitcher rewrite per wireframe — `single` / `compact` / `expanded` variants, env badge color (production red per `tokens.md §4`), search input pre >10 tenants, kbd shortcut `T` (`react-hotkeys-hook@5.3.2`). Pending-changes guard: minimal `dirtyForms: Set<string>` context (`shell/pending-changes.tsx`), `ConfirmDialog` blocks switch when dirty; `PendingChangesTestBridge` dev-only shim for browser-tests (tree-shaken from prod). `session-context.tsx` API: `switchTenant()` replaced with `applySwitchedSession(SessionLoadResult)` — consumes mutation response directly, no extra `/me` round-trip; cross-tab `tenant-changed` broadcast preserved. `X-CA-SDM-Tenant` client header **removed** from `@sdm/api-client/http.ts` (tenant resolves server-side from session). MSW handler `users.ts` made stateful (`Map<userId, activeTenantId>`) per MSW v2 statelessness. Bundle: portal **159.31 KB / 180 KB** (+3.99 KB vs H.0); workspace **159.43 KB / 350 KB**. Tests: 6 BFF unit/integration cases (happy, 403 ghost, 401, 400 validation, idempotent, absolute timeout) + 2 browser scenarios (`h1-tenant-switch.spec.ts`, `h1-pending-changes-guard.spec.ts`). Plán: [H.1.md](./plans/H.1.md), PR #25.

### Phase H scope reference (cont.)

- **H.0 Routing infrastructure ✅ DONE** — `react-router-dom@6` data router (`createBrowserRouter` + `RouterProvider`) + `@tanstack/react-query@5` (5min stale, retry x1, no refetch on focus) wired v `apps/portal` + `apps/workspace`. Code-split per route cez `lazy()`; `routeGuard()` helper okolo lazy components s `<RouteGuard requires={...}>`. Portal placeholder routes: `/`, `/new-incident`, `/tickets`, `/tickets/:id`, `/catalog`, `/catalog/:itemId`, `/kb`, `/kb/article/:id`. Workspace placeholder routes: `/queue`, `/tickets/:id`, `/changes`, `/changes/calendar`, `/changes/:id`, `/problems`, `/cmdb`, `/cmdb/ci/:id`, `/kb`. `<AppShell>` ostáva s `children` API — `RootLayout` v `routes/index.tsx` podáva `<Outlet />` ako children (E.3 smoke contract preserved). `RootErrorBoundary` (404 / generic) + `<ForbiddenElement>` (403 s tenant switcher prominently) v `routes/error-boundaries.tsx`. Bundle mitigation Tier 1+2: `manualChunks` split (`vendor-router` 21.5 KB, `vendor-state` 7.4 KB) + lazy Sentry init (`bootstrap/sentry-bridge.ts` defers `@sentry/react` za `requestIdleCallback`, native React class boundary forwards errors → `vendor-observability` 120.6 KB moved out of initial). Final bundle (gzip): **portal 155.32 KB / 180 KB cap (24 KB headroom)** + **workspace 155.44 KB / 350 KB cap**. LHCI: numeric TTI/LCP/score zostávajú `warn` (graduate-uje keď LHCI infra dostane stub BFF / MSW-in-LHCI — staticDistDir fails `/config` 404 a LCP measures bootstrap error fallback; CLS + a11y + best-practices zostali `error`). Open follow-up pre Phase I: LHCI MSW/stub-BFF integration → graduate timing thresholds. Plán: [H.0.md](./plans/H.0.md), PR #24.

### Phase H scope reference

> MVP scope per `GOAL.md §3`: Incident, Request, Problem, Change, KB (read), CMDB (read), multi-tenancy.
> Každý modul má 1-N chunks per dvojica `(portal-feature, workspace-feature)`.

| Modul         | Spec                                | Portal features                          | Workspace features                                    |
| ------------- | ----------------------------------- | ---------------------------------------- | ----------------------------------------------------- |
| Incident      | `docs/spec/incident-management.md`  | new-incident, my-tickets, ticket-detail  | queue, ticket-detail (agent), bulk-ops\*              |
| Request       | `docs/spec/request-management.md`   | service-catalog, new-request, my-tickets | queue, request-detail                                 |
| Problem       | `docs/spec/problem-management.md`   | — (read-only via incident)               | problems list, problem-detail, link-to-incident       |
| Change        | `docs/spec/change-management.md`    | (read approve, mobile)                   | changes, change-detail, change-calendar, CAB approval |
| KB            | `docs/spec/knowledge-management.md` | kb-search, kb-article                    | kb-browse, (kb-editor v1)                             |
| CMDB          | `docs/spec/cmdb.md`                 | (none)                                   | cmdb (read), ci-detail, relationships                 |
| Multi-tenancy | `docs/spec/multi-tenancy.md`        | tenant-switcher                          | tenant-switcher                                       |

\* v1 scope, nie MVP.

- **Inputs per chunk:** príslušný `docs/spec/<modul>.md` + relevantné `docs/agents/ux-persona-analyst/wireframes/{portal,workspace}/<screen>.md` + `docs/agents/domain-modeller/lifecycles/<entity>.md` (kde existuje)
- **Outputs per chunk:** features pod `apps/<app>/src/features/<feature>/`, integ testy
- **Done-when chunk:** acceptance kritérium z `qa-test-strategy/acceptance-criteria.md` zelené pre danú feature

Granularita: 1 PR ≈ 1 (modul, app) dvojica. Odhad: **~25-35 PR** pre MVP scope.

### Phase I — Acceptance + production hardening 🔜 (~5 chunks)

- **I.1 Playwright e2e suite** — 18 acceptance criteria. Inputs: `qa-test-strategy/{acceptance-criteria,a11y-tests,performance}.md`.
- **I.2 Security audit** — CodeQL + Trufflehog + `pnpm audit` + Snyk/Semgrep eval. Inputs: `security/owasp-mitigations.md`.
- **I.3 Multi-tenancy edge cases** — RLS, cross-tenant data leak prevention, tenant switch state cleanup. Inputs: `docs/spec/multi-tenancy.md`.
- **I.4 Release v1.0 dry-run** — full helm install do staging, smoke run, rollback test. Inputs: `system-overview.md` §Release.
- **I.5 v1.0 cut** — semver tag, image push, helm OCI publish, release notes.

---

## v1 scope (post-MVP)

Tu sa neplánuje granulárne — po MVP cut sa znovu prejde tento dokument. Indicative
fázy (každá vlastné chunks):

- Bulk operations vo workspace queue (per `GOAL.md §3 v1`)
- KB editor (write/publish)
- CMDB editor + Visualizer integrácia
- Pokročilý Change Calendar + CAB workflow
- Reporting widgety

---

## Maintenance pravidlá

1. **Po merge PR-u:** toggle status príslušného chunku (`⏳ IN-FLIGHT` → `✅ DONE`), aktualizuj "Aktuálny stav" hore. Žiadny ďalší update; tento dokument **nie je day-to-day tracker**.
2. **Pri vzniku nového chunku:** pridaj entry s `Inputs` / `Outputs` / `Done-when` v príslušnej fáze.
3. **Pri zmene scope** (napr. v1 → MVP push-up): commit-ni úpravu tohto súboru ako súčasť PR-u, ktorý scope mení. Nepiš sem rozhodnutia v izolácii.
4. **Fázy sú stabilné.** Chunk granularita môže fluctuate (E.1 sa môže rozdeliť na E.1a/E.1b ak je príliš veľký). Phase letters nikdy nemení sémantiku.
5. **Žiadne duplikovanie:** sem nepíš to, čo už je v `docs/spec/*` alebo `docs/agents/*`. Sem patrí **iba poradie a status**; detail je inde.

## Tipy pre `/clear` workflow

- Tento dokument vždy linkuj v prvej správe nového chat-u (system prompt alebo prvý user message).
- Pri spustení nového chunku v novom chate: zadaj odkaz na `Inputs` daného chunku ako kontext, nie celú konverzáciu.
- Status update po merge urob v **tom istom PR-e** ako kód-changes (nie samostatne) — atomicita stavu.
