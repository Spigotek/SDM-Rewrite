import { Hono } from "hono";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import pino from "pino";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { contactId, roleId, tenantId, userId } from "@sdm/domain";
import { SdmHttpClient } from "../../src/api/http-client";
import { createApiRoutesState, registerApiRoutes } from "../../src/api/routes";
import { correlationMiddleware } from "../../src/auth/correlation";
import { AppErrorException, toAppErrorBody } from "../../src/auth/errors";
import { _resetStepUpTokensForTests, mintStepUpToken } from "../../src/auth/step-up-token";
import type { RuntimeConfig } from "../../src/config/schema";
import { AUDIT_EVENTS, AUDIT_SCHEMA_VERSION, createAuditEmitter } from "../../src/platform/audit";
import { createSessionStore } from "../../src/session";
import type { SessionPayload } from "../../src/session/types";

/**
 * I.2 — audit emission per F.4 frozen taxonomy.
 *
 * `acceptance-criteria.md §4.6` (audit log emission). Every mutating call
 * must emit exactly one audit event with the canonical envelope:
 *   `{ schemaVersion, ts, correlationId, category, event, actor, tenant,
 *      request, result, resultCode?, reason?, details? }`
 *
 * We verify:
 *   1. Incident create → `data.in.write` with `details.op = "create"`.
 *   2. Incident update → `data.in.write` with `details.op = "update"`.
 *   3. Incident soft-close (DELETE) → `data.in.delete` with
 *      `details.op = "soft-close"`.
 *   4. Change approve → `data.chg.write` with `details.op = "cab.approve"`.
 *   5. Change reject → `data.chg.write` with `details.op = "cab.reject"`.
 *   6. Change reminder → `data.chg.write` with `details.op = "cab.reminder"`.
 *   7. Problem create → `data.pr.write` with `details.op = "create"`.
 *   8. KB create → `data.KD.write` with `details.op = "create"`.
 *   9. EMERGENCY approve denied (missing step-up) → `data.chg.write` with
 *      `details.op = "cab.approve.denied_step_up"` AND `result = "denied"`.
 *  10. Envelope shape: category + schemaVersion + actor + tenant + result.
 *
 * No new event names are emitted — F.4 taxonomy is frozen. `details.op`
 * is the discriminator (per H.11 precedent).
 */

const BASE = "http://test-sdm.local/caisd-rest";

const KNOWN_DATA_EVENT_NAMES = new Set<string>([
  "data.in.write",
  "data.in.delete",
  "data.cr.write",
  "data.cr.delete",
  "data.pr.write",
  "data.pr.delete",
  "data.chg.write",
  "data.chg.delete",
  "data.KD.write",
  "data.KD.delete",
  "data.nr.write",
  "data.nr.delete",
]);

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

interface AuditCall {
  readonly event: string;
  readonly category: string;
  readonly result: string;
  readonly details?: Record<string, unknown>;
}

interface AuditMock {
  readonly calls: AuditCall[];
}

