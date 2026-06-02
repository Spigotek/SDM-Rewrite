import { Hono } from "hono";
import pino from "pino";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { contactId, roleId, tenantId, userId } from "@sdm/domain";
import { correlationMiddleware } from "../src/auth/correlation";
import { AppErrorException, toAppErrorBody } from "../src/auth/errors";
import { computeTotp, registerStepUpRoutes } from "../src/auth/step-up";
import { consumeStepUpToken, _resetStepUpTokensForTests } from "../src/auth/step-up-token";
import type { RuntimeConfig } from "../src/config/schema";
import { createAuditEmitter } from "../src/platform/audit";
import { createSessionStore } from "../src/session";
import type { SessionPayload } from "../src/session/types";

/**
 * I.1 — `POST /auth/step-up` TOTP verification + token mint.
 *
 * Verifies:
 *  1. Happy path: valid current-window TOTP → 200 + token + `auth.step_up.success` audit.
 *  2. Previous-window code accepted (±1 step skew).
 *  3. Next-next-window code rejected (out of skew).
 *  4. Invalid 6-digit code → 401 + `auth.step_up.denied` audit + reason.
 *  5. Missing session cookie → 401 (auth middleware) BEFORE TOTP check.
 *  6. Replay: `consumeStepUpToken` second call with same token returns false.
 *  7. Token bound to session id — cross-session consume fails.
 *  8. Audit payload shape matches F.4 envelope (category / event / result).
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
  readonly calls: Array<{ event: string; result: string; details?: Record<string, unknown> }>;
}

interface TestApp {
  readonly app: Hono;
  readonly audit: AuditMock;
  readonly sid: string;
  readonly nowMs: number;
  setNow(ms: number): void;
}

async function buildApp(): Promise<TestApp> {
  _resetStepUpTokensForTests();
  const config = makeConfig();
  const log = pino({ level: "silent" });
  const sessionStore = createSessionStore({ driver: "memory" });

  const sid = "step-up-sid";
  const now = Date.now();
  const payload: SessionPayload = {
    sid,
    userId: userId("peter"),
    contactId: contactId("U'PETER'"),
    displayName: "Peter, Change",
    email: "peter@example",
    activeTenantId: tenantId("default"),
    tenants: [
      {
        id: tenantId("default"),
        name: "default",
        roles: [{ id: roleId("20001"), sym: "ChangeManager", uiRole: "change_manager" }],
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

  const calls: AuditMock["calls"] = [];
  const realAudit = createAuditEmitter({ log });
  const audit: typeof realAudit = (c, input, session) => {
    calls.push({ event: input.event, result: input.result, details: input.details });
    realAudit(c, input, session);
  };

  let nowMs = now;
  const app = new Hono();
  app.use("*", correlationMiddleware());
  registerStepUpRoutes(app, {
    config,
    sessionStore,
    log,
    audit,
    now: () => nowMs,
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
    sid,
    nowMs: now,
    setNow(ms: number) {
      nowMs = ms;
    },
  };
}

function totpForWindow(seed: string, nowMs: number, offset = 0): string {
  const counter = Math.floor(nowMs / 1000 / TOTP_STEP_SEC) + offset;
  return computeTotp(seed, counter);
}

async function post(app: Hono, body: unknown, sidCookie?: string): Promise<Response> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (sidCookie) headers["Cookie"] = sidCookie;
  return app.fetch(
    new Request("http://bff/auth/step-up", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }),
  );
}

describe("POST /auth/step-up", () => {
  let ctx: TestApp;
  beforeEach(async () => {
    ctx = await buildApp();
  });
  afterEach(() => {
    _resetStepUpTokensForTests();
  });

  it("returns 200 + token + auth.step_up.success on valid current-window TOTP", async () => {
    const totp = totpForWindow(TEST_SEED, ctx.nowMs, 0);
    const res = await post(ctx.app, { totp }, `sdm.sid=${ctx.sid}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { stepUpToken: string; expiresAt: string };
    expect(body.stepUpToken).toMatch(/^[0-9a-f]{64}$/);
    expect(Date.parse(body.expiresAt)).toBeGreaterThan(ctx.nowMs);

    const emit = ctx.audit.calls.find((c) => c.event === "auth.step_up.success");
    expect(emit).toBeDefined();
    expect(emit?.result).toBe("success");
    expect(typeof emit?.details?.["ttlSec"]).toBe("number");
  });

  it("accepts previous-window TOTP (±1 step skew)", async () => {
    const totp = totpForWindow(TEST_SEED, ctx.nowMs, -1);
    const res = await post(ctx.app, { totp }, `sdm.sid=${ctx.sid}`);
    expect(res.status).toBe(200);
  });

  it("rejects next-next-window TOTP (out of skew tolerance)", async () => {
    const totp = totpForWindow(TEST_SEED, ctx.nowMs, +2);
    const res = await post(ctx.app, { totp }, `sdm.sid=${ctx.sid}`);
    expect(res.status).toBe(401);
    const denied = ctx.audit.calls.find((c) => c.event === "auth.step_up.denied");
    expect(denied).toBeDefined();
    expect(denied?.result).toBe("denied");
  });

  it("returns 401 with auth.step_up.denied on wrong TOTP code", async () => {
    const res = await post(ctx.app, { totp: "000000" }, `sdm.sid=${ctx.sid}`);
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string; reason: string };
    expect(body.error).toBe("unauthorized");
    expect(body.reason).toBe("invalid_totp");
    const denied = ctx.audit.calls.find((c) => c.event === "auth.step_up.denied");
    expect(denied).toBeDefined();
  });

  it("rejects payload that is not a 6-digit code with 400 VALIDATION", async () => {
    const res = await post(ctx.app, { totp: "abc" }, `sdm.sid=${ctx.sid}`);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("VALIDATION");
  });

  it("returns 401 AUTH_EXPIRED when no session cookie is sent", async () => {
    const totp = totpForWindow(TEST_SEED, ctx.nowMs, 0);
    const res = await post(ctx.app, { totp });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("AUTH_EXPIRED");
  });
});

describe("step-up token store", () => {
  beforeEach(() => _resetStepUpTokensForTests());

  it("is single-use — second consume with same token returns false", async () => {
    const ctx = await buildApp();
    const totp = totpForWindow(TEST_SEED, ctx.nowMs, 0);
    const res = await post(ctx.app, { totp }, `sdm.sid=${ctx.sid}`);
    expect(res.status).toBe(200);
    const { stepUpToken } = (await res.json()) as { stepUpToken: string };
    expect(consumeStepUpToken(stepUpToken, ctx.sid)).toBe(true);
    expect(consumeStepUpToken(stepUpToken, ctx.sid)).toBe(false);
  });

  it("is session-bound — cross-session consume returns false", async () => {
    const ctx = await buildApp();
    const totp = totpForWindow(TEST_SEED, ctx.nowMs, 0);
    const res = await post(ctx.app, { totp }, `sdm.sid=${ctx.sid}`);
    const { stepUpToken } = (await res.json()) as { stepUpToken: string };
    expect(consumeStepUpToken(stepUpToken, "other-session")).toBe(false);
    // Token survives the failed cross-session attempt — original session can
    // still consume it (no leakage of state on the wrong-sid path).
    expect(consumeStepUpToken(stepUpToken, ctx.sid)).toBe(true);
  });

  it("expires tokens past the 15-min TTL", async () => {
    const ctx = await buildApp();
    const totp = totpForWindow(TEST_SEED, ctx.nowMs, 0);
    const res = await post(ctx.app, { totp }, `sdm.sid=${ctx.sid}`);
    const { stepUpToken } = (await res.json()) as { stepUpToken: string };
    // Jump 16 minutes — sweep on next consume drops the entry.
    const future = ctx.nowMs + 16 * 60_000;
    expect(consumeStepUpToken(stepUpToken, ctx.sid, future)).toBe(false);
  });
});

describe("audit envelope (F.4 invariant)", () => {
  it("emits auth.step_up.{success,denied} only — no new event family", async () => {
    const ctx = await buildApp();
    await post(ctx.app, { totp: "999999" }, `sdm.sid=${ctx.sid}`);
    await post(ctx.app, { totp: totpForWindow(TEST_SEED, ctx.nowMs, 0) }, `sdm.sid=${ctx.sid}`);
    const events = new Set(ctx.audit.calls.map((c) => c.event));
    for (const e of events) {
      expect(e === "auth.step_up.success" || e === "auth.step_up.denied").toBe(true);
    }
  });
});
