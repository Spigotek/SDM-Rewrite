# Mock Strategy — SDM-Rewrite

## Changelog (round 2)

- **Harmonizácia mien handler modulov s 08** (`devex-devops/mock-strategy.md`):
  finálny set = `auth`, `tenants`, `incidents`, `requests`, `problems`,
  `changes`, `knowledge`, `cmdb`, `users`, `audit` (10 modulov). r1 mal 10
  modulov v inom poradí (auth, tenants, incidents, requests, problems, changes,
  knowledge, cmdb, attachment, service-catalog, reference). r2 zlúčil
  `attachment` do `incidents` (attachment endpoints sú per ticket), zlúčil
  `service-catalog` a `reference` do `requests` (catalog je sub-resource
  requestu), pridal nový `users` modul (per `multi-tenancy.md` §3.1 user fan-out)
  a nový `audit` modul (per 05 audit-and-compliance test vectors).
- Layered handler split potvrdený (04 BFF prijatý): **BFF-layer handlers**
  pre BFF endpoints (`/me/tenants`, `/me/active-tenant`, `/api/queue`, ...) vs.
  **CA SDM upstream handlers** pre `/caisd-rest/*`. Stratégia popisuje obe.
- Tenant kontext mechanizmus — `X-Tenant` header per ADR-11. `parseTenantFromRequest`
  middleware v MSW (§6) testuje jeden mechanizmus (header), nie fallback chain.
- Tech stack potvrdený (06 r2): `msw@2.x` + `@mswjs/data@0.16.x` + `@faker-js/faker@9.x`
  (seeded). Stratégia bola od r1 framework-agnostic; teraz fixuje verzie.

> Stratégia mock-ovania pre **dve vrstvy**: (a) BFF endpoints, ktoré konzumujú
> SPA, a (b) CA SDM REST + BUI endpoints, ktoré BFF konzumuje. **Zdroj pravdy
> pre schémy:** `docs/agents/api-analyst/schemas/*.ts` (12 modulov).
>
> **Hlavná voľba: MSW (Mock Service Worker) @ 2.x**. Layered handler set:
> 10 module-blokov, share-nutých medzi SPA app (browser worker), BFF
> integration testy (node server), a Playwright E2E (route fixture).
>
> Package: `packages/api-mocks/` (per 04 monorepo-layout + 08 mock-strategy).

## 1. Prečo MSW (a nie wiremock / msw-record-replay / Pact)

| Voľba | Hodí sa | Nehodí sa pre nás | Verdikt |
|---|---|---|---|
| **MSW @ 2.x** (handlers v JS/TS) | Unifikovaný handler set pre unit, integration, E2E (jsdom + Playwright + dev server). Schémy z TS zdrojov. Browser worker + Node server one-source-of-truth. | – | **Vybraný** (potvrdené 06 r2 + 08 r1) |
| **wiremock** (JVM, JSON mappings) | Multi-language tímy, cross-service | JS-only project; ďalšia JVM závislosť; horšia developer ergonomia | nie |
| **record-replay** (MSW + recorder, alebo cassettes) | Live API zachytená do JSON | CA SDM nie je dostupný, takže "record" je teoretický. Aj keby bol, schémy v 01 sú už typed | doplnkové, neskôr |
| **Pact** (consumer-driven contracts) | Multi-tím s vlastným producer-om | CA SDM je externý komerčný produkt — žiadny producer-side test | nie |

**MSW handler set je primárny artefakt.** Žije v `packages/api-mocks/src/handlers/`
a je **importovateľný** z apps E2E, integration, unit, **a z BFF integration
testov**. Ten istý handler odpovedá v testoch aj v dev mode (cez service worker
v `apps/portal`/`apps/workspace` keď je `VITE_USE_MOCKS=true`).

## 2. Handler organizácia (10 modulov — harmonizované s 08)

Štruktúra (per modul → mirror voči `api-analyst/schemas/` + BFF route inventory
z 04 `components/bff.md`):

