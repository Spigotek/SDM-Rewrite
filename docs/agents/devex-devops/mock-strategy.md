# Mock backend stratégia — MSW nad CA SDM REST

## Changelog (round 2)

- **Tenant header zmenený z `X-CA-SDM-Tenant` na `X-Tenant`** (04 r2 ADR-11 finálne rozhodnutie).
- Handler set rozšírený z **8 modulov na 10** — pridané `users` (BFF `/me`, `/me/active-tenant`, `/whoami`) a `audit` (BFF `/api/audit/*` endpointy pre admin audit log viewer). `service-catalog` ostáva ako pod-modul v `requests.ts` (zhoda s 09 r1).
- Mocky majú **dve vrstvy** podľa 04 r2 BFF (ADR-01 finalizovaný):
  - **CA SDM upstream mocks** (`/caisd-rest/*`) — pre integration testy BFF (Node MSW).
  - **BFF endpoint mocks** (`/api/*`, `/me/*`, `/auth/*`, `/config`) — pre FE dev a integration testy (browser/Node MSW).
- 09 r1 `mock-strategy.md` (zdroj pravdy pre QA) zarovnaný — tu doplnené handler bloky.
- `parseTenantFromRequest` aktualizovaný na `X-Tenant` lookup + session cookie fallback (BFF-style).
- `## Otvorené závislosti` uzavreté `[04-architecture]` (multi-tenancy header + BFF), `[05-security]` (auth flow).

> Vývoj prebieha **bez živej CA SDM 17.4 inštancie**. Mock backend je založený na
> **Mock Service Worker (MSW)** — zachytáva HTTP requesty v browseri (Service Worker)
> a v Node (Vitest, Playwright integračné testy).
>
> Mock backend je **autoritatívny zdroj pravdy pre dev a CI**, kým prvá CA SDM
> staging inštancia nie je dostupná. Schémy = zdroj z `docs/agents/api-analyst/schemas/`.

## Princípy

1. **Schemafirst** — TypeScript typy zo schém `01-api-analyst` sú zdielané medzi
   `packages/api-client`, `apps/bff/src/lib/ca-sdm-client.ts` a `apps/<x>/src/mocks/`.
   Žiadne hand-rolled typy v mockoch.
2. **Disjunktný stav per modul** — incidents, requests, problems, … žijú v
   samostatných `fixtures/<modul>.ts` súboroch, mutácie sú in-memory v worker scope.
3. **Idempotentnosť** — reload page = reset stavu (Service Worker scope mizne).
   Pre stabilné testy: každý test si reset volá `worker.resetHandlers()`.
4. **Multi-tenancy v mockoch od dňa 1** — fixtures majú `tenant` field, handlery
   filtrujú podľa request header **`X-Tenant`** (04 r2 ADR-11) + session cookie
   fallback (BFF-style).
5. **Žiadna business logic v mockoch** — len CRUD + minimálne state transitions
   (napr. status incidentu: `open → in-progress → resolved`). Workflow logiku má
   reálna CA SDM, mock len simuluje response shape.
6. **Dvojvrstvový mock set** (04 r2 ADR-01 BFF accepted):
   - `handlers/upstream/*` — CA SDM `/caisd-rest/*` endpointy (pre BFF integration testy v Node MSW).
   - `handlers/bff/*` — BFF `/api/*`, `/me/*`, `/auth/*` endpointy (pre FE dev + apps integration tests).
   - V dev mode FE volá iba BFF mocky (`/api/*`). V `bff/tests` Node MSW serve-uje upstream `/caisd-rest/*`.

## Knižnice

| Balík | Verzia | Použitie |
|---|---|---|
| `msw` | ^2.6.0 | Browser Service Worker + Node server |
| `@mswjs/data` | ^0.16.0 | In-memory mock DB (CRUD, relations) |
| `@faker-js/faker` | ^9.3.0 | Generovanie fixture dát |

## Štruktúra balíka `packages/api-mocks/`

