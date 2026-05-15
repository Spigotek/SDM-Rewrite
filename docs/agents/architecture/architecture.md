# SDM-Rewrite — High-level architektúra

> Konsolidácia vstupov z 01 API Analyst, 02 UX/Persona Analyst, 03 Domain
> Modeller a GOAL.md. Tento dokument popisuje cieľovú architektúru
> **frontend-only** projektu, ktorý sa pripája na existujúce CA SDM 17.4
> REST/SOAP rozhrania. Backend nemodifikujeme.
>
> Diagramy sledujú **C4 model** — Level 1 (Context) a Level 2 (Container)
> sú nižšie. Level 3 (Component) per kľúčový container je v adresári
> `components/`.

## Changelog (round 2)

- BFF technológia finalizovaná: **Hono 4 na Node.js 22 LTS + TypeScript 5.7**
  (ADR-01 §3). Container popis v §3.1 aktualizovaný.
- Multi-tenancy header name zharmonizovaný na **`X-CA-SDM-Tenant`** (zhoda
  s 08 `runtime-config.md` + 05 `multi-tenancy-security.md`).
- Session store: **Redis 7 (prod) / in-memory (dev)** — žiadne TBD.
- Sentry SaaS / GlitchTip swap potvrdený ako kompatibilný (DSN-compatible).
- ADR-tabuľka §4 aktualizovaná — všetky ADRs okrem 04/08/11/12 majú v r2
  konkrétne knižničné voľby. ADR-11 doplnený o header name.
- `## Otvorené závislosti` zredukovaná — väčšina r1 flagov je vyriešená cross-
  konvergenciou s peer agentmi.

## 1. Architektonické princípy

| # | Princíp | Vysvetlenie |
|---|---|---|
| P1 | **Backend ako daný** | CA SDM 17.4 sa nemení. Všetky integrácie cez `/caisd-rest`, `/bui`, prípadne `/axis/services/USD_R11` (SOAP fallback). |
| P2 | **Dve aplikácie, jeden monorepo** | `portal` (self-service) a `workspace` (agent) majú odlišné UX patterny a security profil. Spoločný kód žije v `packages/`. (GOAL §4) |
| P3 | **BFF ako broker secretov** | Access Key / Access Token sa nikdy nedostane do prehliadača. BFF (Hono 4 / Node 22 LTS) drží session state v Redis 7 (prod) / in-memory (dev) + tenant kontext + cache. Detail: ADR-01. |
| P4 | **Tenant-first** | Multi-tenancy nie je dodatočná vrstva — je prvotriedny koncept v každom volaní, route, audit logu. Detail: ADR-11. |
| P5 | **Runtime config** | API endpoint, tenant defaults, feature flags sú externé voči build artefaktu. Detail: ADR-12. |
| P6 | **Server-state vs. client-state separation** | Server-state ovláda jedna knižnica (TanStack Query, ADR-03). Client-state je lokálny v komponentoch. Žiadny globálny "Redux all the things" store. |
| P7 | **Hranice packages explicitné** | Žiadne cyklické závislosti, žiadne implicitné re-exporty. `boundaries.md` má tabuľku. |
| P8 | **Simplicita > flexibilita** | Žiadne abstrakcie "pre prípad, že" (YAGNI). Žiadna virtualizácia, žiadne enterprise-grade tabulky, žiaden plugin system v MVP. |
| P9 | **Performance budget na portáli** | TTI < 2 s. Workspace má voľnejší budget (long-running session), ale prvý paint pod 3 s. |
| P10 | **Observability v BFF** | Štruktúrované JSON logy, request correlation ID, error tracking (Sentry alebo ekvivalent — ADR-09). FE posiela len `console.error` + UI eventy do BFF. |

## 2. C4 Level 1 — Systémový kontext

