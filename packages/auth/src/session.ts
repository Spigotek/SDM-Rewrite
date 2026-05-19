import type { ContactId, Permission, TenantId, UIRole, UserId } from "@sdm/domain";

/**
 * Canonical session shape per `docs/agents/security/auth-flow.md` §4.5.
 *
 * Source of truth is the BFF `/me` aggregator (`apps/bff/src/aggregator/me.ts`)
 * and the mirrored MSW handler (`packages/api-mocks/src/handlers/users.ts`).
 * `permissions` comes directly from `activeTenant.effectivePermissions[]`
 * (computed BFF-side) — no FE derivation via `getPermissionsForRole` per F.5
 * D4 alignment.
 */
export interface Session {
  readonly userId: UserId;
  readonly contactId: ContactId;
  readonly displayName: string;
  readonly email: string;
  readonly avatarUrl: string | null;
  readonly tenantId: TenantId;
  readonly tenants: ReadonlyArray<{ id: TenantId; name: string }>;
  readonly roles: readonly UIRole[];
  readonly permissions: readonly Permission[];
  readonly uiRole: UIRole;
  readonly activeRoleId: string;
  readonly app: "portal" | "workspace";
  readonly csrfToken: string;
  readonly idleTimeoutSec: number;
  readonly absoluteExpiresAt: string;
  readonly featureFlags: Readonly<Record<string, boolean>>;
  readonly i18n: { readonly locale: "sk" | "en"; readonly tz: string };
}

export type SessionStatus = "loading" | "authenticated" | "anonymous" | "error";

export interface SessionState {
  readonly status: SessionStatus;
  readonly session?: Session;
  readonly error?: string;
}

export const ANONYMOUS: SessionState = { status: "anonymous" };