```
packages/api-mocks/src/handlers/
├── index.ts                     # zlúčenie všetkých handlerov
├── auth.ts                      # BFF /auth/* + CA SDM /rest_access + IdP callback mock
├── tenants.ts                   # BFF /me/tenants, /me/active-tenant + CA SDM /cnt_role, /tenant_group_member
├── incidents.ts                 # CA SDM /caisd-rest/in/* + /attmnt/* (per ticket scope), /cr/* type=I
├── requests.ts                  # CA SDM /cr/* type=R + service catalog /pcatSearch, /getOfferings + reference data (cr_stat, pcat, sevrty, cr_resolutions)
├── problems.ts                  # CA SDM /pr/* + linked_incidents
├── changes.ts                   # CA SDM /chg/* + /wf/* approval workflow
├── knowledge.ts                 # CA SDM /SKELETONS/*, /KCAT/*, BUI /suggestedSolutions
├── cmdb.ts                      # CA SDM /nr/*, relationships, /all_open_creq
├── users.ts                     # CA SDM /cnt/<id>, /cnt_role per user (per multi-tenancy §3.1 fan-out + RBAC)
└── audit.ts                     # BFF in-memory audit log sink (assertable) — pre security test vectors
```

**Layered split (04 BFF accepted)**:

- **BFF-layer handlers** (`auth.ts` `/auth/*`, `tenants.ts` `/me/*`, `audit.ts`):
  mockujú endpointy, ktoré SPA priamo volá. Bežia v SPA integration testoch +
  E2E.
- **CA SDM upstream handlers** (`incidents.ts`, `requests.ts`, `problems.ts`,
  `changes.ts`, `knowledge.ts`, `cmdb.ts`, `users.ts`, plus CA SDM časť
  `auth.ts` a `tenants.ts`): mockujú CA SDM REST, ktoré BFF konzumuje. Bežia
  primárne v BFF integration testoch.

Apps importujú primárne BFF-layer handlers + minimum CA SDM (pre prípady, keď
SPA priamo deep-link-uje na CA SDM resource bez aggregator-a, čo by malo byť
zriedkavé per 04 BFF design).

```
packages/api-mocks/src/
├── handlers/         # (vyššie)
├── fixtures/         # primitives + per-journey composes (viď test-data.md)
├── db.ts             # @mswjs/data factory
├── browser.ts        # setupWorker pre apps (dev + Playwright)
├── node.ts           # setupServer pre Vitest
└── utils/
    ├── tenant.ts     # parseTenantFromRequest — X-Tenant header per ADR-11
    ├── pagination.ts # toCaSdmPaginatedResponse
    ├── errors.ts     # CA SDM error shape + AppError taxonomy
    └── audit.ts      # in-memory audit log sink (assertable v BFF tests)
```

**Pravidlo**: každý handler vie **odpovedať na žiadanú schému aj na chybu**
(401, 403, 404, 422, 500, 413, 429). Default je happy path; chybové reakcie sa
zapínajú per-test cez `server.use(...overrides)`.

## 3. Povinný handler-set (per modul, 10 modulov — final)

### 3.1 Auth (`auth.ts`)

**BFF-layer endpoints:**

- `GET /auth/login` → 302 redirect na IdP `/authorize` (mock IdP).
- `GET /auth/callback?code=<c>&state=<s>` → mock IdP token exchange + session cookie set.
- `POST /auth/logout` → 200 + `Set-Cookie: __Host-sdm.sid=; Max-Age=0`.
- `POST /auth/heartbeat` → 204.
- `POST /auth/step-up` → 302 redirect na IdP MFA challenge.
- `GET /auth/step-up-callback?code=<c>` → 302 return URL + `session.stepUpAt = now`.
- `GET /me` → 200 `{ user, tenants, activeTenant, uiRole, app, csrfToken, featureFlags, i18n, session }`. **Default mock**: Lucia, 2 tenants (HQ, East), active=HQ.

**CA SDM upstream endpoints:**

- `POST /caisd-rest/rest_access` → 201 `RestAccessCreateResponse` (happy) / 401 (bad creds).
- `GET /caisd-rest/rest_access/{id}` → 200 / 401 / 404.
- `DELETE /caisd-rest/rest_access/{id}` → 204 / 401.
- `POST /caisd-rest/bopsid` → 201 `BopsidResponse`.

**Edge cases:**

- Access key blízko expirácie → BFF silent refresh → mock POST `/rest_access` znova vráti nový key.
- State / nonce mismatch v callback → 400 (`auth.state_mismatch` audit event).
- IdP `/token` zlyhá → 502.
- CA SDM `/rest_access` 401 → 503 z BFF.

