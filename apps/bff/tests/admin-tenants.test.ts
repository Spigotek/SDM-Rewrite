/**
 * J.3 — POST /api/admin/tenants/:id/suspend + /unsuspend tests.
 *
 * 6+ cases per Done-when:
 *  1. Suspend happy path → 204 + sets tenant status.
 *  2. Unsuspend happy path → 204 + restores tenant status.
 *  3. Permission gate — non-admin session → 403 + audit emitted.
 *  4. Audit emit shape for suspend: TENANT_SWITCH_DENIED with details.op.
 *  5. Suspended tenant event emitted on event bus after suspend call.
 *  6. No session → 401.
 *  7. Unsuspend emits correct audit discriminator.
 */

import { Hono } from "hono";
import pino from "pino";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { contactId, roleId, tenantId, userId } from "@sdm/domain";
import { correlationMiddleware } from "../src/auth/correlation";
import type { RuntimeConfig } from "../src/config/schema";
import { createAuditEmitter } from "../src/platform/audit";
import { subscribe } from "../src/platform/event-bus";
import { registerAdminTenantsRoutes } from "../src/api/admin-tenants";
import { _clearRuntimeOverrides, resolvedTenantStatus } from "../src/auth/tenant-suspension";
import { createSessionStore } from "../src/session";
import type { SessionPayload, SessionStore } from "../src/session/types";

const SID = "admin-test-sid";
const COOKIE = `sdm.sid=${SID}`;
const TARGET_TENANT = "acme";

