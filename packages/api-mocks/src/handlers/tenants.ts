import { http, HttpResponse } from "msw";
import { store } from "../db";
import { DEFAULT_USER_ID } from "../fixtures/users";
import { correlationIdFrom } from "../utils/correlation";
import { unauthorized } from "../utils/errors";
import { parseTenantFromRequest } from "../utils/tenant";

const ROLE_PREFIX = "role:";

function stripRolePrefix(raw: string): string {
  return raw.startsWith(ROLE_PREFIX) ? raw.slice(ROLE_PREFIX.length) : raw;
}

export const tenantHandlers = [
  http.get("*/me/tenants", ({ request }) => {
    const user = store.users.find((u) => u.id === DEFAULT_USER_ID);
    if (!user) return unauthorized("session user missing", correlationIdFrom(request));
    const accessibleTenantIds = new Set(user.roleAssignments.map((r) => r.tenantId));
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
    const requestedTenant = parseTenantFromRequest(request);
    const activeTenantId = accessibleTenantIds.has(requestedTenant)
      ? requestedTenant
      : user.defaultTenantId;
    return HttpResponse.json({
      tenants,
      defaultTenantId: user.defaultTenantId,
      activeTenantId,
    });
  }),
];
