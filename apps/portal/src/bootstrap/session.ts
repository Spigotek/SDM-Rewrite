// Session bootstrap — combines BFF /me + /me/tenants into a single Session.
// Real BFF will likely consolidate both into /me (per components/bff.md §2.4);
// E.3 keeps two fetches because that's what @sdm/api-mocks already exposes.

import {
  contactId as toContactId,
  getPermissionsForRole,
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
    username: string;
    firstName: string;
    lastName: string;
    fullName: string;
    email: string | null;
    jobTitle: string | null;
  };
  session: {
    activeTenantId: string;
    expiresAt: string;
  };
}

interface MeTenantsResponse {
  tenants: Array<{
    id: string;
    name: string;
    code: string | null;
    roles: string[];
    isDefault: boolean;
  }>;
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

function parseUIRole(roleId: string): UIRole | null {
  const stripped = roleId.startsWith("role:") ? roleId.slice("role:".length) : roleId;
  return (UI_ROLES as readonly string[]).includes(stripped) ? (stripped as UIRole) : null;
}

function aggregatePermissions(roles: readonly UIRole[]): readonly Permission[] {
  const set = new Set<Permission>();
  for (const role of roles) {
    for (const permission of getPermissionsForRole(role)) {
      set.add(permission);
    }
  }
  return Array.from(set);
}

export interface SessionLoadResult {
  readonly session: Session;
  readonly tenants: ReadonlyArray<{ id: TenantId; name: string; code: string | null }>;
}

// Active tenant header — BFF reads X-CA-SDM-Tenant from every request; SPA is
// authoritative for the active tenant id across page loads. We persist the
// switch in localStorage so a hard refresh keeps the user on the chosen tenant.
const ACTIVE_TENANT_STORAGE_KEY = "sdm.active-tenant";
const TENANT_HEADER = "X-CA-SDM-Tenant";

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

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { ...tenantHeaders(), ...(init?.headers ?? {}) },
  });
  if (!response.ok) {
    throw new Error(`[session] ${path} HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function loadSession(): Promise<SessionLoadResult> {
  const [me, tenantsResp] = await Promise.all([
    fetchJson<MeResponse>("/me"),
    fetchJson<MeTenantsResponse>("/me/tenants"),
  ]);

  const activeTenantId = toTenantId(me.session.activeTenantId);
  const activeTenantInfo = tenantsResp.tenants.find((t) => t.id === me.session.activeTenantId);
  const activeRoles: readonly UIRole[] = activeTenantInfo
    ? activeTenantInfo.roles.map(parseUIRole).filter((r): r is UIRole => r !== null)
    : [];

  const session: Session = {
    userId: toUserId(me.user.id),
    contactId: toContactId(me.user.id),
    displayName: me.user.fullName,
    email: me.user.email ?? "",
    tenantId: activeTenantId,
    tenants: tenantsResp.tenants.map((t) => ({
      id: toTenantId(t.id),
      name: t.name,
    })),
    roles: activeRoles,
    permissions: aggregatePermissions(activeRoles),
    expiresAt: me.session.expiresAt,
  };

  return {
    session,
    tenants: tenantsResp.tenants.map((t) => ({
      id: toTenantId(t.id),
      name: t.name,
      code: t.code,
    })),
  };
}

export async function switchActiveTenant(tenantId: TenantId): Promise<void> {
  const response = await fetch("/me/active-tenant", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...tenantHeaders() },
    body: JSON.stringify({ tenantId }),
  });
  if (!response.ok) {
    throw new Error(`[session] tenant switch failed: HTTP ${response.status}`);
  }
  writeStoredActiveTenant(tenantId);
}
