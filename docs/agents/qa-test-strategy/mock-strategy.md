# Mock Strategy — SDM-Rewrite

> Round 1, fresh. Stratégia mock-ovania CA SDM REST API + BFF (ak Architecture
> zvolí BFF). **Zdroj pravdy pre schémy:** `docs/agents/api-analyst/schemas/*.ts`
> (12 modulov: auth, common, contact, incident, request, problem, change,
> knowledge, cmdb, attachment, service-catalog, reference).
>
> **Hlavná voľba: MSW (Mock Service Worker)**. Dôvody dole.

## 1. Prečo MSW (a nie wiremock / msw-record-replay / Pact)

| Volba | Hodí sa | Nehodí sa pre nás | Verdikt |
|---|---|---|---|
| **MSW** (handlers v JS/TS) | Unifikovaný handler set pre unit, integration, E2E (jsdom + Playwright + dev server). Schémy z TS zdrojov. | Cross-language consumer (žiaden) | **Vybraný** |
| **wiremock** (JVM, JSON mappings) | Multi-language tímy, cross-service | JS-only project; ďalšia JVM závislosť; horšia developer ergonomia | nie |
| **record-replay** (MSW + recorder, alebo cassettes) | Live API zachytená do JSON | CA SDM nie je dostupný, takže "record" je teoretický. Aj keby bol, schémy v 01 sú už typed | doplnkové, neskôr |
| **Pact** (consumer-driven contracts) | Multi-tím s vlastným producer-om | CA SDM je externý komerčný produkt — žiadny producer-side test | nie |

**MSW handler set je primárny artefakt.** Žije v `packages/api-client/src/__mocks__/`
a je **importovateľný** z apps E2E, integration, unit. Ten istý handler odpovedá
v testoch aj v dev mode (cez service worker v `apps/portal`/`apps/workspace`).

## 2. Handler organizácia

Štruktúra (per modul → mirror voči `api-analyst/schemas/`):

```
packages/api-client/src/__mocks__/
├── index.ts                     # všetky handlery zlúčené (default export)
├── auth.handlers.ts             # POST /caisd-rest/rest_access + DELETE
├── tenant.handlers.ts           # GET /me/tenants (BFF), GET /caisd-rest/cnt_role, /tenant_group_member
├── incident.handlers.ts         # /caisd-rest/in/*, /cr/* (filtered type=I)
├── request.handlers.ts          # /caisd-rest/cr/* (type=R), service catalog offerings
├── problem.handlers.ts          # /caisd-rest/pr/*
├── change.handlers.ts           # /caisd-rest/chg/*, /wf/* (workflow tasks)
├── knowledge.handlers.ts        # /caisd-rest/KCAT/*, /SKELETONS/*, /bui/suggestedSolutions
├── cmdb.handlers.ts             # /caisd-rest/nr/*, relationships
├── attachment.handlers.ts       # /caisd-rest/attmnt/*
├── service-catalog.handlers.ts  # /pcatSearch, /getOfferings, dynamic form spec
├── reference.handlers.ts        # cr_stat, pcat, severity, priority, resolution_code
├── common.handlers.ts           # collection GET pre ľubovoľný factory, paging
├── fixtures/                    # data — viď test-data.md
│   ├── tenants.ts
│   ├── users.ts
│   ├── incidents.ts
│   └── ...
└── overrides/                   # per-test override registrations
    └── *
```

**Pravidlo**: každý handler vie **odpovedať na žiadanú schému aj na chybu**
(401, 404, 422, 500, 413, 429). Default je happy path; chybové reakcie sa
zapínajú per-test cez `server.use(...overrides)`.

## 3. Povinný handler-set (per modul, minimum 6 ako vyžaduje validácia)

### 3.1 Auth (`auth.handlers.ts`)

- `POST /caisd-rest/rest_access` → 201 `RestAccessCreateResponse` (happy) / 401 (bad creds).
- `GET /caisd-rest/rest_access/{id}` → 200 / 401 / 404.
- `DELETE /caisd-rest/rest_access/{id}` → 204 / 401.
- `POST /caisd-rest/bopsid` → 201 `BopsidResponse`.
- Edge: expired access key → 401 `{ error: "access_key_expired" }` — testuje silent re-auth flow v `apps/*/src/auth/`.

