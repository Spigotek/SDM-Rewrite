import type { Hono } from "hono";
import type { Context } from "hono";
import type { Logger } from "pino";
import { z } from "zod";
import { getPermissionsForRole, type Permission } from "@sdm/domain";
import type { RuntimeConfig } from "../config/schema";
import { AUDIT_EVENTS, type AuditEmitter } from "../platform/audit";
import { getSessionCookie } from "../security/cookies";
import type { SessionPayload, SessionStore } from "../session/types";
import { toAppErrorBody } from "../auth/errors";

export interface MeRouteDeps {
  readonly config: RuntimeConfig;
  readonly sessionStore: SessionStore;
  readonly log: Logger;
  readonly audit: AuditEmitter;
}

const ActiveTenantSchema = z.object({
  tenantId: z.string().min(1),
});

export function registerMeRoutes(app: Hono, deps: MeRouteDeps): void {
  app.get("/me", async (c) => {
    const correlationId = c.get("correlationId");
    const sid = getSessionCookie(c, deps.config.session.cookieName);
    if (!sid) return unauthorized(c, correlationId);
    const payload = await deps.sessionStore.get(sid);
    if (!payload) return unauthorized(c, correlationId);

    if (await sessionExpired(deps, sid, payload)) {
      return unauthorized(c, correlationId);
    }
    await deps.sessionStore.touch(sid, Date.now());

    const activeTenant = payload.tenants.find((t) => t.id === payload.activeTenantId);
    if (!activeTenant) {
      // Defensive: this should never happen — login always seeds activeTenantId from tenants[0].
      deps.log.error(
        {
          event: "me.active_tenant.missing",
          activeTenantId: payload.activeTenantId,
          correlationId,
        },
        "active tenant not in session.tenants[]",
      );
      return c.json(
        toAppErrorBody({
          code: "UNKNOWN",
          message: "Active tenant missing from session",
          httpStatus: 500,
          correlationId,
        }),
        500,
      );
    }

    const effectivePermissions = computeEffectivePermissions(
      activeTenant.roles.map((r) => r.uiRole),
    );
    const primaryRole = activeTenant.roles[0]?.uiRole ?? "requester";

    return c.json(
      {
        user: {
          id: payload.contactId,
          userId: payload.userId,
          email: payload.email,
          displayName: payload.displayName,
        },
        tenants: payload.tenants.map((t) => ({
          id: t.id,
          name: t.name,
          isServiceProvider: false,
          roles: t.roles.map((r) => ({ id: r.id, name: r.sym, uiRole: r.uiRole })),
        })),
        activeTenant: {
          id: activeTenant.id,
          activeRoleId: activeTenant.roles[0]?.id ?? "",
          effectivePermissions,
        },
        uiRole: primaryRole,
        app:
          primaryRole === "requester" || primaryRole === "requester_external"
            ? "portal"
            : "workspace",
        // F.1 — Origin/Referer check is the CSRF strategy (no double-submit token). Stub kept for §4.5 shape parity until F.5 aligns the canonical shape.
        csrfToken: "",
        featureFlags: {},
        i18n: { locale: "sk" as const, tz: "Europe/Bratislava" },
        session: {
          idleTimeoutSec: deps.config.session.idleSec,
          absoluteExpiresAt: new Date(payload.absoluteExpiresAt).toISOString(),
        },
        correlationId,
      },
      200,
    );
  });

  app.post("/me/active-tenant", async (c) => {
    const correlationId = c.get("correlationId");
    const sid = getSessionCookie(c, deps.config.session.cookieName);
    if (!sid) return unauthorized(c, correlationId);
    const payload = await deps.sessionStore.get(sid);
    if (!payload) return unauthorized(c, correlationId);
    if (await sessionExpired(deps, sid, payload)) return unauthorized(c, correlationId);

    let body: z.infer<typeof ActiveTenantSchema>;
    try {
      body = ActiveTenantSchema.parse(await c.req.json());
    } catch (err) {
      return c.json(
        toAppErrorBody({
          code: "VALIDATION",
          message: "Invalid active-tenant payload",
          httpStatus: 400,
          correlationId,
          details: err instanceof z.ZodError ? err.flatten().fieldErrors : undefined,
        }),
        400,
      );
    }

    const allowed = payload.tenants.find((t) => t.id === body.tenantId);
    if (!allowed) {
      deps.audit(
        c,
        {
          category: "authz",
          event: AUDIT_EVENTS.authz.TENANT_SWITCH_DENIED,
          result: "denied",
          resultCode: 403,
          reason: "tenant_not_in_allowed_list",
          tenant: { sourceTenantId: payload.activeTenantId, targetTenantId: body.tenantId },
        },
        payload,
      );
      return c.json(
        toAppErrorBody({
          code: "TENANT_FORBIDDEN",
          message: "Tenant not in user's allowed list",
          httpStatus: 403,
          correlationId,
        }),
        403,
      );
    }

    await deps.sessionStore.update(sid, {
      activeTenantId: allowed.id,
      cookieVersion: payload.cookieVersion + 1,
      lastSeenAt: Date.now(),
    });
    deps.audit(
      c,
      {
        category: "authz",
        event: AUDIT_EVENTS.authz.TENANT_SWITCH_SUCCESS,
        result: "success",
        resultCode: 200,
        tenant: { sourceTenantId: payload.activeTenantId, targetTenantId: allowed.id },
        details: { newRoleId: allowed.roles[0]?.id ?? null },
      },
      payload,
    );

    return c.json(
      {
        activeTenant: {
          id: allowed.id,
          activeRoleId: allowed.roles[0]?.id ?? "",
          effectivePermissions: computeEffectivePermissions(allowed.roles.map((r) => r.uiRole)),
        },
      },
      200,
    );
  });
}

async function sessionExpired(
  deps: MeRouteDeps,
  sid: string,
  payload: SessionPayload,
): Promise<boolean> {
  const nowMs = Date.now();
  if (nowMs > payload.absoluteExpiresAt) {
    await deps.sessionStore.destroy(sid);
    return true;
  }
  if (nowMs - payload.lastSeenAt > deps.config.session.idleSec * 1000) {
    await deps.sessionStore.destroy(sid);
    return true;
  }
  return false;
}

function computeEffectivePermissions(roles: ReadonlyArray<string>): Permission[] {
  const out = new Set<Permission>();
  for (const role of roles) {
    for (const p of getPermissionsForRole(role as never)) out.add(p);
  }
  return Array.from(out);
}

function unauthorized(c: Context, correlationId: string) {
  return c.json({ error: "unauthorized" as const, correlationId }, 401);
}
