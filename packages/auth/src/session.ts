import type { ContactId, Permission, TenantId, UIRole, UserId } from "@sdm/domain";

export interface Session {
  readonly userId: UserId;
  readonly contactId: ContactId;
  readonly displayName: string;
  readonly email: string;
  readonly tenantId: TenantId;
  readonly tenants: ReadonlyArray<{ id: TenantId; name: string }>;
  readonly roles: readonly UIRole[];
  readonly permissions: readonly Permission[];
  readonly expiresAt: string;
}

export type SessionStatus = "loading" | "authenticated" | "anonymous" | "error";

export interface SessionState {
  readonly status: SessionStatus;
  readonly session?: Session;
  readonly error?: string;
}

export const ANONYMOUS: SessionState = { status: "anonymous" };