### 3.2 Tenants (`tenants.ts`)

**BFF-layer endpoints:**

- `GET /me/tenants` → 200 `MyTenantsResponse` so 3 tenantmi (HQ, Acme East, Acme West) — happy path Anna/Marek.
- `GET /me/tenants` → 200 s 1 tenantom (single-tenant user) — overuje, že tenant switcher sa skryje.
- `POST /me/active-tenant { tenantId }` → 200 + nová `X-CSRF-Token` rotácia / 403 (nepatrí používateľovi → audit `forbidden_tenant_switch`).
- `POST /me/cross-tenant-view { enabled }` → 200 (ak `isServiceProvider`) / 403 (ostatní). Step-up required pri ON.

**CA SDM upstream endpoints:**

- `GET /caisd-rest/cnt_role?WC=contact%3DU'...'` → 200 zoznam rolí so SREL na tenant.
- `GET /caisd-rest/tenant_group_member?WC=tenant_id%3DU'...'` → 200 zoznam memberships.

**Edge cases:**

- Switch na tenant, ku ktorému user nemá rolu → 403 `forbidden_tenant`.
- Cross-tab race: tab B request s `X-Tenant: T1` ale session má T2 → 403 `TENANT_FORBIDDEN` + `correctTenantId: T2`.
- Tenant suspension → 403 `tenant_suspended`.

### 3.3 Incidents (`incidents.ts`) — zlúčené s attachments per ticket scope

**CA SDM upstream endpoints:**

- `GET /caisd-rest/in?WC=active%3D1` → 200 paginated list 25 incidentov.
- `GET /caisd-rest/in/{id}` → 200 plný `Incident` payload.
- `POST /caisd-rest/in` → 201 nový incident (validuje required `customer`, `log_agent`, `description`).
- `PUT /caisd-rest/in/{id}` → 200 (status transition: `OP → WIP`, `WIP → RES` so `resolutionDescription`).
- `PUT /caisd-rest/in/{id}` → 422 `{ field: "resolutionDescription", code: "REQUIRED" }` pri pokuse o `RES` bez popisu.
- `GET /caisd-rest/in/{id}/act_log` → 200 activity log (paginated, first page).
- `POST /caisd-rest/in/{id}/act_log` → 201 (closure note, internal note).
- **Attachments per incident**:
  - `POST /caisd-rest/attmnt` → 201 (multipart).
  - `POST /caisd-rest/attmnt` veľký file > 25 MB → 413.
  - `GET /caisd-rest/attmnt/{id}` → 200 stream.
  - `GET /caisd-rest/in/{id}/attachments` → 200 meta list.

**BFF aggregator endpoints:**

- `GET /api/tickets/incident/{id}` → 200 `UiTicketDetail<Incident>` (aggregator fan-out).
- `POST /api/tickets/incident` → 201 (s redirect na CA SDM POST).
- `PUT /api/tickets/incident/{id}` → 200 (s tenant scope filter injection).
- `POST /api/tickets/incident/{id}/close` → 200 + activity append.
- `POST /api/attachments` → 201 (multipart upload).
- `GET /api/attachments/{id}` → 200 stream / **404** (nie 403 — leakuje existenciu, per multi-tenancy-security L7).

**Edge cases:**

- Cross-tenant `GET /caisd-rest/in/{id}` v inom tenante než `activeTenant` → 200 alebo prázdny (per `multi-tenancy.md` §2). UI test overuje, že queue ignoruje out-of-tenant výsledky.
- 413 pri upload attachment > 25 MB (referenced incident `INC-1042` z `portal-incident-broken-laptop`).
- SSO session expirovala počas submit-u → 401 + draft preserved v localStorage (`portal-incident-broken-laptop` alternate path).

### 3.4 Requests (`requests.ts`) — zlúčené s service-catalog + reference data

**CA SDM upstream endpoints:**

- `GET /caisd-rest/cr?WC=type%3D'R'%20AND%20active%3D1` → 200 list requestov.
- `POST /caisd-rest/cr` → 201 (type=R, status=SUBMITTED).
- `PUT /caisd-rest/cr/{id}` (approve flow): manager schvaľuje → status APPROVED.
- `PUT /caisd-rest/cr/{id}` (reject) → status REJECTED, `rejection_reason` povinný.

