import { test, expect } from "../../fixtures/isolated-context";

/**
 * Journey #2 — `portal-request-software` (requester_lucia).
 *
 * Anchors `acceptance-criteria.md §2.2` happy path:
 *   1. Service Catalog search/filter narrows the offering set.
 *   2. Clicking a featured offering renders the dynamic form.
 *   3. Submit yields 201 with a request ref.
 *
 * I.1 restored the full submit roundtrip after the DynamicForm visibility
 * fix in `apps/portal/src/features/catalog/components/DynamicForm.tsx`. The
 * static Zod schema previously required the hidden `colleague` user-picker
 * (visibleIf `audience === "colleague"`), so submit silently failed when
 * `audience === "self"`. The fix builds the resolver against the currently
 * visible field set and toggles `shouldUnregister: true` so RHF state and
 * the schema stay in lockstep.
 */
test("journey-02 portal software request — catalog → dynamic form → submit", async ({
  isolatedPage,
}) => {
  test.setTimeout(120_000);
  await isolatedPage.goto("/");
  await expect(isolatedPage.getByTestId("portal-home")).toBeVisible({ timeout: 15_000 });

  await isolatedPage.goto("/catalog");
  await expect(isolatedPage.getByTestId("portal-catalog")).toBeVisible({ timeout: 30_000 });

  await expect(isolatedPage.getByTestId("catalog-list")).toBeVisible({ timeout: 30_000 });

  await isolatedPage.getByTestId("catalog-category-software").click();
  await expect(isolatedPage.getByTestId("catalog-category-software")).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  const figmaCard = isolatedPage.getByTestId(/^catalog-featured-catalog:figma/).first();
  await expect(figmaCard).toBeVisible({ timeout: 15_000 });
  await figmaCard.click();

  await expect(isolatedPage.getByTestId("portal-catalog-item")).toBeVisible({ timeout: 10_000 });
  await expect(isolatedPage.getByTestId("catalog-form")).toBeVisible();

  // Audience = self. The conditional `colleague` user-picker stays hidden
  // and — post-I.1 — is no longer required by the resolver (it's filtered
  // out of the visibility-aware schema in DynamicForm).
  await isolatedPage.getByTestId("catalog-field-audience-self").check();

  await isolatedPage.getByTestId("catalog-field-costCenter").fill("Brand 2026");

  await isolatedPage
    .locator('[data-component="select"]')
    .filter({ hasText: /Trvanie/ })
    .locator("button")
    .click();
  await isolatedPage.getByRole("option", { name: /12 mesiacov/ }).click();

  await isolatedPage.getByTestId("catalog-form-submit").click();

  const success = isolatedPage.getByTestId("catalog-item-success");
  await expect(success).toBeVisible({ timeout: 15_000 });
  await expect(success).toHaveAttribute("data-ticket-ref", /^REQ-\d+$/);
  await expect(isolatedPage.getByTestId("catalog-item-success-view")).toBeVisible();
});
