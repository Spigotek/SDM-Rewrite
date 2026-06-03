import { test, expect, type Page } from "@playwright/test";

/**
 * I.2 — cross-tab tenant sync via BroadcastChannel (receiver path).
 *
 * `acceptance-criteria.md §4.2` `cross-tab-tenant-sync-l4`: when a user
 * switches tenant in tab A, tab B (same origin) must re-fetch its session
 * so subsequent reads see the new tenant. Implementation:
 * `SessionProvider` subscribes to the `tenant-changed` BroadcastChannel
 * event and calls `refresh()` (which re-hits `/me`).
 *
 * This test isolates the cross-tab RECEIVER contract:
 *   1. Broadcasting `{ type: "tenant-changed" }` from tab A causes tab B
 *      to issue a `/me` fetch (channel.subscribe handler fires the
 *      `refresh()` callback).
 *
 * The server-side state-mutation half is covered by `h1-tenant-switch`
 * (single-tab TenantSwitcher click → POST /me/active-tenant). Combining
 * both halves in a single Playwright test is non-trivial because each
 * `BrowserContext` runs an independent MSW worker — server-side state
 * mutated in tab A's worker isn't visible in tab B's. Splitting the
 * coverage keeps each test deterministic.
 *
 * Runs on chromium only.
 */

test.describe("@security cross-tab tenant sync", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "cross-tab rig runs on chromium only");

  test("tenant-changed broadcast triggers /me refresh in tab B", async ({ browser }) => {
    const ctx = await browser.newContext({ serviceWorkers: "allow" });
    try {
      const pageA = await ctx.newPage();
      const pageB = await ctx.newPage();
      await Promise.all([waitForShell(pageA), waitForShell(pageB)]);

      // Arm a `/me` request waiter on tab B BEFORE we broadcast — the
      // SessionProvider's BroadcastChannel handler should fire `refresh()`
      // which hits `/me` again. We use waitForRequest with a generous
      // timeout because the listener is event-driven, not polled.
      const meRefreshPromise = pageB.waitForRequest(
        (req) => req.url().includes("/me") && req.method() === "GET",
        { timeout: 8_000 },
      );

      await pageA.evaluate(() => {
        const bc = new BroadcastChannel("sdm-session");
        bc.postMessage({
          type: "tenant-changed",
          tenantId: "globex",
          ts: Date.now(),
          sourceTabId: "test-tab-a",
        });
        bc.close();
      });

      const meRefresh = await meRefreshPromise;
      expect(meRefresh.method()).toBe("GET");
      expect(meRefresh.url()).toContain("/me");
    } finally {
      await ctx.close();
    }
  });
});

async function waitForShell(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByTestId("top-bar").waitFor({ timeout: 20_000 });
  await page.getByTestId("active-tenant").waitFor({ timeout: 20_000 });
}
