import { Hono } from "hono";
import pino from "pino";
import { describe, expect, it, vi } from "vitest";
import { contactId, roleId, tenantId, userId } from "@sdm/domain";
import { registerMeRoutes } from "../../src/aggregator/me";
import { createMeTenantsState, registerMeTenantsRoutes } from "../../src/aggregator/me-tenants";
import { correlationMiddleware } from "../../src/auth/correlation";
import { AppErrorException, toAppErrorBody } from "../../src/auth/errors";
import {
  assertTenantActive,
  filterActiveTenants,
  isActiveTenant,
} from "../../src/auth/tenant-suspension";
import type { RuntimeConfig } from "../../src/config/schema";
import { AUDIT_EVENTS, createAuditEmitter } from "../../src/platform/audit";
import { createSessionStore } from "../../src/session";
import type { SessionPayload, SessionStore, SessionTenant } from "../../src/session/types";

/**
 * I.3 — Tenant suspension contract.
 *
 * Six scenarios per `docs/plans/I.3.md` Fáza A Done-when:
 *  1. Active tenant happy path — GET /me/tenants returns the active tenant.
 *  2. Suspended tenant is filtered from GET /me/tenants.
 *  3. POST /me/active-tenant against a suspended tenant → 403 + audit
 *     `authz.tenant.switch.denied` with `details.reason: "suspended"`.
 *  4. Admin restore (suspended → active) unblocks the switch.
 *  5. Audit envelope shape matches F.4 canonical taxonomy (frozen per D6).
 *  6. The `assertTenantActive` helper itself rejects suspended tenants with
 *     `TENANT_FORBIDDEN` (unit-level guard for the suspension module).
 */

const ACTIVE_TENANT = "tenant-active";
const SUSPENDED_TENANT = "tenant-suspended";

