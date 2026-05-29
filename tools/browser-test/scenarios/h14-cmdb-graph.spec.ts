import { test, expect } from "../fixtures/isolated-context";

/**
 * H.14 CMDB relationships graph — Cytoscape lazy chunk end-to-end.
 *
 * Path:
 *   1. Land on `/cmdb`, click the first row to open detail.
 *   2. Switch to the Relationships tab, expect the tabpanel.
 *   3. Verify the graph mode is active by default and the Cytoscape `<canvas>`
 *      mounts inside `cmdb-graph-canvas`.
 *   4. Toggle to list mode, verify treeview rows render with relType + arrow.
 *   5. Click a list row → URL changes to a different `/cmdb/ci/<id>`.
 *   6. Back on the new CI's Relationships tab, switch the layout selector and
 *      verify it doesn't crash (graph re-runs the layout in-place).
 *
 * Notes:
 *  - We pick the list-view drill-in instead of clicking a canvas node — the
 *    canvas exposes no per-node DOM, so a CDP click would have to be aimed at
 *    pixel coordinates which is flappy. The list view is the a11y-equivalent
 *    surface and exercises the same `navigate(/cmdb/ci/:id)` code path.
 *  - We don't assert the legend is visible because the test doesn't care about
 *    the symbol; the snapshot test covers that.
 */
test("H.14 cmdb — relationships graph mounts, list toggle, drill-in", async ({ isolatedPage }) => {
  await isolatedPage.goto("/cmdb");

  const table = isolatedPage.getByTestId("cmdb-table");
  await expect(table).toBeVisible({ timeout: 15_000 });

  const firstRow = isolatedPage.getByTestId("cmdb-row").first();
  await firstRow.click();
  await expect(isolatedPage).toHaveURL(/\/cmdb\/ci\//, { timeout: 10_000 });

  await isolatedPage.getByTestId("cmdb-tab-relationships").click();
  const panel = isolatedPage.getByTestId("cmdb-tabpanel-relationships");
  await expect(panel).toBeVisible();
  await expect(isolatedPage).toHaveURL(/[?&]tab=relationships/);

  // Either the canvas mounts (CI has neighbours) or the empty state surfaces.
  const canvas = isolatedPage.getByTestId("cmdb-graph-canvas");
  const empty = isolatedPage.getByTestId("cmdb-graph-empty");
  await expect(canvas.or(empty)).toBeVisible({ timeout: 15_000 });

  // If the empty branch fired, advance to a CI that has neighbours by hopping
  // the list page until we find one. Our MSW fixture has ~60 relationships on
  // 50 CIs so the first row almost always has at least one, but be safe.
  let hasNeighbours = await canvas.isVisible();
  if (!hasNeighbours) {
    // Cycle through up to 5 rows looking for one with relationships.
    for (let i = 1; i < 6 && !hasNeighbours; i++) {
      await isolatedPage.goto("/cmdb");
      await expect(table).toBeVisible({ timeout: 10_000 });
      const row = isolatedPage.getByTestId("cmdb-row").nth(i);
      await row.click();
      await expect(isolatedPage).toHaveURL(/\/cmdb\/ci\//, { timeout: 10_000 });
      await isolatedPage.getByTestId("cmdb-tab-relationships").click();
      await expect(panel).toBeVisible();
      hasNeighbours = await canvas.isVisible();
    }
  }
  expect(hasNeighbours).toBe(true);

  // Cytoscape renders to a `<canvas>` inside the test-id wrapper.
  const canvasEl = canvas.locator("canvas").first();
  await expect(canvasEl).toBeVisible({ timeout: 15_000 });

  // List-mode toggle — verify treeview rows render and drill-in works.
  await isolatedPage.getByTestId("cmdb-graph-mode-list").click();
  const rows = isolatedPage.getByTestId("cmdb-graph-list-row");
  await expect(rows.first()).toBeVisible({ timeout: 10_000 });
  const rowCount = await rows.count();
  expect(rowCount).toBeGreaterThan(0);

  // Capture the source CI's URL, then drill into the first neighbour.
  const beforeUrl = isolatedPage.url();
  await rows.first().locator("a").click();
  await expect(isolatedPage).toHaveURL(/\/cmdb\/ci\//, { timeout: 10_000 });
  const afterUrl = isolatedPage.url();
  // URL must have changed to a different CI id (path without query).
  const beforePath = new URL(beforeUrl).pathname;
  const afterPath = new URL(afterUrl).pathname;
  expect(afterPath).not.toBe(beforePath);

  // After drill-in we land on Detail tab by default — switch back to
  // Relationships and verify the layout selector works (graph mode default).
  await isolatedPage.getByTestId("cmdb-tab-relationships").click();
  await expect(panel).toBeVisible();
  // Wait for either the canvas or an empty state again on the new CI.
  await expect(canvas.or(empty)).toBeVisible({ timeout: 15_000 });
  if (await canvas.isVisible()) {
    const layoutSelect = isolatedPage.getByTestId("cmdb-graph-layout");
    await layoutSelect.selectOption("tree");
    await expect(layoutSelect).toHaveValue("tree");
    await layoutSelect.selectOption("breadth");
    await expect(layoutSelect).toHaveValue("breadth");
  }
});