### 3.2 Tenant context (`tenant.handlers.ts`)

- `GET /me/tenants` (BFF) → 200 `MyTenantsResponse` so 3 tenantmi (HQ, Acme East, Acme West) — happy path persona Lucia/Anna.
- `GET /me/tenants` → 200 s 1 tenantom (single-tenant user) — overuje, že tenant switcher sa skryje.
- `POST /me/active-tenant { tenantId }` → 200 / 403 (nepatrí používateľovi).
- `GET /caisd-rest/cnt_role?WC=contact%3DU'...'` → 200 zoznam rolí so SREL na tenant.
- `GET /caisd-rest/tenant_group_member?WC=tenant_id%3DU'...'` → 200 zoznam memberships.
- Edge: switch na tenant, ku ktorému user nemá rolu → 403; UI musí ukázať toast + zostať v predošlom tenante.

### 3.3 Incident (`incident.handlers.ts`)

- `GET /caisd-rest/in?WC=active%3D1` → 200 paginated list 25 incidentov.
- `GET /caisd-rest/in/{id}` → 200 plný `Incident` payload.
- `POST /caisd-rest/in` → 201 nový incident (validuje required `customer`, `log_agent`, `description`).
- `PUT /caisd-rest/in/{id}` → 200 (status transition: `OP → WIP`, `WIP → RES` so `resolutionDescription`).
- `PUT /caisd-rest/in/{id}` → 422 `{ field: "resolutionDescription", code: "REQUIRED" }` pri pokuse o `RES` bez popisu.
- Cross-tenant: `GET /caisd-rest/in/{id}` v inom tenante než `activeTenant` → 200 alebo prázdny (per behavior z `multi-tenancy.md` §2). UI test overuje, že queue ignoruje out-of-tenant výsledky.
- Edge: 413 pri upload attachment > 25 MB (referenced incident `INC-1042` z `portal-incident-broken-laptop`).
- Edge: SSO session expirovala počas submit-u → 401 + draft preserved v localStorage (`portal-incident-broken-laptop` alternate path).

### 3.4 Request (`request.handlers.ts`)

- `GET /caisd-rest/cr?WC=type%3D'R'%20AND%20active%3D1` → 200 list requestov.
- `POST /caisd-rest/cr` → 201 (type=R, status=SUBMITTED).
- `PUT /caisd-rest/cr/{id}` (approve flow): manager schvaľuje → status APPROVED.
- `PUT /caisd-rest/cr/{id}` (reject) → status REJECTED, `rejection_reason` povinný.
- `GET /pcatSearch?query=figma` → 200 `{ offerings: [...] }`.
- `GET /getOfferings/{id}` → 200 s dynamickými poliami (3 polia minimum: text, select, file upload) — pripravené na neskorší `service-catalog-form-schema` flag.
- Auto-approve flow (catalog item bez approval): `POST /caisd-rest/cr` → 201 status=IN_PROGRESS direct.

### 3.5 Problem (`problem.handlers.ts`)

- `GET /caisd-rest/pr` → 200 list.
- `POST /caisd-rest/pr` → 201 (IDENTIFIED).
- `PUT /caisd-rest/pr/{id}` — state transitions per lifecycle (IDENTIFIED → INVESTIGATION → ROOT_CAUSE_KNOWN → KNOWN_ERROR → RESOLVED).
- `POST /caisd-rest/pr/{id}/linked-incidents` → 200 (bulk linkovanie 12 incidentov — `workspace-problem-rca`).
- Edge: cross-tenant linkovanie → buď 200 (povolené) alebo 422 — finálne podľa `[GAP-2]` z `journeys.md`. Default handler: 422 + reason "cross-tenant linking requires global role". Test overuje, že UI ukáže warning.

### 3.6 Change (`change.handlers.ts`)

