import { http, HttpResponse } from "msw";
import {
  getPermissionsForRole,
  tenantId as toTenantId,
  type Permission,
  type TenantId,
  type UIRole,
} from "@sdm/domain";
import { store } from "../db";
import { tenantStatusFixture } from "../fixtures/tenants";
import { DEFAULT_USER_ID } from "../fixtures/users";
import { correlationIdFrom } from "../utils/correlation";
import { badRequest, forbidden, unauthorized } from "../utils/errors";
import { DEFAULT_TENANT_ID, parseTenantFromRequest } from "../utils/tenant";

interface ActiveTenantBody {
  tenantId?: string;
}

type TenantEnvironment = "production" | "staging" | "development" | "sandbox";

const SESSION_IDLE_SEC = 30 * 60;
const SESSION_ABSOLUTE_MS = 8 * 60 * 60 * 1000;
const ROLE_PREFIX = "role:";

// In-memory active-tenant — MSW handlers are stateless in MSW v2, so the
// SPA-driven tenant switch needs a module-level cache to make the next /me
// honour the new active tenant. The browser-test fixture clears the SW
// between scenarios, which also resets this map.
const ACTIVE_TENANT_BY_USER = new Map<string, TenantId>();

function stripRolePrefix(raw: string): UIRole {
  return (raw.startsWith(ROLE_PREFIX) ? raw.slice(ROLE_PREFIX.length) : raw) as UIRole;
}

function computeEffectivePermissions(roles: ReadonlyArray<UIRole>): Permission[] {
  const out = new Set<Permission>();
  for (const role of roles) {
    for (const p of getPermissionsForRole(role)) out.add(p);
  }
  return Array.from(out);
}

function appFromPrimaryRole(role: UIRole): "portal" | "workspace" {
  return role === "requester" || role === "requester_external" ? "portal" : "workspace";
}

// Hard-coded env labels per tenant for browser tests (the fixture model has no
// `environment` field — extending the domain just for this hint is out of
// scope for H.1). Acme is production-grade in the example narratives; Globex
// is staging. Unknown tenants fall back to undefined → no badge.
const TENANT_ENV: Record<string, TenantEnvironment> = {
  "acme-corp": "production",
  globex: "staging",
};

/**
 * I.4 — explicit persona override for browser tests that need a non-default
 * session (e.g. journey-13 needs `kb_editor_jana` for `kb.write` access).
 * The header is consumed by `/me`, `/whoami`, and `/me/active-tenant`. If
 * unset (the normal case), the handlers fall back to `DEFAULT_USER_ID`.
 */
const MSW_USER_HEADER = "x-msw-user-id";
function resolveUserId(request: Request): string {
  const override = request.headers.get(MSW_USER_HEADER);
  if (override && store.users.some((u) => u.id === override)) return override;
  return DEFAULT_USER_ID;
}

function meResponseForUser(userIdValue: string, requestedTenant: TenantId) {
  const user = store.users.find((u) => u.id === userIdValue);
  if (!user) return null;

  const accessibleTenantIds = new Set(user.roleAssignments.map((r) => r.tenantId));
  const remembered = ACTIVE_TENANT_BY_USER.get(user.id);
  const activeTenantId = accessibleTenantIds.has(requestedTenant)
    ? requestedTenant
    : remembered && accessibleTenantIds.has(remembered)
      ? remembered
      : user.defaultTenantId;

  const tenants = store.tenants
    .filter((t) => accessibleTenantIds.has(t.id))
    // I.3 — strip suspended tenants so the FE switcher never enumerates them.
    .filter((t) => (tenantStatusFixture[t.id] ?? "active") === "active")
    .map((t) => {
      const assignments = user.roleAssignments.filter((r) => r.tenantId === t.id);
      const tenant: {
        id: TenantId;
        name: string;
        isServiceProvider: boolean;
        environment?: TenantEnvironment;
        roles: Array<{ id: string; name: string; uiRole: string }>;
      } = {
        id: t.id,
        name: t.name,
        isServiceProvider: false,
        roles: assignments.map((r) => {
          const uiRole = stripRolePrefix(r.roleId);
          return { id: r.roleId, name: uiRole, uiRole };
        }),
      };
      const env = TENANT_ENV[t.id];
      if (env) tenant.environment = env;
      return tenant;
    });

  const activeTenant = tenants.find((t) => t.id === activeTenantId) ?? tenants[0];
  if (!activeTenant) return null;

  const activeRoles = activeTenant.roles.map((r) => r.uiRole as UIRole);
  const primaryRole = activeRoles[0] ?? "requester";

  return {
    user: {
      id: user.id,
      userId: user.username,
      email: user.email,
      displayName: user.fullName,
    },
    tenants,
    activeTenant: {
      id: activeTenant.id,
      activeRoleId: activeTenant.roles[0]?.id ?? "",
      effectivePermissions: computeEffectivePermissions(activeRoles),
    },
    uiRole: primaryRole,
    app: appFromPrimaryRole(primaryRole),
    csrfToken: "",
    featureFlags: {},
    i18n: { locale: "sk" as const, tz: "Europe/Bratislava" },
    session: {
      idleTimeoutSec: SESSION_IDLE_SEC,
      absoluteExpiresAt: new Date(Date.now() + SESSION_ABSOLUTE_MS).toISOString(),
    },
  };
}