```
packages/api-mocks/
├── package.json
├── src/
│   ├── index.ts                       # public exports
│   ├── browser.ts                     # setupWorker pre apps (FE dev — BFF mocks)
│   ├── node.ts                        # setupServer pre Vitest / Playwright (FE + BFF testy)
│   ├── node-upstream.ts               # setupServer pre BFF integration tests (CA SDM mocks)
│   ├── db.ts                          # @mswjs/data model factory
│   ├── handlers/
│   │   ├── index.ts                   # zlúčenie všetkých (bff + upstream)
│   │   ├── bff/
│   │   │   ├── auth.ts                # /auth/login, /auth/callback, /auth/logout, /auth/refresh
│   │   │   ├── users.ts               # /me, /me/active-tenant, /whoami
│   │   │   ├── tenants.ts             # /me/tenants (aggregator)
│   │   │   ├── incidents.ts           # /api/incidents/*
│   │   │   ├── requests.ts            # /api/requests/* + /api/catalog/*
│   │   │   ├── problems.ts            # /api/problems/*
│   │   │   ├── changes.ts             # /api/changes/*
│   │   │   ├── knowledge.ts           # /api/kb/*
│   │   │   ├── cmdb.ts                # /api/ci/*
│   │   │   └── audit.ts               # /api/audit/* (admin viewer; per 05 audit-and-compliance)
│   │   └── upstream/
│   │       ├── auth.ts                # /caisd-rest/rest_access
│   │       ├── tenants.ts             # /caisd-rest/tenant_group_member, cnt_role
│   │       ├── incidents.ts           # /caisd-rest/in/*
│   │       ├── requests.ts            # /caisd-rest/cr/*, /pcatSearch, /getOfferings
│   │       ├── problems.ts            # /caisd-rest/pr/*
│   │       ├── changes.ts             # /caisd-rest/chg/*, /wf/*
│   │       ├── knowledge.ts           # /caisd-rest/SKELETONS/*, /bui/suggestedSolutions
│   │       ├── cmdb.ts                # /caisd-rest/nr/*
│   │       └── reference.ts           # /caisd-rest/cr_stat, /pcat, /sevrty, /cr_resolutions
│   ├── fixtures/
│   │   ├── tenants.ts                 # 2 tenanti — acme-corp, globex
│   │   ├── users.ts                   # 6 — 3 per tenant
│   │   ├── incidents.ts               # ~40 záznamov, distribuované po stavoch
│   │   ├── requests.ts                # ~25
│   │   ├── problems.ts                # ~10
│   │   ├── changes.ts                 # ~15
│   │   ├── knowledge.ts               # ~30
│   │   ├── ci.ts                      # CMDB CI items + relations
│   │   ├── catalog.ts                 # service catalog items + form schemas
│   │   └── audit-events.ts            # ~50 audit events (per 05 audit-and-compliance taxonomy)
│   └── utils/
│       ├── tenant.ts                  # parseTenantFromRequest()
│       ├── pagination.ts              # toCaSdmPaginatedResponse()
│       └── errors.ts                  # CA SDM error shape helpers + BFF AppError shape
└── tsconfig.json
```

`apps/portal/src/mocks/browser.ts` a `apps/workspace/src/mocks/browser.ts` len
re-exportujú zo `@sdm/api-mocks` (BFF mocks only) — žiadny per-app handler override.
`apps/bff/tests/setup.ts` importuje `@sdm/api-mocks/node-upstream` (CA SDM mocks).

## Handler bloky — povinné moduly

**10 handler modulov** pre MVP scope z GOAL §3 (zhoda s 09 r1 `mock-strategy.md` §
3.1–3.10): `auth`, `users`, `tenants`, `incidents`, `requests`, `problems`,
`changes`, `knowledge`, `cmdb`, `audit`.

> Príklady kódu nižšie ukazujú **BFF vrstvu** (`/api/*`, `/me/*`). Upstream vrstva
> (`/caisd-rest/*` v `handlers/upstream/*.ts`) má rovnaký shape ale iné URL.

### 1. `auth.ts` (BFF auth flow)

```ts
import { http, HttpResponse } from "msw";

export const authHandlers = [
  // POST /caisd-rest/rest_access — výmena credentials za access key
  http.post("/caisd-rest/rest_access", async ({ request }) => {
    const body = await request.json() as { rest_access: { user_name: string; password: string } };
    if (!body.rest_access?.user_name) {
      return HttpResponse.json(
        { error: { code: 401, message: "Authentication failed" } },
        { status: 401 },
      );
    }
    return HttpResponse.json({
      rest_access: {
        access_key: `mock-access-key-${Date.now()}`,
        expiration_date: new Date(Date.now() + 3600_000).toISOString(),
      },
    });
  }),

  // GET /caisd-rest/whoami
  http.get("/caisd-rest/whoami", () => {
    return HttpResponse.json({
      user: {
        id: "user-1",
        username: "admin",
        first_name: "Admin",
        last_name: "User",
        email: "admin@example.com",
        tenants: ["acme-corp", "globex"],
        roles: { "acme-corp": "analyst", "globex": "approver" },
      },
    });
  }),
];
```

