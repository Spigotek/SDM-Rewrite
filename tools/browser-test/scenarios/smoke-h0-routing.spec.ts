import { test, expect } from "../fixtures/isolated-context";

/**
 * H.0 routing smoke — verifies the React Router 6 data router is wired and
 * client-side navigation + deep-linking + 404 fallback work end-to-end. Drives
 * portal because portal owns the full route tree H.0 introduces; workspace
 * `/queue` redirect from `/` is exercised by the unchanged
 * `smoke-workspace.spec.ts` (still goto("/")).
 */
test("portal H.0 routing — home, deep-link, navigate, 404", async ({ isolatedPage }) => {
  // 1. Home `/` loads the routed placeholder (preserves E.3 smoke contract).
  await isolatedPage.goto("/");
  await expect(isolatedPage.getByTestId("top-bar")).toBeVisible({ timeout: 15_000 });
  await expect(isolatedPage.getByTestId("portal-home")).toBeVisible({ timeout: 15_000 });
  await expect(isolatedPage.getByRole("heading", { name: "SDM Portal" })).toBeVisible();

  // 2. Client-side navigation via History API (simulating <Link> click).
  await isolatedPage.evaluate(() => {
    window.history.pushState({}, "", "/tickets");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await expect(isolatedPage.getByTestId("portal-my-tickets")).toBeVisible({ timeout: 5_000 });

  // 3. Deep-link to a parametrised route from a fresh page load.
  await isolatedPage.goto("/tickets/INC-123");
  await expect(isolatedPage.getByTestId("portal-ticket-detail")).toBeVisible({ timeout: 15_000 });
  await expect(isolatedPage.getByRole("heading")).toContainText("INC-123");

  // 4. Catalog deep-link with a different param name.
  await isolatedPage.goto("/catalog/item-42");
  await expect(isolatedPage.getByTestId("portal-catalog-item")).toBeVisible({ timeout: 15_000 });
  await expect(isolatedPage.getByRole("heading")).toContainText("item-42");

  // 5. Unknown route renders the 404 fallback.
  await isolatedPage.goto("/this-route-does-not-exist");
  await expect(isolatedPage.getByTestId("route-not-found")).toBeVisible({ timeout: 15_000 });
});
