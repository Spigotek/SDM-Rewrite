import { http, HttpResponse } from "msw";
import { DEFAULT_USER_ID } from "../fixtures/users";
import { store } from "../db";
import { badRequest, unauthorized } from "../utils/errors";
import { correlationIdFrom } from "../utils/correlation";

interface LoginBody {
  username?: string;
  password?: string;
  tenantId?: string;
}

interface SessionResponse {
  user: { id: string; username: string; fullName: string; email: string | null };
  session: { activeTenantId: string; expiresAt: string };
}

function buildSession(activeTenantId: string): SessionResponse {
  const user = store.users.find((u) => u.id === DEFAULT_USER_ID);
  if (!user) throw new Error("default user not seeded");
  return {
    user: {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
    },
    session: {
      activeTenantId,
      expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
    },
  };
}

export const authHandlers = [
  http.post("*/auth/login", async ({ request }) => {
    const correlationId = correlationIdFrom(request);
    const body = (await request.json().catch(() => ({}))) as LoginBody;
    if (!body.username) {
      return badRequest("username is required", correlationId);
    }
    const tenant = body.tenantId ?? store.tenants[0]?.id;
    if (!tenant) return unauthorized("no tenant available", correlationId);
    return HttpResponse.json(buildSession(tenant), {
      status: 200,
      headers: {
        "Set-Cookie": `sdm-active-tenant=${encodeURIComponent(tenant)}; Path=/; SameSite=Lax`,
      },
    });
  }),

  http.post("*/auth/callback", async ({ request }) => {
    const tenant = store.tenants[0]?.id;
    if (!tenant) return unauthorized("no tenant available", correlationIdFrom(request));
    return HttpResponse.json(buildSession(tenant));
  }),

  http.post("*/auth/refresh", ({ request }) => {
    const tenant = store.tenants[0]?.id;
    if (!tenant) return unauthorized("no tenant available", correlationIdFrom(request));
    return HttpResponse.json(buildSession(tenant));
  }),

  http.post("*/auth/logout", () =>
    HttpResponse.json(
      { ok: true },
      {
        status: 200,
        headers: {
          "Set-Cookie": "sdm-active-tenant=; Path=/; Max-Age=0",
        },
      },
    ),
  ),
];
