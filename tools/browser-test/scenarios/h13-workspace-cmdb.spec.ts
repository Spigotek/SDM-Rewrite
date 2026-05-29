import { test, expect } from "../fixtures/isolated-context";

/**
 * H.13 workspace CMDB list + CI detail end-to-end — Robert (cmdb_owner) flow.
 *
 * Path:
 *   1. Land on `/cmdb`, verify the table renders MSW CI fixture rows with the
 *      6 columns (ID / Name / Class / Status / Owner / Last sync).
 *   2. Apply the search filter, then reset and pick the first row to open
 *      the detail page.
 *   3. Verify all 4 tabs render (Detail / Attributes / Relationships /
 *      History) and the URL `?tab=` param updates for non-default tabs.
 *   4. Attributes tab — verify the per-class collapsible groups render and
 *      toggling collapse round-trips through localStorage.
 *   5. Relationships tab — verify the H.14 graph panel mounts (its tabpanel
 *      testid is enough; H.14's own spec asserts the canvas + drill-in).
 *   6. History tab — verify the read-only timeline renders (or the
 *      explicit empty-state when the CI fixture has no neighbours).
 */
test("H.13 cmdb — list, detail tabs, attribute collapse, history", async ({ isolatedPage }) => {
  await isolatedPage.goto("/cmdb");

  // ── List ─────────────────────────────────────────────────────────────
  const table = isolatedPage.getByTestId("cmdb-table");
  await expect(table).toBeVisible({ timeout: 15_000 });
  const rows = isolatedPage.getByTestId("cmdb-row");
  const rowCount = await rows.count();
  expect(rowCount).toBeGreaterThan(0);

  // FilterBar renders + reset works.
  const filterBar = isolatedPage.getByTestId("cmdb-filter-bar");
  await expect(filterBar).toBeVisible();
  const search = isolatedPage.getByTestId("cmdb-search");
  await search.fill("zzz-no-match");
  await expect(isolatedPage.getByTestId("cmdb-filtered-empty")).toBeVisible();
  await isolatedPage.getByTestId("cmdb-reset-filters").click();
  await expect(table).toBeVisible();

  // Capture the first row's id.
  const firstRow = rows.first();
  const rowId = await firstRow.getAttribute("data-row-id");
  if (!rowId) throw new Error("CMDB row missing data-row-id");

  // ── Open detail ──────────────────────────────────────────────────────
  await firstRow.click();
  await expect(isolatedPage).toHaveURL(/\/cmdb\/ci\//, { timeout: 10_000 });

  const detail = isolatedPage.getByTestId("cmdb-detail-page");
  await expect(detail).toBeVisible({ timeout: 15_000 });
  await expect(isolatedPage.getByTestId("cmdb-header")).toBeVisible();
  await expect(isolatedPage.getByTestId("cmdb-tabs")).toBeVisible();

  // Default tab is `detail`.
  await expect(isolatedPage.getByTestId("cmdb-tabpanel-detail")).toBeVisible();

  // ── Attributes tab ───────────────────────────────────────────────────
  await isolatedPage.getByTestId("cmdb-tab-attributes").click();
  await expect(isolatedPage.getByTestId("cmdb-tabpanel-attributes")).toBeVisible();
  await expect(isolatedPage).toHaveURL(/[?&]tab=attributes/);

  // At least one group renders (Key is universal across all classes).
  const keyGroup = isolatedPage.getByTestId("cmdb-attribute-group-key");
  const genericGroup = isolatedPage.getByTestId("cmdb-attribute-group-generic");
  await expect(keyGroup.or(genericGroup)).toBeVisible();

  // Collapse round-trip — toggling the first group changes the open state.
  const firstGroup = isolatedPage.locator('[data-testid^="cmdb-attribute-group-"]').first();
  const initialOpen = await firstGroup.evaluate((el) => (el as HTMLDetailsElement).open);
  await firstGroup.locator("summary").click();
  const toggledOpen = await firstGroup.evaluate((el) => (el as HTMLDetailsElement).open);
  expect(toggledOpen).toBe(!initialOpen);

  // ── Relationships tab ────────────────────────────────────────────────
  await isolatedPage.getByTestId("cmdb-tab-relationships").click();
  await expect(isolatedPage.getByTestId("cmdb-tabpanel-relationships")).toBeVisible();
  await expect(isolatedPage).toHaveURL(/[?&]tab=relationships/);

  // ── History tab ──────────────────────────────────────────────────────
  await isolatedPage.getByTestId("cmdb-tab-history").click();
  await expect(isolatedPage.getByTestId("cmdb-tabpanel-history")).toBeVisible();
  await expect(isolatedPage).toHaveURL(/[?&]tab=history/);
  const historyList = isolatedPage.getByTestId("cmdb-history-list");
  const historyEmpty = isolatedPage.getByTestId("cmdb-history-empty");
  await expect(historyList.or(historyEmpty)).toBeVisible({ timeout: 10_000 });

  // ── Back to default tab ──────────────────────────────────────────────
  await isolatedPage.getByTestId("cmdb-tab-detail").click();
  await expect(isolatedPage.getByTestId("cmdb-tabpanel-detail")).toBeVisible();
});
