import { test, expect } from "../../fixtures/isolated-context";

/**
 * Journey #17 — `workspace-cmdb-relationship-impact` (cmdb_owner_robert).
 *
 * Anchors `acceptance-criteria.md §2.17`:
 *   1. CI relationships tab → Cytoscape canvas mounts (or empty state).
 *   2. Layout selector swap doesn't crash the graph.
 *   3. List mode toggle renders treeview rows + drill-in changes the URL.
 *
 * PDF export with progress bar is deferred — falls under bulk-export UX
 * tracked in Phase I.4 (reporting).
 */
test("journey-17 workspace CMDB relationships — graph layout swap + list drill-in", async ({
  isolatedPage,
}) => {
  await isolatedPage.goto("/cmdb");
  await expect(isolatedPage.getByTestId("cmdb-table")).toBeVisible({ timeout: 15_000 });

  // Find a CI with neighbours by cycling first 6 rows.
  const rows = isolatedPage.getByTestId("cmdb-row");
  const canvas = isolatedPage.getByTestId("cmdb-graph-canvas");
  const panel = isolatedPage.getByTestId("cmdb-tabpanel-relationships");

  let hasNeighbours = false;
  for (let i = 0; i < 6 && !hasNeighbours; i++) {
    await isolatedPage.goto("/cmdb");
    await expect(isolatedPage.getByTestId("cmdb-table")).toBeVisible({ timeout: 10_000 });
    await rows.nth(i).click();
    await expect(isolatedPage).toHaveURL(/\/cmdb\/ci\//, { timeout: 10_000 });
    await isolatedPage.getByTestId("cmdb-tab-relationships").click();
    await expect(panel).toBeVisible();
    hasNeighbours = await canvas.isVisible().catch(() => false);
  }
  expect(hasNeighbours).toBe(true);

  // Layout selector swap.
  const layout = isolatedPage.getByTestId("cmdb-graph-layout");
  await layout.selectOption("tree");
  await expect(layout).toHaveValue("tree");
  await layout.selectOption("breadth");
  await expect(layout).toHaveValue("breadth");

  // List mode drill-in.
  await isolatedPage.getByTestId("cmdb-graph-mode-list").click();
  const listRows = isolatedPage.getByTestId("cmdb-graph-list-row");
  await expect(listRows.first()).toBeVisible({ timeout: 10_000 });
  const before = new URL(isolatedPage.url()).pathname;
  await listRows.first().locator("a").click();
  await expect(isolatedPage).toHaveURL(/\/cmdb\/ci\//, { timeout: 10_000 });
  expect(new URL(isolatedPage.url()).pathname).not.toBe(before);
});
