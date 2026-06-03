// Session bootstrap — single /me fetch returning canonical §4.5 shape.
// Per F.5 D4: BFF embeds `tenants[]` and computes `effectivePermissions[]`,
// so the FE no longer fans out to `/me/tenants` nor derives permissions via
// `getPermissionsForRole`. The MSW handler mirrors the BFF shape.

import {
  contactId as toContactId,
  tenantId as toTenantId,
  userId as toUserId,
  type Permission,
  type TenantId,
  type UIRole,
} from "@sdm/domain";
import type { Session } from "@sdm/auth";

export type TenantEnvironment = "production" | "staging" | "development" | "sandbox";

/**
 * I.3 — Lifecycle status surfaced by the BFF for the tenant switcher. The
 * happy path strips suspended tenants server-side, but the field is still
 * threaded through so admin / SP cockpit views (post-MVP) can render the
 * suspended state with a tooltip instead of removing the entry.
 */
export type TenantStatus = "active" | "suspended";

export interface MeResponse {
  user: {
    id: string;
    userId: string;
    email: string;
    displayName: string;
    avatarUrl?: string | null;
  };
  tenants: Array<{
    id: string;
    name: string;
    isServiceProvider: boolean;
    environment?: TenantEnvironment;
    status?: TenantStatus;
    roles: Array<{ id: string; name: string; uiRole: string }>;
  }>;
  activeTenant: {
    id: string;
    activeRoleId: string;
    effectivePermissions: string[];
  };
  uiRole: string;
  app: "portal" | "workspace";
  csrfToken: string;
  featureFlags: Record<string, boolean>;
  i18n: { locale: "sk" | "en"; tz: string };
  session: { idleTimeoutSec: number; absoluteExpiresAt: string };
}

export interface SessionLoadResult {
  readonly session: Session;
  readonly tenants: ReadonlyArray<{
    id: TenantId;
    name: string;
    environment?: TenantEnvironment;
    status?: TenantStatus;
  }>;
}

// H.1: `X-CA-SDM-Tenant` removed. The BFF resolves the active tenant from the
// server-side session (`session.activeTenantId`) — the client must not inject
// any tenant hint header. The localStorage key is kept for MSW backward-compat
// in browser-test fixtures but the SPA no longer reads/writes it for requests.

export class UnauthorizedError extends Error {
  constructor(public readonly reason?: string) {
    super(reason ? `unauthorized: ${reason}` : "unauthorized");
    this.name = "UnauthorizedError";
  }
}

/**
 * I.3 — Thrown when the BFF rejects a tenant switch because the target tenant
 * is suspended. Distinct from `UnauthorizedError` (401) and a generic 403 —
 * the SessionContext maps this to a toast + a forced sign-out flow.
 */
export class TenantSuspendedError extends Error {
  constructor(public readonly targetTenantId: string) {
    super(`tenant suspended: ${targetTenantId}`);
    this.name = "TenantSuspendedError";
  }
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "include",
  });
  if (response.status === 401) {
    const body = (await response.json().catch(() => null)) as { reason?: string } | null;
    throw new UnauthorizedError(body?.reason);
  }
  if (!response.ok) {
    throw new Error(`[session] ${path} HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function login(username: string, password: string): Promise<void> {
  const response = await fetch("/auth/login", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (response.status === 401 || response.status === 400) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new UnauthorizedError(body?.message ?? "invalid credentials");
  }
  if (!response.ok) {
    throw new Error(`[session] login HTTP ${response.status}`);
  }
}

export async function logout(): Promise<void> {
  try {
    await fetch("/auth/logout", { method: "POST", credentials: "include" });
  } catch {
    // Logout is best-effort — server may already have torn down the session.
  }
}

const UI_ROLES: readonly UIRole[] = [
  "requester",
  "requester_external",
  "agent_l1",
  "agent_l2",
  "change_manager",
  "kb_editor",
  "cmdb_owner",
  "sp_admin",
];

function parseUIRole(raw: string): UIRole | null {
  return (UI_ROLES as readonly string[]).includes(raw) ? (raw as UIRole) : null;
}

export function shapeMeResponseToSession(me: MeResponse): SessionLoadResult {
  const activeTenant = me.tenants.find((t) => t.id === me.activeTenant.id);
  const activeRoles: readonly UIRole[] = activeTenant
    ? activeTenant.roles.map((r) => parseUIRole(r.uiRole)).filter((r): r is UIRole => r !== null)
    : [];
  const permissions = me.activeTenant.effectivePermissions as readonly Permission[];
  const uiRole = parseUIRole(me.uiRole) ?? activeRoles[0] ?? "requester";

  const session: Session = {
    userId: toUserId(me.user.userId),
    contactId: toContactId(me.user.id),
    displayName: me.user.displayName,
    email: me.user.email,
    avatarUrl: me.user.avatarUrl ?? null,
    tenantId: toTenantId(me.activeTenant.id),
    tenants: me.tenants.map((t) => ({ id: toTenantId(t.id), name: t.name })),
    roles: activeRoles,
    permissions,
    uiRole,
    activeRoleId: me.activeTenant.activeRoleId,
    app: me.app,
    csrfToken: me.csrfToken,
    idleTimeoutSec: me.session.idleTimeoutSec,
    absoluteExpiresAt: me.session.absoluteExpiresAt,
    featureFlags: me.featureFlags,
    i18n: me.i18n,
  };

  return {
    session,
    tenants: me.tenants.map((t) => {
      const opt: {
        id: TenantId;
        name: string;
        environment?: TenantEnvironment;
        status?: TenantStatus;
      } = {
        id: toTenantId(t.id),
        name: t.name,
      };
      if (t.environment) opt.environment = t.environment;
      if (t.status) opt.status = t.status;
      return opt;
    }),
  };
}

export async function loadSession(): Promise<SessionLoadResult> {
  const me = await fetchJson<MeResponse>("/me");
  return shapeMeResponseToSession(me);
}

/**
 * H.1: POST /me/active-tenant returns the full /me shape so the caller can
 * prime its query cache atomically. Throws `UnauthorizedError` on 401 and a
 * generic `Error` on other non-2xx (the mutation hook surfaces a toast).
 */
export async function postActiveTenant(tenantId: TenantId): Promise<SessionLoadResult> {
  const response = await fetch("/me/active-tenant", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tenantId }),
  });
  if (response.status === 401) {
    const body = (await response.json().catch(() => null)) as { reason?: string } | null;
    throw new UnauthorizedError(body?.reason);
  }
  // I.3 — 403 with `details.reason: "tenant_suspended"` is its own failure
  // mode: the FE drops to anonymous + surfaces a toast, then the user
  // re-authenticates.
  if (response.status === 403) {
    const body = (await response.json().catch(() => null)) as {
      details?: { reason?: string };
    } | null;
    if (body?.details?.reason === "tenant_suspended") {
      throw new TenantSuspendedError(tenantId);
    }
    throw new Error(`[session] tenant switch forbidden`);
  }
  if (!response.ok) {
    throw new Error(`[session] tenant switch failed: HTTP ${response.status}`);
  }
  const me = (await response.json()) as MeResponse;
  return shapeMeResponseToSession(me);
}
