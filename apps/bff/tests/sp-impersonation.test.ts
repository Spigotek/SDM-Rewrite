import { Hono } from "hono";
import pino from "pino";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { contactId, roleId, tenantId, userId } from "@sdm/domain";
import { correlationMiddleware } from "../src/auth/correlation";
import { AppErrorException, toAppErrorBody } from "../src/auth/errors";
import {
  _resetViewAsStoreForTests,
  getViewAsTenant,
  registerSpImpersonationRoutes,
} from "../src/auth/sp-impersonation";
import { computeTotp, registerStepUpRoutes } from "../src/auth/step-up";
import { _resetStepUpTokensForTests } from "../src/auth/step-up-token";
import type { RuntimeConfig } from "../src/config/schema";
import { createAuditEmitter } from "../src/platform/audit";
import { createSessionStore } from "../src/session";
import type { SessionPayload } from "../src/session/types";

/**
 * I.5 — SP impersonation endpoints.
 *
 *  1. GET /me/sp-tenants returns sp_admin-scoped tenants only.
 *  2. POST /api/sp/view-as happy path (with step-up token) → 200 + audit
 *     `authz.tenant.switch.success` with `details.op: "sp.view_as.start"`.
 *  3. Non-sp_admin caller → 403 + audit denied + `op: "sp.view_as.start"` +
 *     `reason: "sp_admin_required"`.
 *  4. Missing step-up token → 401 + audit denied + `op: "sp.view_as.denied_step_up"`.
 *  5. View-as expires after the TTL — `getViewAsTenant` returns null past it.
 *  6. DELETE /api/sp/view-as clears the store + emits stop audit.
 *  7. Audit envelope reuses existing `authz.tenant.switch.*` event names
 *     (D6 invariant — no new taxonomy strings).
 */

const TEST_SEED = "JBSWY3DPEHPK3PXP";
const TOTP_STEP_SEC = 30;

