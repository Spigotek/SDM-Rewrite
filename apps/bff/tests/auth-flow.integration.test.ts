import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import pino from "pino";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/index";
import { SdmBroker } from "../src/auth/sdm-broker";
import type { RuntimeConfig } from "../src/config/schema";
import { MemorySessionStore } from "../src/session/memory-store";

const SDM_BASE = "http://test-sdm.local/caisd-rest";
const ORIGIN = "http://portal.test.local";

const BOOTSTRAP_OK = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<rest_access id="402020" REL_ATTR="402020" COMMON_NAME="51299815abc">
  <link href="${SDM_BASE}/rest_access/402020" rel="self"/>
  <access_key>51299815abc</access_key>
  <expiration_date>1779696034</expiration_date>
</rest_access>`;

const BOOTSTRAP_401 = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<error><message>The user name or password you entered is not correct. Please try again.</message><status>401</status></error>`;

const CNT_VUEUSER = JSON.stringify({
  collection_cnt: {
    "@COUNT": 1,
    cnt: {
      "@id": "U'BDE1683C44FCCB4DAE50BA4DDB5DCBE6'",
      "@COMMON_NAME": "User, Vue ",
      access_type: { "@id": "10002", "@COMMON_NAME": "Administration" },
      email_address: "uservue@camp.com",
      first_name: "Vue",
      last_name: "User",
      userid: "vueuser",
    },
  },
});

const CNT_ROLE_EMPTY = JSON.stringify({
  collection_cnt_role: { "@COUNT": 0 },
});