function makeConfig(): RuntimeConfig {
  return {
    nodeEnv: "test",
    bff: { port: 5174, trustedOrigins: ["http://localhost:5500"], logLevel: "fatal" },
    casdm: {
      baseUrl: "http://x.local",
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

interface AppRig {
  readonly app: Hono;
  readonly sessionStore: SessionStore;
  readonly auditSpy: ReturnType<typeof vi.fn>;
  readonly sid: string;
  readonly payload: SessionPayload;
  readonly setSuspended: (tenantId: string, suspended: boolean) => Promise<void>;
}

async function buildRig(): Promise<AppRig> {
  const config = makeConfig();
  const log = pino({ level: "silent" });
  const sessionStore = createSessionStore({ driver: "memory" });

  const sid = "suspend-sid-1";
  const now = Date.now();
  const tenants: ReadonlyArray<SessionTenant> = [
    {
      id: tenantId(ACTIVE_TENANT),
      name: "Active Inc.",
      roles: [{ id: roleId("r-active"), sym: "agent_l1", uiRole: "agent_l1" }],
      status: "active",
    },
    {
      id: tenantId(SUSPENDED_TENANT),
      name: "Suspended Ltd.",
      roles: [{ id: roleId("r-susp"), sym: "agent_l1", uiRole: "agent_l1" }],
      status: "suspended",
    },
  ];
  const payload: SessionPayload = {
    sid,
    userId: userId("u-1"),
    contactId: contactId("U'CNT'"),
    displayName: "Anna, Analyst",
    email: "anna@example",
    activeTenantId: tenantId(ACTIVE_TENANT),
    tenants,
    accessKey: "key",
    accessKeyId: "kid",
    accessKeyExpiresAt: now + 3600_000,
    createdAt: now,
    lastSeenAt: now,
    absoluteExpiresAt: now + 28800_000,
    cookieVersion: 1,
  };
  await sessionStore.create(sid, payload, 28800);

  // Spy on audit so per-test assertions can inspect the emitted event shape.
  const realAudit = createAuditEmitter({ log });
  const auditSpy = vi.fn(realAudit);

  const app = new Hono();
  app.use("*", correlationMiddleware());
  registerMeRoutes(app, { config, sessionStore, log, audit: auditSpy });
  registerMeTenantsRoutes(app, { config, sessionStore, log }, createMeTenantsState());
  app.onError((err, c) => {
    if (err instanceof AppErrorException) {
      return c.json(
        toAppErrorBody({ code: err.code, message: err.message, httpStatus: err.httpStatus }),
        err.httpStatus as never,
      );
    }
    return c.json({ error: "internal_error" }, 500);
  });

  return {
    app,
    sessionStore,
    auditSpy,
    sid,
    payload,
    async setSuspended(targetId: string, suspended: boolean): Promise<void> {
      const live = await sessionStore.get(sid);
      if (!live) throw new Error("rig session vanished");
      const nextTenants = live.tenants.map((t) =>
        t.id === targetId
          ? { ...t, status: suspended ? ("suspended" as const) : ("active" as const) }
          : t,
      );
      await sessionStore.update(sid, { tenants: nextTenants } as never);
    },
  };
}

describe("tenant suspension — module helpers", () => {
  it("isActiveTenant treats missing status as active (backward-compat)", () => {
    expect(isActiveTenant({ status: undefined })).toBe(true);
    expect(isActiveTenant({ status: "active" })).toBe(true);
    expect(isActiveTenant({ status: "suspended" })).toBe(false);
  });

  it("filterActiveTenants strips suspended entries preserving order", () => {
    const input: ReadonlyArray<SessionTenant> = [
      { id: tenantId("a"), name: "A", roles: [], status: "active" },
      { id: tenantId("s"), name: "S", roles: [], status: "suspended" },
      { id: tenantId("b"), name: "B", roles: [] },
    ];
    const filtered = filterActiveTenants(input);
    expect(filtered.map((t) => t.id)).toEqual(["a", "b"]);
  });

  it("assertTenantActive throws TENANT_FORBIDDEN with details.reason=suspended", () => {
    let err: unknown;
    try {
      assertTenantActive(
        { id: tenantId("s"), name: "S", roles: [], status: "suspended" },
        { sourceTenantId: "a", targetTenantId: "s" },
      );
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(AppErrorException);
    expect((err as AppErrorException).code).toBe("TENANT_FORBIDDEN");
    expect((err as AppErrorException).httpStatus).toBe(403);
    expect((err as AppErrorException).details).toMatchObject({ reason: "suspended" });
  });
});

describe("tenant suspension — GET /me/tenants", () => {
  it("happy path lists the active tenant", async () => {
    const rig = await buildRig();
    const res = await rig.app.fetch(
      new Request("http://bff/me/tenants", {
        headers: { Cookie: `sdm.sid=${rig.sid}` },
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { tenants: Array<{ id: string }> };
    const ids = body.tenants.map((t) => t.id);
    expect(ids).toContain(ACTIVE_TENANT);
  });

  it("filters suspended tenants from the payload", async () => {
    const rig = await buildRig();
    const res = await rig.app.fetch(
      new Request("http://bff/me/tenants", {
        headers: { Cookie: `sdm.sid=${rig.sid}` },
      }),
    );
    const body = (await res.json()) as { tenants: Array<{ id: string }> };
    const ids = body.tenants.map((t) => t.id);
    expect(ids).not.toContain(SUSPENDED_TENANT);
    expect(ids).toContain(ACTIVE_TENANT);
  });
});

describe("tenant suspension — POST /me/active-tenant", () => {
  it("denies a switch to a suspended tenant with 403 + audit + details.reason=tenant_suspended", async () => {
    const rig = await buildRig();
    const res = await rig.app.fetch(
      new Request("http://bff/me/active-tenant", {
        method: "POST",
        headers: { Cookie: `sdm.sid=${rig.sid}`, "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: SUSPENDED_TENANT }),
      }),
    );
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string; details?: { reason: string } };
    expect(body.error).toBe("TENANT_FORBIDDEN");
    expect(body.details?.reason).toBe("tenant_suspended");

    // Audit assertion — frozen taxonomy: `authz.tenant.switch.denied` with
    // discriminator `details.reason: "suspended"` (D6).
    const denials = rig.auditSpy.mock.calls.filter(
      (c) => (c[1] as { event: string }).event === AUDIT_EVENTS.authz.TENANT_SWITCH_DENIED,
    );
    expect(denials.length).toBeGreaterThanOrEqual(1);
    const denyInput = denials[denials.length - 1]?.[1] as {
      event: string;
      reason?: string;
      details?: { reason?: string };
      tenant?: { sourceTenantId?: string; targetTenantId?: string };
    };
    expect(denyInput.event).toBe("authz.tenant.switch.denied");
    expect(denyInput.reason).toBe("suspended");
    expect(denyInput.details?.reason).toBe("suspended");
    expect(denyInput.tenant?.targetTenantId).toBe(SUSPENDED_TENANT);
  });

  it("admin restore (suspended → active) unblocks the switch on the next call", async () => {
    const rig = await buildRig();
    // Step 1 — denied.
    const before = await rig.app.fetch(
      new Request("http://bff/me/active-tenant", {
        method: "POST",
        headers: { Cookie: `sdm.sid=${rig.sid}`, "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: SUSPENDED_TENANT }),
      }),
    );
    expect(before.status).toBe(403);

    // Step 2 — admin un-suspends. (Simulated via session-store update; the
    // real path goes through a CA SDM admin endpoint that flips delete_flag.)
    await rig.setSuspended(SUSPENDED_TENANT, false);

    // Step 3 — switch now succeeds with 200 + activeTenant pinned to the
    // previously-suspended tenant.
    const after = await rig.app.fetch(
      new Request("http://bff/me/active-tenant", {
        method: "POST",
        headers: { Cookie: `sdm.sid=${rig.sid}`, "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: SUSPENDED_TENANT }),
      }),
    );
    expect(after.status).toBe(200);
    const body = (await after.json()) as { activeTenant: { id: string } };
    expect(body.activeTenant.id).toBe(SUSPENDED_TENANT);
  });

  it("filters suspended tenants from the /me response embedded list", async () => {
    const rig = await buildRig();
    const res = await rig.app.fetch(
      new Request("http://bff/me", {
        headers: { Cookie: `sdm.sid=${rig.sid}` },
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { tenants: Array<{ id: string }> };
    const ids = body.tenants.map((t) => t.id);
    expect(ids).toContain(ACTIVE_TENANT);
    expect(ids).not.toContain(SUSPENDED_TENANT);
  });
});
