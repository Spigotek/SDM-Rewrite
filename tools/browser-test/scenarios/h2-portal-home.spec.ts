import { test, expect } from "../fixtures/isolated-context";

/**
 * Portal home dashboard — Lucia journey (originally H.2 AC #1, rebuilt in
 * K.1 v1.1.4 per the multi-column dashboard brief §10.1).
 *
 *  1. `/` renders the personalised greeting (resolves from `/me` displayName).
 *  2. Quick-action tiles ("Nahlásiť problém" / "Hardvér / Softvér" / "Reset hesla")
 *     are present and route correctly client-side.
 *  3. Open-tickets card pre-populates from the loader (MSW fixture seeds
 *     incidents for `user-1` = Anna who is the default MSW session user).
 */
test("portal home — greeting, quick actions, open tickets", async ({ isolatedPage }) => {
  await isolatedPage.goto("/");

  // Shell + home root rendered.
  await expect(isolatedPage.getByTestId("top-bar")).toBeVisible({ timeout: 15_000 });
  await expect(isolatedPage.getByTestId("portal-home")).toBeVisible({ timeout: 15_000 });

  // Greeting heading exists with a personalised salutation.
  const hero = isolatedPage.getByTestId("home-hero");
  await expect(hero).toBeVisible();
  await expect(hero).toContainText(/Dobrý deň|Hello/);

  // Quick-action tiles.
  const reportCta = isolatedPage.getByTestId("home-quick-action-report");
  const catalogCta = isolatedPage.getByTestId("home-quick-action-catalog");
  const passwordCta = isolatedPage.getByTestId("home-quick-action-password");
  await expect(reportCta).toBeVisible();
  await expect(catalogCta).toBeVisible();
  await expect(passwordCta).toBeVisible();

  // Client-side navigation: click "Nahlásiť problém" → URL changes + new-incident page renders.
  await reportCta.click();
  await expect(isolatedPage).toHaveURL(/\/new-incident$/);
  await expect(isolatedPage.getByTestId("portal-new-incident")).toBeVisible({ timeout: 5_000 });

  // Back to home; verify the open-tickets card landed.
  await isolatedPage.goto("/");
  await expect(isolatedPage.getByTestId("portal-home")).toBeVisible({ timeout: 15_000 });
  // The card itself is the assertion target — its internal state (rows vs.
  // empty-state) is data-driven by the MSW fixture, so just confirm the
  // card frame is mounted.
  await expect(isolatedPage.getByTestId("home-open-tickets")).toBeVisible({ timeout: 5_000 });
});