export const userHandlers = [
  http.get("*/me", ({ request }) => {
    const requestedTenant = parseTenantFromRequest(request);
    const me = meResponseForUser(resolveUserId(request), requestedTenant);
    if (!me) return unauthorized("session user missing", correlationIdFrom(request));
    return HttpResponse.json(me);
  }),

  http.get("*/whoami", ({ request }) => {
    const user = store.users.find((u) => u.id === resolveUserId(request));
    if (!user) return unauthorized("session user missing", correlationIdFrom(request));
    return HttpResponse.json({
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      defaultTenantId: user.defaultTenantId,
    });
  }),

  http.post("*/me/active-tenant", async ({ request }) => {
    const correlationId = correlationIdFrom(request);
    const body = (await request.json().catch(() => ({}))) as ActiveTenantBody;
    if (!body.tenantId) return badRequest("tenantId is required", correlationId);
    const user = store.users.find((u) => u.id === resolveUserId(request));
    if (!user) return unauthorized("session user missing", correlationId);
    const hasAccess = user.roleAssignments.some((r) => r.tenantId === body.tenantId);
    if (!hasAccess) return forbidden(`user has no role in tenant ${body.tenantId}`, correlationId);

    // I.3 — block switch into a suspended tenant. The reason discriminator
    // mirrors the BFF response shape (`details.reason: "tenant_suspended"`)
    // so the SPA session-context handler treats both runtimes identically.
    const targetStatus = tenantStatusFixture[body.tenantId] ?? "active";
    if (targetStatus === "suspended") {
      return HttpResponse.json(
        {
          error: "TENANT_FORBIDDEN",
          message: "Tenant is suspended — switch denied",
          correlationId,
          details: { reason: "tenant_suspended" },
        },
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const newTenant = toTenantId(body.tenantId);
    ACTIVE_TENANT_BY_USER.set(user.id, newTenant);

    const me = meResponseForUser(user.id, newTenant);
    if (!me) return unauthorized("session user missing", correlationId);
    return HttpResponse.json(me, {
      status: 200,
      headers: {
        "Set-Cookie": `sdm-active-tenant=${encodeURIComponent(body.tenantId)}; Path=/; SameSite=Lax`,
      },
    });
  }),

  // Lightweight directory search used by Service Catalog `user-picker` fields
  // (H.5). Returns up to 20 matches sorted by display name; case-insensitive
  // contains on either `fullName` or `email`. Tenant-scoped (only users with
  // an assignment in the active tenant are visible).
  http.get("*/api/users", ({ request }) => {
    const tenant = parseTenantFromRequest(request);
    const url = new URL(request.url);
    const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
    const all = store.users.filter((u) => u.roleAssignments.some((r) => r.tenantId === tenant));
    const matches = (
      q
        ? all.filter(
            (u) =>
              u.fullName.toLowerCase().includes(q) || (u.email ?? "").toLowerCase().includes(q),
          )
        : all
    )
      .slice(0, 20)
      .map((u) => ({ id: u.id, displayName: u.fullName, email: u.email ?? "" }));
    return HttpResponse.json({ users: matches });
  }),
];

export { DEFAULT_TENANT_ID };
