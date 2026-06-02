import { http, HttpResponse } from "msw";
import { DEFAULT_USER_ID } from "../fixtures/users";
import { store } from "../db";
import { badRequest, unauthorized } from "../utils/errors";
import { correlationIdFrom } from "../utils/correlation";

/**
 * I.1 step-up TOTP — in-memory mock token store mirroring the BFF behaviour.
 * Single-use, 15-min TTL. Browser tests mint a token by POSTing `123456` (the
 * always-valid MSW fixture code); replaying the same token fails. Production
 * TOTP validation against the corp IdP MFA backend is BFF-side; MSW is only
 * used in dev/test contexts so a fixed-code shortcut keeps Playwright fast.
 */
interface StepUpEntry {
  readonly expiresAt: number;
}
const stepUpTokens = new Map<string, StepUpEntry>();
const STEP_UP_FIXTURE_CODE = "123456";
const STEP_UP_TTL_MS = 15 * 60_000;

function mintStepUpToken(): { token: string; expiresAt: number } {
  const token = `msw-stepup-${Math.random().toString(36).slice(2, 18)}`;
  const expiresAt = Date.now() + STEP_UP_TTL_MS;
  stepUpTokens.set(token, { expiresAt });
  return { token, expiresAt };
}

export function consumeStepUpTokenMock(token: string): boolean {
  const entry = stepUpTokens.get(token);
  if (!entry) return false;
  stepUpTokens.delete(token);
  return entry.expiresAt > Date.now();
}

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

  http.post("*/auth/step-up", async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { totp?: string };
    if (typeof body.totp !== "string" || !/^\d{6}$/.test(body.totp)) {
      return badRequest("totp must be a 6-digit numeric code", correlationIdFrom(request));
    }
    if (body.totp !== STEP_UP_FIXTURE_CODE) {
      return HttpResponse.json(
        {
          error: "unauthorized",
          reason: "invalid_totp",
          correlationId: correlationIdFrom(request),
        },
        { status: 401 },
      );
    }
    const mint = mintStepUpToken();
    return HttpResponse.json(
      { stepUpToken: mint.token, expiresAt: new Date(mint.expiresAt).toISOString() },
      { status: 200 },
    );
  }),
];
