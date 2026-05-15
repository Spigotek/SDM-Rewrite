# Architecture — riziká a otvorené otázky

> Riziká, ktoré sa otvárajú v dôsledku architektonických rozhodnutí, alebo
> ktoré z 01–03 prešli do oblasti, kde ich vlastní Architecture / Security /
> Stack / DevOps. Každé riziko má adresáta a navrhovanú mitigáciu.

## A-001 až A-020 — Architektonické

| # | Riziko | Dopad | Mitigácia | Vlastník mitigácie |
|---|---|---|---|---|
| A-001 | **BFF ako SPOF** — single instance v MVP = výpadok zhasne FE. | High v prod, low v dev | MVP: hot-standby + monitoring, automatický restart cez systemd / Kubernetes. v1: horizontal scaling s Redis session store. | `08-devex-devops` |
| A-002 | **CA SDM rate limit neznámy** (api-analyst flag `bulk-rate-limit`) — BFF môže preťažiť backend pri queue refresh × N concurrent users. | Medium | Konzervatívny per-instance concurrency limit (max 20 paralelných CA SDM calls), exponential backoff pri 5xx, monitor cez `casdm.errors` metric. | `08-devex-devops`, `09-qa` |
| A-003 | **Session store SPOF v MVP** — in-memory session = restart BFF = všetci odhlásení. | Medium | Akceptujeme v MVP; release notes hovoria "redeploy pri pracovnom čase". v1: Redis. | `08-devex-devops` |
| A-004 | **Two-tab tenant drift** — user prepne tenant v tab A, tab B má starý kontext. | Medium | BFF detekuje X-Tenant mismatch → 403 TENANT_FORBIDDEN s `correctTenantId`, FE auto-refresh. Detail v `data-flows.md` § 2. | `04-architecture` (vyriešené), `09-qa` test scenár |
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

## A-100 — Open architectural questions (do round 2)

| # | Otázka | Smer | Stav |
|---|---|---|---|
| A-101 | Konkrétna BFF technológia (Node + Fastify / Hono / NestJS / Bun) | → 06-tech-stack-selector | Otvorené |
| A-102 | Session store (in-memory MVP, Redis v1) | → 08-devex-devops | Otvorené |
| A-103 | Konkrétny IdP (Keycloak / Azure AD / Okta) | → 05-security | Otvorené |
| A-104 | Error tracking platform (Sentry SaaS vs. GlitchTip self-hosted) | → 05-security, 08-devex-devops | Otvorené |
| A-105 | UI framework (React / Vue / iné) | → 06-tech-stack-selector | Otvorené |
| A-106 | Routing knižnica (závislé od framework) | → 06-tech-stack-selector | Otvorené |
| A-107 | Form knižnica (react-hook-form / VeeValidate / iné) | → 06-tech-stack-selector | Otvorené |
| A-108 | WYSIWYG (TipTap / Lexical / ProseMirror) | → 06-tech-stack-selector | Otvorené (R-010) |
| A-109 | Graph library (Cytoscape / ReactFlow / iné) | → 06-tech-stack-selector | Otvorené (R-011) |
| A-110 | Calendar library | → 06-tech-stack-selector | Otvorené |
| A-111 | Cross-tenant viewer policy (audit, scope) | → 05-security | Otvorené (R-002, R-003, A-016) |
| A-112 | Service Catalog form source endpoint | → 01-api-analyst | Otvorené (A-005) |
| A-113 | Step-up auth flow detail | → 05-security | Otvorené |
| A-114 | KB analytics — own telemetry vs. defer to v1 | → 04-architecture (po round 2), 05-security pre privacy | Otvorené |

## Otvorené závislosti

| # | Flag | Smer | Popis |
|---|---|---|---|
| 1 | `risks-cross-ref` | → 09-qa | QA agent zostaví testovací plán per riziko (A-002 rate limit, A-004 two-tab, A-013 PII filter, ...). |
| 2 | `risks-tech-stack` | → 06-tech-stack-selector | A-101, A-105–A-110 sú vstupom pre Tech Stack porovnanie. |
| 3 | `risks-security` | → 05-security | A-007, A-011, A-013, A-016, A-103, A-104, A-111, A-113 sú vstupom pre Security threat model. |
| 4 | `risks-devops` | → 08-devex-devops | A-001, A-002, A-003, A-008, A-009, A-012 sú vstupom pre DevOps deployment / monitoring strategy. |
