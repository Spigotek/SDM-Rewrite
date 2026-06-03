import type { Context, MiddlewareHandler } from "hono";
import type { RuntimeConfig } from "../config/schema";
import { getSessionCookie } from "./cookies";
import type { SessionStore } from "../session/types";
import { toAppErrorBody } from "../auth/errors";
import { AUDIT_EVENTS, type AuditEmitter } from "../platform/audit";

/**
 * I.3 — Tenant header hardening, both directions:
 *
 *  1. **Inbound forge rejection (FE → BFF)**: per `multi-tenancy.md §5.3` the
 *     `X-CA-SDM-Tenant` header is informational + audit-friendly only —
 *     authority is the server-side session. A request that carries the
 *     header with a value that doesn't match `session.activeTenantId` is a
 *     tamper attempt: reject with 403 + audit `authz.tenant.switch.denied`
 *     (`details.reason: "header_forgery"`). A missing header is fine; a
 *     mismatched header is not.
 *
 *  2. **Outbound response stamping (BFF → FE)**: every response with an
 *     authenticated caller carries `X-Response-Tenant: <activeTenantId>` so
 *     the `@sdm/api-client` HttpClient can detect a tenant-race condition
 *     (response arrives after a tenant switch) before passing the payload
 *     to React state. The header is set unconditionally for sessioned
 *     responses — including 4xx — so an L12 race that surfaces as a 404
 *     still gives the client enough context to discard the stale answer.
 *
 *  The middleware reads the session cookie only (no idle-expiry side
 *  effects); a missing cookie short-circuits both branches (the auth
 *  middleware on the protected route handles unauthenticated callers).
 */

export interface TenantHeaderMiddlewareDeps {
  readonly config: RuntimeConfig;
  readonly sessionStore: SessionStore;
  readonly audit: AuditEmitter;
}

const INBOUND_HEADER = "x-ca-sdm-tenant";
const OUTBOUND_HEADER = "X-Response-Tenant";

export function tenantHeaderMiddleware(deps: TenantHeaderMiddlewareDeps): MiddlewareHandler {
  return async function tenantHeader(c: Context, next: () => Promise<void>) {
    const sid = getSessionCookie(c, deps.config.session.cookieName);
    const session = sid ? await deps.sessionStore.get(sid) : null;

    // (1) Inbound — only check on requests that carry the header AND have an
    // active session to compare against. Anonymous callers can't forge a
    // tenant (no session to lie about); the auth gate on the route handles
    // them with 401.
    if (session) {
      const headerValue = c.req.header(INBOUND_HEADER);
      if (headerValue !== undefined && headerValue !== session.activeTenantId) {
        deps.audit(
          c,
          {
            category: "authz",
            event: AUDIT_EVENTS.authz.TENANT_SWITCH_DENIED,
            result: "denied",
            resultCode: 403,
            reason: "header_forgery",
            tenant: {
              sourceTenantId: session.activeTenantId,
              targetTenantId: headerValue,
            },
            details: { reason: "header_forgery", op: "tenant.header.mismatch" },
          },
          session,
        );
        return c.json(
          toAppErrorBody({
            code: "TENANT_FORBIDDEN",
            message: "Tenant header does not match active session",
            httpStatus: 403,
            details: { reason: "tenant_header_forgery" },
          }),
          403,
        );
      }
    }

    await next();

    // (2) Outbound — stamp every sessioned response so the HttpClient race
    // detector can compare it against `session.activeTenantId` in the SPA.
    // Reads after the response.finalize phase are safe in Hono (headers
    // mutable until the response is flushed by `serve`).
    if (session) {
      c.res.headers.set(OUTBOUND_HEADER, session.activeTenantId);
    }
  };
}

export const X_RESPONSE_TENANT_HEADER = OUTBOUND_HEADER;
export const X_CA_SDM_TENANT_HEADER = "X-CA-SDM-Tenant" as const;
