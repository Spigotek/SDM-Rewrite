import type { Hono } from "hono";
import type { Logger } from "pino";
import { z } from "zod";
import { AUDIT_EVENTS, type AuditEmitter } from "../platform/audit";
import type { RuntimeConfig } from "../config/schema";
import { requireActiveSession } from "../session/load";
import type { SessionStore } from "../session/types";
import { AppErrorException, toAppErrorBody } from "./errors";
import { consumeStepUpToken } from "./step-up-token";

/**
 * I.5 — SP cockpit / cross-tenant view.
 *
 * Three endpoints + a tiny in-memory view-as store:
 *
 *  - `GET  /me/sp-tenants`     — list tenants the caller has `sp_admin` in.
 *  - `POST /api/sp/view-as`    — set the session's "viewing as" tenant; gated
 *                                by a step-up token (X-Step-Up-Token) so
 *                                impersonation is a deliberate action that
 *                                lands in the audit trail with a fresh MFA
 *                                check.
 *  - `DELETE /api/sp/view-as`  — clear the view-as context.
 *
 * Audit taxonomy: per D6 frozen taxonomy, impersonation start/stop reuse the
 * existing `authz.tenant.switch.{success,denied}` event names with a
 * `details.op = "sp.view_as.start" | "sp.view_as.stop" | "sp.view_as.denied_step_up"`
 * discriminator. The H.11 precedent (cab.approve via data.chg.write) sets the
 * pattern.
 *
 * In-memory store: same constraint as the step-up token store — single
 * instance only. Multi-instance deployments need Redis (out-of-MVP per
 * multi-tenancy-security.md §6). The store sweeps expired entries lazily on
 * each lookup.
 */

const VIEW_AS_TTL_MS = 60 * 60_000; // 1h per plan I.5 §Fáza A
const STEP_UP_HEADER = "x-step-up-token";
const SP_ADMIN_ROLE = "sp_admin" as const;

interface ViewAsEntry {
  readonly sessionId: string;
  readonly tenantId: string;
  readonly expiresAt: number;
}

const viewAsStore = new Map<string, ViewAsEntry>();

function sweepExpired(nowMs: number): void {
  for (const [sid, entry] of viewAsStore) {
    if (entry.expiresAt < nowMs) viewAsStore.delete(sid);
  }
}

/**
 * Public read API — the REST proxy / scoping middleware can consult this to
 * see if the caller is currently viewing-as a specific tenant. Returns the
 * tenant id when the entry is still valid; `null` otherwise.
 */
export function getViewAsTenant(sessionId: string, nowMs: number = Date.now()): string | null {
  sweepExpired(nowMs);
  const entry = viewAsStore.get(sessionId);
  if (!entry) return null;
  if (entry.expiresAt < nowMs) {
    viewAsStore.delete(sessionId);
    return null;
  }
  return entry.tenantId;
}

/** Test hook — clears the store between cases. Not re-exported from index. */
export function _resetViewAsStoreForTests(): void {
  viewAsStore.clear();
}

const ViewAsBodySchema = z.object({
  tenantId: z.string().min(1),
});

export interface SpImpersonationRouteDeps {
  readonly config: RuntimeConfig;
  readonly sessionStore: SessionStore;
  readonly audit: AuditEmitter;
  readonly log: Logger;
  /** Override clock for tests. */
  readonly now?: () => number;
  /** Skip the step-up gate — only valid for tests that exercise the unrelated
   *  branches (cross-tenant query, expiry). Defaults to `false`. */
  readonly skipStepUp?: boolean;
}

