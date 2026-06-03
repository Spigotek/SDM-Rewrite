import { Hono } from "hono";
import pino from "pino";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { contactId, roleId, tenantId, userId } from "@sdm/domain";
import { SdmHttpClient } from "../../src/api/http-client";
import { createApiRoutesState, registerApiRoutes } from "../../src/api/routes";
import { correlationMiddleware } from "../../src/auth/correlation";
import { AppErrorException, toAppErrorBody } from "../../src/auth/errors";
import {
  _resetStepUpTokensForTests,
  consumeStepUpToken,
  mintStepUpToken,
} from "../../src/auth/step-up-token";
import type { RuntimeConfig } from "../../src/config/schema";
import { createAuditEmitter } from "../../src/platform/audit";
import { createSessionStore } from "../../src/session";
import type { SessionPayload, SessionStore } from "../../src/session/types";

/**
 * I.2 — token replay protection.
 *
 * `acceptance-criteria.md §4.1` `refresh-token-rotation` / `session-expiry`
 * vectors + I.1 step-up token contract. We verify:
 *
 *  1. Step-up tokens are single-use — second `consumeStepUpToken` returns false.
 *  2. Step-up tokens are bound to the minting session — cross-session
 *     consume fails even within TTL.
 *  3. Step-up tokens expire after 15 min — TTL boundary covered.
 *  4. Session-cookie POST after `/auth/logout` returns 401 (the destroy
 *     in the logout handler invalidates the session store entry).
 *  5. Reusing a step-up token across an EMERGENCY approve attempt + a
 *     follow-up replay returns 401 with `cab.approve.denied_step_up`.
 *  6. Bogus token format (random hex string never minted) → consume rejects.
 */

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

interface AuditMock {
  readonly calls: Array<{ event: string; details?: Record<string, unknown> }>;
}

async function makeSession(
  sessionStore: SessionStore,
  sid: string,
  uiRole: "change_manager" | "agent_l1" = "change_manager",
): Promise<SessionPayload> {
  const now = Date.now();
  const payload: SessionPayload = {
    sid,
    userId: userId("user-1"),
    contactId: contactId("U'CNT'"),
    displayName: "Anna, Analyst",
    email: "anna@example",
    activeTenantId: tenantId("default"),
    tenants: [
      {
        id: tenantId("default"),
        name: "default",
        roles: [{ id: roleId("10001"), sym: uiRole, uiRole }],
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
  return payload;
}

async function buildApi(): Promise<{
  app: Hono;
  audit: AuditMock;
  sessionStore: SessionStore;
  sid: string;
}> {
  const config = makeConfig();
  const log = pino({ level: "silent" });
  const sessionStore = createSessionStore({ driver: "memory" });
  const client = new SdmHttpClient(
    { baseUrl: BASE, requestTimeoutMs: 2000, maxRetries: 0 },
    { fetch: globalThis.fetch, log },
  );

  const sid = "replay-sid";
  await makeSession(sessionStore, sid);

  const calls: AuditMock["calls"] = [];
  const realAudit = createAuditEmitter({ log });
  const audit: typeof realAudit = (c, input, session) => {
    calls.push({ event: input.event, details: input.details });
    realAudit(c, input, session);
  };

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
  return { app, audit: { calls }, sessionStore, sid };
}

describe("step-up token replay", () => {
  beforeEach(() => _resetStepUpTokensForTests());
  afterEach(() => _resetStepUpTokensForTests());

  it("step-up token is single-use — second consume returns false", () => {
    const { token } = mintStepUpToken("session-x");
    expect(consumeStepUpToken(token, "session-x")).toBe(true);
    expect(consumeStepUpToken(token, "session-x")).toBe(false);
  });

  it("step-up token is session-bound — cross-session consume returns false", () => {
    const { token } = mintStepUpToken("session-x");
    expect(consumeStepUpToken(token, "session-y")).toBe(false);
    // Original session can still consume — failed lookup must not delete entry.
    expect(consumeStepUpToken(token, "session-x")).toBe(true);
  });

  it("bogus token (not minted) returns false on consume", () => {
    expect(consumeStepUpToken("a".repeat(64), "any-session")).toBe(false);
  });

  it("step-up token past TTL returns false on consume", () => {
    const { token, expiresAt } = mintStepUpToken("session-x");
    const future = expiresAt + 1;
    expect(consumeStepUpToken(token, "session-x", future)).toBe(false);
  });

  it("EMERGENCY approve consumes token once — replay → 401 STEP_UP_REQUIRED", async () => {
    const { app, audit, sid } = await buildApi();
    const { token } = mintStepUpToken(sid);

    const first = await app.fetch(
      new Request("http://bff/api/changes/CHG-001/approve", {
        method: "POST",
        headers: {
          Cookie: `sdm.sid=${sid}`,
          "Content-Type": "application/json",
          "X-Step-Up-Token": token,
        },
        body: JSON.stringify({ approverId: "user-1", category: "EMERGENCY" }),
      }),
    );
    expect(first.status).toBe(200);

    const replay = await app.fetch(
      new Request("http://bff/api/changes/CHG-001/approve", {
        method: "POST",
        headers: {
          Cookie: `sdm.sid=${sid}`,
          "Content-Type": "application/json",
          "X-Step-Up-Token": token,
        },
        body: JSON.stringify({ approverId: "user-1", category: "EMERGENCY" }),
      }),
    );
    expect(replay.status).toBe(401);
    const replayBody = (await replay.json()) as { error: string };
    expect(replayBody.error).toBe("STEP_UP_REQUIRED");
    const deniedAudit = audit.calls.find((c) => c.details?.["op"] === "cab.approve.denied_step_up");
    expect(deniedAudit?.details?.["reason"]).toBe("invalid_or_replayed");
  });
});

describe("session cookie after logout", () => {
  it("destroyed session cookie → 401 AUTH_EXPIRED on subsequent mutation", async () => {
    const { app, sessionStore, sid } = await buildApi();
    // Simulate logout: drop the session entry from the store.
    await sessionStore.destroy(sid);

    const res = await app.fetch(
      new Request("http://bff/api/changes/CHG-001/approve", {
        method: "POST",
        headers: {
          Cookie: `sdm.sid=${sid}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ approverId: "user-1" }),
      }),
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("AUTH_EXPIRED");
  });
});