```mermaid
flowchart TB
    subgraph users["Cieľové skupiny"]
        Lucia["requester_lucia<br/>(zamestnankyňa)"]
        Anna["agent_l1_anna<br/>(L1 service desk)"]
        Marek["agent_l2_marek<br/>(L2 specialist)"]
        Peter["change_manager_peter<br/>(CAB chair)"]
        Jana["kb_editor_jana<br/>(KB editor)"]
        Robert["cmdb_owner_robert<br/>(CMDB owner)"]
    end

    subgraph sdmrewrite["SDM-Rewrite (nový FE)"]
        Portal["Portal SPA<br/>portal.&lt;org&gt;"]
        Workspace["Workspace SPA<br/>workspace.&lt;org&gt;"]
        BFF["BFF<br/>api.&lt;org&gt;"]
    end

    IdP["Corp IdP<br/>(SAML / OIDC; product TBD by Security)"]
    CASDM["CA SDM 17.4<br/>/caisd-rest, /bui, SOAP fallback"]
    Sentry["Error tracking<br/>(Sentry React SaaS<br/>or GlitchTip self-hosted)"]

    Lucia --> Portal
    Anna --> Workspace
    Marek --> Workspace
    Peter --> Workspace
    Jana --> Workspace
    Robert --> Workspace

    Portal -- HTTPS --> BFF
    Workspace -- HTTPS --> BFF
    BFF -- "SSO redirect / SAML / OIDC" --> IdP
    BFF -- "REST + SOAP fallback" --> CASDM
    Portal --> Sentry
    Workspace --> Sentry
    BFF --> Sentry
```

**Externé systémy** (mimo nášho scope):
- **CA SDM 17.4** — existujúci produkt, REST + SOAP rozhranie. Verzia
  zafixovaná v `api-analyst/versions.md`.
- **Corp IdP** — SAML alebo OIDC. Konkrétny produkt (Keycloak / Azure AD / iný)
  rozhodne Security agent (05). BFF integruje cez OIDC discovery / SAML metadata.
- **Sentry** alebo ekvivalent — error tracking. DevOps + Security spoluvyberú.

## 3. C4 Level 2 — Containers

```mermaid
flowchart TB
    subgraph "Browser (per user session)"
        PortalApp["Portal SPA<br/>(React 19 + Vite 5)<br/>self-service flows"]
        WorkspaceApp["Workspace SPA<br/>(React 19 + Vite 5)<br/>agent flows"]
    end

    subgraph "Server-side (BFF tier — Hono 4 + Node 22 LTS)"
        BFFAuth["BFF :: Auth module<br/>SSO callback,<br/>access-key broker,<br/>session store"]
        BFFAPI["BFF :: API module<br/>REST proxy,<br/>response shaping,<br/>tenant scoping"]
        BFFAgg["BFF :: Aggregator module<br/>multi-call fan-out<br/>(me/tenants, queue, ticket-detail)"]
        BFFSession["Session store<br/>(Redis 7 prod / in-memory dev)"]
        BFFConfig["Runtime config /config<br/>(JSON endpoint)"]
    end

    subgraph "External"
        IdP["Corp IdP"]
        CASDM["CA SDM 17.4 REST + SOAP"]
    end

    PortalApp -- "HttpOnly session cookie<br/>X-CA-SDM-Tenant header<br/>JSON" --> BFFAPI
    WorkspaceApp -- "HttpOnly session cookie<br/>X-CA-SDM-Tenant header<br/>JSON" --> BFFAPI
    PortalApp -- "GET /config" --> BFFConfig
    WorkspaceApp -- "GET /config" --> BFFConfig

    BFFAPI --> BFFSession
    BFFAuth --> BFFSession
    BFFAPI --> BFFAgg
    BFFAuth -- "OIDC / SAML" --> IdP
    BFFAuth -- "POST rest_access" --> CASDM
    BFFAPI -- "X-AccessKey + X-Role" --> CASDM
    BFFAgg -- "fan-out REST calls" --> CASDM
    BFFAPI -- "SOAP fallback (rare)" --> CASDM
```

### 3.1 Container inventory