### 2. `users.ts` (BFF `/me` family)

Aggregator endpoints, ktoré BFF skladá z `/caisd-rest/whoami` + `cnt_role`
(per `api-analyst/multi-tenancy.md` § 3.1). FE volá vždy BFF, nikdy CA SDM
priamo.

```ts
import { http, HttpResponse } from "msw";
import { db } from "../../db";
import { parseTenantFromRequest } from "../../utils/tenant";

export const userHandlers = [
  // GET /me — user profile + session info + activeTenantId
  http.get("/me", ({ request }) => {
    const activeTenant = parseTenantFromRequest(request);
    return HttpResponse.json({
      user: {
        id: "user-1",
        username: "anna.analyst",
        fullName: "Anna Analyst",
        email: "anna@acme-corp.example",
      },
      session: {
        activeTenantId: activeTenant,
        expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
      },
    });
  }),

  // POST /me/active-tenant — switch tenant
  http.post("/me/active-tenant", async ({ request }) => {
    const body = await request.json() as { tenantId: string };
    const user = db.user.findFirst({ where: { id: { equals: "user-1" } } });
    if (!user?.tenants.includes(body.tenantId)) {
      return HttpResponse.json(
        { error: { code: "TENANT_FORBIDDEN", message: "User has no role in tenant" } },
        { status: 403 },
      );
    }
    return HttpResponse.json({ activeTenantId: body.tenantId }, {
      headers: { "Set-Cookie": `sdm-session=mock-session; HttpOnly; SameSite=Lax` },
    });
  }),
];
```

### 3. `tenants.ts` (BFF `/me/tenants` aggregator)

BFF skladá z 3+ CA SDM volaní (`/caisd-rest/cnt_role`, `/tenant_group_member`,
`/whoami`) per `api-analyst/multi-tenancy.md` § 3.1. Mock vracia agregovaný shape:

```ts
import { http, HttpResponse } from "msw";
import { db } from "../../db";

export const tenantHandlers = [
  // GET /me/tenants — aggregator
  http.get("/me/tenants", () => {
    const tenants = db.tenant.findMany({});
    return HttpResponse.json({
      tenants: tenants.map((t) => ({
        id: t.id,
        name: t.name,
        roles: ["analyst", "approver"],          // simplified — z user.roles mapping
      })),
    });
  }),
];
```

Upstream variant (`handlers/upstream/tenants.ts`) volá `/caisd-rest/cnt_role`
a `/caisd-rest/tenant_group_member` — pre BFF integration tests.

### 4. `incidents.ts`

```ts
import { http, HttpResponse } from "msw";
import { db } from "../db";
import { parseTenantFromRequest } from "../utils/tenant";
import { toCaSdmPaginatedResponse } from "../utils/pagination";

export const incidentHandlers = [
  // GET /caisd-rest/in
  http.get("/caisd-rest/in", ({ request }) => {
    const tenant = parseTenantFromRequest(request);
    const url = new URL(request.url);
    const wc = url.searchParams.get("wc"); // CA SDM WHERE clause
    const start = Number(url.searchParams.get("start") ?? 0);
    const count = Number(url.searchParams.get("count") ?? 25);

    const all = db.incident.findMany({
      where: { tenant: { equals: tenant } },
    });
    const filtered = wc ? all.filter((i) => matchWhereClause(i, wc)) : all;
    return HttpResponse.json(toCaSdmPaginatedResponse(filtered, start, count, "in"));
  }),

  // GET /caisd-rest/in/:id
  http.get("/caisd-rest/in/:id", ({ params, request }) => {
    const tenant = parseTenantFromRequest(request);
    const incident = db.incident.findFirst({
      where: { id: { equals: String(params.id) }, tenant: { equals: tenant } },
    });
    if (!incident) {
      return HttpResponse.json(
        { error: { code: 404, message: `Incident ${params.id} not found` } },
        { status: 404 },
      );
    }
    return HttpResponse.json({ in: incident });
  }),

  // POST /caisd-rest/in
  http.post("/caisd-rest/in", async ({ request }) => {
    const tenant = parseTenantFromRequest(request);
    const body = await request.json() as { in: Partial<Incident> };
    const created = db.incident.create({
      ...body.in,
      tenant,
      id: `cr:${Date.now()}`,
      open_date: Math.floor(Date.now() / 1000),
      status: "OP",
    });
    return HttpResponse.json({ in: created }, { status: 201 });
  }),

  // PATCH /caisd-rest/in/:id
  http.patch("/caisd-rest/in/:id", async ({ params, request }) => {
    const updated = db.incident.update({
      where: { id: { equals: String(params.id) } },
      data: await request.json() as Partial<Incident>,
    });
    if (!updated) {
      return HttpResponse.json({ error: { code: 404, message: "Not found" } }, { status: 404 });
    }
    return HttpResponse.json({ in: updated });
  }),
];

function matchWhereClause(record: Incident, wc: string): boolean {
  // Simplified parser — supports `field = 'value'` and `AND`. Sufficient for MVP demos.
  const tokens = wc.split(/\s+AND\s+/i);
  return tokens.every((t) => {
    const m = t.match(/(\w+)\s*=\s*'?([^']+)'?/);
    if (!m) return true;
    const [, field, value] = m;
    return String(record[field as keyof Incident]) === value;
  });
}
```

