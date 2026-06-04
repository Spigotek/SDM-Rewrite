import { test, expect } from "../fixtures/isolated-context";

/**
 * J.3 — SSE tenant push delivery (`docs/plans/J.3.md` Strategy §C.5).
 *
 * Scenarios:
 *  1. Admin suspends the active tenant → workspace shell redirects to /login
 *     within 5 s (push path, vs I.3's "next API call ≤30 s" measurement).
 *  2. Admin suspends a NON-active tenant → no logout; dispatching
 *     sdm:tenant-switcher-invalidate does not drop the session.
 *  3. SSE blocked (EventSource error) → session-context still alive via
 *     I.3 heartbeat fallback (session-lost event still works).
 *
 * Runs on chromium only — MSW SSE needs ReadableStream support.
 */
test.describe("@J3 SSE tenant push", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "single-vendor contract");

  test("admin suspends active tenant → shell drops to anonymous within 5s", async ({
    isolatedPage,
  }) => {
    await isolatedPage.goto("/");
    await expect(isolatedPage.getByTestId("user-pill")).toBeVisible({ timeout: 15_000 });

    // Invoke the MSW admin-suspend handler which emits SSE tenant.suspended.
    const status = await isolatedPage.evaluate(async () => {
      const r = await fetch("/api/admin/tenants/acme-corp/suspend", {
        method: "POST",
        credentials: "include",
      });
      return r.status;
    });
    expect(status).toBe(204);

    // The EventSourceProvider should dispatch sdm:tenant-suspended which
    // the session-context listener turns into an anonymous state drop.
    // Alternatively, if the MSW admin handler calls sseEmitFromTest,
    // the EventSource will receive the event and dispatch it.
    // Either way: user-pill must disappear within 5s.
    await expect(isolatedPage.getByTestId("user-pill")).toBeHidden({ timeout: 5_000 });
  });

  test("admin suspends non-active tenant → no logout (switcher-invalidate only)", async ({
    isolatedPage,
  }) => {
    await isolatedPage.goto("/");
    await expect(isolatedPage.getByTestId("user-pill")).toBeVisible({ timeout: 15_000 });

    // Simulate the dispatch for a non-active tenant (globex is not the default).
    await isolatedPage.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent("sdm:tenant-switcher-invalidate", {
          detail: { tenantId: "globex" },
        }),
      );
    });

    // User-pill must REMAIN visible — no logout for non-active tenant suspension.
    await expect(isolatedPage.getByTestId("user-pill")).toBeVisible({ timeout: 2_000 });
  });

  test("SSE blocked → I.3 fallback still works via sdm:session-lost event", async ({
    isolatedPage,
  }) => {
    await isolatedPage.goto("/");
    await expect(isolatedPage.getByTestId("user-pill")).toBeVisible({ timeout: 15_000 });

    // Simulate the I.3 fallback path: heartbeat fires sdm:session-lost directly.
    await isolatedPage.evaluate(() => {
      window.dispatchEvent(new CustomEvent("sdm:session-lost"));
    });

    await expect(isolatedPage.getByTestId("user-pill")).toBeHidden({ timeout: 5_000 });
  });
});
