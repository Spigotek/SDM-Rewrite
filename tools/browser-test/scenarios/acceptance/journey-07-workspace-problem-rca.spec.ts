import { test, expect } from "../../fixtures/isolated-context";

/**
 * Journey #7 — `workspace-problem-rca` (agent_l2_marek).
 *
 * Anchors `acceptance-criteria.md §2.7`:
 *   1. Problems list renders + opens detail.
 *   2. Problem detail surfaces header + description + root-cause + linked
 *      incidents sections.
 *   3. Link-incident modal multi-selects and submits → linked list grows.
 *
 * Cross-tenant linking 422 (`@security:cross-tenant-deny`) is covered by
 * BFF integration tests (`packages/api-mocks` exposes the 422 shape).
 */
test("journey-07 workspace problem RCA — list → detail → link incident", async ({
  isolatedPage,
}) => {
  await isolatedPage.goto("/problems");

  const rows = isolatedPage.getByTestId("problems-row");
  await expect(rows.first()).toBeVisible({ timeout: 15_000 });

  await rows.first().click();
  await expect(isolatedPage).toHaveURL(/\/problems\//, { timeout: 10_000 });
  await expect(isolatedPage.getByTestId("problem-detail-page")).toBeVisible({ timeout: 15_000 });
  await expect(isolatedPage.getByTestId("problem-header")).toBeVisible();
  await expect(isolatedPage.getByTestId("problem-description")).toBeVisible();
  await expect(isolatedPage.getByTestId("problem-rootcause")).toBeVisible();
  await expect(isolatedPage.getByTestId("problem-linked-incidents")).toBeVisible();

  const baseline = await isolatedPage.getByTestId("problem-linked-row").count();
  await isolatedPage.getByTestId("problem-link-incident-open").click();
  const modal = isolatedPage.getByTestId("problem-link-modal");
  await expect(modal).toBeVisible({ timeout: 5_000 });

  const checkboxes = modal.locator("input[type=checkbox]:not(:disabled)");
  await expect(checkboxes.first()).toBeVisible({ timeout: 10_000 });
  await checkboxes.first().check();
  await isolatedPage.getByTestId("problem-link-modal-submit").click();
  await expect(modal).toBeHidden({ timeout: 5_000 });
  await expect(isolatedPage.getByTestId("problem-linked-row")).toHaveCount(baseline + 1, {
    timeout: 5_000,
  });
});