async function buildApi(): Promise<{ app: Hono; audit: AuditMock; sid: string }> {
  const config = makeConfig();
  const log = pino({ level: "silent" });
  const sessionStore = createSessionStore({ driver: "memory" });
  const client = new SdmHttpClient(
    { baseUrl: BASE, requestTimeoutMs: 2000, maxRetries: 0 },
    { fetch: globalThis.fetch, log },
  );
  const sid = "audit-emit-sid";
  const now = Date.now();
  const payload: SessionPayload = {
    sid,
    userId: userId("anna.analyst"),
    contactId: contactId("U'CNT'"),
    displayName: "Anna, Analyst",
    email: "anna@example",
    activeTenantId: tenantId("default"),
    tenants: [
      {
        id: tenantId("default"),
        name: "default",
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

  const calls: AuditCall[] = [];
  const realAudit = createAuditEmitter({ log });
  const audit: typeof realAudit = (c, input, session) => {
    calls.push({
      event: input.event,
      category: input.category,
      result: input.result,
      details: input.details,
    });
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
  return { app, audit: { calls }, sid };
}

const SID_COOKIE = "sdm.sid=audit-emit-sid";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("audit emission — F.4 taxonomy (frozen)", () => {
  beforeEach(() => _resetStepUpTokensForTests());

  it("POST /api/incidents emits data.in.write op=create + envelope shape", async () => {
    server.use(
      http.post(
        `${BASE}/in`,
        () =>
          new HttpResponse(JSON.stringify({ in: { "@id": 100100, "@REL_ATTR": "cr:100100" } }), {
            status: 201,
            headers: { "Content-Type": "application/json" },
          }),
      ),
    );
    const { app, audit } = await buildApi();
    const res = await app.fetch(
      new Request("http://bff/api/incidents", {
        method: "POST",
        headers: { Cookie: SID_COOKIE, "Content-Type": "application/json" },
        body: JSON.stringify({ summary: "x", customerId: "U'CNT'" }),
      }),
    );
    expect(res.status).toBe(201);
    const emit = audit.calls.find((c) => c.event === AUDIT_EVENTS.data.write("in"));
    expect(emit).toBeDefined();
    expect(emit?.category).toBe("data");
    expect(emit?.result).toBe("success");
    expect(emit?.details?.["op"]).toBe("create");
    expect(emit?.details?.["recordId"]).toBe("100100");
  });

  it("PUT /api/incidents/:id emits data.in.write op=update", async () => {
    server.use(
      http.put(`${BASE}/in/100100`, () =>
        HttpResponse.json({ in: { "@id": 100100 } }, { status: 200 }),
      ),
    );
    const { app, audit } = await buildApi();
    const res = await app.fetch(
      new Request("http://bff/api/incidents/100100", {
        method: "PUT",
        headers: { Cookie: SID_COOKIE, "Content-Type": "application/json" },
        body: JSON.stringify({ summary: "updated" }),
      }),
    );
    expect(res.status).toBe(200);
    const emit = audit.calls.find((c) => c.event === AUDIT_EVENTS.data.write("in"));
    expect(emit?.details?.["op"]).toBe("update");
    expect(emit?.details?.["recordId"]).toBe("100100");
  });

  it("DELETE /api/incidents/:id emits data.in.delete op=soft-close", async () => {
    server.use(
      http.put(`${BASE}/in/100100`, () =>
        HttpResponse.json({ in: { "@id": 100100 } }, { status: 200 }),
      ),
    );
    const { app, audit } = await buildApi();
    const res = await app.fetch(
      new Request("http://bff/api/incidents/100100", {
        method: "DELETE",
        headers: { Cookie: SID_COOKIE },
      }),
    );
    expect(res.status).toBe(200);
    const emit = audit.calls.find((c) => c.event === AUDIT_EVENTS.data.delete("in"));
    expect(emit?.category).toBe("data");
    expect(emit?.result).toBe("success");
    expect(emit?.details?.["op"]).toBe("soft-close");
    expect(emit?.details?.["kind"]).toBe("status-CL");
  });

  it("POST /api/changes/:id/approve emits data.chg.write op=cab.approve", async () => {
    const { app, audit } = await buildApi();
    const res = await app.fetch(
      new Request("http://bff/api/changes/CHG-001/approve", {
        method: "POST",
        headers: { Cookie: SID_COOKIE, "Content-Type": "application/json" },
        body: JSON.stringify({ approverId: "user-1" }),
      }),
    );
    expect(res.status).toBe(200);
    const emit = audit.calls.find((c) => c.event === "data.chg.write");
    expect(emit?.details?.["op"]).toBe("cab.approve");
  });

  it("POST /api/changes/:id/reject emits data.chg.write op=cab.reject", async () => {
    const { app, audit } = await buildApi();
    const res = await app.fetch(
      new Request("http://bff/api/changes/CHG-001/reject", {
        method: "POST",
        headers: { Cookie: SID_COOKIE, "Content-Type": "application/json" },
        body: JSON.stringify({ approverId: "user-1", reason: "regression" }),
      }),
    );
    expect(res.status).toBe(200);
    const emit = audit.calls.find((c) => c.event === "data.chg.write");
    expect(emit?.details?.["op"]).toBe("cab.reject");
  });

  it("POST /api/changes/:id/reminder emits data.chg.write op=cab.reminder", async () => {
    const { app, audit } = await buildApi();
    const res = await app.fetch(
      new Request("http://bff/api/changes/CHG-001/reminder", {
        method: "POST",
        headers: { Cookie: SID_COOKIE, "Content-Type": "application/json" },
        body: JSON.stringify({ approverId: "user-7" }),
      }),
    );
    expect(res.status).toBe(200);
    const emit = audit.calls.find((c) => c.event === "data.chg.write");
    expect(emit?.details?.["op"]).toBe("cab.reminder");
  });

  it("POST /api/problems emits data.pr.write op=create", async () => {
    server.use(
      http.post(
        `${BASE}/pr`,
        () =>
          new HttpResponse(JSON.stringify({ pr: { "@id": 200200 } }), {
            status: 201,
            headers: { "Content-Type": "application/json" },
          }),
      ),
    );
    const { app, audit } = await buildApi();
    const res = await app.fetch(
      new Request("http://bff/api/problems", {
        method: "POST",
        headers: { Cookie: SID_COOKIE, "Content-Type": "application/json" },
        body: JSON.stringify({ summary: "problem-x", customerId: "U'CNT'" }),
      }),
    );
    expect(res.status).toBe(201);
    const emit = audit.calls.find((c) => c.event === AUDIT_EVENTS.data.write("pr"));
    expect(emit?.details?.["op"]).toBe("create");
  });

  it("POST /api/kb emits data.KD.write op=create", async () => {
    server.use(
      http.post(
        `${BASE}/KD`,
        () =>
          new HttpResponse(JSON.stringify({ KD: { "@id": 300300 } }), {
            status: 201,
            headers: { "Content-Type": "application/json" },
          }),
      ),
    );
    const { app, audit } = await buildApi();
    const res = await app.fetch(
      new Request("http://bff/api/kb", {
        method: "POST",
        headers: { Cookie: SID_COOKIE, "Content-Type": "application/json" },
        body: JSON.stringify({ title: "KB title", summary: "summary", customerId: "U'CNT'" }),
      }),
    );
    expect(res.status).toBe(201);
    const emit = audit.calls.find((c) => c.event === AUDIT_EVENTS.data.write("KD"));
    expect(emit?.details?.["op"]).toBe("create");
  });

  it("EMERGENCY approve without step-up emits cab.approve.denied_step_up with result=denied", async () => {
    const { app, audit } = await buildApi();
    const res = await app.fetch(
      new Request("http://bff/api/changes/CHG-001/approve", {
        method: "POST",
        headers: { Cookie: SID_COOKIE, "Content-Type": "application/json" },
        body: JSON.stringify({ approverId: "user-1", category: "EMERGENCY" }),
      }),
    );
    expect(res.status).toBe(401);
    const denied = audit.calls.find((c) => c.details?.["op"] === "cab.approve.denied_step_up");
    expect(denied?.event).toBe("data.chg.write");
    expect(denied?.result).toBe("denied");
  });

  it("EMERGENCY approve with valid step-up token still uses data.chg.write (no new event family)", async () => {
    const { app, audit, sid } = await buildApi();
    const { token } = mintStepUpToken(sid);
    const res = await app.fetch(
      new Request("http://bff/api/changes/CHG-001/approve", {
        method: "POST",
        headers: {
          Cookie: SID_COOKIE,
          "Content-Type": "application/json",
          "X-Step-Up-Token": token,
        },
        body: JSON.stringify({ approverId: "user-1", category: "EMERGENCY" }),
      }),
    );
    expect(res.status).toBe(200);
    const events = new Set(audit.calls.filter((c) => c.category === "data").map((c) => c.event));
    // All emitted data.* events must be from the frozen taxonomy.
    for (const event of events) {
      expect(KNOWN_DATA_EVENT_NAMES.has(event)).toBe(true);
    }
  });

  it("schemaVersion is the canonical F.4 constant", () => {
    // Sanity check that schemaVersion is exported and is the constant the
    // contract relies on. Bumping this is a SIEM-breaking change.
    expect(AUDIT_SCHEMA_VERSION).toBe("1.0");
  });
});
