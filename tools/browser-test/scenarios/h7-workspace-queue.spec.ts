import { test, expect } from "../fixtures/isolated-context";

/**
 * H.7 workspace queue end-to-end — drives the workspace shell after MSW
 * has hydrated the active session. Covers the surviving pillars of the chunk:
 *
 *   1. `/` redirects to `/queue` and the table renders rows from the MSW
 *      `/api/queue` aggregator handler.
 *   2. Keyboard nav `j`/`k` moves the selected row; `Enter` opens the
 *      M.2.B detail drawer (URL gains `?selected=:id`); `Escape` closes it.
 *   3. Filter chips narrow the visible row set; reset clears them.
 *
 * Saved-views (the inner left rail + "Save view" toolbar input) were removed
 * in M.2.B per owner feedback, so the H.7 saved-view sub-test is gone.
 */
test("H.7 queue — load, keyboard nav, detail drawer, filter chip", async ({ isolatedPage }) => {
  await isolatedPage.goto("/");

  // `/` should redirect to `/queue` (the workspace landing).
  await expect(isolatedPage).toHaveURL(/\/queue/, { timeout: 15_000 });

  // Active tenant testid preserved for H.1 smoke contract.
  await expect(isolatedPage.getByTestId("active-tenant")).toHaveText("acme-corp", {
    timeout: 15_000,
  });

  const table = isolatedPage.getByTestId("queue-table");
  await expect(table).toBeVisible({ timeout: 15_000 });
  const rows = isolatedPage.getByTestId("queue-row");
  const rowCount = await rows.count();
  expect(rowCount).toBeGreaterThan(0);

  // ── Keyboard nav ─────────────────────────────────────────────────────
  await isolatedPage.locator("body").click();
  await isolatedPage.keyboard.press("j");
  await expect(rows.first()).toHaveAttribute("data-selected", "true");

  await isolatedPage.keyboard.press("j");
  const secondRow = rows.nth(1);
  await expect(secondRow).toHaveAttribute("data-selected", "true");

  await isolatedPage.keyboard.press("k");
  await expect(rows.first()).toHaveAttribute("data-selected", "true");

  await isolatedPage.keyboard.press("Enter");
  await expect(isolatedPage).toHaveURL(/selected=/);
  // M.2.B — selection opens the right-side detail drawer (replaces the
  // permanent split-pane). The drawer hosts the existing `queue-detail-pane`
  // body, so both testids are present.
  const drawer = isolatedPage.getByTestId("queue-detail-drawer");
  await expect(drawer).toBeVisible();
  await expect(isolatedPage.getByTestId("queue-detail-pane")).toBeVisible();

  await isolatedPage.keyboard.press("Escape");
  await expect(isolatedPage).not.toHaveURL(/selected=/);
  await expect(drawer).toHaveCount(0);

  // ── Filter chip toggle ───────────────────────────────────────────────
  const firstChip = isolatedPage.locator('[data-testid^="queue-chip-"]').first();
  await firstChip.click();
  await expect(firstChip).toHaveAttribute("aria-pressed", "true");

  const resetBtn = isolatedPage.getByTestId("queue-reset-filters");
  await expect(resetBtn).toBeVisible();
  await resetBtn.click();
  await expect(firstChip).toHaveAttribute("aria-pressed", "false");
});
