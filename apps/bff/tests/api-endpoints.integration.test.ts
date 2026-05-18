import { Hono } from "hono";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import pino from "pino";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { contactId, roleId, tenantId, userId } from "@sdm/domain";
import { SdmHttpClient } from "../src/api/http-client";
import { createApiRoutesState, registerApiRoutes } from "../src/api/routes";
import { correlationMiddleware } from "../src/auth/correlation";
import { AppErrorException, toAppErrorBody } from "../src/auth/errors";
import type { RuntimeConfig } from "../src/config/schema";
import { createSessionStore } from "../src/session";
import type { SessionPayload } from "../src/session/types";

const BASE = "http://test-sdm.local/caisd-rest";

function makeConfig(): RuntimeConfig {
  return {
    nodeEnv: "test",
    bff: { port: 5174, trustedOrigins: ["http://localhost:5500"], logLevel: "fatal" },
    casdm: { baseUrl: BASE, basicAuthUser: "u", basicAuthPass: "p", requestTimeoutMs: 2000 },
    session: {
      driver: "memory",
      cookieName: "sdm.sid",
      cookieSecure: false,
      sameSite: "Lax",
      idleSec: 1800,
      absoluteSec: 28800,
      cookieMaxAgeSec: 28800,
    },
    uiRoleMapping: {},
  };
}

async function buildApi(): Promise<{ app: Hono; sid: string }> {
  const config = makeConfig();
  const log = pino({ level: "silent" });
  const sessionStore = createSessionStore({ driver: "memory" });
  const client = new SdmHttpClient(
    { baseUrl: BASE, requestTimeoutMs: 2000, maxRetries: 0 },
    { fetch: globalThis.fetch, log },
  );
  const sid = "integ-sid";
  const now = Date.now();
  const payload: SessionPayload = {
    sid,
    userId: userId("vueuser"),
    contactId: contactId("U'BDE'"),
    displayName: "User, Vue",
    email: "vueuser@example",
    activeTenantId: tenantId("default"),
    tenants: [
      {
        id: tenantId("default"),
        name: "default",
        roles: [{ id: roleId("10002"), sym: "Administrator", uiRole: "agent_l1" }],
      },
    ],
    accessKey: "51299815abc",
    accessKeyId: "402020",
    accessKeyExpiresAt: now + 3600_000,
    createdAt: now,
    lastSeenAt: now,
    absoluteExpiresAt: now + 28800_000,
    cookieVersion: 1,
  };
  await sessionStore.create(sid, payload, 28800);

  const app = new Hono();
  app.use("*", correlationMiddleware());
  registerApiRoutes(app, { client, sessionStore, config, log }, createApiRoutesState());
  app.onError((err, c) => {
    if (err instanceof AppErrorException) {
      return c.json(
        toAppErrorBody({
          code: err.code,
          message: err.message,
          httpStatus: err.httpStatus,
        }),
        err.httpStatus as never,
      );
    }
    return c.json({ error: "internal_error" }, 500);
  });
  return { app, sid };
}

const COOKIE = "Cookie";
const SID_COOKIE = "sdm.sid=integ-sid";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// CA SDM sample shapes derived from real-backend-contracts.md §7 + §12-17.
const INCIDENT_DETAIL = {
  in: {
    "@id": 2800,
    "@REL_ATTR": "cr:2800",
    "@COMMON_NAME": "SD:01",
    ref_num: "SD:01",
    summary: "Summary Service Desk Incident None",
    description: "Template Description Service Desk Incident None llll",
    open_date: "1031839200",
    close_date: "0",
    active: { "@id": 200, "@REL_ATTR": "0", "@COMMON_NAME": "NO" },
    priority: { "@id": 505, "@REL_ATTR": "0", "@COMMON_NAME": "None" },
    status: { "@id": 5201, "@REL_ATTR": "CL", "@COMMON_NAME": "Uzatvorený" },
    customer: { "@id": "U'793ED'", "@COMMON_NAME": "System_AHD_generated" },
  },
};

const INCIDENT_LIST = {
  collection_in: {
    "@COUNT": "1",
    "@START": "1",
    "@TOTAL_COUNT": "1",
    in: INCIDENT_DETAIL.in,
  },
};

const INCIDENT_CREATED = {
  in: { "@id": 407804, "@REL_ATTR": "cr:407804", "@COMMON_NAME": 5721 },
};

