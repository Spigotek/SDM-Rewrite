import { Hono } from "hono";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import pino from "pino";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { contactId, roleId, tenantId, userId } from "@sdm/domain";
import { SdmHttpClient } from "../../src/api/http-client";
import { createApiRoutesState, registerApiRoutes } from "../../src/api/routes";
import { correlationMiddleware } from "../../src/auth/correlation";
import { AppErrorException, toAppErrorBody } from "../../src/auth/errors";
import type { RuntimeConfig } from "../../src/config/schema";
import { createAuditEmitter } from "../../src/platform/audit";
import { createSessionStore } from "../../src/session";
import { assertBodyTenantMatchesSession, scopeReadQuery } from "../../src/api/tenant-scoping";
import type { SessionPayload } from "../../src/session/types";

/**
 * I.2 — cross-tenant isolation sweep.
 *
 * `acceptance-criteria.md §4.2` `tenant-*` vectors. Per OWASP A01 the BFF
 * must:
 *
 *   1. Inject `WC=tenant=U'<active>'` into every read query so CA SDM can't
 *      return foreign-tenant rows even if the FE crafts a stale id.
 *   2. Translate "foreign-tenant row not in scope" into 404 (NOT 403) so
 *      a probe can't enumerate the existence of foreign records.
 *   3. Reject mutating bodies that carry a mismatched `tenantId` /
 *      `tenant.id` / `tenant["@REL_ATTR"]` with TENANT_FORBIDDEN (the
 *      shape *is* known-bad — the FE never sends arbitrary tenant ids; a
 *      mismatched value is a tamper attempt).
 *
 * The sweep exercises the multi-tenant code path with a real tenant id
 * (not the `"default"` single-tenant placeholder that no-ops). When CA
 * SDM returns 0 rows under the tenant filter, the BFF surfaces 404 on
 * a detail GET — exactly the "not in scope" → "not found" contract.
 */

const BASE = "http://test-sdm.local/caisd-rest";

const TENANT_A = "U'BDE1683C44FCCB4DAE50BA4DDB5DCBE6'";
const TENANT_B = "U'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'";

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
    // This sweep validates the legacy tenant `WC` read-filter, which is gated
    // behind `tenantWcScoping` (default off — single-tenant CA SDM scopes via
    // X-Role instead). Enable it so the scoping assertions exercise the path.
    tenantWcScoping: true,
  };
}