### 5. `requests.ts`

```ts
import { http, HttpResponse } from "msw";
import { db } from "../db";
import { parseTenantFromRequest } from "../utils/tenant";
import { toCaSdmPaginatedResponse } from "../utils/pagination";
import { catalogForms } from "../fixtures/catalog";

export const requestHandlers = [
  // GET /caisd-rest/cr (request_for=R)
  http.get("/caisd-rest/cr", ({ request }) => {
    const tenant = parseTenantFromRequest(request);
    const url = new URL(request.url);
    const start = Number(url.searchParams.get("start") ?? 0);
    const count = Number(url.searchParams.get("count") ?? 25);
    const all = db.serviceRequest.findMany({
      where: { tenant: { equals: tenant } },
    });
    return HttpResponse.json(toCaSdmPaginatedResponse(all, start, count, "cr"));
  }),

  // GET /caisd-rest/svc_offering — Service Catalog browse
  http.get("/caisd-rest/svc_offering", ({ request }) => {
    const tenant = parseTenantFromRequest(request);
    return HttpResponse.json({
      svc_offerings: db.serviceOffering.findMany({
        where: { tenant: { equals: tenant } },
      }),
    });
  }),

  // GET /caisd-rest/svc_offering/:id/form — dynamic form schema
  http.get("/caisd-rest/svc_offering/:id/form", ({ params }) => {
    const schema = catalogForms[String(params.id)];
    if (!schema) return HttpResponse.json({ error: { code: 404 } }, { status: 404 });
    return HttpResponse.json({ form: schema });
  }),

  // POST /caisd-rest/cr — submit request from catalog
  http.post("/caisd-rest/cr", async ({ request }) => {
    const tenant = parseTenantFromRequest(request);
    const body = await request.json() as { cr: Record<string, unknown> };
    const created = db.serviceRequest.create({
      ...body.cr,
      tenant,
      id: `cr:${Date.now()}`,
      open_date: Math.floor(Date.now() / 1000),
      status: "OP",
    });
    return HttpResponse.json({ cr: created }, { status: 201 });
  }),
];
```

### 6. `problems.ts`

```ts
import { http, HttpResponse } from "msw";
import { db } from "../db";
import { parseTenantFromRequest } from "../utils/tenant";
import { toCaSdmPaginatedResponse } from "../utils/pagination";

export const problemHandlers = [
  http.get("/caisd-rest/pr", ({ request }) => {
    const tenant = parseTenantFromRequest(request);
    const url = new URL(request.url);
    const all = db.problem.findMany({ where: { tenant: { equals: tenant } } });
    return HttpResponse.json(
      toCaSdmPaginatedResponse(all, Number(url.searchParams.get("start") ?? 0), 25, "pr"),
    );
  }),

  http.get("/caisd-rest/pr/:id", ({ params, request }) => {
    const tenant = parseTenantFromRequest(request);
    const pr = db.problem.findFirst({
      where: { id: { equals: String(params.id) }, tenant: { equals: tenant } },
    });
    if (!pr) return HttpResponse.json({ error: { code: 404 } }, { status: 404 });
    return HttpResponse.json({ pr });
  }),

  // GET /caisd-rest/pr/:id/related_incidents — relation queries
  http.get("/caisd-rest/pr/:id/related_incidents", ({ params }) => {
    const related = db.incident.findMany({
      where: { problem: { equals: String(params.id) } },
    });
    return HttpResponse.json({ incidents: related });
  }),
];
```

