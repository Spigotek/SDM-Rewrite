import { test, expect } from "../fixtures/isolated-context";

/**
 * H.5 portal Service Catalog — Lucia journey.
 *
 * Paths covered:
 *   1. `/catalog` renders the CategoryTiles (4) + featured grid.
 *   2. Clicking a category filters the list (toggles aria-pressed).
 *   3. Clicking a featured item navigates to `/catalog/:itemId`.
 *   4. DynamicForm renders the schema-driven fields, including a radio
 *      group with a conditional visibility branch (`audience=colleague`
 *      reveals `user-picker`).
 *   5. Submit posts to `/api/requests` → success screen with the new
 *      request ref + view-ticket CTA.
 */
test("portal H.5 catalog — browse + filter + dynamic-form submit", async ({ isolatedPage }) => {
  // Bootstrap MSW via the home route first.
  await isolatedPage.goto("/");
  await expect(isolatedPage.getByTestId("portal-home")).toBeVisible({ timeout: 15_000 });

  // Open the catalog list.
  await isolatedPage.goto("/catalog");
  const route = isolatedPage.getByTestId("portal-catalog");
  await expect(route).toBeVisible({ timeout: 15_000 });

  // CategoryTiles — 4 tiles visible.
  await expect(isolatedPage.getByTestId("catalog-categories")).toBeVisible();
  await expect(isolatedPage.getByTestId("catalog-category-hardware")).toBeVisible();
  await expect(isolatedPage.getByTestId("catalog-category-software")).toBeVisible();
  await expect(isolatedPage.getByTestId("catalog-category-access")).toBeVisible();
  await expect(isolatedPage.getByTestId("catalog-category-other")).toBeVisible();

  // Featured grid surfaces at least one card.
  await expect(isolatedPage.getByTestId("catalog-list")).toBeVisible({ timeout: 10_000 });

  // Filter by software — figma offering is featured under "software".
  await isolatedPage.getByTestId("catalog-category-software").click();
  await expect(isolatedPage.getByTestId("catalog-category-software")).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  // Open the Figma item detail.
  const figmaCard = isolatedPage.getByTestId(/^catalog-featured-catalog:figma/).first();
  await expect(figmaCard).toBeVisible({ timeout: 10_000 });
  await figmaCard.click();

  await expect(isolatedPage.getByTestId("portal-catalog-item")).toBeVisible({ timeout: 10_000 });
  await expect(isolatedPage.getByTestId("catalog-form")).toBeVisible();

  // Radio group `audience` — pick "self" branch first so the conditional
  // `colleague` user-picker stays hidden.
  await isolatedPage.getByTestId("catalog-field-audience-self").check();

  // The conditional `colleague` user-picker MUST NOT be visible.
  await expect(isolatedPage.getByTestId("catalog-field-colleague")).toHaveCount(0);

  // Fill the required text + select fields.
  await isolatedPage.getByTestId("catalog-field-costCenter").locator("input").fill("Brand 2026");

  // The `duration` select — open + pick the first option (12 mesiacov).
  await isolatedPage
    .locator('[data-component="select"]')
    .filter({ hasText: /Trvanie/ })
    .locator("button")
    .click();
  await isolatedPage.getByRole("option", { name: /12 mesiacov/ }).click();

  // Submit.
  await isolatedPage.getByTestId("catalog-form-submit").click();

  // Success screen → carries `data-ticket-ref` with the new request ref.
  const success = isolatedPage.getByTestId("catalog-item-success");
  await expect(success).toBeVisible({ timeout: 10_000 });
  await expect(success).toHaveAttribute("data-ticket-ref", /^REQ-\d+$/);
  await expect(isolatedPage.getByTestId("catalog-item-success-view")).toBeVisible();
  await expect(isolatedPage.getByTestId("catalog-item-success-back")).toBeVisible();
});