**Service Catalog (BUI vrstva):**

- `GET /pcatSearch?query=figma` → 200 `{ offerings: [...] }`.
- `GET /getOfferings/{id}` → 200 s dynamickými poliami (3 polia minimum: text, select, file upload). Akonáhle 01 doimplementuje GAP-1, doplní sa realistická variabilita.

**Reference data (zlúčené):**

- `GET /caisd-rest/cr_stat` → 200 status list (OP, WIP, HLD, RES, CL, ...).
- `GET /caisd-rest/pcat` → 200 category tree.
- `GET /caisd-rest/sevrty` → 200 severity codes.
- `GET /caisd-rest/cr_resolutions` → 200 resolution code list.

**BFF aggregator endpoints:**

- `GET /api/catalog/offerings` → 200 paginated.
- `GET /api/catalog/items/{id}` → 200 normalizovaný `DynamicFormSchema` (per ADR-06).
- `POST /api/tickets/request` → 201 (s schema re-validation v BFF).
- `GET /api/reference/{type}?type=incident|request|...` → 200 cached 15 min.

**Edge cases:**

- Auto-approve flow (catalog item bez approval): `POST /caisd-rest/cr` → 201 status=IN_PROGRESS direct.

### 3.5 Problems (`problems.ts`)

**CA SDM upstream endpoints:**

- `GET /caisd-rest/pr` → 200 list.
- `POST /caisd-rest/pr` → 201 (IDENTIFIED).
- `PUT /caisd-rest/pr/{id}` — state transitions per lifecycle (IDENTIFIED → INVESTIGATION → ROOT_CAUSE_KNOWN → KNOWN_ERROR → RESOLVED).
- `POST /caisd-rest/pr/{id}/linked-incidents` → 200 (bulk linkovanie 12 incidentov — `workspace-problem-rca`).
- `GET /caisd-rest/pr/{id}/related_incidents` → 200 zoznam linkovaných.

**Edge cases:**

- Cross-tenant linkovanie → buď 200 (povolené) alebo 422 — finálne podľa `[GAP-2]`. Default handler: 422 + reason `cross_tenant_linking_forbidden`. Test overuje, že UI ukáže warning.

### 3.6 Changes (`changes.ts`)

**CA SDM upstream endpoints:**

- `GET /caisd-rest/chg` → 200 list (default + calendar view).
- `POST /caisd-rest/chg` → 201 RFC.
- `PUT /caisd-rest/chg/{id}` — transitions RFC → APPR_PENDING → APPROVED / REJECTED.
- `PUT /caisd-rest/wf/{id}` — approval task update.
- Emergency flow: `POST /caisd-rest/chg { type: "emergency" }` → 201 status=EMG_RFC.

**BFF endpoints:**

- `POST /api/changes/{id}/approve { stepUpToken }` → 200 (vyžaduje step-up token).
- `POST /api/changes/{id}/approve` bez step-up → 403 `step_up_required`.

**Edge cases:**

- Approve bez rollback plan → 422 `{ field: "rollbackPlan", code: "REQUIRED_FOR_EMERGENCY" }`.
- Conflict detection: `GET /caisd-rest/chg?WC=...calendar window...` → 2 changes na rovnaký CI v rovnakom čase, FE ich má vizuálne zvýrazniť.
- Cross-tenant calendar view bez `change.read.calendar.cross-tenant` → 403.

### 3.7 Knowledge (`knowledge.ts`)

**CA SDM upstream endpoints:**

- `GET /caisd-rest/SKELETONS?WC=...` → 200 KB list.
- `GET /caisd-rest/SKELETONS/{id}` → 200 KB article s body.
- `POST /caisd-rest/SKELETONS` → 201 DRAFT.
- `PUT /caisd-rest/SKELETONS/{id}` — transitions DRAFT → REVIEW → APPROVED → PUBLISHED.

**BUI vrstva:**

- `GET /bui/suggestedSolutions?text=<q>` → 200 ranked KB articles.

**BFF endpoints:**

- `GET /api/kb/search?q=<q>` → 200 (cache 30 s per query).
- `GET /api/kb/articles/{id}` → 200 (cache 5 min).