### 7. `changes.ts`

```ts
import { http, HttpResponse } from "msw";
import { db } from "../db";
import { parseTenantFromRequest } from "../utils/tenant";

export const changeHandlers = [
  http.get("/caisd-rest/chg", ({ request }) => {
    const tenant = parseTenantFromRequest(request);
    return HttpResponse.json({
      chg: db.change.findMany({ where: { tenant: { equals: tenant } } }),
    });
  }),

  http.get("/caisd-rest/chg/:id", ({ params }) => {
    const chg = db.change.findFirst({ where: { id: { equals: String(params.id) } } });
    if (!chg) return HttpResponse.json({ error: { code: 404 } }, { status: 404 });
    return HttpResponse.json({ chg });
  }),

  // POST /caisd-rest/chg/:id/approve — minimálny approval flow
  http.post("/caisd-rest/chg/:id/approve", async ({ params, request }) => {
    const body = await request.json() as { decision: "approve" | "reject"; reason?: string };
    const updated = db.change.update({
      where: { id: { equals: String(params.id) } },
      data: { status: body.decision === "approve" ? "APR" : "REJ" },
    });
    return HttpResponse.json({ chg: updated });
  }),
];
```

### 8. `knowledge.ts`

```ts
import { http, HttpResponse } from "msw";
import { db } from "../db";

export const knowledgeHandlers = [
  http.get("/caisd-rest/kd", ({ request }) => {
    const url = new URL(request.url);
    const q = url.searchParams.get("q");
    const all = db.knowledgeDoc.findMany({});
    const filtered = q
      ? all.filter((d) =>
          [d.title, d.summary, d.content].some((f) => f?.toLowerCase().includes(q.toLowerCase())),
        )
      : all;
    return HttpResponse.json({ kd: filtered });
  }),

  http.get("/caisd-rest/kd/:id", ({ params }) => {
    const kd = db.knowledgeDoc.findFirst({ where: { id: { equals: String(params.id) } } });
    if (!kd) return HttpResponse.json({ error: { code: 404 } }, { status: 404 });
    return HttpResponse.json({ kd });
  }),
];
```

### 9. `cmdb.ts`

```ts
import { http, HttpResponse } from "msw";
import { db } from "../db";

export const cmdbHandlers = [
  http.get("/caisd-rest/nr", ({ request }) => {
    const url = new URL(request.url);
    const start = Number(url.searchParams.get("start") ?? 0);
    const all = db.configurationItem.findMany({});
    return HttpResponse.json({
      nr: all.slice(start, start + 25),
      total_count: all.length,
    });
  }),

  http.get("/caisd-rest/nr/:id", ({ params }) => {
    const ci = db.configurationItem.findFirst({ where: { id: { equals: String(params.id) } } });
    if (!ci) return HttpResponse.json({ error: { code: 404 } }, { status: 404 });
    return HttpResponse.json({ nr: ci });
  }),

  // GET /caisd-rest/nr/:id/relations
  http.get("/caisd-rest/nr/:id/relations", ({ params }) => {
    const relations = db.ciRelation.findMany({
      where: {
        OR: [
          { source: { equals: String(params.id) } },
          { target: { equals: String(params.id) } },
        ],
      },
    });
    return HttpResponse.json({ relations });
  }),
];
```

### 10. `audit.ts` (BFF admin audit log viewer)

Endpoints pre admin audit log UI per 05 r1 `audit-and-compliance.md`. BFF
zaslúhne audit events do JSON log streamu — admin UI dotazuje cez paginated
endpoint.

