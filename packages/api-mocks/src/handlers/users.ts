import { http, HttpResponse } from "msw";
import { getPermissionsForRole, type Permission, type UIRole } from "@sdm/domain";
import { store } from "../db";
import { DEFAULT_USER_ID } from "../fixtures/users";
import { correlationIdFrom } from "../utils/correlation";
import { badRequest, forbidden, unauthorized } from "../utils/errors";
import { DEFAULT_TENANT_ID, parseTenantFromRequest } from "../utils/tenant";

interface ActiveTenantBody {
  tenantId?: string;
}

const SESSION_IDLE_SEC = 30 * 60;
const SESSION_ABSOLUTE_MS = 8 * 60 * 60 * 1000;
const ROLE_PREFIX = "role:";

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

export const userHandlers = [
  http.get("*/me", ({ request }) => {
    const user = store.users.find((u) => u.id === DEFAULT_USER_ID);
    if (!user) return unauthorized("session user missing", correlationIdFrom(request));

    const accessibleTenantIds = new Set(user.roleAssignments.map((r) => r.tenantId));
    const requestedTenant = parseTenantFromRequest(request);
    const activeTenantId = accessibleTenantIds.has(requestedTenant)
      ? requestedTenant
      : user.defaultTenantId;

    const tenants = store.tenants
      .filter((t) => accessibleTenantIds.has(t.id))
      .map((t) => {
        const assignments = user.roleAssignments.filter((r) => r.tenantId === t.id);
        return {
          id: t.id,
          name: t.name,
          isServiceProvider: false,
          roles: assignments.map((r) => {
            const uiRole = stripRolePrefix(r.roleId);
            return { id: r.roleId, name: uiRole, uiRole };
          }),
        };
      });

    const activeTenant = tenants.find((t) => t.id === activeTenantId) ?? tenants[0];
    if (!activeTenant) return unauthorized("no tenants for user", correlationIdFrom(request));

    const activeRoles = activeTenant.roles.map((r) => r.uiRole as UIRole);
    const primaryRole = activeRoles[0] ?? "requester";

    return HttpResponse.json({
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
    });
  }),

  http.get("*/whoami", ({ request }) => {
    const user = store.users.find((u) => u.id === DEFAULT_USER_ID);
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
    const user = store.users.find((u) => u.id === DEFAULT_USER_ID);
    if (!user) return unauthorized("session user missing", correlationId);
    const hasAccess = user.roleAssignments.some((r) => r.tenantId === body.tenantId);
    if (!hasAccess) return forbidden(`user has no role in tenant ${body.tenantId}`, correlationId);
    return HttpResponse.json(
      { activeTenantId: body.tenantId },
      {
        status: 200,
        headers: {
          "Set-Cookie": `sdm-active-tenant=${encodeURIComponent(body.tenantId)}; Path=/; SameSite=Lax`,
        },
      },
    );
  }),
];

export { DEFAULT_TENANT_ID };