function makeConfig(): RuntimeConfig {
  return {
    nodeEnv: "test",
    bff: { port: 5174, trustedOrigins: ["http://localhost:5500"], logLevel: "fatal" },
    casdm: {
      baseUrl: "http://t/caisd-rest",
      basicAuthUser: "u",
      basicAuthPass: "p",
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

interface AuditMock {
  readonly calls: Array<{
    event: string;
    result: string;
    reason?: string;
    details?: Record<string, unknown>;
    tenant?: { sourceTenantId?: string; targetTenantId?: string };
  }>;
}

interface TestApp {
  readonly app: Hono;
  readonly audit: AuditMock;
  readonly spSid: string;
  readonly nonSpSid: string;
  readonly nowMs: number;
  setNow(ms: number): void;
}

async function buildApp(): Promise<TestApp> {
  _resetStepUpTokensForTests();
  _resetViewAsStoreForTests();
  const config = makeConfig();
  const log = pino({ level: "silent" });
  const sessionStore = createSessionStore({ driver: "memory" });

  const spSid = "sp-admin-sid";
  const nonSpSid = "regular-sid";
  const nowMs = Date.now();

  const spPayload: SessionPayload = {
    sid: spSid,
    userId: userId("sp-admin"),
    contactId: contactId("U'SP'"),
    displayName: "Service Provider",
    email: "sp.admin@example",
    activeTenantId: tenantId("acme-corp"),
    tenants: [
      {
        id: tenantId("acme-corp"),
        name: "Acme",
        roles: [{ id: roleId("90001"), sym: "ServiceProviderAdmin", uiRole: "sp_admin" }],
      },
      {
        id: tenantId("globex"),
        name: "Globex",
        roles: [{ id: roleId("90002"), sym: "ServiceProviderAdmin", uiRole: "sp_admin" }],
      },
      {
        id: tenantId("initech"),
        name: "Initech",
        // A tenant the SP user CAN see in /me but has only an analyst role
        // — must be filtered out of /me/sp-tenants and rejected on view-as.
        roles: [{ id: roleId("90003"), sym: "AnalystL1", uiRole: "agent_l1" }],
      },
    ],
    accessKey: "key",
    accessKeyId: "kid",
    accessKeyExpiresAt: nowMs + 3600_000,
    createdAt: nowMs,
    lastSeenAt: nowMs,
    absoluteExpiresAt: nowMs + 28800_000,
    cookieVersion: 1,
  };

  const nonSpPayload: SessionPayload = {
    sid: nonSpSid,
    userId: userId("anna"),
    contactId: contactId("U'ANNA'"),
    displayName: "Anna",
    email: "anna@example",
    activeTenantId: tenantId("acme-corp"),
    tenants: [
      {
        id: tenantId("acme-corp"),
        name: "Acme",
        roles: [{ id: roleId("90004"), sym: "AnalystL1", uiRole: "agent_l1" }],
      },
    ],
    accessKey: "key",
    accessKeyId: "kid",
    accessKeyExpiresAt: nowMs + 3600_000,
    createdAt: nowMs,
    lastSeenAt: nowMs,
    absoluteExpiresAt: nowMs + 28800_000,
    cookieVersion: 1,
  };

  await sessionStore.create(spSid, spPayload, 28800);
  await sessionStore.create(nonSpSid, nonSpPayload, 28800);

  const calls: AuditMock["calls"] = [];
  const realAudit = createAuditEmitter({ log });
  const audit: typeof realAudit = (c, input, session) => {
    calls.push({
      event: input.event,
      result: input.result,
      reason: input.reason,
      details: input.details,
      tenant: input.tenant,
    });
    realAudit(c, input, session);
  };

  let mutableNow = nowMs;
  const app = new Hono();
  app.use("*", correlationMiddleware());
  registerStepUpRoutes(app, { config, sessionStore, log, audit, now: () => mutableNow });
  registerSpImpersonationRoutes(app, {
    config,
    sessionStore,
    log,
    audit,
    now: () => mutableNow,
  });
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
    return c.json({ error: "internal" }, 500);
  });

  return {
    app,
    audit: { calls },
    spSid,
    nonSpSid,
    nowMs,
    setNow(ms: number) {
      mutableNow = ms;
    },
  };
}

function totpForWindow(seed: string, nowMs: number, offset = 0): string {
  const counter = Math.floor(nowMs / 1000 / TOTP_STEP_SEC) + offset;
  return computeTotp(seed, counter);
}

async function mintStepUpFor(ctx: TestApp, sid: string): Promise<string> {
  const totp = totpForWindow(TEST_SEED, ctx.nowMs, 0);
  const res = await ctx.app.fetch(
    new Request("http://bff/auth/step-up", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `sdm.sid=${sid}` },
      body: JSON.stringify({ totp }),
    }),
  );
  const body = (await res.json()) as { stepUpToken: string };
  return body.stepUpToken;
}

async function getSpTenants(app: Hono, sid: string): Promise<Response> {
  return app.fetch(
    new Request("http://bff/me/sp-tenants", { headers: { Cookie: `sdm.sid=${sid}` } }),
  );
}

interface ViewAsHeaderOpts {
  readonly sid: string;
  readonly stepUpToken?: string;
}

async function postViewAs(app: Hono, body: unknown, opts: ViewAsHeaderOpts): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Cookie: `sdm.sid=${opts.sid}`,
  };
  if (opts.stepUpToken) headers["X-Step-Up-Token"] = opts.stepUpToken;
  return app.fetch(
    new Request("http://bff/api/sp/view-as", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }),
  );
}

async function deleteViewAs(app: Hono, sid: string): Promise<Response> {
  return app.fetch(
    new Request("http://bff/api/sp/view-as", {
      method: "DELETE",
      headers: { Cookie: `sdm.sid=${sid}` },
    }),
  );
}

