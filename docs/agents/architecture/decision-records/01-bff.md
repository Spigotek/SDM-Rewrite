# ADR-01 — BFF áno/nie

**Status**: accepted
**Dátum**: 2026-05-15
**Autor**: 04-architecture agent (runId 20260508-192438, round 1)

## Kontext

CA SDM 17.4 vystavuje REST API (`/caisd-rest`) s autentifikáciou cez
`X-AccessKey` — token vydaný endpointom `POST /caisd-rest/rest_access`
(api-analyst/`auth.md`). Token je dlhožijúci shared secret. Okrem primárneho
REST sú v hre dve vedľajšie vrstvy:

1. **Service Point / BUI** (`/api`, `/bui`, `/gs`, root-level) s `X-AccessToken`
   — používajú sa pre KB suggested solutions, Service Catalog browse, dynamické
   form rendering. Iný token, iná lifecycle.
2. **SOAP** (`/axis/services/USD_R11`) pre operácie, ktoré REST nemá
   (bulk update, advanced KB search, impersonation, escalation hook, quick
   ticket templates — api-analyst/`gaps.md` katalóg 20 položiek).

Doménový model (03/`entities.md`) má **20+ agregátov**. UI views
(03/`ui-views.md`) potrebujú **multi-call fan-out** pre kľúčové scenáre:
- `/me/tenants` — 3–4 paralelné CA SDM volania (api-analyst/`multi-tenancy.md` §3).
- `UiTicketDetail` — 4–6 paralelných volaní (ticket + contacts + CI +
  linked + attachments + activity log).
- `UiQueueItem` — `in + cr + pr` fan-out s denormalizáciou assignee/group mien.

GOAL §5 NFR požaduje SSO-ready auth bez creds v browseri, audit log,
short-lived tokens, multi-tenancy s tenant switcherom.

UX analytik popisuje 5+ riziká okolo tenant kontextu, error shapingu
(R-006, R-007, R-017) a real-time updates (R-012).

## Rozhodnutie

**BFF (Backend for Frontend) bude súčasťou MVP architektúry.**

BFF beží ako samostatný server proces medzi prehliadačmi (Portal + Workspace
SPA) a CA SDM 17.4. Detail dekompozície v `components/bff.md`.

Konkrétna technológia (Node.js + Fastify / Hono / NestJS / Bun / iné) je
úloha **06 Tech Stack Selector**. Architecture poskytuje boundary, API
kontrakt a dekompozíciu.

## Dôsledky

**Pozitívne**:
1. **Access Key nikdy neopustí server**. SPA dostáva HttpOnly + Secure + SameSite
   cookie so session ID. Žiadny XSS leak Access Keya. Rieši `auth.md` § Riziko #1.
2. **Tenant defenzívna izolácia**. BFF pred každým CA SDM volaním pridá WC filter
   `tenant=<activeTenantId>`, čím zabráni privilege escalation v scenári, kde
   X-Role by sám neoddelil tenanty (multi-tenancy.md §6).
3. **Aggregátory blízko CA SDM**. `/me/tenants`, queue, ticket-detail nemajú
   waterfall latenciu v prehliadači. Latencia od BFF → CA SDM je per-DC krátka.
4. **SOAP fallback skrytý**. SPA pozná len jednotný `/api/...` BFF kontrakt;
   či sa pod kapotou volá REST alebo SOAP rieši BFF (rieši `soap-fallback.md`).
5. **Error shape unifikácia**. CA SDM má flat 401 pre auth/permission failures
   (auth.md §5). BFF disambiguuje → `AppError.code` taxonómia (AUTH_EXPIRED,
   AUTH_FORBIDDEN, TENANT_FORBIDDEN, VALIDATION, ...). FE má konzistentnú
   error handling logiku.
6. **Runtime config endpoint** (`/config`) je prirodzene v BFF — riešenie
   GOAL §5 (API endpoint konfigurovateľný bez rebuildu).
7. **Audit log v jednom mieste**. Štruktúrované JSON logy s `requestId`,
   `userId`, `tenantId` na BFF úrovni dávajú jednotný audit trail nezávislý
   od CA SDM internal logov.
8. **Caching reference dát** (priorities, severities, statuses) v BFF cache
   znižuje latency a load na CA SDM. TTL 5–15 min, alignovanú s charakterom
   dát.

**Negatívne / náklady**:
1. **+1 deployable**. BFF je extra proces, ktorý DevOps musí monitorovať,
   reštartovať, škálovať. Mitigácia: jednoduchá single-binary Node.js (alebo
   ekv.) appka; horizontal scaling stateless (session store mimo procesu).
2. **+1 latency hop**. Prehliadač → BFF → CA SDM. Latencia BFF → CA SDM je
   minimalizovaná colokáciou v rovnakej DMZ.
