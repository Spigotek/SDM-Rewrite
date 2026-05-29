import { Hono } from "hono";
import pino from "pino";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { contactId, roleId, tenantId, userId } from "@sdm/domain";
import { SdmHttpClient } from "../src/api/http-client";
import { createApiRoutesState, registerApiRoutes } from "../src/api/routes";
import { correlationMiddleware } from "../src/auth/correlation";
import { AppErrorException, toAppErrorBody } from "../src/auth/errors";
import type { RuntimeConfig } from "../src/config/schema";
import { createAuditEmitter } from "../src/platform/audit";
import { createSessionStore } from "../src/session";
import type { SessionPayload } from "../src/session/types";

/**
 * H.11 — CAB approval endpoints. We verify:
 *  1. Payload validation (approverId required everywhere, reason required on reject).
 *  2. Audit emit uses the F.4 canonical event name `data.chg.write` (no new
 *     event taxonomy — hard constraint per H.11.md).
 *  3. The emitted `details.op` discriminates approve / reject / reminder so
 *     SIEM can split CAB actions without redefining the audit category.
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

async function buildApi(): Promise<{ app: Hono; audit: AuditMock }> {
  const config = makeConfig();
  const log = pino({ level: "silent" });
  const sessionStore = createSessionStore({ driver: "memory" });
  const client = new SdmHttpClient(
    { baseUrl: BASE, requestTimeoutMs: 2000, maxRetries: 0 },
    { fetch: globalThis.fetch, log },
  );

  const sid = "cab-approval-sid";
  const now = Date.now();
  const payload: SessionPayload = {
    sid,
    userId: userId("change.manager"),
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
  return { app, audit: { calls } };
}

const COOKIE = "Cookie";
const SID_COOKIE = "sdm.sid=cab-approval-sid";

async function post(app: Hono, path: string, body: unknown): Promise<Response> {
  return app.fetch(
    new Request(`http://bff${path}`, {
      method: "POST",
      headers: { [COOKIE]: SID_COOKIE, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

describe("/api/changes/:id/approve", () => {
  let app: Hono;
  let audit: AuditMock;
  beforeEach(async () => {
    const built = await buildApi();
    app = built.app;
    audit = built.audit;
  });
  afterEach(() => vi.restoreAllMocks());

  it("returns 200 with approve decision shape", async () => {
    const res = await post(app, "/api/changes/CHG-001/approve", {
      approverId: "user-1",
      comment: "ok",
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body["decision"]).toBe("approve");
    expect(body["approverId"]).toBe("user-1");
    expect(body["comment"]).toBe("ok");
  });

  it("emits data.chg.write audit with op=cab.approve", async () => {
    await post(app, "/api/changes/CHG-001/approve", { approverId: "user-1" });
    const emit = audit.calls.find((c) => c.event === "data.chg.write");
    expect(emit).toBeDefined();
    expect(emit?.details?.["op"]).toBe("cab.approve");
    expect(emit?.details?.["recordId"]).toBe("CHG-001");
    expect(emit?.details?.["approverId"]).toBe("user-1");
  });

  it("rejects missing approverId with 400 VALIDATION", async () => {
    const res = await post(app, "/api/changes/CHG-001/approve", {});
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("VALIDATION");
  });
});

describe("/api/changes/:id/reject", () => {
  let app: Hono;
  let audit: AuditMock;
  beforeEach(async () => {
    const built = await buildApi();
    app = built.app;
    audit = built.audit;
  });

  it("requires both approverId and reason", async () => {
    const noApprover = await post(app, "/api/changes/CHG-001/reject", { reason: "x" });
    expect(noApprover.status).toBe(400);
    const noReason = await post(app, "/api/changes/CHG-001/reject", { approverId: "user-1" });
    expect(noReason.status).toBe(400);
  });

  it("returns 200 + emits data.chg.write op=cab.reject", async () => {
    const res = await post(app, "/api/changes/CHG-001/reject", {
      approverId: "user-1",
      reason: "regression observed in pre-prod",
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body["decision"]).toBe("reject");
    expect(body["reason"]).toBe("regression observed in pre-prod");
    const emit = audit.calls.find((c) => c.event === "data.chg.write");
    expect(emit?.details?.["op"]).toBe("cab.reject");
    expect(emit?.details?.["reasonLength"]).toBe("regression observed in pre-prod".length);
  });
});

describe("/api/changes/:id/reminder", () => {
  let app: Hono;
  let audit: AuditMock;
  beforeEach(async () => {
    const built = await buildApi();
    app = built.app;
    audit = built.audit;
  });

  it("returns ack + emits data.chg.write op=cab.reminder", async () => {
    const res = await post(app, "/api/changes/CHG-001/reminder", { approverId: "user-7" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; approverId: string };
    expect(body.ok).toBe(true);
    expect(body.approverId).toBe("user-7");
    const emit = audit.calls.find((c) => c.event === "data.chg.write");
    expect(emit?.details?.["op"]).toBe("cab.reminder");
    expect(emit?.details?.["approverId"]).toBe("user-7");
  });

  it("rejects missing approverId with 400", async () => {
    const res = await post(app, "/api/changes/CHG-001/reminder", {});
    expect(res.status).toBe(400);
  });
});

describe("F.4 invariant — no new audit event names", () => {
  it("only uses data.chg.write for all three actions", async () => {
    const { app, audit } = await buildApi();
    await post(app, "/api/changes/CHG-001/approve", { approverId: "u1" });
    await post(app, "/api/changes/CHG-001/reject", { approverId: "u1", reason: "no" });
    await post(app, "/api/changes/CHG-001/reminder", { approverId: "u1" });
    const events = new Set(audit.calls.map((c) => c.event));
    expect(events.has("data.chg.write")).toBe(true);
    // The set must NOT contain any new CAB-specific event name.
    for (const e of events) {
      expect(e.startsWith("cab.") || e === "change.approved" || e === "change.rejected").toBe(
        false,
      );
    }
  });
});