function buildTestConfig(): RuntimeConfig {
  return {
    nodeEnv: "test",
    bff: {
      port: 5174,
      trustedOrigins: [ORIGIN],
      logLevel: "fatal",
    },
    casdm: {
      baseUrl: SDM_BASE,
      basicAuthUser: "service",
      basicAuthPass: "service-pass",
      requestTimeoutMs: 2000,
    },
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

function buildTestApp() {
  const config = buildTestConfig();
  const log = pino({ level: "silent" });
  const sessionStore = new MemorySessionStore();
  const broker = new SdmBroker(
    {
      baseUrl: config.casdm.baseUrl,
      basicAuthUser: config.casdm.basicAuthUser,
      basicAuthPass: config.casdm.basicAuthPass,
      requestTimeoutMs: config.casdm.requestTimeoutMs,
      maxRetries: 0,
    },
    { fetch: globalThis.fetch, log, now: () => Date.now() },
  );
  return { app: buildApp({ config, sessionStore, broker, log }), sessionStore };
}

const happyHandlers = [
  http.post(
    `${SDM_BASE}/rest_access`,
    () =>
      new HttpResponse(BOOTSTRAP_OK, {
        status: 201,
        headers: { "Content-Type": "application/xml" },
      }),
  ),
  http.get(`${SDM_BASE}/cnt`, () => HttpResponse.text(CNT_VUEUSER)),
  http.get(`${SDM_BASE}/cnt_role`, () => HttpResponse.text(CNT_ROLE_EMPTY)),
  http.delete(`${SDM_BASE}/rest_access/:id`, () => new HttpResponse(null, { status: 204 })),
];

const server = setupServer(...happyHandlers);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers(...happyHandlers));
afterAll(() => server.close());

function extractCookie(headers: Headers, name: string): string | null {
  const setCookie = headers.get("set-cookie");
  if (!setCookie) return null;
  const m = new RegExp(`(?:^|, )${name}=([^;]+)`).exec(setCookie);
  return m ? (m[1] ?? null) : null;
}

describe("F.1 BFF auth flow — integration", () => {
  it("full happy path: login → /me → switch-tenant → heartbeat → logout", async () => {
    const { app } = buildTestApp();

    // 1) login
    const loginRes = await app.fetch(
      new Request("http://bff/auth/login", {
        method: "POST",
        headers: {
          Origin: ORIGIN,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username: "vueuser", password: "Vue@user123!" }),
      }),
    );
    expect(loginRes.status).toBe(200);
    const loginBody = (await loginRes.json()) as {
      ok: boolean;
      user: { userId: string; email: string };
      uiRoles: string[];
    };
    expect(loginBody.ok).toBe(true);
    expect(loginBody.user.userId).toBe("vueuser");
    expect(loginBody.user.email).toBe("uservue@camp.com");
    // vueuser has empty cnt_role → access_type "Administration" → sp_admin fallback
    expect(loginBody.uiRoles).toEqual(["sp_admin"]);

    const sid = extractCookie(loginRes.headers, "sdm.sid");
    expect(sid).toBeTruthy();
    const cookieHeader = `sdm.sid=${sid}`;

    // 2) /me
    const meRes = await app.fetch(
      new Request("http://bff/me", { headers: { Cookie: cookieHeader } }),
    );
    expect(meRes.status).toBe(200);
    const me = (await meRes.json()) as {
      user: { userId: string; email: string };
      uiRole: string;
      app: string;
      activeTenant: { id: string; effectivePermissions: string[] };
      csrfToken: string;
      session: { idleTimeoutSec: number; absoluteExpiresAt: string };
    };
    expect(me.user.userId).toBe("vueuser");
    expect(me.uiRole).toBe("sp_admin");
    expect(me.app).toBe("workspace");
    expect(me.activeTenant.id).toBe("default");
    // sp_admin has tenant.admin and audit.read in @sdm/domain permissions map
    expect(me.activeTenant.effectivePermissions).toContain("tenant.admin");
    expect(me.activeTenant.effectivePermissions).toContain("audit.read");
    expect(me.csrfToken).toBe("");
    expect(me.session.idleTimeoutSec).toBe(1800);

    // 3) switch-tenant (same tenant, should succeed)
    const switchRes = await app.fetch(
      new Request("http://bff/me/active-tenant", {
        method: "POST",
        headers: {
          Origin: ORIGIN,
          "Content-Type": "application/json",
          Cookie: cookieHeader,
        },
        body: JSON.stringify({ tenantId: "default" }),
      }),
    );
    expect(switchRes.status).toBe(200);

    // 4) heartbeat — 204
    const hbRes = await app.fetch(
      new Request("http://bff/auth/heartbeat", {
        method: "POST",
        headers: { Origin: ORIGIN, Cookie: cookieHeader },
      }),
    );
    expect(hbRes.status).toBe(204);

    // 5) logout
    const outRes = await app.fetch(
      new Request("http://bff/auth/logout", {
        method: "POST",
        headers: { Origin: ORIGIN, Cookie: cookieHeader },
      }),
    );
    expect(outRes.status).toBe(200);

    // /me after logout — 401
    const meAfter = await app.fetch(
      new Request("http://bff/me", { headers: { Cookie: cookieHeader } }),
    );
    expect(meAfter.status).toBe(401);
  });

  it("login with wrong password returns 401 AUTH_INVALID_CREDENTIALS", async () => {
    const { app } = buildTestApp();
    server.use(
      http.post(
        `${SDM_BASE}/rest_access`,
        () =>
          new HttpResponse(BOOTSTRAP_401, {
            status: 401,
            headers: { "Content-Type": "application/xml" },
          }),
      ),
    );

    const res = await app.fetch(
      new Request("http://bff/auth/login", {
        method: "POST",
        headers: { Origin: ORIGIN, "Content-Type": "application/json" },
        body: JSON.stringify({ username: "vueuser", password: "WRONG" }),
      }),
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("AUTH_INVALID_CREDENTIALS");
  });

  it("switch-tenant rejects unknown tenant with TENANT_FORBIDDEN", async () => {
    const { app } = buildTestApp();
    const loginRes = await app.fetch(
      new Request("http://bff/auth/login", {
        method: "POST",
        headers: { Origin: ORIGIN, "Content-Type": "application/json" },
        body: JSON.stringify({ username: "vueuser", password: "pwd" }),
      }),
    );
    const sid = extractCookie(loginRes.headers, "sdm.sid");
    const cookieHeader = `sdm.sid=${sid}`;
    const res = await app.fetch(
      new Request("http://bff/me/active-tenant", {
        method: "POST",
        headers: {
          Origin: ORIGIN,
          "Content-Type": "application/json",
          Cookie: cookieHeader,
        },
        body: JSON.stringify({ tenantId: "ghost-tenant" }),
      }),
    );
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("TENANT_FORBIDDEN");
  });

  it("CSRF middleware rejects POST from untrusted origin", async () => {
    const { app } = buildTestApp();
    const res = await app.fetch(
      new Request("http://bff/auth/login", {
        method: "POST",
        headers: { Origin: "https://evil.example", "Content-Type": "application/json" },
        body: JSON.stringify({ username: "vueuser", password: "pwd" }),
      }),
    );
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string; reason: string };
    expect(body.error).toBe("csrf_rejected");
    expect(body.reason).toBe("untrusted_origin");
  });

  it("/me without cookie returns 401", async () => {
    const { app } = buildTestApp();
    const res = await app.fetch(new Request("http://bff/me"));
    expect(res.status).toBe(401);
  });

  it("logout without cookie still returns 200 (idempotent UX)", async () => {
    const { app } = buildTestApp();
    const res = await app.fetch(
      new Request("http://bff/auth/logout", {
        method: "POST",
        headers: { Origin: ORIGIN },
      }),
    );
    expect(res.status).toBe(200);
  });

  it("X-Correlation-ID is echoed in response headers", async () => {
    const { app } = buildTestApp();
    const res = await app.fetch(
      new Request("http://bff/health", { headers: { "X-Correlation-ID": "my-trace-id" } }),
    );
    expect(res.headers.get("x-correlation-id")).toBe("my-trace-id");
  });

  it("/me marks session expired after absolute timeout elapses (manual mutation)", async () => {
    const { app, sessionStore } = buildTestApp();
    const loginRes = await app.fetch(
      new Request("http://bff/auth/login", {
        method: "POST",
        headers: { Origin: ORIGIN, "Content-Type": "application/json" },
        body: JSON.stringify({ username: "vueuser", password: "pwd" }),
      }),
    );
    const sid = extractCookie(loginRes.headers, "sdm.sid");
    expect(sid).toBeTruthy();
    // backdate absoluteExpiresAt — bypass the readonly via session-store update
    await sessionStore.update(sid as string, {
      // @ts-expect-error — forcing readonly field for the test
      absoluteExpiresAt: Date.now() - 1000,
    });
    const meRes = await app.fetch(
      new Request("http://bff/me", { headers: { Cookie: `sdm.sid=${sid}` } }),
    );
    expect(meRes.status).toBe(401);
  });
});