**Edge cases:**

- Search 0 výsledkov → 200 prázdny zoznam — UI test (Lucia alternate flow) musí ponúknuť "create ticket from search".
- KB článok len v EN, profil SK → vráti `language=en` + UI test overuje "Iba v angličtine" badge.
- KB body s malicious markdown (`<script>`, `javascript:`) → sanitization test (`@security:kb-xss-sanitization`).

### 3.8 CMDB (`cmdb.ts`)

**CA SDM upstream endpoints:**

- `GET /caisd-rest/nr` → 200 list CI.
- `GET /caisd-rest/nr/{id}` → 200 CI detail s 47 atribútmi (per `workspace-cmdb-ci-detail`).
- `GET /caisd-rest/nr/{id}/relationships` → 200 graph s 23 nodes (default) alebo 200+ nodes (cluster test).
- `GET /caisd-rest/nr/{id}/all_open_creq` → 200 6 otvorených incidentov na CI.

**BFF endpoints:**

- `GET /api/ci/{id}` → 200 (cache 5 min).
- `GET /api/ci/{id}/related` → 200 (aggregator, BFS depth=2 v MVP).

**Cross-tenant:**

- CI v inom tenante → 200 aggregate ("3 CIs consumed by External tenant") bez detailov (per `cmdb_owner_robert` cross-tenant journey).
- Bez `ci.read.cross-tenant` permission → 403 (per RBAC).

### 3.9 Users (`users.ts`) — **nový modul r2**

**Účel**: fan-out endpoints pre user profile a role mapping (per
`multi-tenancy.md §3.1` + `rbac.md §3`). Predtým rozptýlené medzi auth a tenants.

**CA SDM upstream endpoints:**

- `GET /caisd-rest/cnt/{userUuid}` → 200 user profile s tenant, roles.
- `GET /caisd-rest/cnt/{userUuid}?X-Obj-Attrs=tenant,roles` → 200 with selected attrs.
- `GET /caisd-rest/role/{roleId}?X-Obj-Attrs=tenant,name` → 200 role details with tenant SREL.
- `GET /caisd-rest/cnt/{userUuid}/assigned_tickets` → 200 (for "my work" queue).

**BFF endpoints:**

- `GET /api/users/me/preferences` → 200 (queue filter, theme, density, language).
- `PUT /api/users/me/preferences` → 200.

**Edge cases:**

- User downgradnutý z agent_l2 na agent_l1 mid-session → BFF re-fetch `cnt_role` → 401 `role_changed` na next call (`@security:rbac-role-stale`).
- User nemá rolu v aktuálnom tenante (zmena v CA SDM) → 401 `role_revoked`.

### 3.10 Audit (`audit.ts`) — **nový modul r2**

**Účel**: in-memory audit log sink, ktorý sa dá assertovať v BFF integration
testoch (per 05 `audit-and-compliance.md`). **Nie endpoint** v MVP — `getAuditLog()`
helper exportuje pole emitted events pre testy.

**API pre testy:**

```ts
// packages/api-mocks/src/utils/audit.ts
export interface AuditEvent {
  ts: string;
  correlationId: string;
  actor: { userId: string; ip?: string; ua?: string };
  category: "auth" | "authz" | "security" | "data" | "sensitive";
  action: string;     // e.g. "tenant_switch", "forbidden_tenant_switch", "auth.login"
  resource?: { type: string; id: string; tenantId: string };
  result: "success" | "failure" | "denied";
  details?: Record<string, unknown>;
  stepUpAt?: string;
  crossTenant?: boolean;
  sourceTenant?: string;
  targetTenant?: string;
}

export function getAuditLog(): AuditEvent[];
export function clearAuditLog(): void;
export function emitAudit(event: AuditEvent): void;
```

**Per-test usage:**

```ts
import { getAuditLog, clearAuditLog } from "@sdm/api-mocks/audit";

beforeEach(() => clearAuditLog());

test("@security:audit-log-tenant-switch", async () => {
  await callBFF("POST /me/active-tenant", { tenantId: "t-acme-east" });
  const events = getAuditLog().filter(e => e.action === "tenant_switch");
  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({
    actor: { userId: "u-anna" },
    details: { fromTenant: "t-acme-hq", toTenant: "t-acme-east" },
  });
});
```

