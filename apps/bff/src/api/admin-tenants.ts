/**
 * J.3 — Dev-only admin endpoint for runtime tenant status flipping.
 *
 * POST /api/admin/tenants/:id/suspend   → status = "suspended"
 * POST /api/admin/tenants/:id/unsuspend → status = "active"
 *
 * Gates:
 *  - Requires active session (`requireActiveSession`).
 *  - Requires `tenant.admin` permission (present in `sp_admin` role per
 *    `packages/domain/src/permissions.ts` SP_ADMIN_PERMISSIONS).
 *  - Returns 403 if either gate fails.
 *
 * Audit: composes under the frozen `authz.tenant.switch.denied` event name
 * with a `details.op` discriminator ("admin.tenant.suspend" |
 * "admin.tenant.unsuspend"). No new audit event names — F.4 taxonomy frozen.
 *
 * After flipping status, publishes `tenant.suspended` to every connected
 * session that has the target tenant in its `tenants[]` array via the event bus.
 * For unsuspend: status is flipped but NO push event is emitted (there is no
 * `tenant.unsuspended` event type — FE learns about restore on next /me call).
 */

import type { Hono } from "hono";
import type { Logger } from "pino";
import { hasPermission, type UIRole } from "@sdm/domain";
import { AUDIT_EVENTS, type AuditEmitter } from "../platform/audit";
import type { RuntimeConfig } from "../config/schema";
import { requireActiveSession } from "../session/load";
import type { SessionStore } from "../session/types";
import { AppErrorException, toAppErrorBody } from "../auth/errors";
import { notifyTenantSuspended, setTenantStatus } from "../auth/tenant-suspension";
import { getCorrelationId } from "../auth/correlation";

export interface AdminTenantsRouteDeps {
  readonly config: RuntimeConfig;
  readonly sessionStore: SessionStore;
  readonly audit: AuditEmitter;
  readonly log: Logger;
}

export function registerAdminTenantsRoutes(app: Hono, deps: AdminTenantsRouteDeps): void {
  app.post("/api/admin/tenants/:id/suspend", async (c) => {
    const correlationId = getCorrelationId(c);

    let session;
    try {
      session = await requireActiveSession(c, deps);
    } catch (err) {
      if (err instanceof AppErrorException) {
        return c.json(
          toAppErrorBody({
            code: err.code,
            message: err.message,
            httpStatus: err.httpStatus,
            correlationId,
          }),
          err.httpStatus as never,
        );
      }
      throw err;
    }

    // Permission gate: require tenant.admin.
    const activeTenant = session.tenants.find((t) => t.id === session.activeTenantId);
    const roles = (activeTenant?.roles.map((r) => r.uiRole) ?? []) as UIRole[];
    if (!hasPermission(roles, "tenant.admin")) {
      deps.audit(
        c,
        {
          category: "authz",
          event: AUDIT_EVENTS.authz.TENANT_SWITCH_DENIED,
          result: "denied",
          resultCode: 403,
          reason: "permission_denied",
          details: {
            op: "admin.tenant.suspend",
            required_permission: "tenant.admin",
          },
        },
        session,
      );
      return c.json(
        toAppErrorBody({
          code: "AUTH_FORBIDDEN",
          message: "tenant.admin permission required",
          httpStatus: 403,
          correlationId,
        }),
        403,
      );
    }

    const targetTenantId = c.req.param("id");

    setTenantStatus(targetTenantId, "suspended");
    await notifyTenantSuspended(deps.sessionStore, targetTenantId, "admin.tenant.suspend");

    deps.audit(
      c,
      {
        category: "authz",
        event: AUDIT_EVENTS.authz.TENANT_SWITCH_DENIED,
        result: "denied",
        resultCode: 200,
        details: {
          op: "admin.tenant.suspend",
          target_tenant_id: targetTenantId,
          actor_id: session.userId,
        },
      },
      session,
    );

    deps.log.info(
      { event: "admin.tenant.suspend", tenantId: targetTenantId, actorId: session.userId },
      "tenant suspended by admin",
    );

    c.status(204);
    return c.body(null);
  });

  app.post("/api/admin/tenants/:id/unsuspend", async (c) => {
    const correlationId = getCorrelationId(c);

    let session;
    try {
      session = await requireActiveSession(c, deps);
    } catch (err) {
      if (err instanceof AppErrorException) {
        return c.json(
          toAppErrorBody({
            code: err.code,
            message: err.message,
            httpStatus: err.httpStatus,
            correlationId,
          }),
          err.httpStatus as never,
        );
      }
      throw err;
    }

    const activeTenant = session.tenants.find((t) => t.id === session.activeTenantId);
    const roles = (activeTenant?.roles.map((r) => r.uiRole) ?? []) as UIRole[];
    if (!hasPermission(roles, "tenant.admin")) {
      deps.audit(
        c,
        {
          category: "authz",
          event: AUDIT_EVENTS.authz.TENANT_SWITCH_DENIED,
          result: "denied",
          resultCode: 403,
          reason: "permission_denied",
          details: {
            op: "admin.tenant.unsuspend",
            required_permission: "tenant.admin",
          },
        },
        session,
      );
      return c.json(
        toAppErrorBody({
          code: "AUTH_FORBIDDEN",
          message: "tenant.admin permission required",
          httpStatus: 403,
          correlationId,
        }),
        403,
      );
    }

    const targetTenantId = c.req.param("id");

    setTenantStatus(targetTenantId, "active");
    // No push event for unsuspend — FE learns via next /me call.

    deps.audit(
      c,
      {
        category: "authz",
        event: AUDIT_EVENTS.authz.TENANT_SWITCH_DENIED,
        result: "success",
        resultCode: 200,
        details: {
          op: "admin.tenant.unsuspend",
          target_tenant_id: targetTenantId,
          actor_id: session.userId,
        },
      },
      session,
    );

    deps.log.info(
      { event: "admin.tenant.unsuspend", tenantId: targetTenantId, actorId: session.userId },
      "tenant unsuspended by admin",
    );

    c.status(204);
    return c.body(null);
  });
}
