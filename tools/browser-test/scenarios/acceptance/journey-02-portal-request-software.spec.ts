import { test, expect } from "../../fixtures/isolated-context";

/**
 * Journey #2 — `portal-request-software` (requester_lucia).
 *
 * Anchors `acceptance-criteria.md §2.2` happy path:
 *   1. Service Catalog search/filter narrows the offering set.
 *   2. Clicking a featured offering renders the dynamic form.
 *   3. Submit yields 201 with a request ref.
 *
 * Manager-approve / rejection branches are deferred to BFF integration —
 * MSW does not simulate the second-user approval round-trip end-to-end.
 */
test("journey-02 portal software request — catalog → dynamic form → request ref", async ({
  isolatedPage,
}) => {
  // Dynamic form submit + catalog list + first-render MSW cold-start can
  // exceed the 60 s default. Bump for safety on CI runners.
  test.setTimeout(120_000);
  await isolatedPage.goto("/");
  await expect(isolatedPage.getByTestId("portal-home")).toBeVisible({ timeout: 15_000 });

  await isolatedPage.goto("/catalog");
  await expect(isolatedPage.getByTestId("portal-catalog")).toBeVisible({ timeout: 30_000 });

  // Wait for the catalog list to populate. `catalog-list` only renders on
  // success+nonempty; covers the path the journey actually exercises. If
  // MSW is slow on the cold boot the query may take >15 s in preview mode.
  await expect(isolatedPage.getByTestId("catalog-list")).toBeVisible({ timeout: 30_000 });

  // Filter by software category — software card group.
  await isolatedPage.getByTestId("catalog-category-software").click();
  await expect(isolatedPage.getByTestId("catalog-category-software")).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  // Open the Figma offering — featured under "software".
  const figmaCard = isolatedPage.getByTestId(/^catalog-featured-catalog:figma/).first();
  await expect(figmaCard).toBeVisible({ timeout: 15_000 });
  await figmaCard.click();

  await expect(isolatedPage.getByTestId("portal-catalog-item")).toBeVisible({ timeout: 10_000 });
  await expect(isolatedPage.getByTestId("catalog-form")).toBeVisible();

  // Audience = self (avoids conditional colleague picker).
  await isolatedPage.getByTestId("catalog-field-audience-self").check();
  await isolatedPage.getByTestId("catalog-field-costCenter").locator("input").fill("Brand 2026");

  await isolatedPage
    .locator('[data-component="select"]')
    .filter({ hasText: /Trvanie/ })
    .locator("button")
    .click();
  await isolatedPage.getByRole("option", { name: /12 mesiacov/ }).click();

  await isolatedPage.getByTestId("catalog-form-submit").click();

  const success = isolatedPage.getByTestId("catalog-item-success");
  await expect(success).toBeVisible({ timeout: 10_000 });
  await expect(success).toHaveAttribute("data-ticket-ref", /^REQ-\d+$/);
});