**Coverage of audit events** (per 05 audit-and-compliance §2):

- `auth.login`, `auth.login.failure`, `auth.logout`, `auth.idle_timeout`.
- `auth.state_mismatch`, `auth.nonce_mismatch`, `auth.refresh_token_reuse`.
- `tenant_switch`, `forbidden_tenant_switch`, `cross_tenant_view_enabled`, `cross_tenant_read`, `cross_tenant_write`.
- `forbidden_resource`, `forbidden_tenant`, `role_changed`, `role_revoked`.
- `data.create`, `data.update`, `data.delete` (per resource type).
- `sensitive.bulk_delete`, `sensitive.admin_action`, `sensitive.audit_export`.
- `incident.escalated`, `change.approve.emergency`, `kb.publish`, `cmdb.update`.

## 4. Error scenario coverage matrix

Pre **každý** modul musí byť **aspoň jeden** test z každej kategórie:

| Error kategória | Status code | UI behavior overený |
|---|---|---|
| Auth expired | 401 | Silent re-auth attempt, fallback redirect na login, draft preserved |
| Forbidden (RBAC) | 403 | Disabled UI element s tooltipom, žiadny redirect |
| Cross-tenant resource | **404** | Empty state + "not found" message + návrat-link (nie 403 — leak existence) |
| Not found | 404 | Empty state + "not found" message + návrat-link |
| Validation | 422 | Inline field error, focus na poli, žiadna strata formulára |
| Payload too large | 413 | Inline error pri upload, suggestion pre alternatívu |
| Server error | 500 | Toast "niečo sa pokazilo", retry button, žiaden infinite spinner |
| Rate limit | 429 | UI ukáže "skús o X sekúnd", auto-retry s backoff (bulk operations) |
| CSRF mismatch | 403 | Toast "Session expired, refresh page" |
| Step-up required | 403 | Modal redirect na MFA prompt, return URL preserved |

## 5. Performance / latency simulation

Default MSW handler **nevracia okamžite**. Faktor: `__mocks__/timing.ts`:

```ts
export const LATENCY = {
  list: 80,        // ms
  detail: 50,
  create: 120,
  update: 90,
  attachment: 250,
  search: 180,
  aggregator: 200, // BFF aggregator fan-out — vyššia
  auth: 150,
};
```

Pre **perf testy** existuje deterministický override `LATENCY = 0`, aby
Lighthouse audit neprenášal MSW timing do FE-side metriky.

Pre **timeout testy** existuje override `LATENCY[op] = 30000` → testuje UI
timeout handling (loading state, cancel button, error fallback).

Pre **BFF perf measurement** (p50/p95 per `performance.md`) sa použije
realistic latency s seeded jitter (±20 ms σ).

## 6. Multi-tenancy semantika v handlers (ADR-11 — `X-Tenant` header)

Po 04 r2 finalizácii: tenant context = `X-Tenant: <tenantId>` header z FE → BFF.
BFF validuje proti `session.activeTenantId`. Mock `parseTenantFromRequest`:

```ts
// packages/api-mocks/src/utils/tenant.ts
export function parseTenantFromRequest(req: Request): string | null {
  // ADR-11: jediný legitímny mechanizmus.
  const header = req.headers.get("X-Tenant");
  if (!header && !isPublicEndpoint(req.url)) {
    return null;
  }
  return header;
}
```

Handler check:

```ts
const tenantId = parseTenantFromRequest(req);
if (!tenantId && !isPublicEndpoint(req.url)) {
  emitAudit({ action: "tenant_context_missing", result: "denied", ... });
  return new HttpResponse(JSON.stringify({ error: "tenant_context_missing" }), { status: 401 });
}
// Cross-tab race: ak `X-Tenant` neodpovedá session.activeTenantId
if (tenantId !== session.activeTenantId) {
  return new HttpResponse(
    JSON.stringify({ error: "TENANT_FORBIDDEN", correctTenantId: session.activeTenantId }),
    { status: 403 }
  );
}
```

Tým testujeme:

- Náš api-client **vždy** posiela `X-Tenant` header (regression guard).
- BFF má server-side authority (session.activeTenantId), nie request input.
- Cross-tab tenant drift detekuje BFF (per multi-tenancy-security L4 + L12).

