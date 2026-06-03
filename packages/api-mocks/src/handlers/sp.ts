import { http, HttpResponse } from "msw";
import { store } from "../db";
import { DEFAULT_USER_ID } from "../fixtures/users";
import { tenantStatusFixture } from "../fixtures/tenants";
import { correlationIdFrom } from "../utils/correlation";
import { badRequest, forbidden, unauthorized } from "../utils/errors";

/**
 * I.5 — SP impersonation MSW handlers (mirror of `apps/bff/src/auth/sp-impersonation.ts`).
 *
 *  - `GET  /me/sp-tenants`    — sp_admin scope (filtered by status="active").
 *  - `POST /api/sp/view-as`   — sets the per-user view-as entry; in MSW we
 *                               do NOT require a step-up token because the
 *                               BFF unit test already covers that branch and
 *                               browser tests want a deterministic flow.
 *                               Production wiring (BFF route) enforces the
 *                               token; MSW is dev/test only.
 *  - `DELETE /api/sp/view-as` — clear.
 *
 * The view-as state is exposed through a small accessor (`getMswViewAsTenant`)
 * so the cmdb / changes handlers can consult it when shaping responses.
 */

const VIEW_AS_TTL_MS = 60 * 60_000;
const MSW_USER_HEADER = "x-msw-user-id";
const SP_ROLE = "sp_admin" as const;

interface ViewAsEntry {
  readonly tenantId: string;
  readonly expiresAt: number;
}
const viewAsByUser = new Map<string, ViewAsEntry>();

export function getMswViewAsTenant(userId: string, nowMs: number = Date.now()): string | null {
  const entry = viewAsByUser.get(userId);
  if (!entry) return null;
  if (entry.expiresAt < nowMs) {
    viewAsByUser.delete(userId);
    return null;
  }
  return entry.tenantId;
}

export function isSpAdmin(userId: string): boolean {
  const user = store.users.find((u) => u.id === userId);
  if (!user) return false;
  return user.roleAssignments.some((r) => r.roleId === "role:sp_admin");
}

export function spAdminTenantIds(userId: string): readonly string[] {
  const user = store.users.find((u) => u.id === userId);
  if (!user) return [];
  return user.roleAssignments.filter((r) => r.roleId === "role:sp_admin").map((r) => r.tenantId);
}

function resolveUserId(request: Request): string {
  const override = request.headers.get(MSW_USER_HEADER);
  if (override && store.users.some((u) => u.id === override)) return override;
  return DEFAULT_USER_ID;
}

interface ViewAsBody {
  tenantId?: string;
}

export const spHandlers = [
  http.get("*/me/sp-tenants", ({ request }) => {
    const userIdValue = resolveUserId(request);
    const user = store.users.find((u) => u.id === userIdValue);
    if (!user) return unauthorized("session user missing", correlationIdFrom(request));
    const ids = new Set(
      user.roleAssignments.filter((r) => r.roleId === "role:sp_admin").map((r) => r.tenantId),
    );
    const tenants = store.tenants
      .filter((t) => ids.has(t.id))
      .filter((t) => (tenantStatusFixture[t.id] ?? "active") === "active")
      .map((t) => ({ id: t.id, name: t.name }));
    return HttpResponse.json({ tenants });
  }),

  http.post("*/api/sp/view-as", async ({ request }) => {
    const correlationId = correlationIdFrom(request);
    const userIdValue = resolveUserId(request);
    const user = store.users.find((u) => u.id === userIdValue);
    if (!user) return unauthorized("session user missing", correlationId);

    const body = (await request.json().catch(() => ({}))) as ViewAsBody;
    if (!body.tenantId) return badRequest("tenantId is required", correlationId);
    const isSpOnTarget = user.roleAssignments.some(
      (r) => r.roleId === "role:sp_admin" && r.tenantId === body.tenantId,
    );
    if (!isSpOnTarget) {
      return forbidden(`user is not sp_admin on tenant ${body.tenantId}`, correlationId);
    }
    viewAsByUser.set(user.id, {
      tenantId: body.tenantId,
      expiresAt: Date.now() + VIEW_AS_TTL_MS,
    });
    return HttpResponse.json({
      viewingAsTenantId: body.tenantId,
      expiresAt: new Date(Date.now() + VIEW_AS_TTL_MS).toISOString(),
    });
  }),

  http.delete("*/api/sp/view-as", ({ request }) => {
    const userIdValue = resolveUserId(request);
    viewAsByUser.delete(userIdValue);
    return HttpResponse.json({ viewingAsTenantId: null });
  }),
];

/** Test hook — reset state between scenarios. */
export function _resetMswSpStateForTests(): void {
  viewAsByUser.clear();
}

export { SP_ROLE, MSW_USER_HEADER };