describe("GET /me/sp-tenants", () => {
  let ctx: TestApp;
  beforeEach(async () => {
    ctx = await buildApp();
  });
  afterEach(() => {
    _resetStepUpTokensForTests();
    _resetViewAsStoreForTests();
  });

  it("returns only tenants where the caller holds sp_admin", async () => {
    const res = await getSpTenants(ctx.app, ctx.spSid);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { tenants: Array<{ id: string; name: string }> };
    expect(body.tenants).toHaveLength(2);
    const ids = body.tenants.map((t) => t.id).sort();
    expect(ids).toEqual(["acme-corp", "globex"]);
  });

  it("returns an empty list for a non-sp_admin caller", async () => {
    const res = await getSpTenants(ctx.app, ctx.nonSpSid);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { tenants: unknown[] };
    expect(body.tenants).toEqual([]);
  });

  it("returns 401 when no session cookie is present", async () => {
    const res = await ctx.app.fetch(new Request("http://bff/me/sp-tenants"));
    expect(res.status).toBe(401);
  });
});

describe("POST /api/sp/view-as", () => {
  let ctx: TestApp;
  beforeEach(async () => {
    ctx = await buildApp();
  });
  afterEach(() => {
    _resetStepUpTokensForTests();
    _resetViewAsStoreForTests();
  });

  it("succeeds when caller is sp_admin + step-up token is valid; emits start audit", async () => {
    const token = await mintStepUpFor(ctx, ctx.spSid);
    const res = await postViewAs(
      ctx.app,
      { tenantId: "globex" },
      { sid: ctx.spSid, stepUpToken: token },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { viewingAsTenantId: string; expiresAt: string };
    expect(body.viewingAsTenantId).toBe("globex");
    expect(Date.parse(body.expiresAt)).toBeGreaterThan(ctx.nowMs);

    const start = ctx.audit.calls.find(
      (c) => c.event === "authz.tenant.switch.success" && c.details?.["op"] === "sp.view_as.start",
    );
    expect(start).toBeDefined();
    expect(start?.details?.["impersonating_tenant"]).toBe("globex");
    expect(start?.tenant?.targetTenantId).toBe("globex");
    expect(getViewAsTenant(ctx.spSid)).toBe("globex");
  });

  it("denies non-sp_admin callers with 403 + sp_admin_required reason", async () => {
    const res = await postViewAs(
      ctx.app,
      { tenantId: "acme-corp" },
      { sid: ctx.nonSpSid, stepUpToken: "irrelevant" },
    );
    expect(res.status).toBe(403);
    const denied = ctx.audit.calls.find(
      (c) =>
        c.event === "authz.tenant.switch.denied" &&
        c.details?.["op"] === "sp.view_as.start" &&
        c.details?.["reason"] === "sp_admin_required",
    );
    expect(denied).toBeDefined();
    expect(getViewAsTenant(ctx.nonSpSid)).toBe(null);
  });

  it("denies sp_admin on a tenant where they are NOT sp_admin (analyst-only)", async () => {
    const token = await mintStepUpFor(ctx, ctx.spSid);
    const res = await postViewAs(
      ctx.app,
      { tenantId: "initech" },
      { sid: ctx.spSid, stepUpToken: token },
    );
    expect(res.status).toBe(403);
  });

  it("returns 401 STEP_UP_REQUIRED when token is missing", async () => {
    const res = await postViewAs(ctx.app, { tenantId: "globex" }, { sid: ctx.spSid });
    expect(res.status).toBe(401);
    const denied = ctx.audit.calls.find(
      (c) =>
        c.event === "authz.tenant.switch.denied" &&
        c.details?.["op"] === "sp.view_as.denied_step_up",
    );
    expect(denied).toBeDefined();
    expect(denied?.details?.["reason"]).toBe("missing");
    expect(getViewAsTenant(ctx.spSid)).toBe(null);
  });

  it("returns 401 STEP_UP_REQUIRED with invalid_or_replayed when token is bogus", async () => {
    const res = await postViewAs(
      ctx.app,
      { tenantId: "globex" },
      { sid: ctx.spSid, stepUpToken: "deadbeef".repeat(8) },
    );
    expect(res.status).toBe(401);
    const denied = ctx.audit.calls.find((c) => c.details?.["op"] === "sp.view_as.denied_step_up");
    expect(denied?.details?.["reason"]).toBe("invalid_or_replayed");
  });

  it("returns 400 VALIDATION on missing tenantId", async () => {
    const token = await mintStepUpFor(ctx, ctx.spSid);
    const res = await postViewAs(ctx.app, {}, { sid: ctx.spSid, stepUpToken: token });
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/sp/view-as", () => {
  let ctx: TestApp;
  beforeEach(async () => {
    ctx = await buildApp();
  });
  afterEach(() => {
    _resetStepUpTokensForTests();
    _resetViewAsStoreForTests();
  });

  it("clears the view-as store + emits stop audit", async () => {
    const token = await mintStepUpFor(ctx, ctx.spSid);
    await postViewAs(ctx.app, { tenantId: "globex" }, { sid: ctx.spSid, stepUpToken: token });
    expect(getViewAsTenant(ctx.spSid)).toBe("globex");

    const res = await deleteViewAs(ctx.app, ctx.spSid);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { viewingAsTenantId: null };
    expect(body.viewingAsTenantId).toBe(null);
    expect(getViewAsTenant(ctx.spSid)).toBe(null);

    const stop = ctx.audit.calls.find(
      (c) => c.event === "authz.tenant.switch.success" && c.details?.["op"] === "sp.view_as.stop",
    );
    expect(stop).toBeDefined();
    expect(stop?.details?.["cleared_tenant"]).toBe("globex");
  });

  it("is idempotent — DELETE without an active view-as still 200s", async () => {
    const res = await deleteViewAs(ctx.app, ctx.spSid);
    expect(res.status).toBe(200);
  });
});

describe("view-as store lifecycle", () => {
  beforeEach(() => {
    _resetStepUpTokensForTests();
    _resetViewAsStoreForTests();
  });
  afterEach(() => {
    _resetStepUpTokensForTests();
    _resetViewAsStoreForTests();
  });

  it("expires entries past the 1h TTL", async () => {
    const ctx = await buildApp();
    const token = await mintStepUpFor(ctx, ctx.spSid);
    await postViewAs(ctx.app, { tenantId: "globex" }, { sid: ctx.spSid, stepUpToken: token });
    // Jump 65 minutes forward; the next consume should clear.
    const future = ctx.nowMs + 65 * 60_000;
    expect(getViewAsTenant(ctx.spSid, future)).toBe(null);
  });
});

describe("audit envelope (D6 invariant)", () => {
  it("reuses authz.tenant.switch.{success,denied} only — no new event names", async () => {
    _resetStepUpTokensForTests();
    _resetViewAsStoreForTests();
    const ctx = await buildApp();
    // Exercise: deny path (no step-up) + happy path.
    await postViewAs(ctx.app, { tenantId: "globex" }, { sid: ctx.spSid });
    const token = await mintStepUpFor(ctx, ctx.spSid);
    await postViewAs(ctx.app, { tenantId: "globex" }, { sid: ctx.spSid, stepUpToken: token });
    await deleteViewAs(ctx.app, ctx.spSid);

    // Filter to authz events only — auth.step_up.success from the mint is
    // intentional and out of scope for this invariant.
    const authzEvents = new Set(
      ctx.audit.calls.filter((c) => c.event.startsWith("authz.")).map((c) => c.event),
    );
    for (const e of authzEvents) {
      expect(e === "authz.tenant.switch.success" || e === "authz.tenant.switch.denied").toBe(true);
    }
  });
});