## 7. Schema drift detection

Jeden contract test per modul načíta `docs/agents/api-analyst/schemas/<modul>.ts`,
vytvorí MSW response z fixture-a, a overí, že fixture **pasuje na schému**
(runtime validator — `zod@3.x` per 06 r2).

Ak `api-analyst` zmení schému (round 2+), tento test fail-ne a donúti
update fixture-y. **Žiadne ručné synchronizovanie**.

Implementácia v `tools/test-fixture-validator.ts` (per `test-data.md` §9).

## 8. Mock backend vs. dev server (zdieľaná infraštruktúra s 08)

Cieľ: **rovnaké handlers** bežia v testoch aj v `pnpm dev` (per 08
`dev-environment.md`). Detail:

| Mode | Mechanizmus | Plays well with |
|---|---|---|
| Test (node) — unit / integration | `setupServer()` z `msw/node` (export `@sdm/api-mocks/node`) | vitest |
| Test (node) — BFF integration | `setupServer()` z `msw/node` (mockuje CA SDM upstream, BFF beží ako real code) | vitest |
| Test (browser) — component | `setupServer()` z `msw/node` (jsdom), žiaden service worker | vitest + RTL |
| Dev server (SPA) | `setupWorker()` z `msw/browser` registered v `apps/*/src/main.tsx` keď `VITE_USE_MOCKS=true` | Vite dev server |
| Playwright E2E | route fixture importuje handler list z `@sdm/api-mocks/browser` (no service worker pollution) | Real browser test |

DevOps (08) postará sa o pluging do bundler-u (`@vitejs/plugin-react-swc`) +
service worker registration (`public/mockServiceWorker.js`).

## 9. Per-test handler override (pattern)

Pre edge cases (chyby, race conditions):

```ts
import { http, HttpResponse } from "msw";
import { server } from "@sdm/api-mocks/node";

test("UI shows error banner on 500", async () => {
  server.use(
    http.get("/caisd-rest/in", () =>
      HttpResponse.json({ error: { code: 500, message: "Backend down" } }, { status: 500 }),
    ),
  );
  // ... assert error banner
});
```

CI flag: `onUnhandledRequest: "error"` (strict — každý nezachytený fetch v teste
= fail). Per 08 r1 self-flag → potvrdené strict v r2.

## Otvorené závislosti

- `[04-architecture]` BFF rozhodnutie — `[resolved-in-round-2]`. Layered handler
  set s explicitným split BFF-layer vs. CA SDM upstream je implementovaný (§2).
- `[04-architecture]` Tenant context mechanizmus — `[resolved-in-round-2]`.
  `X-Tenant` header per ADR-11; `parseTenantFromRequest` testuje jeden
  mechanizmus (§6).
- `[01-api-analyst]` Gap #3 (Service Catalog dynamic form schema). MSW handler
  `/getOfferings/{id}` zatiaľ vracia mock s 3 statickými poliami. Akonáhle
  01 doimplementuje skutočnú schému (alebo potvrdí, že je to v1+ feature),
  doplníme dynamic-form handler s realistickou variabilitou.
- `[01-api-analyst]` Gap #6 (Approval workflow) — currently MSW len updatuje
  `wf.status`. Ak Live CA SDM má side-effect chain (auto-notification, next
  task spawn), doplníme MSW fixture s post-update events.
- `[01-api-analyst]` Gap #4 (cross-tenant viewer role) — handler aktuálne
  default-deny (422 `cross_tenant_linking_forbidden`). Po overení Petr
  cross-tenant flow buď otvoríme handler, alebo označíme
  `workspace-change-cross-tenant-conflict` ako out-of-scope MVP.
- `[08-devex-devops]` Service worker registration v `apps/*` build pipeline —
  `[resolved-in-round-2]` per 08 r2 `mock-strategy.md` (browser worker v dev,
  Vite plugin integration). QA zaručuje len handler set ako importovateľnú
  knižnicu.
- `[06-tech-stack-selector]` MSW + @mswjs/data + faker version pin —
  `[resolved-in-round-2]` (`msw@2.x`, `@mswjs/data@0.16.x`, `@faker-js/faker@9.x`).
