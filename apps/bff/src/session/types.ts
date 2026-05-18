import type { ContactId, RoleId, TenantId, UIRole, UserId } from "@sdm/domain";

export interface SessionTenantRole {
  readonly id: RoleId;
  readonly sym: string;
  readonly uiRole: UIRole;
}

export interface SessionTenant {
  readonly id: TenantId;
  readonly name: string;
  readonly roles: ReadonlyArray<SessionTenantRole>;
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
}