export function registerSpImpersonationRoutes(app: Hono, deps: SpImpersonationRouteDeps): void {
  const now = deps.now ?? Date.now;

  app.get("/me/sp-tenants", async (c) => {
    const correlationId = c.get("correlationId") as string;
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

    const spTenants = session.tenants
      .filter((t) => t.roles.some((r) => r.uiRole === SP_ADMIN_ROLE))
      .map((t) => ({ id: t.id, name: t.name }));

    return c.json({ tenants: spTenants }, 200);
  });

  app.post("/api/sp/view-as", async (c) => {
    const correlationId = c.get("correlationId") as string;
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

    let body: z.infer<typeof ViewAsBodySchema>;
    try {
      body = ViewAsBodySchema.parse(await c.req.json());
    } catch (err) {
      return c.json(
        toAppErrorBody({
          code: "VALIDATION",
          message: "Invalid view-as payload",
          httpStatus: 400,
          correlationId,
          details: err instanceof z.ZodError ? err.flatten().fieldErrors : undefined,
        }),
        400,
      );
    }

    const targetTenant = session.tenants.find((t) => t.id === body.tenantId);
    const isSpAdminOnTarget =
      !!targetTenant && targetTenant.roles.some((r) => r.uiRole === SP_ADMIN_ROLE);
    if (!targetTenant || !isSpAdminOnTarget) {
      deps.audit(
        c,
        {
          category: "authz",
          event: AUDIT_EVENTS.authz.TENANT_SWITCH_DENIED,
          result: "denied",
          resultCode: 403,
          reason: "sp_admin_required",
          tenant: { sourceTenantId: session.activeTenantId, targetTenantId: body.tenantId },
          details: { op: "sp.view_as.start", reason: "sp_admin_required" },
        },
        session,
      );
      return c.json(
        toAppErrorBody({
          code: "TENANT_FORBIDDEN",
          message: "Caller is not sp_admin on the target tenant",
          httpStatus: 403,
          correlationId,
          details: { reason: "sp_admin_required" },
        }),
        403,
      );
    }

    if (!deps.skipStepUp) {
      const token = c.req.header(STEP_UP_HEADER);
      const ok =
        typeof token === "string" && token.length > 0
          ? consumeStepUpToken(token, session.sid)
          : false;
      if (!ok) {
        deps.audit(
          c,
          {
            category: "authz",
            event: AUDIT_EVENTS.authz.TENANT_SWITCH_DENIED,
            result: "denied",
            resultCode: 401,
            reason: "step_up_required",
            tenant: { sourceTenantId: session.activeTenantId, targetTenantId: body.tenantId },
            details: {
              op: "sp.view_as.denied_step_up",
              reason: token ? "invalid_or_replayed" : "missing",
            },
          },
          session,
        );
        return c.json(
          toAppErrorBody({
            code: "STEP_UP_REQUIRED",
            message: "Step-up authentication required for SP impersonation",
            httpStatus: 401,
            correlationId,
            details: { reason: token ? "invalid_or_replayed" : "missing" },
          }),
          401,
        );
      }
    }

    const nowMs = now();
    viewAsStore.set(session.sid, {
      sessionId: session.sid,
      tenantId: body.tenantId,
      expiresAt: nowMs + VIEW_AS_TTL_MS,
    });

    deps.audit(
      c,
      {
        category: "authz",
        event: AUDIT_EVENTS.authz.TENANT_SWITCH_SUCCESS,
        result: "success",
        resultCode: 200,
        tenant: { sourceTenantId: session.activeTenantId, targetTenantId: body.tenantId },
        details: {
          op: "sp.view_as.start",
          impersonating_tenant: body.tenantId,
          ttlSec: VIEW_AS_TTL_MS / 1000,
        },
      },
      session,
    );

    return c.json(
      {
        viewingAsTenantId: body.tenantId,
        expiresAt: new Date(nowMs + VIEW_AS_TTL_MS).toISOString(),
      },
      200,
    );
  });

  app.delete("/api/sp/view-as", async (c) => {
    const correlationId = c.get("correlationId") as string;
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

    const prior = viewAsStore.get(session.sid);
    viewAsStore.delete(session.sid);

    deps.audit(
      c,
      {
        category: "authz",
        event: AUDIT_EVENTS.authz.TENANT_SWITCH_SUCCESS,
        result: "success",
        resultCode: 200,
        tenant: {
          sourceTenantId: prior?.tenantId ?? session.activeTenantId,
          targetTenantId: session.activeTenantId,
        },
        details: { op: "sp.view_as.stop", cleared_tenant: prior?.tenantId ?? null },
      },
      session,
    );

    return c.json({ viewingAsTenantId: null }, 200);
  });
}
