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

interface MeResponse {
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
  readonly tenants: ReadonlyArray<{ id: TenantId; name: string }>;
}

// Active tenant header — SPA keeps the last switch in localStorage so a hard
// refresh re-attaches the same `X-CA-SDM-Tenant` value. BFF validates against
// `session.activeTenantId` (per auth-flow.md §4.3) — the header is a hint, not
// authoritative. MSW reads it for tenant scoping in mock mode.
export const ACTIVE_TENANT_STORAGE_KEY = "sdm.active-tenant";
export const TENANT_HEADER = "X-CA-SDM-Tenant";

function readStoredActiveTenant(): string | null {
  try {
    return window.localStorage.getItem(ACTIVE_TENANT_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredActiveTenant(id: string): void {
  try {
    window.localStorage.setItem(ACTIVE_TENANT_STORAGE_KEY, id);
  } catch {
    // localStorage unavailable (private mode, etc.) — degrade gracefully.
  }
}

function tenantHeaders(): Record<string, string> {
  const stored = readStoredActiveTenant();
  return stored ? { [TENANT_HEADER]: stored } : {};
}

export class UnauthorizedError extends Error {
  constructor(public readonly reason?: string) {
    super(reason ? `unauthorized: ${reason}` : "unauthorized");
    this.name = "UnauthorizedError";
  }
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "include",
    headers: { ...tenantHeaders(), ...(init?.headers ?? {}) },
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
  try {
    window.localStorage.removeItem(ACTIVE_TENANT_STORAGE_KEY);
  } catch {
    // ignore
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

export async function loadSession(): Promise<SessionLoadResult> {
  const me = await fetchJson<MeResponse>("/me");

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

  writeStoredActiveTenant(me.activeTenant.id);

  return {
    session,
    tenants: me.tenants.map((t) => ({ id: toTenantId(t.id), name: t.name })),
  };
}

export async function switchActiveTenant(tenantId: TenantId): Promise<void> {
  const response = await fetch("/me/active-tenant", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...tenantHeaders() },
    body: JSON.stringify({ tenantId }),
  });
  if (!response.ok) {
    throw new Error(`[session] tenant switch failed: HTTP ${response.status}`);
  }
  writeStoredActiveTenant(tenantId);
}