| Container | Typ | Účel | Klúčové rozhodnutia |
|---|---|---|---|
| **Portal SPA** | Browser SPA | Self-service flows pre `requester_lucia`. Low information density, mobile-friendly, TTI < 2 s. | React 19 + Vite 5 + React Router v6 data router (per 06 stack). Routing client-side, single index.html. |
| **Workspace SPA** | Browser SPA | Agent / specialist flows pre 5 person. High density, hot-keys, multi-pane. | Rovnaký stack ako Portal, samostatný bundle, samostatné nasadenie. |
| **BFF :: Auth** | Server module (Hono 4 / Node 22 LTS) | SSO redirect, session lifecycle, brokerage CA SDM Access Key, logout. | ADR-01 §3 (Hono), ADR-11 (multi-tenancy), 05 `auth-flow.md` Variant A. |
| **BFF :: API** | Server module | Proxy CA SDM REST volaní s tenant scopingom a payload shapingom (XML→JSON, camelCase). | ADR-01. Vlastní per-endpoint route mapping; žiadny generický passthrough. |
| **BFF :: Aggregator** | Server module | Multi-call agregáty (`/me/tenants`, ticket-detail, queue), bez ktorých by FE musel orchestrovať fan-out v prehliadači. | ADR-01 + UI views z 03 (`UiQueueItem`, `UiTicketDetail`). |
| **Session store** | Redis 7 (prod) / in-memory `Map` (dev) | Per-session uložisko: Access Key, expirácia, activeTenantId, user profile cache. | ADR-01 §3 (Redis fixed pre prod, in-memory pre dev); `components/bff.md` §2.2. HA topológiu vlastní 08. |
| **Runtime config endpoint** | Server module | `GET /config` vracia `apiBaseUrl`, `features`, `i18nDefaults`. SPA si ho ťahá na bootstrape pred prvým API volaním. | ADR-12. |
| **CA SDM 17.4** | Externý | Backend. Read-only z nášho pohľadu — nemeníme schémy, len volania. | — |
| **Corp IdP** | Externý | SAML / OIDC. | Security agent. |

### 3.2 Logické packages (zhrnutie — detail v `monorepo-layout.md`)

| Package | Účel | Konzumenti |
|---|---|---|
| `@sdm/api-client` | Typovaný klient nad CA SDM REST + BFF endpointy. Generovaný/odvodený z `api-analyst/schemas/`. | BFF, oba SPA (cez BFF). |
| `@sdm/api-types` | TypeScript typy (`Incident`, `Request`, `Problem`, ...) odvodené z `domain/model.ts`. | `api-client`, `domain`, oba SPA, BFF. |
| `@sdm/domain` | Pravidlá doménového modelu — state machines, validátory, permission mapping (RoleCode → Permission[]). Pure functions, žiadny side-effect. | Oba SPA (a prípadne BFF pre validáciu). |
| `@sdm/design-system` | Tokens, primitives, app-level components. | Oba SPA. |
| `@sdm/auth` | Auth helpery pre SPA (session refresh hook, login redirect, role-based component guards). | Oba SPA. |
| `@sdm/i18n` | i18n catalog (SK + EN), formatters (date/number/currency podľa locale + tenant). | Oba SPA, BFF (pre error message lokalizáciu). |
| `@sdm/utils` | Pure utility — date math, formatting, type guards. | Všetci. |

Žiadne ďalšie packages "pre prípad". Ak vznikne nová potreba, addne sa explicitne (YAGNI, P8).

## 4. Klúčové architektonické rozhodnutia (zhrnutie)

Plný text v `decision-records/`. Zhrnutie:

| ADR | Téma | Rozhodnutie |
|---|---|---|
| 01 | BFF + technológia | **Áno, BFF je v MVP. Konkrétne: Hono 4 + Node 22 LTS + TS 5.7 strict.** Dôvody: broker pre Access Key, agregácia (`/me/tenants`, ticket-detail), tenant defenzívny filter, KB suggested solutions cez BUI vrstvu, error shape unifikácia. |
| 02 | Monorepo tool | **pnpm 9 workspaces + Turborepo** (orchestrátor build cache). Turborepo je *over the top* pnpm workspaces, nie alternatíva. |
| 03 | Data fetching layer | **TanStack Query v5** (`@tanstack/react-query`) v SPA. |
| 04 | State management filozofia | **Server-state v TanStack Query**, **client-state lokálne** (useState / useReducer). Žiadny globálny store. |
| 05 | Routing | **React Router v6 data router** (`createBrowserRouter`). Žiadny SSR. Route-level code-splitting povinný. |
| 06 | Dynamic forms (Service Catalog) | **JSON-schema-driven renderer** + **React Hook Form 7 + Zod 3** (`@hookform/resolvers/zod`). BFF normalizuje CA SDM Service Catalog template do `DynamicFormSchema`. |
| 07 | i18n | **i18next + react-i18next + ICU plugin**. `@sdm/i18n` adaptér. Default SK, switch EN. |
| 08 | Error boundary a globálne error handling | **Per-app error boundary** s typovanou `AppError`, fallback UI v Design System, BFF error shape taxonomy. |
| 09 | Observability vo FE + BFF | **Sentry React** (FE; GlitchTip swap-compatible cez DSN). **pino 9 JSON stdout → ELK/Loki** (BFF; SIEM post-MVP). Audit event taxonómia od 05 `audit-and-compliance.md` (~40 eventov / 5 kategórií). |
| 10 | Build pipeline | **Vite 5/6** pre obe SPA. BFF bez bundleru (`tsc --build`, `tsx` watch v dev). |
| 11 | Multi-tenancy stratégia | **Server-side aktívny tenant v BFF session** + **HTTP header `X-CA-SDM-Tenant` v API volaniach** (zhoda s 08). Cross-tab cez `__Host-sdm.tenantVer` cookie (05). Tenant switcher prvotriedny element. |
| 12 | Runtime config | **`/config` endpoint na BFF** + fallback `window.__SDM_CONFIG__` (inline-injected) pre offline dev. **Žiadne build-time hardcoding API endpointu** (GOAL §5 + §11). |

