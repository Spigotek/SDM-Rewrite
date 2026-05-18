import { Hono } from "hono";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import pino from "pino";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { contactId, roleId, tenantId, userId } from "@sdm/domain";
import { AppErrorException } from "../src/auth/errors";
import { correlationMiddleware } from "../src/auth/correlation";
import { SdmHttpClient } from "../src/api/http-client";
import { paginationToCaSdm, proxyToSdm, readCollection } from "../src/api/rest-proxy";
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

async function buildAppWithSession(opts: { activeTenantId: string }): Promise<{
  app: Hono;
  sid: string;
}> {
  const config = makeConfig();
  const log = pino({ level: "silent" });
  const sessionStore = createSessionStore({ driver: "memory" });
  const client = new SdmHttpClient(
    { baseUrl: BASE, requestTimeoutMs: 2000, maxRetries: 0 },
    { fetch: globalThis.fetch, log },
  );

  const sid = "test-sid-1";
  const now = Date.now();
  const payload: SessionPayload = {
    sid,
    userId: userId("vueuser"),
    contactId: contactId("U'BDE'"),
    displayName: "User, Vue",
    email: "vueuser@example",
    activeTenantId: tenantId(opts.activeTenantId),
    tenants: [
      {
        id: tenantId(opts.activeTenantId),
        name: opts.activeTenantId,
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
  app.get("/api/probe", async (c) => {
    const result = await proxyToSdm(
      c,
      { client, sessionStore, config, log },
      {
        method: "GET",
        caSdmPath: "/in?size=2",
        xObjAttrs: "ref_num,summary,status",
        op: "GET /api/probe",
      },
    );
    return c.json({ status: result.status, body: result.body });
  });
  app.post("/api/probe", async (c) => {
    const json = await c.req.json();
    const result = await proxyToSdm(
      c,
      { client, sessionStore, config, log },
      {
        method: "POST",
        caSdmPath: "/in",
        body: JSON.stringify(json),
        contentType: "application/json",
        op: "POST /api/probe",
      },
    );
    return c.json(result.body, result.status as 200 | 201);
  });
  app.onError((err, c) => {
    if (err instanceof AppErrorException) {
      return c.json({ error: err.code, message: err.message }, err.httpStatus as never);
    }
    return c.json({ error: "internal_error" }, 500);
  });
  return { app, sid };
}

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("proxyToSdm — header injection matrix", () => {
  it("sends X-AccessKey + Accept + X-Obj-Attrs + X-Correlation-ID on GET, no Content-Type", async () => {
    let seenHeaders: Headers | null = null;
    server.use(
      http.get(`${BASE}/in`, ({ request }) => {
        seenHeaders = request.headers;
        return HttpResponse.json({ collection_in: { "@COUNT": 0, "@TOTAL_COUNT": 0 } });
      }),
    );
    const { app, sid } = await buildAppWithSession({ activeTenantId: "default" });
    const res = await app.fetch(
      new Request("http://bff/api/probe", { headers: { Cookie: `sdm.sid=${sid}` } }),
    );
    expect(res.status).toBe(200);
    expect(seenHeaders).not.toBeNull();
    const h = seenHeaders as unknown as Headers;
    expect(h.get("x-accesskey")).toBe("51299815abc");
    expect(h.get("accept")).toBe("application/json");
    expect(h.get("x-obj-attrs")).toBe("ref_num,summary,status");
    expect(h.get("x-correlation-id")).toMatch(/^[0-9a-f-]{8,}/);
    expect(h.get("content-type")).toBeNull();
  });

  it("sends Content-Type only when a body is present", async () => {
    let seenCt: string | null = null;
    server.use(
      http.post(`${BASE}/in`, ({ request }) => {
        seenCt = request.headers.get("content-type");
        return new HttpResponse(JSON.stringify({ in: { "@id": 1 } }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        });
      }),
    );
    const { app, sid } = await buildAppWithSession({ activeTenantId: "default" });
    const res = await app.fetch(
      new Request("http://bff/api/probe", {
        method: "POST",
        headers: { Cookie: `sdm.sid=${sid}`, "Content-Type": "application/json" },
        body: JSON.stringify({ summary: "x" }),
      }),
    );
    expect(res.status).toBe(201);
    expect(seenCt).toBe("application/json");
  });

  it("returns 401 (AUTH_EXPIRED) when the session cookie is missing", async () => {
    const { app } = await buildAppWithSession({ activeTenantId: "default" });
    const res = await app.fetch(new Request("http://bff/api/probe"));
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("AUTH_EXPIRED");
  });

  it("propagates upstream 400 'Invalid REST Access Key' as AUTH_EXPIRED (sic — §8)", async () => {
    server.use(
      http.get(
        `${BASE}/in`,
        () =>
          new HttpResponse(
            JSON.stringify({
              status: "400",
              message: "Invalid REST Access Key (FAKE) provided via X-AccessKey header.",
            }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          ),
      ),
    );
    const { app, sid } = await buildAppWithSession({ activeTenantId: "default" });
    const res = await app.fetch(
      new Request("http://bff/api/probe", { headers: { Cookie: `sdm.sid=${sid}` } }),
    );
    expect(res.status).toBe(401);
    expect((await res.json()) as { error: string }).toEqual(
      expect.objectContaining({ error: "AUTH_EXPIRED" }),
    );
  });
});

describe("proxyToSdm — tenant scoping at the path layer", () => {
  it("does NOT inject tenant WC on the 'default' placeholder (single-tenant)", async () => {
    let seenWc: string | null = "<not-called>";
    server.use(
      http.get(`${BASE}/in`, ({ request }) => {
        seenWc = new URL(request.url).searchParams.get("WC");
        return HttpResponse.json({ collection_in: { "@COUNT": 0, "@TOTAL_COUNT": 0 } });
      }),
    );
    const { app, sid } = await buildAppWithSession({ activeTenantId: "default" });
    await app.fetch(new Request("http://bff/api/probe", { headers: { Cookie: `sdm.sid=${sid}` } }));
    expect(seenWc).toBeNull();
  });

  it("injects tenant WC on a real (non-default) tenantId", async () => {
    let seenWc: string | null = null;
    server.use(
      http.get(`${BASE}/in`, ({ request }) => {
        seenWc = new URL(request.url).searchParams.get("WC");
        return HttpResponse.json({ collection_in: { "@COUNT": 0, "@TOTAL_COUNT": 0 } });
      }),
    );
    const { app, sid } = await buildAppWithSession({ activeTenantId: "U'ABC'" });
    await app.fetch(new Request("http://bff/api/probe", { headers: { Cookie: `sdm.sid=${sid}` } }));
    expect(seenWc).toBe("tenant=U'ABC'");
  });
});

describe("paginationToCaSdm", () => {
  it("defaults to start=1, size=25", () => {
    expect(paginationToCaSdm(new URLSearchParams())).toEqual({ start: 1, size: 25 });
  });
  it("translates page=0 size=10 → start=1 size=10", () => {
    expect(paginationToCaSdm(new URLSearchParams("page=0&size=10"))).toEqual({
      start: 1,
      size: 10,
    });
  });
  it("translates page=3 size=5 → start=16 size=5 (0-based FE pages)", () => {
    expect(paginationToCaSdm(new URLSearchParams("page=3&size=5"))).toEqual({
      start: 16,
      size: 5,
    });
  });
  it("clamps size to [1, 100]", () => {
    expect(paginationToCaSdm(new URLSearchParams("size=500")).size).toBe(100);
    expect(paginationToCaSdm(new URLSearchParams("size=-1")).size).toBe(1);
  });
  it("clamps negative page to 0", () => {
    expect(paginationToCaSdm(new URLSearchParams("page=-7")).start).toBe(1);
  });
});

describe("readCollection", () => {
  it("returns [] for an empty collection (§19.1 — entity key omitted)", () => {
    const parsed = { collection_in: { "@COUNT": "0", "@TOTAL_COUNT": "0", "@START": "0" } };
    expect(readCollection(parsed, "in")).toEqual({ rows: [], total: 0, start: 0 });
  });

  it("returns a single-element array even when upstream collapses to an object (§4)", () => {
    const parsed = {
      collection_in: { "@TOTAL_COUNT": "1", "@START": "1", in: { "@id": 1, ref_num: "SD:01" } },
    };
    const out = readCollection(parsed, "in");
    expect(out.rows).toHaveLength(1);
    expect(out.total).toBe(1);
  });

  it("returns the array as-is when upstream returns multiple entries", () => {
    const parsed = {
      collection_in: {
        "@TOTAL_COUNT": "2",
        "@START": "1",
        in: [{ "@id": 1 }, { "@id": 2 }],
      },
    };
    expect(readCollection(parsed, "in").rows).toHaveLength(2);
  });
});