```ts
import { http, HttpResponse } from "msw";
import { db } from "../../db";
import { parseTenantFromRequest } from "../../utils/tenant";
import { toCaSdmPaginatedResponse } from "../../utils/pagination";

export const auditHandlers = [
  // GET /api/audit/events — list audit events (paginated)
  http.get("/api/audit/events", ({ request }) => {
    const tenant = parseTenantFromRequest(request);
    const url = new URL(request.url);
    const start = Number(url.searchParams.get("start") ?? 0);
    const count = Number(url.searchParams.get("count") ?? 25);
    const eventType = url.searchParams.get("eventType");
    const userId = url.searchParams.get("userId");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    let events = db.auditEvent.findMany({
      where: { tenantId: { equals: tenant } },
    });
    if (eventType) events = events.filter((e) => e.eventType === eventType);
    if (userId) events = events.filter((e) => e.userId === userId);
    if (from) events = events.filter((e) => e.timestamp >= from);
    if (to) events = events.filter((e) => e.timestamp <= to);

    // Most recent first
    events.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    return HttpResponse.json(toCaSdmPaginatedResponse(events, start, count, "events"));
  }),

  // GET /api/audit/events/:id — single event detail
  http.get("/api/audit/events/:id", ({ params, request }) => {
    const tenant = parseTenantFromRequest(request);
    const event = db.auditEvent.findFirst({
      where: { id: { equals: String(params.id) }, tenantId: { equals: tenant } },
    });
    if (!event) {
      return HttpResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
    }
    return HttpResponse.json({ event });
  }),

  // GET /api/audit/event-types — taxonomy (per 05 audit-and-compliance.md)
  http.get("/api/audit/event-types", () => {
    return HttpResponse.json({
      eventTypes: [
        "auth.login",
        "auth.logout",
        "auth.session_expired",
        "tenant.switched",
        "incident.created",
        "incident.updated",
        "incident.status_changed",
        "change.approved",
        "change.rejected",
        "kb.published",
        "permission.denied",
        "data.exported",
      ],
    });
  }),
];
```

Fixture (`fixtures/audit-events.ts`):

```ts
import { faker } from "@faker-js/faker";
faker.seed(43);

const TYPES = ["auth.login", "incident.created", "tenant.switched", "change.approved", "permission.denied"];

export const auditEventsFixture = Array.from({ length: 50 }).map((_, i) => ({
  id: `aud:${100_000 + i}`,
  timestamp: faker.date.recent({ days: 7 }).toISOString(),
  eventType: faker.helpers.arrayElement(TYPES),
  userId: faker.helpers.arrayElement(["user-1", "user-2", "user-3"]),
  tenantId: i % 3 === 0 ? "globex" : "acme-corp",
  correlationId: faker.string.uuid(),
  outcome: faker.helpers.arrayElement(["success", "failure"]),
  details: { ipAddress: faker.internet.ip(), userAgent: "Mozilla/5.0" },
}));
```

## In-memory DB — `db.ts`

`@mswjs/data` model factory. Definuje schémy + vzťahy + seed-uje fixtures.

```ts
import { factory, primaryKey, manyOf, oneOf } from "@mswjs/data";
import {
  tenantsFixture,
  usersFixture,
  incidentsFixture,
  requestsFixture,
  problemsFixture,
  changesFixture,
  knowledgeFixture,
  ciFixture,
  ciRelationFixture,
  serviceOfferingFixture,
} from "./fixtures";

export const db = factory({
  tenant: {
    id: primaryKey(String),
    name: String,
    domain: String,
  },
  user: {
    id: primaryKey(String),
    username: String,
    email: String,
    tenants: Array,
  },
  incident: {
    id: primaryKey(String),
    ref_num: String,
    summary: String,
    description: String,
    status: String,           // OP, IP, CL, RS
    priority: Number,         // 1–5
    severity: Number,
    impact: Number,
    urgency: Number,
    open_date: Number,        // epoch seconds
    close_date: Number,
    customer: String,
    assignee: String,
    affected_resource: String,
    problem: String,
    tenant: String,
  },
  serviceRequest: {
    id: primaryKey(String),
    ref_num: String,
    summary: String,
    status: String,
    open_date: Number,
    requestor: String,
    svc_offering: String,
    tenant: String,
  },
  serviceOffering: {
    id: primaryKey(String),
    name: String,
    description: String,
    category: String,
    tenant: String,
  },
  problem: {
    id: primaryKey(String),
    ref_num: String,
    summary: String,
    status: String,
    root_cause: String,
    tenant: String,
  },
  change: {
    id: primaryKey(String),
    ref_num: String,
    summary: String,
    status: String,           // OP, APR, REJ, IMP, CL
    risk: Number,
    backout_plan: String,
    requested_start: Number,
    requested_end: Number,
    tenant: String,
  },
  knowledgeDoc: {
    id: primaryKey(String),
    title: String,
    summary: String,
    content: String,
    category: String,
    published: Boolean,
  },
  configurationItem: {
    id: primaryKey(String),
    name: String,
    ci_class: String,
    status: String,
    family: String,
    tenant: String,
  },
  ciRelation: {
    id: primaryKey(String),
    source: String,
    target: String,
    type: String,             // "depends_on", "contains", "uses"
  },
  auditEvent: {
    id: primaryKey(String),
    timestamp: String,        // ISO-8601
    eventType: String,        // per 05 audit taxonomy
    userId: String,
    tenantId: String,
    correlationId: String,
    outcome: String,          // "success" | "failure"
    details: Object,
  },
});

// Seed
tenantsFixture.forEach((t) => db.tenant.create(t));
usersFixture.forEach((u) => db.user.create(u));
incidentsFixture.forEach((i) => db.incident.create(i));
requestsFixture.forEach((r) => db.serviceRequest.create(r));
serviceOfferingFixture.forEach((s) => db.serviceOffering.create(s));
problemsFixture.forEach((p) => db.problem.create(p));
changesFixture.forEach((c) => db.change.create(c));
knowledgeFixture.forEach((k) => db.knowledgeDoc.create(k));
ciFixture.forEach((c) => db.configurationItem.create(c));
ciRelationFixture.forEach((r) => db.ciRelation.create(r));
auditEventsFixture.forEach((e) => db.auditEvent.create(e));
```