## 5. Hraničné prípady a NFR mapping

| NFR (GOAL §5) | Realizácia |
|---|---|
| Auth: SSO-ready, žiadne creds v browseri, short-lived tokeny, audit log | BFF (ADR-01), Security agent vlastní detail. Audit v BFF JSON logoch (ADR-09). |
| Multi-tenancy: per-tenant izolácia, tenant switcher, default tenant z profilu | ADR-11. Tenant flush flow popísaný v `data-flows.md` § Tenant switch. |
| API endpoint konfigurovateľný | ADR-12 (`/config` endpoint). |
| i18n SK + EN | ADR-07. |
| a11y WCAG 2.1 AA | Design System agent (07) vlastní. Architecture zaisťuje, že každá SPA má `<html lang>` switcheable a focus management na route-level. |
| Performance: TTI portál < 2 s | Route-level code-splitting (ADR-05, React Router v6 data router `lazy:`), Vite 5 (ADR-10), `@sdm/design-system` tree-shakeable. Žiadne heavy charting libs (Cytoscape/FullCalendar/TipTap) v portál bundle. |
| Browsery: posledné 2 verzie evergreens | Žiaden IE/legacy polyfilling. Build target `ES2020`. |
| Observability: štruktúrované logy, error tracking, RUM nice-to-have | ADR-09. |
| GDPR-aware | BFF audit log obsahuje len pseudonymizované user/tenant ID; PII (mená, emaily) sa nevypisuje. CA SDM rieši PII v audit-trail natívne. |

## Otvorené závislosti

| # | Flag | Smer | Popis | Status |
|---|---|---|---|---|
| 1 | `bff-tech-stack` | (vlastné) | Hono 4 + Node 22 LTS + TS 5.7 strict (ADR-01 §3). | `[resolved-in-round-2]` |
| 2 | `session-store-choice` | (vlastné) | Redis 7 prod / in-memory dev (ADR-01). HA topológiu vlastní 08. | `[resolved-in-round-2]` arch — operatívne open |
| 3 | `idp-product` | → 05-security | Config-driven cez 08 `runtime-config.md` (`auth.mode`). | `[resolved-in-round-2]` — kontrakt zafixovaný; konkrétny customer IdP product je deployment-time decision. |
| 4 | `error-tracking-product` | (vlastné) | Sentry React primary + GlitchTip self-hosted swap (ADR-09). | `[resolved-in-round-2]` |
| 5 | `service-catalog-form-source` | → 01-api-analyst | gap #3 — inherent API gap. | open (inherent) |
| 6 | `cross-tenant-policy` | → 05-security, 01-api-analyst | Cross-tenant viewer rola (R-002, R-003). | open (inherent — A-111) |
| 7 | `kb-analytics-scope` | → post-MVP | KB analytics (R-004). | open (post-MVP — biznis decision) |
| 8 | `real-time-strategy` | → 04 (v1), 01 | Polling MVP; v1 SSE re-evaluate ak CA SDM doručí webhooks. | open (post-MVP) |
