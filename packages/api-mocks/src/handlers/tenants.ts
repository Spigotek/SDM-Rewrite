import { http, HttpResponse } from "msw";
import { store } from "../db";
import { DEFAULT_USER_ID } from "../fixtures/users";
import { correlationIdFrom } from "../utils/correlation";
import { unauthorized } from "../utils/errors";

export const tenantHandlers = [
  http.get("*/me/tenants", ({ request }) => {
    const user = store.users.find((u) => u.id === DEFAULT_USER_ID);
    if (!user) return unauthorized("session user missing", correlationIdFrom(request));
    const accessibleTenantIds = new Set(user.roleAssignments.map((r) => r.tenantId));
    const tenants = store.tenants.filter((t) => accessibleTenantIds.has(t.id));
    return HttpResponse.json({
      tenants: tenants.map((t) => ({
        id: t.id,
        name: t.name,
        code: t.code,
        roles: user.roleAssignments.filter((r) => r.tenantId === t.id).map((r) => r.roleId),
        isDefault: t.id === user.defaultTenantId,
      })),
    });
  }),
];
