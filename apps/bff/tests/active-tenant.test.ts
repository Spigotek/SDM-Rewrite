/**
 * H.1 — POST /me/active-tenant unit + integration tests.
 *
 * The endpoint already exists from F.1 (`apps/bff/src/aggregator/me.ts`) and
 * was hardened in F.5; this file covers the canonical Done-when matrix called
 * out in `docs/plans/H.1.md` so the audit-emit + session-mutation behaviour is
 * pinned down independently of the broader `auth-flow.integration.test.ts`.
 */

import { Hono } from "hono";
import pino from "pino";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { contactId, roleId, tenantId, userId } from "@sdm/domain";
import { registerMeRoutes } from "../src/aggregator/me";
import { correlationMiddleware } from "../src/auth/correlation";
import type { RuntimeConfig } from "../src/config/schema";
import { createAuditEmitter, AUDIT_EVENTS, type AuditEmitter } from "../src/platform/audit";
import { createSessionStore } from "../src/session";
import type { SessionPayload, SessionStore } from "../src/session/types";

const SID = "active-tenant-sid";
const COOKIE = `sdm.sid=${SID}`;

function makeConfig(): RuntimeConfig {
  return {
    nodeEnv: "test",
    bff: { port: 5176, trustedOrigins: ["http://localhost:5500"], logLevel: "fatal" },
    casdm: {
      baseUrl: "http://test-sdm.local/caisd-rest",
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

async function buildApp(seed?: Partial<SessionPayload>): Promise<{
  app: Hono;
  sessionStore: SessionStore;
  auditLogs: Array<Record<string, unknown>>;
  audit: AuditEmitter;
}> {
  const config = makeConfig();
  const auditLogs: Array<Record<string, unknown>> = [];
  const logger = pino(
    {
      level: "info",
    },
    {
      write: (chunk: string) => {
        try {
          const json = JSON.parse(chunk) as Record<string, unknown>;
          if (json["auditEvent"]) auditLogs.push(json["auditEvent"] as Record<string, unknown>);
        } catch {
          // ignore non-JSON
        }
      },
    },
  );
  const audit = createAuditEmitter({ log: logger });
  const sessionStore = createSessionStore({ driver: "memory" });

  const now = Date.now();
  const payload: SessionPayload = {
    sid: SID,
    userId: userId("vueuser"),
    contactId: contactId("U'BDE'"),
    displayName: "User, Vue",
    email: "vueuser@example",
    activeTenantId: tenantId("acme"),
    tenants: [
      {
        id: tenantId("acme"),
        name: "Acme",
        roles: [{ id: roleId("10001"), sym: "Analyst Level 1", uiRole: "agent_l1" }],
      },
      {
        id: tenantId("globex"),
        name: "Globex",
        roles: [{ id: roleId("10002"), sym: "Analyst Level 2", uiRole: "agent_l2" }],
      },
    ],
    accessKey: "51299815abc",
    accessKeyId: "402020",
    accessKeyExpiresAt: now + 3600_000,
    createdAt: now,
    lastSeenAt: now,
    absoluteExpiresAt: now + 28800_000,
    cookieVersion: 1,
    ...seed,
  };
  await sessionStore.create(SID, payload, 28800);

  const app = new Hono();
  app.use("*", correlationMiddleware());
  registerMeRoutes(app, { config, sessionStore, log: logger, audit });

  return { app, sessionStore, auditLogs, audit };
}

describe("POST /me/active-tenant", () => {
  let restoreRandom: () => void;
  beforeEach(() => {
    // Force samplingRate to never sample-out — TENANT_SWITCH_* is rate 1.0 anyway
    // but pinning Math.random insulates against future taxonomy changes.
    const spy = vi.spyOn(Math, "random").mockReturnValue(0);
    restoreRandom = () => spy.mockRestore();
  });
  afterEach(() => restoreRandom());

  it("switches active tenant on happy path and emits authz.tenant.switch.success", async () => {
    const { app, sessionStore, auditLogs } = await buildApp();

    const res = await app.fetch(
      new Request("http://bff/me/active-tenant", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: COOKIE },
        body: JSON.stringify({ tenantId: "globex" }),
      }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      activeTenant: { id: string; effectivePermissions: string[] };
      tenants: Array<{ id: string }>;
      uiRole: string;
    };
    expect(body.activeTenant.id).toBe("globex");
    expect(body.uiRole).toBe("agent_l2");
    expect(body.tenants.map((t) => t.id).sort()).toEqual(["acme", "globex"]);
    // Permissions are computed from the new tenant's role — agent_l2 has more
    // than agent_l1 so just spot-check the bump.
    expect(body.activeTenant.effectivePermissions.length).toBeGreaterThan(0);

    const stored = await sessionStore.get(SID);
    expect(stored?.activeTenantId).toBe("globex");
    expect(stored?.cookieVersion).toBe(2);

    const success = auditLogs.find((e) => e["event"] === AUDIT_EVENTS.authz.TENANT_SWITCH_SUCCESS);
    expect(success).toBeDefined();
    expect(
      (success as { tenant: { sourceTenantId: string; targetTenantId: string } }).tenant,
    ).toEqual({ activeTenantId: "acme", sourceTenantId: "acme", targetTenantId: "globex" });
  });

  it("rejects unknown tenant with 403 TENANT_FORBIDDEN and emits authz.tenant.switch.denied", async () => {
    const { app, sessionStore, auditLogs } = await buildApp();

    const res = await app.fetch(
      new Request("http://bff/me/active-tenant", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: COOKIE },
        body: JSON.stringify({ tenantId: "ghost" }),
      }),
    );

    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("TENANT_FORBIDDEN");

    const stored = await sessionStore.get(SID);
    expect(stored?.activeTenantId).toBe("acme");

    const denied = auditLogs.find((e) => e["event"] === AUDIT_EVENTS.authz.TENANT_SWITCH_DENIED);
    expect(denied).toBeDefined();
    expect((denied as { result: string }).result).toBe("denied");
    expect((denied as { reason: string }).reason).toBe("tenant_not_in_allowed_list");
  });

  it("returns 401 when the session cookie is missing", async () => {
    const { app } = await buildApp();
    const res = await app.fetch(
      new Request("http://bff/me/active-tenant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: "globex" }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 VALIDATION when the body is malformed", async () => {
    const { app } = await buildApp();
    const res = await app.fetch(
      new Request("http://bff/me/active-tenant", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: COOKIE },
        body: JSON.stringify({}),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("is idempotent when switching to the already-active tenant", async () => {
    const { app, sessionStore, auditLogs } = await buildApp();
    const res = await app.fetch(
      new Request("http://bff/me/active-tenant", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: COOKIE },
        body: JSON.stringify({ tenantId: "acme" }),
      }),
    );
    expect(res.status).toBe(200);
    const stored = await sessionStore.get(SID);
    expect(stored?.activeTenantId).toBe("acme");
    // Still emits a success — auditors want a trail of every switch attempt.
    expect(
      auditLogs.filter((e) => e["event"] === AUDIT_EVENTS.authz.TENANT_SWITCH_SUCCESS).length,
    ).toBe(1);
  });

  it("returns 401 when the session has aged past absoluteExpiresAt", async () => {
    const { app, sessionStore } = await buildApp();
    await sessionStore.update(SID, { absoluteExpiresAt: Date.now() - 1000 } as never);
    const res = await app.fetch(
      new Request("http://bff/me/active-tenant", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: COOKIE },
        body: JSON.stringify({ tenantId: "globex" }),
      }),
    );
    expect(res.status).toBe(401);
  });
});