3. **Vyšší attack surface** o BFF samotný. Mitigácia: BFF je tenký proxy
   + aggregátor, žiadna business logika; Security agent (05) vlastní
   threat model.
4. **Session store** vyžaduje rozhodnutie (in-memory pre MVP single-instance,
   Redis pre v1 HA). DevOps agent (08) finalizuje.
5. **Lock-in na vlastný klient kontrakt**. SPA pozná len BFF API, nie priamy
   CA SDM. Mitigácia: BFF kontrakt je verzionovaný cez `/config` features
   a explicitnú API kontrakt dokumentáciu.

## Alternatívy

### A) Direct CA SDM REST z browseru (bez BFF)

**Mechanika**: SPA volá `/caisd-rest/...` priamo s `X-AccessKey` v hlavičke.
Login flow: POST `rest_access` z browseru, key sa uloží do JS variable
alebo cookie.

**Prečo zamietnuté**:
- `X-AccessKey` v browseri je vysoké XSS riziko (auth.md §6 explicitne hovorí
  "BFF musí držať Access Key v session-side store").
- Dlhožijúci secret v JS memory / cookie / localStorage — všetky tieto
  nositele majú dokumentované únikové vektory.
- Žiadny mechanizmus na agregáciu — `/me/tenants` by bol 4-call waterfall
  v prehliadači, čo zhoršuje TTI.
- Multi-tenant defenzívny filter musí robiť každý frontend volajúci ručne.
  Vysoká pravdepodobnosť bug-u (privilege escalation, ak sa zabudne pridať).
- Error shape disambiguation by sa musela duplikovať vo všetkých SPA
  feature moduloch.
- SOAP fallback v browseri je technicky možný (XML envelope cez fetch), ale
  ergonomicky strašný a SOAP service nemusí mať CORS.
- Service Point token je iný ako Access Key — SPA by musela manažovať
  dva tokeny súčasne.

### B) "Tenký" reverse proxy (Nginx + Lua / Envoy + WASM) bez aplikačnej logiky

**Mechanika**: Nginx alebo Envoy ako passthrough s minimálnou auth injekciou
(napr. inject `X-AccessKey` z cookie).

**Prečo zamietnuté**:
- Nerieši aggregáciu (`/me/tenants`, ticket-detail) — to vyžaduje aplikačnú
  logiku (parallel HTTP calls + merge), čo Nginx/Lua síce dokáže, ale
  ergonomicky / debuggovateľne je to noir.
- Stále by zostala potreba "thin" BFF pre aggregátory. Skončili by sme
  s dvomi deployables (proxy + aggregator BFF), čo je horšie ako jeden BFF.
- Error shaping a SOAP fallback nie sú vhodné pre proxy layer.

### C) Edge functions (Cloudflare Workers / Vercel Edge)

**Mechanika**: rovnaká funkcionalita ako BFF, ale beží na edge POP-och.

**Prečo zamietnuté pre MVP**:
- CA SDM je on-prem (GOAL §1). Edge functions z public cloud-u by museli
  cross-internet do customer DC — žiadny benefit edge collocation, navyše
  network policies on-prem instalácií typicky zakazujú outbound z DMZ.
- Pre customer self-hosted nasadenie potrebujeme self-hostable BFF
  (Node.js binary, container). Cloud-only edge je nevhodný.

### D) Server-Side Rendered Next.js / Nuxt app

**Mechanika**: SSR framework slúži ako "FE + BFF v jednom".

**Prečo zamietnuté**:
- Nepotrebujeme SSR pre TTI cieľ < 2 s — vysoko-optimalizovaný SPA s lazy
  routes a `/config` prefetch dosiahne ten istý budget bez SSR overhead.
- Lock-in do konkrétneho FE frameworku (Next = React, Nuxt = Vue) — ide
  proti princípu, že 06 Tech Stack Selector má voľbu.
- Komplexnejší debug (server-rendered hydration mismatch problémy).
- BFF logika by bola "vrstva" v rámci SSR app — ťažšie unit-testovateľná
  ako samostatný BFF.

## Otvorené závislosti

| # | Flag | Smer | Popis |
|---|---|---|---|
| 1 | `bff-technology` | → 06-tech-stack-selector | Konkrétna voľba (Node.js + Fastify / Hono / NestJS / Bun / iné). |
| 2 | `session-store` | → 08-devex-devops | MVP in-memory, v1 Redis. |
| 3 | `bff-deployment` | → 08-devex-devops | Container / systemd service / Kubernetes Deployment. Po výbere stacku. |
| 4 | `bff-threat-model` | → 05-security | Plný threat model BFF (CSRF, session hijack, key broker leakage, ...). |
