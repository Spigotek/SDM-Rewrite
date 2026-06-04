/**
 * J.3 — MSW mirror for the BFF admin tenant suspend/unsuspend endpoints.
 *
 * POST /api/admin/tenants/:id/suspend   → flips tenantStatusFixture + emits SSE
 * POST /api/admin/tenants/:id/unsuspend → restores tenantStatusFixture
 *
 * Mutates the mutable `tenantStatusOverride` map (separate from the read-only
 * `tenantStatusFixture` so the original fixture is preserved for test isolation).
 * The MSW users handler reads `tenantStatusOverride` preferentially.
 *
 * For browser-tests, after calling /api/admin/tenants/:id/suspend the SSE
 * stream emits `tenant.suspended` via `sseEmitFromTest` so the FE reacts
 * within milliseconds (matching the BFF real-path behaviour).
 */

import { http, HttpResponse } from "msw";
import { sseEmitFromTest } from "./events";

/** Runtime override map — takes priority over `tenantStatusFixture`. */
export const tenantStatusOverride = new Map<string, "active" | "suspended">();

export const adminTenantHandlers = [
  http.post("*/api/admin/tenants/:id/suspend", ({ params }) => {
    const tenantId = params["id"] as string;
    tenantStatusOverride.set(tenantId, "suspended");

    sseEmitFromTest({
      type: "tenant.suspended",
      tenantId,
      reason: "admin.tenant.suspend",
      at: new Date().toISOString(),
    });

    return new HttpResponse(null, { status: 204 });
  }),

  http.post("*/api/admin/tenants/:id/unsuspend", ({ params }) => {
    const tenantId = params["id"] as string;
    tenantStatusOverride.set(tenantId, "active");

    return new HttpResponse(null, { status: 204 });
  }),
];