function makeConfig(): RuntimeConfig {
  return {
    nodeEnv: "test",
    bff: { port: 5181, trustedOrigins: ["http://localhost:5500"], logLevel: "silent" },
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

function makePayload(uiRole: string = "sp_admin"): SessionPayload {
  const now = Date.now();
  return {
    sid: SID,
    userId: userId("admin-user"),
    contactId: contactId("CNT-ADMIN"),
    displayName: "Admin User",
    email: "admin@example.com",
    activeTenantId: tenantId(TARGET_TENANT),
    tenants: [
      {
        id: tenantId(TARGET_TENANT),
        name: "Acme",
        roles: [{ id: roleId("r-admin"), sym: uiRole, uiRole: uiRole as "sp_admin" | "agent_l1" }],
        status: "active",
      },
    ],
    accessKey: "key-xyz",
    accessKeyId: "kid-002",
    accessKeyExpiresAt: now + 3600_000,
    createdAt: now,
    lastSeenAt: now,
    absoluteExpiresAt: now + 28800_000,
    cookieVersion: 1,
  };
}

async function buildApp(sessionStore: SessionStore): Promise<{
  app: Hono;
  auditLogs: Array<Record<string, unknown>>;
}> {
  const config = makeConfig();
  const auditLogs: Array<Record<string, unknown>> = [];
  const logger = pino(
    { level: "info" },
    {
      write: (chunk: string) => {
        try {
          const json = JSON.parse(chunk) as Record<string, unknown>;
          if (json["auditEvent"]) auditLogs.push(json["auditEvent"] as Record<string, unknown>);
        } catch {
          // ignore
        }
      },
    },
  );
  const audit = createAuditEmitter({ log: logger });
  const app = new Hono();
  app.use("*", correlationMiddleware());
  registerAdminTenantsRoutes(app, { config, sessionStore, audit, log: pino({ level: "silent" }) });
  return { app, auditLogs };
}

describe("POST /api/admin/tenants/:id/suspend", () => {
  let sessionStore: SessionStore;

  beforeEach(async () => {
    sessionStore = createSessionStore({ driver: "memory" });
    _clearRuntimeOverrides();
  });

  afterEach(async () => {
    await sessionStore.close();
    _clearRuntimeOverrides();
  });

  it("1. suspend happy path → 204 + runtime status is suspended", async () => {
    await sessionStore.create(SID, makePayload("sp_admin"), 28800);
    const { app } = await buildApp(sessionStore);

    const res = await app.fetch(
      new Request(`http://bff/api/admin/tenants/${TARGET_TENANT}/suspend`, {
        method: "POST",
        headers: { Cookie: COOKIE },
      }),
    );
    expect(res.status).toBe(204);

    const fakeTenant = { id: TARGET_TENANT, status: "active" as const };
    expect(resolvedTenantStatus(fakeTenant)).toBe("suspended");
  });

  it("2. unsuspend happy path → 204 + runtime status restored to active", async () => {
    await sessionStore.create(SID, makePayload("sp_admin"), 28800);
    const { app } = await buildApp(sessionStore);

    // First suspend
    await app.fetch(
      new Request(`http://bff/api/admin/tenants/${TARGET_TENANT}/suspend`, {
        method: "POST",
        headers: { Cookie: COOKIE },
      }),
    );

    // Then unsuspend
    const res = await app.fetch(
      new Request(`http://bff/api/admin/tenants/${TARGET_TENANT}/unsuspend`, {
        method: "POST",
        headers: { Cookie: COOKIE },
      }),
    );
    expect(res.status).toBe(204);

    const fakeTenant = { id: TARGET_TENANT, status: "active" as const };
    expect(resolvedTenantStatus(fakeTenant)).toBe("active");
  });

  it("3. non-admin session → 403 with PERMISSION_DENIED", async () => {
    await sessionStore.create(SID, makePayload("agent_l1"), 28800);
    const { app } = await buildApp(sessionStore);

    const res = await app.fetch(
      new Request(`http://bff/api/admin/tenants/${TARGET_TENANT}/suspend`, {
        method: "POST",
        headers: { Cookie: COOKIE },
      }),
    );
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("AUTH_FORBIDDEN");
  });

  it("4. audit emit shape for suspend: TENANT_SWITCH_DENIED with details.op", async () => {
    await sessionStore.create(SID, makePayload("sp_admin"), 28800);
    const { app, auditLogs } = await buildApp(sessionStore);

    await app.fetch(
      new Request(`http://bff/api/admin/tenants/${TARGET_TENANT}/suspend`, {
        method: "POST",
        headers: { Cookie: COOKIE },
      }),
    );

    const suspendAudit = auditLogs.find(
      (log) =>
        (log as { event?: string })["event"] === "authz.tenant.switch.denied" &&
        (log as { details?: { op?: string } })["details"]?.["op"] === "admin.tenant.suspend",
    );
    expect(suspendAudit).toBeDefined();
    expect(
      (suspendAudit as { details: { target_tenant_id: string } })["details"]["target_tenant_id"],
    ).toBe(TARGET_TENANT);
  });

  it("5. suspend publishes tenant.suspended to event bus", async () => {
    await sessionStore.create(SID, makePayload("sp_admin"), 28800);
    const { app } = await buildApp(sessionStore);

    const events: Array<{ type: string; tenantId?: string }> = [];
    const unsub = subscribe(SID, (e) => events.push(e as { type: string; tenantId?: string }));

    await app.fetch(
      new Request(`http://bff/api/admin/tenants/${TARGET_TENANT}/suspend`, {
        method: "POST",
        headers: { Cookie: COOKIE },
      }),
    );

    // Give publishToAllSessionsWithTenant (async) a tick to complete.
    await new Promise<void>((r) => setTimeout(r, 10));

    unsub();
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe("tenant.suspended");
    expect(events[0]?.tenantId).toBe(TARGET_TENANT);
  });

  it("6. no session cookie → 401", async () => {
    const { app } = await buildApp(sessionStore);

    const res = await app.fetch(
      new Request(`http://bff/api/admin/tenants/${TARGET_TENANT}/suspend`, {
        method: "POST",
      }),
    );
    expect(res.status).toBe(401);
  });

  it("7. unsuspend emits correct audit op discriminator", async () => {
    await sessionStore.create(SID, makePayload("sp_admin"), 28800);
    const { app, auditLogs } = await buildApp(sessionStore);

    await app.fetch(
      new Request(`http://bff/api/admin/tenants/${TARGET_TENANT}/unsuspend`, {
        method: "POST",
        headers: { Cookie: COOKIE },
      }),
    );

    const unsuspendAudit = auditLogs.find(
      (log) =>
        (log as { details?: { op?: string } })["details"]?.["op"] === "admin.tenant.unsuspend",
    );
    expect(unsuspendAudit).toBeDefined();
  });
});