## Fixture generátor — `fixtures/incidents.ts`

```ts
import { faker } from "@faker-js/faker";

faker.seed(42);                     // deterministicky

export const incidentsFixture = Array.from({ length: 40 }).map((_, i) => ({
  id: `cr:1000${i}`,
  ref_num: `IN-${String(i + 1).padStart(5, "0")}`,
  summary: faker.hacker.phrase(),
  description: faker.lorem.paragraph(),
  status: faker.helpers.arrayElement(["OP", "IP", "RS", "CL"]),
  priority: faker.helpers.arrayElement([1, 2, 3, 4, 5]),
  severity: faker.helpers.arrayElement([1, 2, 3, 4, 5]),
  impact: faker.helpers.arrayElement([1, 2, 3, 4]),
  urgency: faker.helpers.arrayElement([1, 2, 3, 4]),
  open_date: faker.date.recent({ days: 30 }).getTime() / 1000,
  close_date: 0,
  customer: faker.helpers.arrayElement(["user-1", "user-2", "user-3"]),
  assignee: faker.helpers.arrayElement(["user-1", "user-2"]),
  affected_resource: faker.helpers.arrayElement(["ci:srv-01", "ci:srv-02"]),
  problem: i % 5 === 0 ? `pr:200${Math.floor(i / 5)}` : "",
  tenant: i % 3 === 0 ? "globex" : "acme-corp",
}));
```

`faker.seed(42)` zabezpečí, že fixtures sú deterministické naprieč CI behmi —
critical pre stabilné E2E.

## Utils

### `parseTenantFromRequest(request)` — `utils/tenant.ts`

04 r2 ADR-11 finalizoval **`X-Tenant`** ako tenant context header. BFF má
session ako autoritu — header je defenzívny audit-friendly hint. Mock akceptuje
header alebo session-cookie fallback:

```ts
export function parseTenantFromRequest(req: Request): string {
  // Stratégia 1 — X-Tenant header (per 04 ADR-11, primárna v BFF + FE komunikácii).
  const header = req.headers.get("X-Tenant");
  if (header) return header;
  // Stratégia 2 — session cookie (BFF-side autorita; FE nečíta).
  const cookie = req.headers.get("Cookie")?.match(/sdm-active-tenant=([^;]+)/);
  if (cookie?.[1]) return cookie[1];
  // Default tenant — typicky z user.defaultTenantId.
  return "acme-corp";
}
```

CA SDM upstream mocky (`handlers/upstream/*`) **nečítajú** `X-Tenant` priamo —
namiesto toho dostávajú `X-Role` od BFF (zhodne s `components/bff.md` § 2.3
REST proxy: BFF inject `X-Role` zo session). Mock to môže simulovať tak, že
v upstream variant `parseTenantFromRequest` číta `X-Role` a mapuje role → tenant
(via fixture user role table).

### `toCaSdmPaginatedResponse(records, start, count, key)` — `utils/pagination.ts`

