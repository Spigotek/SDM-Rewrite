import { Hono } from "hono";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import pino from "pino";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
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
 * J.6 — PATCH /api/changes/:id/schedule.
 *
 * Verified:
 *  1. Happy path — 200 + updated DTO returned.
 *  2. Permission gate — user without change.schedule → 403.
 *  3. Missing scheduledStartAt → 400 VALIDATION.
 *  4. Missing scheduledEndAt → 400 VALIDATION.
 *  5. Non-ISO scheduledStartAt → 400 VALIDATION.
 *  6. scheduledEndAt <= scheduledStartAt → 400 VALIDATION.
 *  7. Not-found / cross-tenant → 404.
 *  8. Audit shape — data.chg.write + details.op="schedule.update" + before/after values.
 */

const BASE = "http://test-sdm.local/caisd-rest";

const CHANGE_ID = "CHG-0042";
const START_AT = "2026-07-10T08:00:00.000Z";
const END_AT = "2026-07-10T12:00:00.000Z";
const PREV_START_EPOCH = 1752134400; // some past epoch
const PREV_END_EPOCH = 1752148800;

/** Minimal CA SDM chg fixture returned by GET /chg/:id. */
const MOCK_CHG_RESPONSE = {
  chg: {
    "@id": "42",
    "@COMMON_NAME": CHANGE_ID,
    chg_ref_num: CHANGE_ID,
    summary: "Deploy v2 hotfix",
    description: "",
    status: null,
    priority: null,
    requestor: null,
    assignee: null,
    open_date: "1748822400",
    close_date: null,
    category: null,
    risk: null,
    schedule_start_date: String(PREV_START_EPOCH),
    schedule_end_date: String(PREV_END_EPOCH),
    rollback_plan: null,
  },
};

/** CA SDM response after a successful PUT /chg/:id (returns updated object). */
const MOCK_CHG_UPDATED_RESPONSE = {
  chg: {
    ...MOCK_CHG_RESPONSE.chg,
    schedule_start_date: String(Math.floor(new Date(START_AT).getTime() / 1000)),
    schedule_end_date: String(Math.floor(new Date(END_AT).getTime() / 1000)),
  },
};

// ── MSW server to intercept CA SDM calls ─────────────────────────────────────

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function mountOkHandlers(): void {
  server.use(
    http.get(`${BASE}/chg/${CHANGE_ID}`, () => HttpResponse.json(MOCK_CHG_RESPONSE)),
    http.put(`${BASE}/chg/${CHANGE_ID}`, () => HttpResponse.json(MOCK_CHG_UPDATED_RESPONSE)),
  );
}

// ── Test helpers ─────────────────────────────────────────────────────────────

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

const CHANGE_MANAGER_SID = "schedule-cm-sid";
const AGENT_L1_SID = "schedule-agent-sid";

async function buildApi(): Promise<{ app: Hono; audit: AuditMock }> {
  const config = makeConfig();
  const log = pino({ level: "silent" });
  const sessionStore = createSessionStore({ driver: "memory" });
  const client = new SdmHttpClient(
    { baseUrl: BASE, requestTimeoutMs: 2000, maxRetries: 0 },
    { fetch: globalThis.fetch, log },
  );

  const now = Date.now();
  const base = {
    activeTenantId: tenantId("default"),
    accessKey: "key",
    accessKeyId: "kid",
    accessKeyExpiresAt: now + 3_600_000,
    createdAt: now,
    lastSeenAt: now,
    absoluteExpiresAt: now + 28_800_000,
    cookieVersion: 1,
  };

  // change_manager has change.schedule
  const cmSession: SessionPayload = {
    sid: CHANGE_MANAGER_SID,
    userId: userId("change.manager"),
    contactId: contactId("U'PETER'"),
    displayName: "Peter CM",
    email: "peter@example",
    tenants: [
      {
        id: tenantId("default"),
        name: "default",
        roles: [{ id: roleId("20001"), sym: "ChangeManager", uiRole: "change_manager" }],
      },
    ],
    ...base,
  };
  await sessionStore.create(CHANGE_MANAGER_SID, cmSession, 28800);

  // agent_l1 does NOT have change.schedule
  const agentSession: SessionPayload = {
    sid: AGENT_L1_SID,
    userId: userId("agent.l1"),
    contactId: contactId("U'ANNA'"),
    displayName: "Anna L1",
    email: "anna@example",
    tenants: [
      {
        id: tenantId("default"),
        name: "default",
        roles: [{ id: roleId("10001"), sym: "AgentL1", uiRole: "agent_l1" }],
      },
    ],
    ...base,
  };
  await sessionStore.create(AGENT_L1_SID, agentSession, 28800);

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
        toAppErrorBody({ code: err.code, message: err.message, httpStatus: err.httpStatus }),
        err.httpStatus as never,
      );
    }
    return c.json({ error: "internal_error" }, 500);
  });

  return { app, audit: { calls } };
}