async function buildApi(activeTenant: string): Promise<{ app: Hono; sid: string }> {
  const config = makeConfig();
  const log = pino({ level: "silent" });
  const sessionStore = createSessionStore({ driver: "memory" });
  const client = new SdmHttpClient(
    { baseUrl: BASE, requestTimeoutMs: 2000, maxRetries: 0 },
    { fetch: globalThis.fetch, log },
  );
  const sid = `tenant-iso-${activeTenant}`;
  const now = Date.now();
  const payload: SessionPayload = {
    sid,
    userId: userId("user-1"),
    contactId: contactId("U'CNT'"),
    displayName: "Anna, Analyst",
    email: "anna@example",
    activeTenantId: tenantId(activeTenant),
    tenants: [
      {
        id: tenantId(activeTenant),
        name: "active",
        roles: [{ id: roleId("10001"), sym: "agent_l1", uiRole: "agent_l1" }],
      },
    ],
    accessKey: "key",
    accessKeyId: "kid",
    accessKeyExpiresAt: now + 3600_000,
    createdAt: now,
    lastSeenAt: now,
    absoluteExpiresAt: now + 28800_000,
    cookieVersion: 1,
  };
  await sessionStore.create(sid, payload, 28800);

  const audit = createAuditEmitter({ log });
  const app = new Hono();
  app.use("*", correlationMiddleware());
  registerApiRoutes(app, { client, sessionStore, config, log, audit }, createApiRoutesState());
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

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/**
 * Helper: simulate a CA SDM upstream where rows live in a specific tenant.
 * If the inbound `WC` filter contains the wrong tenant predicate, return
 * an empty collection — which the BFF surfaces as 0 rows on a list and
 * 404 on a single-record GET (per A01: no enumeration via 403).
 */
function tenantScopedHandler(opts: {
  factory: string;
  ownerTenantPredicate: string; // e.g. `tenant=U'<TENANT_A>'`
  detailRow: object;
}) {
  return [
    http.get(`${BASE}/${opts.factory}`, ({ request }) => {
      const wc = new URL(request.url).searchParams.get("WC") ?? "";
      if (!wc.includes(opts.ownerTenantPredicate)) {
        return HttpResponse.json({
          [`collection_${opts.factory}`]: {
            "@COUNT": "0",
            "@START": "1",
            "@TOTAL_COUNT": "0",
          },
        });
      }
      return HttpResponse.json({
        [`collection_${opts.factory}`]: {
          "@COUNT": "1",
          "@START": "1",
          "@TOTAL_COUNT": "1",
          [opts.factory]: opts.detailRow,
        },
      });
    }),
  ];
}

const ENDPOINTS: ReadonlyArray<{
  name: string;
  factory: string;
  route: string;
  detailRow: object;
}> = [
  {
    name: "incidents",
    factory: "in",
    route: "/api/incidents",
    detailRow: { "@id": 2800, "@REL_ATTR": "cr:2800", summary: "tenant-a-row" },
  },
  {
    name: "requests",
    factory: "cr",
    route: "/api/requests",
    detailRow: { "@id": 2801, "@REL_ATTR": "cr:2801", summary: "tenant-a-row" },
  },
  {
    name: "problems",
    factory: "pr",
    route: "/api/problems",
    detailRow: { "@id": 2802, "@REL_ATTR": "pr:2802", summary: "tenant-a-row" },
  },
  {
    name: "changes",
    factory: "chg",
    route: "/api/changes",
    detailRow: {
      "@id": 2803,
      chg_ref_num: "CHG:001",
      summary: "tenant-a-row",
    },
  },
  {
    name: "cmdb-ci",
    factory: "nr",
    route: "/api/cmdb",
    detailRow: { "@id": 2804, name: "tenant-a-ci" },
  },
  {
    name: "kb",
    factory: "KD",
    route: "/api/kb",
    detailRow: { "@id": 2805, "@COMMON_NAME": "tenant-a-kb", TITLE: "tenant-a-kb" },
  },
];

describe("tenant isolation sweep — list reads filter by active tenant", () => {
  for (const ep of ENDPOINTS) {
    it(`${ep.name}: tenant B session sees 0 rows when records belong to tenant A`, async () => {
      server.use(
        ...tenantScopedHandler({
          factory: ep.factory,
          ownerTenantPredicate: `tenant=${TENANT_A}`,
          detailRow: ep.detailRow,
        }),
      );
      const { app, sid } = await buildApi(TENANT_B);
      const res = await app.fetch(
        new Request(`http://bff${ep.route}?size=10`, {
          headers: { Cookie: `sdm.sid=${sid}` },
        }),
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: unknown[]; page: { total: number } };
      expect(body.page.total).toBe(0);
      expect(body.data).toEqual([]);
    });

    it(`${ep.name}: tenant A session sees the row when records belong to tenant A`, async () => {
      server.use(
        ...tenantScopedHandler({
          factory: ep.factory,
          ownerTenantPredicate: `tenant=${TENANT_A}`,
          detailRow: ep.detailRow,
        }),
      );
      const { app, sid } = await buildApi(TENANT_A);
      const res = await app.fetch(
        new Request(`http://bff${ep.route}?size=10`, {
          headers: { Cookie: `sdm.sid=${sid}` },
        }),
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: unknown[]; page: { total: number } };
      expect(body.page.total).toBe(1);
      expect(body.data.length).toBe(1);
    });
  }
});

describe("tenant isolation sweep — mutating body tamper rejected", () => {
  it("scopeReadQuery injects active tenant into WC for the proxy", () => {
    // Belt-and-braces unit on the helper used by the route handlers — without
    // this the test above would still pass via an empty mock, so this asserts
    // the BFF is actually adding the predicate (not relying on the upstream).
    const out = scopeReadQuery("/in?size=5", { activeTenantId: TENANT_A });
    const url = new URL(`http://x${out}`);
    expect(url.searchParams.get("WC")).toBe(`tenant=${TENANT_A}`);
  });

  it("assertBodyTenantMatchesSession rejects mismatched tenantId with TENANT_FORBIDDEN", () => {
    let err: unknown;
    try {
      assertBodyTenantMatchesSession(
        { tenantId: TENANT_B, summary: "x" },
        { activeTenantId: TENANT_A },
      );
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(AppErrorException);
    expect(err).toMatchObject({ code: "TENANT_FORBIDDEN", httpStatus: 403 });
  });

  it("assertBodyTenantMatchesSession rejects mismatched nested tenant.id", () => {
    let err: unknown;
    try {
      assertBodyTenantMatchesSession({ tenant: { id: TENANT_B } }, { activeTenantId: TENANT_A });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(AppErrorException);
  });

  it("assertBodyTenantMatchesSession rejects mismatched tenant @REL_ATTR (XML projection)", () => {
    expect(() =>
      assertBodyTenantMatchesSession(
        { tenant: { "@REL_ATTR": TENANT_B } },
        { activeTenantId: TENANT_A },
      ),
    ).toThrow(AppErrorException);
  });

  it("scopeReadQuery merges an FE-supplied WC clause with the tenant predicate (AND)", () => {
    const out = scopeReadQuery("/in?WC=status.code%3D%27OP%27&size=5", {
      activeTenantId: TENANT_A,
    });
    const url = new URL(`http://x${out}`);
    expect(url.searchParams.get("WC")).toBe(`status.code='OP' AND tenant=${TENANT_A}`);
  });
});

describe("tenant isolation sweep — 404 NOT 403 on out-of-scope detail GET", () => {
  it("GET /api/incidents/:id from tenant B returns 404 when record belongs to tenant A", async () => {
    // The detail GET path doesn't currently inject WC=tenant=… (single-record
    // path uses the PK directly). Object-level authorization is enforced by
    // the BFF reading the entity tenant and matching the session — this test
    // codifies that an unmatched detail GET surfaces as 404, not 403.
    //
    // In the current implementation the CA SDM upstream returns 404 directly
    // when the record exists but is in a different tenant scope (the upstream
    // filters by the access key's tenant context). We simulate that here.
    server.use(
      http.get(
        `${BASE}/in/2800`,
        () =>
          new HttpResponse(JSON.stringify({ status: "404", message: "Record not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          }),
      ),
    );
    const { app, sid } = await buildApi(TENANT_B);
    const res = await app.fetch(
      new Request("http://bff/api/incidents/2800", {
        headers: { Cookie: `sdm.sid=${sid}` },
      }),
    );
    expect(res.status).toBe(404);
    expect(res.status).not.toBe(403);
  });
});
