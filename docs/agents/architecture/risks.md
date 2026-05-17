# Architecture — riziká a otvorené otázky

> Riziká, ktoré sa otvárajú v dôsledku architektonických rozhodnutí, alebo
> ktoré z 01–03 prešli do oblasti, kde ich vlastní Architecture / Security /
> Stack / DevOps. Každé riziko má adresáta a navrhovanú mitigáciu.

## Changelog (round 2)

- Sekcia A-100 (open architectural questions) — väčšina otázok uzavretá
  cross-konvergenciou s 05/06/07/08 výstupmi. Konkrétne:
  - A-101 (BFF technológia) → resolved: **Hono 4 + Node 22 LTS** (ADR-01).
  - A-102 (session store) → resolved architecturally: **Redis prod /
    in-memory dev** (ADR-01, `components/bff.md` §2.2). 08 vlastní HA
    topológiu.
  - A-103 (IdP) → resolved by 05 `auth-flow.md` (OIDC Variant A primary,
    config-driven via 08 `runtime-config.md`).
  - A-104 (error tracking) → resolved: **Sentry React** (ADR-09); GlitchTip
    ostáva self-hosted swap (DSN-compatible).
  - A-105 (UI framework) → resolved: **React 19** (06).
  - A-106 (routing) → resolved: **React Router v6 data router** (ADR-05).
  - A-107 (form lib) → resolved: **React Hook Form + Zod** (ADR-06).
  - A-108 (WYSIWYG) → resolved: **TipTap** (06).
  - A-109 (graph viz) → resolved: **Cytoscape (canvas)** (06).
  - A-110 (calendar) → resolved: **FullCalendar** (06).
  - A-111 (cross-tenant viewer) → open (inherent API gap; 01 + 05 v r2
    ďalšieho behu môžu zatvoriť po referenčnej inštancii).
  - A-112 (Service Catalog form source) → open (inherent API gap, gap #3).
  - A-113 (step-up auth) → open (post-MVP; 05 nemá v r1 detailed flow).
  - A-114 (KB analytics) → open (post-MVP feature scope).
- Nové riziká po r2: žiadne (peer konvergencia neodhalila nové architektonické
  problémy).

## A-001 až A-020 — Architektonické

| # | Riziko | Dopad | Mitigácia | Vlastník mitigácie |
|---|---|---|---|---|
| A-001 | **BFF ako SPOF** — single instance v MVP = výpadok zhasne FE. | High v prod, low v dev | MVP: hot-standby + monitoring, automatický restart cez systemd / Kubernetes. v1: horizontal scaling s Redis session store. | `08-devex-devops` |
| A-002 | **CA SDM rate limit neznámy** (api-analyst flag `bulk-rate-limit`) — BFF môže preťažiť backend pri queue refresh × N concurrent users. | Medium | Konzervatívny per-instance concurrency limit (max 20 paralelných CA SDM calls), exponential backoff pri 5xx, monitor cez `casdm.errors` metric. | `08-devex-devops`, `09-qa` |
| A-003 | **Session store SPOF v MVP** — in-memory session = restart BFF = všetci odhlásení. | Medium | Akceptujeme v MVP; release notes hovoria "redeploy pri pracovnom čase". v1: Redis. | `08-devex-devops` |
| A-004 | **Two-tab tenant drift** — user prepne tenant v tab A, tab B má starý kontext. | Medium | BFF detekuje `X-CA-SDM-Tenant` mismatch → 403 TENANT_FORBIDDEN s `correctTenantId`, FE auto-refresh. 05 doplnil druhý fail-safe cez `__Host-sdm.tenantVer` cookie + BroadcastChannel. Detail v `data-flows.md` § 2 + `decision-records/11-multi-tenancy.md` §2.3. | `04-architecture` (vyriešené), `09-qa` test scenár |
| A-005 | **Service Catalog form schema neznáma** (api-analyst gap #3) — bez nej JsonSchemaForm renderer nemá vstup. | High — blokuje P-03 wireframe | Spike v round 2: testovať na referenčnej CA SDM inštancii po nasadení. Plán B: minimal MVP renderer s 5 field types, ostatné po v1. | `01-api-analyst`, `04-architecture` |
| A-006 | **Polling overhead** — `UiTicketDetail` activity log poll 10 s, `UiQueueItem` 30 s. Pri 30 paralelných workspace užívateľoch je to 30 × 6 RPM proti CA SDM. | Medium | A-002 mitigácia stačí. Monitor v BFF metrics. v1: re-evaluate SSE od BFF (cache invalidation push). | `08-devex-devops`, `04-architecture` (v1) |
| A-007 | **Search ranking závisí od BUI vrstvy** (api-analyst gap #2) — KB suggested solutions cez Service Point token. Service Point má vlastné expirácie. | Medium | BFF spravuje obidva tokeny (Access Key + Access Token) v session. Refresh nezávisle. | `04-architecture` (BFF Auth module), `05-security` |
| A-008 | **TypeScript project references compile slow** — pri 9 packages + 3 apps `tsc --build` rastie. | Low-Medium | Turborepo cache + `--incremental`. Po prvom build < 10 s. | `08-devex-devops` |
| A-009 | **Bundle size creep** — Workspace má heavy moduly (calendar, graph, WYSIWYG). Initial bundle môže prekročiť 350 kB ak code-split nedostatočný. | Medium | Bundle visualizer v CI, fail-build ak chunk > budget. | `08-devex-devops` |
| A-010 | **Runtime config tampering** — `/config` endpoint je verejne dostupný (na customer infra). Žiadny secret v ňom, ale `features.kbAnalytics=true` by mohol enable feature, ktorá nemá BFF backing. | Low | Žiadne secrets v `/config`. Features sú UI-toggle; BFF nezávisle override. | `05-security` |
| A-011 | **CSRF na BFF** — POST/PUT/DELETE na `/api/...` vyžadujú ochranu. | High v prod | SameSite=Lax cookie + Origin header check (samedomain) v MVP. v1: double-submit token. Detail Security agent. | `05-security` |
| A-012 | **No CA SDM healthcheck endpoint** (api-analyst gap #17) — synthetic ping cez `GET /caisd-rest/sevrty?size=1`. | Low | Mitigáciu poznáme. Cache 60 s pre `/ready`. | `08-devex-devops` |
| A-013 | **Sentry data leak** — bug v frontkáde môže do error stack-u dostať PII. | Medium | `beforeSend` regex filter (emails, phone numbers, common PII shapes). Allow-list field names. Test v QA. | `05-security`, `09-qa` |
| A-014 | **Locale fallback** — niektoré dynamic CA SDM stringy nie sú lokalizované (raw EN). UI v SK ich ukáže ako EN. | Low | Akceptujeme v MVP. UX comm: "labels in EN are CA SDM defaults". v1: per-tenant mapping in BFF. | `04-architecture` (v1), `07-design-system` |
| A-015 | **Mobile performance** — P-12 mobile approve v workspace bundle (~ 350 kB). 3G connection = pomalý load. | Medium | Mobile route má vlastný light entrypoint (`apps/workspace/src/main-mobile.tsx`?) — defer rozhodnutie do Tech Stack. Default: jeden bundle, lazy moduly. | `06-tech-stack`, `04-architecture` |
| A-016 | **Cross-tenant viewer rola** — UX risks R-002, R-003, GAP-2, GAP-3. Existuje v CA SDM? | Medium-High pre Peter persona | Security + API analyst overia v round 2. Ak nie, MVP downgrade. | `05-security`, `01-api-analyst` |
| A-017 | **Service Provider tenant pri 100+ tenantoch** — tenant switcher list veľký. | Low v MVP (predpoklad < 10 tenantov) | Post-MVP: pinned + search vo switcheri. | `02-ux-persona` (post-MVP) |
| A-018 | **WebSockets / SSE pre real-time** — UX risk R-012. MVP polling, no push. | Medium | Akceptujeme polling. v1: re-evaluate, ak CA SDM doručí webhooks. | `04-architecture` (v1), `01-api-analyst` |
| A-019 | **KB analytics endpoint chýba** (api-analyst gap #4, UX R-004). | Medium pre Jana persona | Post-MVP feature. MVP: skryť KB analytics tab (W-10). | `04-architecture` (v1), `07-design-system` |
| A-020 | **Audit log pre tenant switch** — `multi-tenancy.md` §6 hovorí o audit potrebe. BFF logy obsahujú každý request s `tenantId`, ale explicitný "tenant switched" event je odporúčaný. | Low-Medium | BFF audit logger zapíše explicit log riadok `event=tenant_switch` pri `POST /me/active-tenant`. | `04-architecture` (vyriešené), `05-security` audit |

## A-100 — Open architectural questions

> Po round 2 cross-konvergencii s 05/06/07/08. Otvorené ostávajú iba
> inherentne open body (skutočné API gaps z 01, post-MVP features,
> biznis-rozhodnutia).

| # | Otázka | Smer | Stav |
|---|---|---|---|
| A-101 | Konkrétna BFF technológia | (vlastné) | `[resolved-in-round-2]` — **Hono 4 + Node 22 LTS** (ADR-01 §3) |
| A-102 | Session store | → 08-devex-devops | `[resolved-in-round-2]` arch (Redis prod / in-memory dev; ADR-01 + `components/bff.md`); 08 vlastní HA topológiu |
| A-103 | Konkrétny IdP | → 05-security | `[resolved-in-round-2]` — config-driven cez 08 `runtime-config.md` (`auth.mode: sso-oidc \| sso-saml \| rest-access-key`); 05 `auth-flow.md` Variant A |
| A-104 | Error tracking platform | (vlastné) | `[resolved-in-round-2]` — **Sentry React** primary; **GlitchTip** self-hosted swap (DSN-compatible) |
| A-105 | UI framework | (vlastné) | `[resolved-in-round-2]` — **React 19** (06) |
| A-106 | Routing knižnica | (vlastné) | `[resolved-in-round-2]` — **React Router v6 data router** (ADR-05) |
| A-107 | Form knižnica | (vlastné) | `[resolved-in-round-2]` — **React Hook Form + Zod** (ADR-06) |
| A-108 | WYSIWYG | (vlastné) | `[resolved-in-round-2]` — **TipTap** (06); A-010 ostáva ako bundle-size risk |
| A-109 | Graph library | (vlastné) | `[resolved-in-round-2]` — **Cytoscape (canvas)** (06) |
| A-110 | Calendar library | (vlastné) | `[resolved-in-round-2]` — **FullCalendar** (06) |
| A-111 | Cross-tenant viewer policy (audit, scope) | → 05-security, 01-api-analyst | Otvorené — inherent API gap (R-002, R-003); čaká na referenčnú CA SDM inštanciu |
| A-112 | Service Catalog form source endpoint | → 01-api-analyst | Otvorené — inherent API gap (#3); A-005 |
| A-113 | Step-up auth flow detail (re-prompt IdP pri SP elevation) | → 05-security | Otvorené — 05 v r1 nepokryl detailný flow; post-MVP |
| A-114 | KB analytics — own telemetry vs. defer to v1 | → post-MVP | Otvorené — biznis rozhodnutie |
| A-115 | i18n knižnica | (vlastné) | `[resolved-in-round-2]` — **i18next + react-i18next + ICU** (ADR-07) |
| A-116 | Build pipeline | (vlastné) | `[resolved-in-round-2]` — **Vite 5/6** (ADR-10) |
| A-117 | Tenant header name | (vlastné) | `[resolved-in-round-2]` — **`X-CA-SDM-Tenant`** (ADR-11, zhoda s 08) |
| A-118 | Two-tab tenant drift mitigácia | (vlastné) | `[resolved-in-round-2]` — `__Host-sdm.tenantVer` cookie + BFF mismatch detection (05 §2.3) |

## Otvorené závislosti

| # | Flag | Smer | Popis | Status |
|---|---|---|---|---|
| 1 | `risks-cross-ref` | → 09-qa | QA agent zostaví testovací plán per riziko. 09 v `acceptance-criteria.md` r1 dodal 18 journey × scenarios + 10 cross-cutting; A-004/A-013 sú v cross-cutting. | `[resolved-in-round-2]` (cross-ref existuje; per-risk allocation vlastní 09) |
| 2 | `risks-tech-stack` | → 06-tech-stack-selector | A-101, A-105–A-110, A-115, A-116. | `[resolved-in-round-2]` — 06 doručil v r1 |
| 3 | `risks-security` | → 05-security | A-007, A-011, A-013, A-016, A-103, A-111, A-113. | partially open — A-111, A-113 ostávajú; ostatné pokryté `security/*` v r1 |
| 4 | `risks-devops` | → 08-devex-devops | A-001, A-002, A-003, A-008, A-009, A-012, A-102, A-104. | partially open — operatívne body (rate limit threshold, monitoring stack); 08 doručil bootstrap v r1 |