function patch(app: Hono, id: string, body: unknown, sid = CHANGE_MANAGER_SID): Promise<Response> {
  return app.fetch(
    new Request(`http://bff/api/changes/${id}/schedule`, {
      method: "PATCH",
      headers: {
        Cookie: `sdm.sid=${sid}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }),
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("PATCH /api/changes/:id/schedule — happy path", () => {
  let app: Hono;

  beforeEach(async () => {
    const built = await buildApi();
    app = built.app;
    mountOkHandlers();
  });

  it("returns 200 with updated DTO when change.schedule permission held", async () => {
    const res = await patch(app, CHANGE_ID, {
      scheduledStartAt: START_AT,
      scheduledEndAt: END_AT,
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body["scheduledStartAt"]).toBe(START_AT);
    expect(body["scheduledEndAt"]).toBe(END_AT);
  });
});

describe("PATCH /api/changes/:id/schedule — audit shape", () => {
  let app: Hono;
  let audit: AuditMock;

  beforeEach(async () => {
    const built = await buildApi();
    app = built.app;
    audit = built.audit;
    mountOkHandlers();
  });

  it("emits data.chg.write with op=schedule.update and previous/new timestamps", async () => {
    await patch(app, CHANGE_ID, { scheduledStartAt: START_AT, scheduledEndAt: END_AT });
    const emit = audit.calls.find((c) => c.event === "data.chg.write");
    expect(emit).toBeDefined();
    expect(emit?.details?.["op"]).toBe("schedule.update");
    expect(emit?.details?.["recordId"]).toBe(CHANGE_ID);
    expect(emit?.details?.["scheduled_start_at"]).toBe(START_AT);
    expect(emit?.details?.["scheduled_end_at"]).toBe(END_AT);
    // previous values captured from pre-fetch
    expect(emit?.details?.["previous_start_at"]).toBeDefined();
    expect(emit?.details?.["previous_end_at"]).toBeDefined();
  });

  it("only uses data.chg.write — no new audit event names", async () => {
    await patch(app, CHANGE_ID, { scheduledStartAt: START_AT, scheduledEndAt: END_AT });
    const events = new Set(audit.calls.map((c) => c.event));
    expect(events.has("data.chg.write")).toBe(true);
    for (const e of events) {
      expect(e.startsWith("schedule.") || e === "change.rescheduled").toBe(false);
    }
  });
});

describe("PATCH /api/changes/:id/schedule — permission gate", () => {
  let app: Hono;

  beforeEach(async () => {
    const built = await buildApi();
    app = built.app;
    mountOkHandlers();
  });

  it("returns 403 AUTH_FORBIDDEN when caller lacks change.schedule", async () => {
    const res = await patch(
      app,
      CHANGE_ID,
      { scheduledStartAt: START_AT, scheduledEndAt: END_AT },
      AGENT_L1_SID,
    );
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("AUTH_FORBIDDEN");
  });

  it("returns 401 when no session cookie", async () => {
    const res = await app.fetch(
      new Request(`http://bff/api/changes/${CHANGE_ID}/schedule`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledStartAt: START_AT, scheduledEndAt: END_AT }),
      }),
    );
    expect(res.status).toBe(401);
  });
});

describe("PATCH /api/changes/:id/schedule — body validation", () => {
  let app: Hono;

  beforeEach(async () => {
    const built = await buildApi();
    app = built.app;
    mountOkHandlers();
  });

  it("400 VALIDATION when scheduledStartAt is missing", async () => {
    const res = await patch(app, CHANGE_ID, { scheduledEndAt: END_AT });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("VALIDATION");
  });

  it("400 VALIDATION when scheduledEndAt is missing", async () => {
    const res = await patch(app, CHANGE_ID, { scheduledStartAt: START_AT });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("VALIDATION");
  });

  it("400 VALIDATION when scheduledStartAt is not ISO 8601", async () => {
    const res = await patch(app, CHANGE_ID, {
      scheduledStartAt: "not-a-date",
      scheduledEndAt: END_AT,
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("VALIDATION");
  });

  it("400 VALIDATION when scheduledEndAt <= scheduledStartAt (end-before-start)", async () => {
    const res = await patch(app, CHANGE_ID, {
      scheduledStartAt: END_AT,
      scheduledEndAt: START_AT,
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("VALIDATION");
  });
});

describe("PATCH /api/changes/:id/schedule — 404 cross-tenant / not-found", () => {
  let app: Hono;

  beforeEach(async () => {
    const built = await buildApi();
    app = built.app;
  });

  it("returns 404 when change not found in tenant", async () => {
    server.use(
      http.get(`${BASE}/chg/CHG-MISSING`, () =>
        HttpResponse.json({ error: "not found" }, { status: 404 }),
      ),
    );
    const res = await patch(app, "CHG-MISSING", {
      scheduledStartAt: START_AT,
      scheduledEndAt: END_AT,
    });
    expect(res.status).toBe(404);
  });
});