describe("/api/incidents — full CRUD + error path", () => {
  it("GET /api/incidents returns paginated, remapped FE shape", async () => {
    server.use(http.get(`${BASE}/in`, () => HttpResponse.json(INCIDENT_LIST)));
    const { app } = await buildApi();
    const res = await app.fetch(
      new Request("http://bff/api/incidents?page=0&size=2", { headers: { [COOKIE]: SID_COOKIE } }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: Array<{ ref: string; status: { code: string } }>;
      page: { total: number };
    };
    expect(body.page.total).toBe(1);
    expect(body.data[0]?.ref).toBe("SD:01");
    expect(body.data[0]?.status?.code).toBe("CL");
  });

  it("GET /api/incidents/:id returns single record with FK fields collapsed", async () => {
    server.use(http.get(`${BASE}/in/2800`, () => HttpResponse.json(INCIDENT_DETAIL)));
    const { app } = await buildApi();
    const res = await app.fetch(
      new Request("http://bff/api/incidents/2800", { headers: { [COOKIE]: SID_COOKIE } }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      id: string;
      ref: string;
      summary: string;
      openedAt: string | null;
      status: { code: string; label: string } | null;
    };
    expect(body.id).toBe("2800");
    expect(body.ref).toBe("SD:01");
    expect(body.status?.label).toBe("Uzatvorený");
    expect(body.openedAt).toBe(new Date(1031839200 * 1000).toISOString());
  });

  it("POST /api/incidents encodes customer FK as REL_ATTR (§12.1)", async () => {
    let seenBody = "";
    let seenContentType: string | null = null;
    server.use(
      http.post(`${BASE}/in`, async ({ request }) => {
        seenBody = await request.text();
        seenContentType = request.headers.get("content-type");
        return new HttpResponse(JSON.stringify(INCIDENT_CREATED), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        });
      }),
    );
    const { app } = await buildApi();
    const res = await app.fetch(
      new Request("http://bff/api/incidents", {
        method: "POST",
        headers: { [COOKIE]: SID_COOKIE, "Content-Type": "application/json" },
        body: JSON.stringify({
          summary: "F.2 probe",
          customerId: "U'BDE1683C44FCCB4DAE50BA4DDB5DCBE6'",
        }),
      }),
    );
    expect(res.status).toBe(201);
    expect(seenContentType).toBe("application/xml");
    expect(seenBody).toContain("<summary>F.2 probe</summary>");
    expect(seenBody).toContain(`<customer REL_ATTR="U'BDE1683C44FCCB4DAE50BA4DDB5DCBE6'"/>`);
  });

  it("PUT /api/incidents/:id sends partial XML body", async () => {
    let seenBody = "";
    server.use(
      http.put(`${BASE}/in/2800`, async ({ request }) => {
        seenBody = await request.text();
        return HttpResponse.json({ in: { "@id": 2800 } });
      }),
    );
    const { app } = await buildApi();
    const res = await app.fetch(
      new Request("http://bff/api/incidents/2800", {
        method: "PUT",
        headers: { [COOKIE]: SID_COOKIE, "Content-Type": "application/json" },
        body: JSON.stringify({ summary: "updated" }),
      }),
    );
    expect(res.status).toBe(200);
    expect(seenBody).toBe("<in><summary>updated</summary></in>");
  });

  it("DELETE /api/incidents/:id maps to PUT status=CL (soft-close §21 item 5)", async () => {
    let seenMethod = "";
    let seenBody = "";
    server.use(
      http.put(`${BASE}/in/2800`, async ({ request }) => {
        seenMethod = "PUT";
        seenBody = await request.text();
        return HttpResponse.json({ in: { "@id": 2800 } });
      }),
    );
    const { app } = await buildApi();
    const res = await app.fetch(
      new Request("http://bff/api/incidents/2800", {
        method: "DELETE",
        headers: { [COOKIE]: SID_COOKIE },
      }),
    );
    expect(res.status).toBe(200);
    expect(seenMethod).toBe("PUT");
    expect(seenBody).toContain(`<status REL_ATTR="CL"/>`);
  });

  it("PUT /api/incidents/:id surfaces upstream 409 (unknown id) as NOT_FOUND (§20)", async () => {
    server.use(
      http.put(
        `${BASE}/in/99999`,
        () =>
          new HttpResponse(
            JSON.stringify({
              status: "409",
              message: "Invalid number of rows (0) affected by the operation. Expecting (1).",
            }),
            { status: 409, headers: { "Content-Type": "application/json" } },
          ),
      ),
    );
    const { app } = await buildApi();
    const res = await app.fetch(
      new Request("http://bff/api/incidents/99999", {
        method: "PUT",
        headers: { [COOKIE]: SID_COOKIE, "Content-Type": "application/json" },
        body: JSON.stringify({ summary: "x" }),
      }),
    );
    expect(res.status).toBe(404);
    expect(((await res.json()) as { error: string }).error).toBe("NOT_FOUND");
  });
});

describe("/api/requests — type=R injected on POST (§13.1)", () => {
  it('forces <type REL_ATTR="R"/> on creation', async () => {
    let seenBody = "";
    server.use(
      http.post(`${BASE}/cr`, async ({ request }) => {
        seenBody = await request.text();
        return new HttpResponse(JSON.stringify({ cr: { "@id": 407805 } }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        });
      }),
    );
    const { app } = await buildApi();
    await app.fetch(
      new Request("http://bff/api/requests", {
        method: "POST",
        headers: { [COOKIE]: SID_COOKIE, "Content-Type": "application/json" },
        body: JSON.stringify({ summary: "x", customerId: "U'BDE'" }),
      }),
    );
    expect(seenBody).toContain(`<type REL_ATTR="R"/>`);
  });

  it("returns FE shape with `type` FK collapsed on detail", async () => {
    server.use(
      http.get(`${BASE}/cr/2851`, () =>
        HttpResponse.json({
          cr: {
            "@id": 2851,
            "@COMMON_NAME": "SA:01",
            ref_num: "SA:01",
            summary: "x",
            type: { "@id": 182, "@REL_ATTR": "I", "@COMMON_NAME": "Incident" },
          },
        }),
      ),
    );
    const { app } = await buildApi();
    const res = await app.fetch(
      new Request("http://bff/api/requests/2851", { headers: { [COOKIE]: SID_COOKIE } }),
    );
    const body = (await res.json()) as { type: { code: string } };
    expect(body.type?.code).toBe("I");
  });
});

describe("/api/problems — basic list + detail", () => {
  it("collapses pr.priority numeric @COMMON_NAME safely (§18 — numeric labels)", async () => {
    server.use(
      http.get(`${BASE}/pr/406621`, () =>
        HttpResponse.json({
          pr: {
            "@id": 406621,
            "@COMMON_NAME": 5254,
            ref_num: 5254,
            priority: { "@id": 502, "@REL_ATTR": 3, "@COMMON_NAME": 3 },
            status: { "@id": 5200, "@REL_ATTR": "OP", "@COMMON_NAME": "Vytvorený" },
          },
        }),
      ),
    );
    const { app } = await buildApi();
    const res = await app.fetch(
      new Request("http://bff/api/problems/406621", { headers: { [COOKIE]: SID_COOKIE } }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ref: string;
      priority: { code: string; label: string };
    };
    expect(body.ref).toBe("5254");
    expect(body.priority?.code).toBe("3");
    expect(body.priority?.label).toBe("3");
  });

  it("GET /api/problems list passes pagination start=1", async () => {
    let seenStart: string | null = null;
    server.use(
      http.get(`${BASE}/pr`, ({ request }) => {
        seenStart = new URL(request.url).searchParams.get("start");
        return HttpResponse.json({
          collection_pr: { "@COUNT": "0", "@TOTAL_COUNT": "0", "@START": "1" },
        });
      }),
    );
    const { app } = await buildApi();
    await app.fetch(new Request("http://bff/api/problems", { headers: { [COOKIE]: SID_COOKIE } }));
    expect(seenStart).toBe("1");
  });
});

describe("/api/changes — schema divergence (§15)", () => {
  it("reads chg_ref_num and requestor (not ref_num / customer)", async () => {
    server.use(
      http.get(`${BASE}/chg/2781`, () =>
        HttpResponse.json({
          chg: {
            "@id": 2781,
            chg_ref_num: "USD:11",
            summary: "ITIL Summary Priority Low",
            requestor: { "@id": "U'FCF'", "@COMMON_NAME": "System_MA_User" },
            status: { "@id": 6001, "@REL_ATTR": "CL", "@COMMON_NAME": "Closed" },
            open_date: "1031839200",
          },
        }),
      ),
    );
    const { app } = await buildApi();
    const res = await app.fetch(
      new Request("http://bff/api/changes/2781", { headers: { [COOKIE]: SID_COOKIE } }),
    );
    const body = (await res.json()) as {
      ref: string;
      customer: { id: string; label: string } | null;
    };
    expect(body.ref).toBe("USD:11");
    expect(body.customer?.label).toBe("System_MA_User");
  });

  it("POST /api/changes emits <requestor REL_ATTR=…/> (not <customer/>)", async () => {
    let seenBody = "";
    server.use(
      http.post(`${BASE}/chg`, async ({ request }) => {
        seenBody = await request.text();
        return new HttpResponse(JSON.stringify({ chg: { "@id": 400851 } }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        });
      }),
    );
    const { app } = await buildApi();
    await app.fetch(
      new Request("http://bff/api/changes", {
        method: "POST",
        headers: { [COOKIE]: SID_COOKIE, "Content-Type": "application/json" },
        body: JSON.stringify({ summary: "x", customerId: "U'BDE'" }),
      }),
    );
    expect(seenBody).toContain(`<requestor REL_ATTR="U'BDE'"/>`);
    expect(seenBody).not.toContain(`<customer`);
  });
});

describe("/api/kb — uppercase KD factory + UPPERCASE attrs (§16)", () => {
  it("GET /api/kb/:id routes to /KD/:id (case-sensitive)", async () => {
    server.use(
      http.get(`${BASE}/KD/400101`, () =>
        HttpResponse.json({
          KD: {
            "@id": 400101,
            "@COMMON_NAME": "Testovaci dokument",
            TITLE: "Testovaci dokument",
            SUMMARY: "bla bla",
            RESOLUTION: "riesenie",
            CREATION_DATE: "1619009439",
          },
        }),
      ),
    );
    const { app } = await buildApi();
    const res = await app.fetch(
      new Request("http://bff/api/kb/400101", { headers: { [COOKIE]: SID_COOKIE } }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { title: string; createdAt: string | null };
    expect(body.title).toBe("Testovaci dokument");
    expect(body.createdAt).toBe(new Date(1619009439 * 1000).toISOString());
  });

  it("POST /api/kb emits UPPERCASE element names", async () => {
    let seenBody = "";
    server.use(
      http.post(`${BASE}/KD`, async ({ request }) => {
        seenBody = await request.text();
        return new HttpResponse(JSON.stringify({ KD: { "@id": 401701 } }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        });
      }),
    );
    const { app } = await buildApi();
    await app.fetch(
      new Request("http://bff/api/kb", {
        method: "POST",
        headers: { [COOKIE]: SID_COOKIE, "Content-Type": "application/json" },
        body: JSON.stringify({ title: "F.2 KD probe", summary: "probe" }),
      }),
    );
    expect(seenBody).toContain("<TITLE>F.2 KD probe</TITLE>");
    expect(seenBody).toContain("<SUMMARY>probe</SUMMARY>");
  });

  it("DELETE /api/kb/:id is NOT registered (KB has no soft-delete path)", async () => {
    const { app } = await buildApi();
    const res = await app.fetch(
      new Request("http://bff/api/kb/400101", {
        method: "DELETE",
        headers: { [COOKIE]: SID_COOKIE },
      }),
    );
    expect(res.status).toBe(404);
  });
});

describe("/api/cmdb — GUID PK + delete_flag soft-delete (§17)", () => {
  it("passes the GUID PK through unmangled (Node URL normalizes %27 back to ' on the way out)", async () => {
    let seenUrl = "";
    server.use(
      http.get(`${BASE}/nr/:id`, ({ request }) => {
        seenUrl = request.url;
        return HttpResponse.json({
          nr: { "@id": "U'4BC'", name: "probe", description: 8080 },
        });
      }),
    );
    const { app } = await buildApi();
    const res = await app.fetch(
      new Request("http://bff/api/cmdb/U'4BC'", { headers: { [COOKIE]: SID_COOKIE } }),
    );
    expect(res.status).toBe(200);
    // Whether the wire-level form is %27-encoded depends on the runtime URL
    // normaliser; what matters is the GUID arrived at the upstream intact.
    expect(seenUrl).toContain("U'4BC'");
  });

  it("DELETE /api/cmdb/:id maps to PUT delete_flag=1 (§21 item 5)", async () => {
    let seenBody = "";
    server.use(
      http.put(`${BASE}/nr/:id`, async ({ request }) => {
        seenBody = await request.text();
        return HttpResponse.json({ nr: { "@id": "U'4BC'" } });
      }),
    );
    const { app } = await buildApi();
    const res = await app.fetch(
      new Request("http://bff/api/cmdb/U'4BC'", {
        method: "DELETE",
        headers: { [COOKIE]: SID_COOKIE },
      }),
    );
    expect(res.status).toBe(200);
    expect(seenBody).toContain(`<delete_flag REL_ATTR="1"/>`);
  });

  it("POST /api/cmdb requires classId — proxied as <class REL_ATTR=…/>", async () => {
    let seenBody = "";
    server.use(
      http.post(`${BASE}/nr`, async ({ request }) => {
        seenBody = await request.text();
        return new HttpResponse(JSON.stringify({ nr: { "@id": "U'NEW'" } }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        });
      }),
    );
    const { app } = await buildApi();
    await app.fetch(
      new Request("http://bff/api/cmdb", {
        method: "POST",
        headers: { [COOKIE]: SID_COOKIE, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "probe", classId: "300173" }),
      }),
    );
    expect(seenBody).toContain(`<class REL_ATTR="300173"/>`);
  });
});

describe("/api/reference — cache TTL", () => {
  it("hits the upstream once then serves from cache on subsequent calls", async () => {
    let hits = 0;
    server.use(
      http.get(`${BASE}/pri`, () => {
        hits += 1;
        return HttpResponse.json({
          collection_pri: {
            "@TOTAL_COUNT": "2",
            "@START": "1",
            pri: [
              { "@id": "500", "@REL_ATTR": "1", "@COMMON_NAME": "1" },
              { "@id": "501", "@REL_ATTR": "2", "@COMMON_NAME": "2" },
            ],
          },
        });
      }),
    );
    const { app } = await buildApi();

    const res1 = await app.fetch(
      new Request("http://bff/api/reference/priorities", { headers: { [COOKIE]: SID_COOKIE } }),
    );
    const body1 = (await res1.json()) as { data: unknown[]; cached: boolean };
    expect(body1.cached).toBe(false);
    expect(body1.data).toHaveLength(2);

    const res2 = await app.fetch(
      new Request("http://bff/api/reference/priorities", { headers: { [COOKIE]: SID_COOKIE } }),
    );
    const body2 = (await res2.json()) as { cached: boolean };
    expect(body2.cached).toBe(true);
    expect(hits).toBe(1);
  });

  it("does NOT inject tenant scoping on reference reads (single-tenant on default + ref tables have no tenant column)", async () => {
    let seenWc: string | null = "<not-called>";
    server.use(
      http.get(`${BASE}/crs`, ({ request }) => {
        seenWc = new URL(request.url).searchParams.get("WC");
        return HttpResponse.json({
          collection_crs: { "@TOTAL_COUNT": "0", "@START": "1" },
        });
      }),
    );
    const { app } = await buildApi();
    await app.fetch(
      new Request("http://bff/api/reference/statuses", { headers: { [COOKIE]: SID_COOKIE } }),
    );
    expect(seenWc).toBeNull();
  });

  it("POST /_invalidate clears the cache", async () => {
    let hits = 0;
    server.use(
      http.get(`${BASE}/pri`, () => {
        hits += 1;
        return HttpResponse.json({
          collection_pri: {
            "@TOTAL_COUNT": "0",
            "@START": "1",
          },
        });
      }),
    );
    const { app } = await buildApi();
    await app.fetch(
      new Request("http://bff/api/reference/priorities", { headers: { [COOKIE]: SID_COOKIE } }),
    );
    await app.fetch(
      new Request("http://bff/api/reference/_invalidate", {
        method: "POST",
        headers: { [COOKIE]: SID_COOKIE },
      }),
    );
    await app.fetch(
      new Request("http://bff/api/reference/priorities", { headers: { [COOKIE]: SID_COOKIE } }),
    );
    expect(hits).toBe(2);
  });
});
