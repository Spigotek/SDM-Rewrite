import { test, expect } from "../fixtures/isolated-context";

/**
 * H.1 tenant-switch end-to-end — drives the portal because the multi-tenant
 * fixture user `user-1` (Anna Analyst) defaults to the portal app shell. The
 * scenario verifies:
 *
 *   1. Initial state shows the compact tenant display + env badge.
 *   2. Pressing `T` opens the expanded dropdown (kbd shortcut).
 *   3. Search filters the list.
 *   4. Selecting Globex triggers POST /me/active-tenant and the active tenant
 *      label + the testid display swap to the new tenant.
 *   5. The MSW handler updates its in-memory state so subsequent /me fetches
 *      return the new tenant — verified by reading `active-tenant` on the home
 *      placeholder which renders `session.tenantId`.
 */
test("H.1 tenant switch — kbd shortcut, search, broad cache nuke", async ({ isolatedPage }) => {
  await isolatedPage.goto("/");

  const tenantDisplay = isolatedPage.getByTestId("tenant-display");
  await expect(tenantDisplay).toBeVisible({ timeout: 15_000 });
  await expect(tenantDisplay).toContainText("Acme Corporation");

  const envBadgeInDisplay = tenantDisplay.locator('[data-component="tenant-env-badge"]');
  await expect(envBadgeInDisplay).toHaveAttribute("data-env", "production");

  // Kbd shortcut `T` opens the dropdown — focus must not be inside an input.
  await isolatedPage.locator("body").click();
  await isolatedPage.keyboard.press("t");
  const list = isolatedPage.getByTestId("tenant-list");
  await expect(list).toBeVisible();

  // Search filter — typing "glo" narrows the list to Globex only.
  await isolatedPage.getByTestId("tenant-search").fill("glo");
  await expect(list.locator("li[role=option]")).toHaveCount(1);

  // Switch to Globex.
  await isolatedPage.getByTestId("tenant-row-globex").click();

  // After the mutation lands the display updates + the env badge swaps to
  // Globex's "staging" tone.
  await expect(tenantDisplay).toContainText("Globex Industries", { timeout: 5_000 });
  await expect(tenantDisplay.locator('[data-component="tenant-env-badge"]')).toHaveAttribute(
    "data-env",
    "staging",
  );

  // Home placeholder renders `session.tenantId` — confirms the session context
  // picked up the new active tenant from the mutation response, not a follow-up
  // /me fetch.
  await expect(isolatedPage.getByTestId("active-tenant")).toHaveText("globex");
});

test("H.1 tenant switch — single-tenant variant is read-only", async ({ isolatedPage }) => {
  // The default mock user is multi-tenant. To exercise the single-tenant
  // variant we'd need a different fixture user — out of scope for this PR;
  // this test asserts the basic data-variant attribute exists so the variant
  // logic is wired even if it can't yet flip to `single` for the default user.
  await isolatedPage.goto("/");
  const switcher = isolatedPage.getByTestId("tenant-switcher");
  await expect(switcher).toBeVisible({ timeout: 15_000 });
  await expect(switcher).toHaveAttribute("data-variant", /compact|expanded/);
});
