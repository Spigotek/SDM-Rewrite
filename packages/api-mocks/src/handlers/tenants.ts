import { http, HttpResponse } from "msw";
import { store } from "../db";
import { tenantStatusFixture } from "../fixtures/tenants";
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
      // I.3 — strip suspended tenants per `multi-tenancy.md §7`. The BFF
      // applies the same filter; the MSW handler mirrors it so the build-mode
      // FE never sees them either (tests + dev shell are deterministic).
      .filter((t) => (tenantStatusFixture[t.id] ?? "active") === "active")
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