- `GET /caisd-rest/chg` → 200 list (default + calendar view).
- `POST /caisd-rest/chg` → 201 RFC.
- `PUT /caisd-rest/chg/{id}` — transitions RFC → APPR_PENDING → APPROVED / REJECTED.
- `PUT /caisd-rest/wf/{id}` — approval task update (per gap #6 — overiteľné neskôr).
- Emergency flow: `POST /caisd-rest/chg { type: "emergency" }` → 201 status=EMG_RFC.
- Edge: approve bez rollback plan → 422 `{ field: "rollbackPlan", code: "REQUIRED_FOR_EMERGENCY" }` (`workspace-change-emergency-approve` alternate).
- Conflict detection: `GET /caisd-rest/chg?WC=...calendar window...` → vráti 2 changes na rovnaký CI v rovnakom čase, FE ich má vizuálne zvýrazniť.

### 3.7 Knowledge (`knowledge.handlers.ts`)

- `GET /caisd-rest/SKELETONS?WC=...` → 200 KB list.
- `GET /caisd-rest/SKELETONS/{id}` → 200 KB article s body.
- `POST /caisd-rest/SKELETONS` → 201 DRAFT.
- `PUT /caisd-rest/SKELETONS/{id}` — transitions DRAFT → REVIEW → APPROVED → PUBLISHED.
- `GET /bui/suggestedSolutions?text=<q>` → 200 ranked KB articles.
- Edge: search 0 výsledkov → 200 prázdny zoznam — UI test (Lucia alternate flow) musí ponúknuť "create ticket from search".
- Edge: KB článok len v EN, profil SK → vráti `language=en` + UI test overuje "Iba v angličtine" badge.

### 3.8 CMDB (`cmdb.handlers.ts`)

- `GET /caisd-rest/nr` → 200 list CI.
- `GET /caisd-rest/nr/{id}` → 200 CI detail s 47 atribútmi (per `workspace-cmdb-ci-detail`).
- `GET /caisd-rest/nr/{id}/relationships` → 200 graph s 23 nodes (default) alebo 200+ nodes (cluster test).
- `GET /caisd-rest/nr/{id}/all_open_creq` → 200 6 otvorených incidentov na CI.
- Cross-tenant: CI v inom tenante → 200 aggregate ("3 CIs consumed by External tenant") bez detailov (per `cmdb_owner_robert` cross-tenant journey).

### 3.9 Attachment (`attachment.handlers.ts`)

- `POST /caisd-rest/attmnt` happy → 201.
- `POST /caisd-rest/attmnt` veľký file → 413 (test pre Lucia broken-laptop alternate).
- `GET /caisd-rest/attmnt/{id}` → 200 stream.

### 3.10 Reference data (`reference.handlers.ts`)

- `GET /caisd-rest/cr_stat` → 200 status list (OP, WIP, HLD, RES, CL, ...).
- `GET /caisd-rest/pcat` → 200 category tree.
- `GET /caisd-rest/sevrty` → 200 severity codes.
- `GET /caisd-rest/cr_resolutions` → 200 resolution code list (závisí od `[03-domain-modeller]` flag — finálny zdroj per-tenant config alebo global).

## 4. Error scenario coverage matrix

Pre **každý** modul musí byť **aspoň jeden** test z každej kategórie:

| Error kategória | Status code | UI behavior overený |
|---|---|---|
| Auth expired | 401 | Silent re-auth attempt, fallback redirect na login, draft preserved |
| Forbidden (RBAC) | 403 | Disabled UI element s tooltipom, žiadny redirect |
| Not found | 404 | Empty state + "not found" message + návrat-link |
| Validation | 422 | Inline field error, focus na poli, žiadna strata formulára |
| Payload too large | 413 | Inline error pri upload, suggestion pre alternatívu |
| Server error | 500 | Toast "niečo sa pokazilo", retry button, žiaden infinite spinner |
| Rate limit | 429 | UI ukáže "skús o X sekúnd", auto-retry s backoff (bulk operations) |

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
};
```

Pre **perf testy** existuje deterministický override `LATENCY = 0`, aby
Lighthouse audit neprenášal MSW timing do FE-side metriky.

Pre **timeout testy** existuje override `LATENCY[op] = 30000` → testuje UI
timeout handling (loading state, cancel button, error fallback).

## 6. Multi-tenancy semantika v handlers

Každý handler musí **fail-fast** ak request nepríde s tenant kontextom
(podľa toho, ako Architecture zvolí mechanizmus). Default v MSW:

```ts
const tenantId = req.headers.get("X-Tenant-Id")
              ?? extractTenantFromCookie(req)
              ?? extractTenantFromUrl(req);
