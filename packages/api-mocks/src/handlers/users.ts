import { http, HttpResponse } from "msw";
import { store } from "../db";
import { DEFAULT_USER_ID } from "../fixtures/users";
import { correlationIdFrom } from "../utils/correlation";
import { badRequest, forbidden, unauthorized } from "../utils/errors";
import { DEFAULT_TENANT_ID, parseTenantFromRequest } from "../utils/tenant";

interface ActiveTenantBody {
  tenantId?: string;
}

export const userHandlers = [
  http.get("*/me", ({ request }) => {
    const activeTenant = parseTenantFromRequest(request);
    const user = store.users.find((u) => u.id === DEFAULT_USER_ID);
    if (!user) return unauthorized("session user missing", correlationIdFrom(request));
    return HttpResponse.json({
      user: {
        id: user.id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.fullName,
        email: user.email,
        jobTitle: user.jobTitle,
      },
      session: {
        activeTenantId: activeTenant,
        expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
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
