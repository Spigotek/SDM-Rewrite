import { publishToAllSessionsWithTenant } from "../platform/event-bus";
import type { SessionPayload, SessionStore, SessionTenant, TenantStatus } from "../session/types";
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

export function isActiveTenant(tenant: Pick<SessionTenant, "id" | "status">): boolean {
  return resolvedTenantStatus(tenant) === "active";
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

// =============================================================================
// J.3 — Runtime suspension override map + notify helper
// =============================================================================

/**
 * Runtime override map for tenant status. This is the authoritative source
 * for status changes made via the admin endpoint (`POST /api/admin/tenants/:id/
 * {suspend,unsuspend}`). On `/me` and `/me/tenants` reads, `resolvedTenantStatus`
 * applies this map's value when present; falls back to the embedded session value.
 *
 * Intentionally module-level (singleton per BFF process). Multi-instance
 * deploys require a Redis-backed adapter — v2.0 scope.
 */
const runtimeStatusOverrides = new Map<string, TenantStatus>();

/** Apply the runtime override map to a tenant's base status. */
export function resolvedTenantStatus(tenant: Pick<SessionTenant, "id" | "status">): TenantStatus {
  return runtimeStatusOverrides.get(tenant.id) ?? tenantStatus(tenant);
}

/** Flip the runtime status for a tenant. Called by the admin endpoint. */
export function setTenantStatus(tenantId: string, status: TenantStatus): void {
  runtimeStatusOverrides.set(tenantId, status);
}

/**
 * Publish a `tenant.suspended` event to all sessions that have the tenant in
 * their `tenants[]` array, then reset the override map for unsuspend.
 *
 * @param sessionStore - needed to find affected sessions via `findSessionIdsWithTenant`.
 * @param tenantId - the tenant being (un)suspended.
 * @param reason - human-readable reason (e.g. "admin.tenant.suspend").
 */
export async function notifyTenantSuspended(
  sessionStore: SessionStore,
  tenantId: string,
  reason: string,
): Promise<void> {
  const sessionIds = await sessionStore.findSessionIdsWithTenant(tenantId);
  publishToAllSessionsWithTenant(Array.from(sessionIds), {
    type: "tenant.suspended",
    tenantId,
    reason,
    at: new Date().toISOString(),
  });
}

/** Exposed for tests — clear all runtime overrides. */
export function _clearRuntimeOverrides(): void {
  runtimeStatusOverrides.clear();
}
