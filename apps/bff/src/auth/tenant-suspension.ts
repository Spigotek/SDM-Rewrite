import type { SessionPayload, SessionTenant, TenantStatus } from "../session/types";
import { AppErrorException } from "./errors";

/**
 * I.3 — Tenant suspension helpers.
 *
 * Two enforcement points, both server-authoritative:
 *  1. `GET /me/tenants` — `filterActiveTenants()` strips suspended entries
 *     before the response so the FE never renders them in the switcher.
 *  2. `POST /me/active-tenant` — `assertTenantActive()` throws
 *     `TENANT_FORBIDDEN` (httpStatus 403) with `details.reason: "suspended"`
 *     so the audit emitter can dispatch `authz.tenant.switch.denied` and the
 *     FE can pivot to a logout + toast (no taxonomy expansion per D6).
 *
 * Backward-compat: a `SessionTenant` lacking the optional `status` field is
 * treated as `"active"`. New session payloads (post-I.3) populate the field
 * via the broker fan-out; legacy sessions persisted before deploy still log
 * in cleanly. The helpers never read `null` / `undefined` as suspended.
 */

export function tenantStatus(tenant: Pick<SessionTenant, "status">): TenantStatus {
  return tenant.status ?? "active";
}

export function isActiveTenant(tenant: Pick<SessionTenant, "status">): boolean {
  return tenantStatus(tenant) === "active";
}

/**
 * Return only the active tenants from a session — the source `tenants[]`
 * array is preserved by index (no sorting), so callers can map roles 1:1.
 */
export function filterActiveTenants(
  tenants: ReadonlyArray<SessionTenant>,
): ReadonlyArray<SessionTenant> {
  return tenants.filter(isActiveTenant);
}

/**
 * Look up a tenant on a session by id without status filtering. Returns
 * `undefined` when the id is not in the user's `allowedTenants[]` — callers
 * must distinguish "tenant not allowed" (403 forbidden) from "tenant allowed
 * but suspended" (403 suspended) to log the right audit reason.
 */
export function findTenant(
  session: Pick<SessionPayload, "tenants">,
  tenantId: string,
): SessionTenant | undefined {
  return session.tenants.find((t) => t.id === tenantId);
}

export interface SuspensionDenyDetails {
  readonly sourceTenantId: string;
  readonly targetTenantId: string;
}

/**
 * Throw if the target tenant is suspended. Caller is responsible for the
 * "tenant not in allowed list" check first — this helper assumes the target
 * exists in the session.
 *
 * The error carries `details.reason: "suspended"` so the audit emitter can
 * route it to `authz.tenant.switch.denied` without inventing a new event
 * name (D6 frozen audit taxonomy).
 */
export function assertTenantActive(target: SessionTenant, refs: SuspensionDenyDetails): void {
  if (isActiveTenant(target)) return;
  throw new AppErrorException({
    code: "TENANT_FORBIDDEN",
    httpStatus: 403,
    message: "Tenant is suspended — switch denied",
    details: {
      reason: "suspended",
      sourceTenantId: refs.sourceTenantId,
      targetTenantId: refs.targetTenantId,
    },
  });
}
