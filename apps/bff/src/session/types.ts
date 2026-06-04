import type { ContactId, RoleId, TenantId, UIRole, UserId } from "@sdm/domain";

export interface SessionTenantRole {
  readonly id: RoleId;
  readonly sym: string;
  readonly uiRole: UIRole;
}

/**
 * I.3 — Tenant lifecycle status. `"active"` is the default; `"suspended"` is
 * surfaced by tenant admin (CA SDM `delete_flag=1` or equivalent v1+ admin UI)
 * and blocks both `GET /me/tenants` exposure and `POST /me/active-tenant`
 * switching. Backward-compat: missing field is treated as `"active"` so older
 * session payloads in flight at deploy time keep working.
 */
export type TenantStatus = "active" | "suspended";

export interface SessionTenant {
  readonly id: TenantId;
  readonly name: string;
  readonly roles: ReadonlyArray<SessionTenantRole>;
  readonly status?: TenantStatus;
}

export interface SessionPayload {
  readonly sid: string;
  readonly userId: UserId;
  readonly contactId: ContactId;
  readonly displayName: string;
  readonly email: string;
  activeTenantId: TenantId;
  readonly tenants: ReadonlyArray<SessionTenant>;
  accessKey: string;
  accessKeyId: string;
  accessKeyExpiresAt: number;
  readonly createdAt: number;
  lastSeenAt: number;
  readonly absoluteExpiresAt: number;
  cookieVersion: number;
}

export interface SessionStore {
  create(id: string, payload: SessionPayload, ttlSec: number): Promise<void>;
  get(id: string): Promise<SessionPayload | null>;
  touch(id: string, lastSeenAt: number): Promise<void>;
  update(
    id: string,
    partial: Partial<Omit<SessionPayload, "sid" | "createdAt" | "absoluteExpiresAt">>,
  ): Promise<void>;
  destroy(id: string): Promise<void>;
  close(): Promise<void>;
  /**
   * J.3 — Return all session IDs whose `tenants[]` array contains the given
   * tenantId. Used by the event bus to fan out `tenant.suspended` events to
   * every session that could be affected by a runtime suspension.
   */
  findSessionIdsWithTenant(tenantId: string): Promise<readonly string[]>;
}
