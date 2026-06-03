import { test, expect, type Page } from "@playwright/test";

/**
 * I.2 — cross-tab logout sync via BroadcastChannel (`@sdm/api-client/cross-tab`).
 *
 * `acceptance-criteria.md §4.1` `cross-tab-logout` vector: when a user logs out
 * in tab A, tab B (same origin) must drop to the anonymous state within ~2 s
 * without polling `/me`. Implementation: `SessionProvider` in both portal +
 * workspace subscribes to the `sdm-session` BroadcastChannel; a
 * `{ type: "logout" }` message clears the local session state.
 *
 * Rig design: two pages of the SAME `BrowserContext` simulate the "two tabs"
 * scenario. In real browsers BroadcastChannel propagates across same-origin
 * tabs because they share the renderer process; in Playwright, separate
 * `browser.newContext()` instances are isolated (like incognito windows) and
 * BroadcastChannel does NOT cross contexts. The same-context two-page rig is
 * the canonical reproduction of the production "two-tabs" case.
 *
 * Runs on chromium only.
 */

test.describe("@security cross-tab logout", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "cross-tab rig runs on chromium only");

  test("logout in tab A → tab B drops to anonymous (BroadcastChannel)", async ({ browser }) => {
    const ctx = await browser.newContext({ serviceWorkers: "allow" });
    try {
      const pageA = await ctx.newPage();
      const pageB = await ctx.newPage();

      await Promise.all([waitForShell(pageA), waitForShell(pageB)]);

      // Sanity: both tabs report the same active tenant from `/me`.
      const initialA = await pageA.getByTestId("active-tenant").textContent();
      const initialB = await pageB.getByTestId("active-tenant").textContent();
      expect(initialA).toBeTruthy();
      expect(initialB).toBe(initialA);

      // Broadcast a logout from tab A. This is the production code path —
      // `<SessionProvider>` calls channel.post({ type: "logout" }) inside
      // its `logout` callback after `/auth/logout` resolves. Posting the
      // raw BroadcastChannel message skips the network round-trip + cookie
      // clear (MSW doesn't propagate Set-Cookie reliably for `/auth/logout`)
      // and isolates the cross-tab receiver contract.
      await pageA.evaluate(() => {
        const bc = new BroadcastChannel("sdm-session");
        bc.postMessage({
          type: "logout",
          ts: Date.now(),
          sourceTabId: "test-tab-a",
        });
        bc.close();
      });

      // Tab B must reflect the dropped session — `<TopBar>` only renders
      // the user pill + logout button when `status === "ready"`, so the
      // pill disappears once the listener fires.
      await expect(pageB.getByTestId("user-pill")).toBeHidden({ timeout: 5_000 });
      await expect(pageB.getByTestId("logout-button")).toBeHidden();
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