if (!tenantId && !isPublicEndpoint(req.url)) {
  return res(401, { error: "tenant_context_missing" });
}
```

Tým testujeme, že náš api-client **vždy** posiela tenant kontext (regression
guard po round-2 zmenách v Architecture).

## 7. Schema drift detection

Jeden contract test per modul načíta `docs/agents/api-analyst/schemas/<modul>.ts`,
vytvorí MSW response z fixture-a, a overí, že fixture **pasuje na schému**
(runtime validator — zod / valibot / class-validator podľa 06).

Ak `api-analyst` zmení schému (round 2+), tento test fail-ne a donúti
update fixture-y. **Žiadne ručné synchronizovanie**.

## 8. Mock backend vs. dev server (zdieľaná infraštruktúra s 08)

Cieľ: **rovnaké handlers** bežia v testoch aj v `npm run dev`. Detail:

| Mode | Mechanizmus | Plays well with |
|---|---|---|
| Test (node) | `setupServer()` z `msw/node` | vitest/jest, Playwright (route fixture variant) |
| Test (browser) | `setupWorker()` z `msw/browser` (jsdom režim — nie default) | komponent testy s real network |
| Dev server | `setupWorker()` registered v `apps/*/src/main.tsx` keď `import.meta.env.MODE === "development"` | Vite ekv. dev server |
| Playwright E2E | route fixture importuje handler list z `__mocks__/index.ts` | Real browser test bez service-worker complikácií |

DevOps (08) postará sa o pluging do bundler-u (Vite/Webpack/Rspack podľa 06).

## Otvorené závislosti

- `[04-architecture]` Ak Architecture zvolí BFF, niektoré handlers
  (`/me/tenants`, `/me/active-tenant`, `/bui/suggestedSolutions` aggregated)
  sa rozdelia na **dve vrstvy**: MSW pre BFF endpointy + MSW pre CA SDM
  upstream. Súčasná stratégia má jeden flat handler set; v round 2 doplníme
  layered variant ak Architecture potvrdí BFF.
- `[04-architecture]` Tenant context mechanizmus (header / cookie / route)
  ovplyvní implementáciu MSW middleware (§6). Stratégia opisuje fallback chain
  všetkých troch mechanizmov; finálny ostane jeden.
- `[01-api-analyst]` Gap #3 (Service Catalog dynamic form schema). MSW handler
  `/getOfferings/{id}` zatiaľ vracia mock s 3 statickými poliami. Akonáhle
  01 doimplementuje skutočnú schému (alebo potvrdí, že je to v1+ feature),
  doplníme dynamic-form handler s realistickou variabilitou.
- `[01-api-analyst]` Gap #6 (Approval workflow) — currently MSW len updatuje
  `wf.status`. Ak Live CA SDM má side-effect chain (auto-notification, next
  task spawn), doplníme MSW fixture s post-update events.
- `[01-api-analyst]` Gap #4 (cross-tenant viewer role) — handler aktuálne
  default-deny. Po overení Petr cross-tenant flow buď otvoríme handler, alebo
  označíme `workspace-change-cross-tenant-conflict` ako out-of-scope MVP.
- `[08-devex-devops]` Service worker registration v `apps/*` build pipeline —
  konkrétna voľba (msw worker, vite-plugin-msw, ...) patrí DevOps. QA
  zaručuje len handler set ako importovateľnú knižnicu.
