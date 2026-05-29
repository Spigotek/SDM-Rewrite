import { test, expect } from "../../fixtures/isolated-context";

/**
 * Journey #8 — `workspace-cmdb-impact-analysis` (agent_l2_marek).
 *
 * Anchors `acceptance-criteria.md §2.8`:
 *   1. CMDB list → pick a CI → relationships tab.
 *   2. Graph canvas (or list fallback) renders within budget.
 *   3. Drill-in via list mode swaps the active CI.
 *
 * 200-node clustering + PDF export are deferred — large-graph perf cases
 * are tracked in `library-recommendation.md` and exercised through the
 * H.14 perf test rig (out of journey-smoke scope).
 */
test("journey-08 workspace CMDB impact — graph mount + list drill-in", async ({ isolatedPage }) => {
  await isolatedPage.goto("/cmdb");
  const table = isolatedPage.getByTestId("cmdb-table");
  await expect(table).toBeVisible({ timeout: 15_000 });

  const rows = isolatedPage.getByTestId("cmdb-row");
  await rows.first().click();
  await expect(isolatedPage).toHaveURL(/\/cmdb\/ci\//, { timeout: 10_000 });

  await isolatedPage.getByTestId("cmdb-tab-relationships").click();
  const panel = isolatedPage.getByTestId("cmdb-tabpanel-relationships");
  await expect(panel).toBeVisible();

  const canvas = isolatedPage.getByTestId("cmdb-graph-canvas");
  const empty = isolatedPage.getByTestId("cmdb-graph-empty");
  await expect(canvas.or(empty)).toBeVisible({ timeout: 15_000 });

  // If first CI has no neighbours, hop until one does (≤5 tries).
  let hasNeighbours = await canvas.isVisible();
  if (!hasNeighbours) {
    for (let i = 1; i < 6 && !hasNeighbours; i++) {
      await isolatedPage.goto("/cmdb");
      await expect(table).toBeVisible({ timeout: 10_000 });
      await isolatedPage.getByTestId("cmdb-row").nth(i).click();
      await expect(isolatedPage).toHaveURL(/\/cmdb\/ci\//, { timeout: 10_000 });
      await isolatedPage.getByTestId("cmdb-tab-relationships").click();
      await expect(panel).toBeVisible();
      hasNeighbours = await canvas.isVisible();
    }
  }
  expect(hasNeighbours).toBe(true);

  // Drill-in via list mode.
  await isolatedPage.getByTestId("cmdb-graph-mode-list").click();
  const listRows = isolatedPage.getByTestId("cmdb-graph-list-row");
  await expect(listRows.first()).toBeVisible({ timeout: 10_000 });
  const before = new URL(isolatedPage.url()).pathname;
  await listRows.first().locator("a").click();
  await expect(isolatedPage).toHaveURL(/\/cmdb\/ci\//, { timeout: 10_000 });
  expect(new URL(isolatedPage.url()).pathname).not.toBe(before);
});