```ts
export function toCaSdmPaginatedResponse<T>(records: T[], start: number, count: number, key: string) {
  return {
    [`${key}_collection`]: {
      "@COUNT": Math.min(count, records.length - start),
      "@START": start,
      "@TOTAL_COUNT": records.length,
      [key]: records.slice(start, start + count),
    },
  };
}
```

Shape kopíruje CA SDM REST pagination convention (`@COUNT`, `@START`, `@TOTAL_COUNT`)
známu z PDF (sekcia REST API 2906+).

## Node MSW pre testy

`packages/api-mocks/src/node.ts`:

```ts
import { setupServer } from "msw/node";
import { handlers } from "./handlers";

export const server = setupServer(...handlers);
```

Použitie v Vitest setup (`vitest.setup.ts`):

```ts
import { beforeAll, afterEach, afterAll } from "vitest";
import { server } from "@sdm/api-mocks/node";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

## Per-test handler override

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

## Fixture rozsah — pre MVP scope

| Modul | Počet záznamov | Distribúcia |
|---|---|---|
| Tenants | 2 | acme-corp (primárny), globex |
| Users | 6 | 3 per tenant |
| Incidents | 40 | per status: OP=15, IP=10, RS=8, CL=7 |
| Service Requests | 25 | OP=12, IP=8, CL=5 |
| Service Offerings | 8 | 5 katalógových formulárov |
| Problems | 10 | s linkmi na incidenty |
| Changes | 15 | per status |
| Knowledge docs | 30 | s kategóriami |
| CIs | 50 | servery + sieťové prvky |
| CI relations | 60 | depends_on, contains, uses |
| Audit events | 50 | per 05 audit-taxonomy; rozloženie 7 dní |

Celkovo **~300 rekordov** — dostatočné na demo všetkých UX flowov z GOAL §3,
malé dosť aby boli loadnuté inštantne, deterministické thanks to
`faker.seed(42)` (general) + `faker.seed(43)` (audit-events — žiadne kolízie ID).

## Migrácia na živé CA SDM

Keď bude staging k dispozícii:

1. `VITE_USE_MOCKS=false` v `.env.local`.
2. Vite proxy preroute `/caisd-rest/*` na staging URL.
3. MSW handlery zostávajú aktívne v Vitest (Node) a Playwright integračné testy
   — tam **vždy** preferujeme mocks, nikdy nebijeme na živý server v CI.
4. Smoke E2E proti staging beží **manuálne / nightly** s `STAGING_URL` env.

Mock backend nie je vyhadzovaný — zostáva **druhým runtimeom**.

## Otvorené závislosti

- `[04-architecture]` Multi-tenancy header — `[resolved-in-round-2]`. 04 ADR-11 finalizoval **`X-Tenant`**. `parseTenantFromRequest` aktualizovaný v § Utils.
- `[04-architecture]` BFF rozhodnutie — `[resolved-in-round-2]`. 04 ADR-01 accepted. Mocky majú teraz dve vrstvy (`bff/*` a `upstream/*`).
- `[05-security]` Auth flow — `[resolved-in-round-2]`. Mode `sso-oidc` v prod, `rest-access-key` permissive mock v dev. BFF handler `auth.ts` skladá OIDC redirect → cookie session shape.
- `[09-qa-test-strategy]` Handler module count — `[resolved-in-round-2]`. **10 modulov** zarovnaných s 09 r1 `mock-strategy.md` § 3.1–3.10 (auth, users, tenants, incidents, requests, problems, changes, knowledge, cmdb, audit). `reference` ostáva ako upstream-only sub-handler (nie samostatný BFF endpoint, lebo BFF cachuje reference data interne).
- `[01-api-analyst]` Schémy v `docs/agents/api-analyst/schemas/` sú **autoritatívne** pre TS typy fixture záznamov a handlerov — pretrváva. Round 1 phase A produkuje tieto schémy; v post-conv overíme, či každý handler matchuje schému. Ak schémy odhalia ďalšie endpointy (napr. attachments, comments), pridajú sa ďalšie handler bloky.
- `[09-qa-test-strategy]` `onUnhandledRequest: "error"` v Vitest setup je strict default — 09 r1 `mock-strategy.md` § 8 potvrdil "strict" smer. Zachovaná default.
- `[?]` SOAP fallback endpointy (Web Services) z GOAL §2 — pretrváva. Momentálne **mimo MVP** (predpokladáme, že REST pokrýva). Ak 01-api-analyst nájde dieru, pridáme SOAP mock cez `wiremock` (osobitný service) alebo `nock` v Node.
