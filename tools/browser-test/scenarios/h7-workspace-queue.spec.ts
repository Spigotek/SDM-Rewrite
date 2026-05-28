import { test, expect } from "../fixtures/isolated-context";

/**
 * H.7 workspace queue end-to-end — drives the workspace shell after MSW
 * has hydrated the active session. Covers the four pillars of the chunk:
 *
 *   1. `/` redirects to `/queue` and the table renders rows from the MSW
 *      `/api/queue` aggregator handler.
 *   2. Keyboard nav `j`/`k` moves the selected row; `Enter` opens the
 *      split-pane placeholder (URL gains `?selected=:id`).
 *   3. Filter chips narrow the visible row set; reset clears them.
 *   4. Save view persists a localStorage entry exposed by the sidebar; the
 *      sidebar entry reapplies the same filters on click.
 */
test("H.7 queue — load, keyboard nav, filter chip, saved view", async ({ isolatedPage }) => {
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
  await expect(isolatedPage.getByTestId("queue-split-pane-placeholder")).toBeVisible();

  await isolatedPage.keyboard.press("Escape");
  await expect(isolatedPage).not.toHaveURL(/selected=/);

  // ── Filter chip toggle ───────────────────────────────────────────────
  const firstChip = isolatedPage.locator('[data-testid^="queue-chip-"]').first();
  await firstChip.click();
  await expect(firstChip).toHaveAttribute("aria-pressed", "true");

  const resetBtn = isolatedPage.getByTestId("queue-reset-filters");
  await expect(resetBtn).toBeVisible();
  await resetBtn.click();
  await expect(firstChip).toHaveAttribute("aria-pressed", "false");

  // ── Saved views — save current filter set under a name ──────────────
  // First apply a filter so the saved-view affordance is enabled.
  await firstChip.click();
  await expect(firstChip).toHaveAttribute("aria-pressed", "true");
  const nameInput = isolatedPage.getByTestId("queue-save-view-name");
  await nameInput.fill("My open");
  await isolatedPage.getByTestId("queue-save-view-submit").click();

  // Sidebar exposes the saved view; clicking it re-applies the filters.
  const savedSidebar = isolatedPage.locator('[data-testid^="queue-sidebar-view-"]');
  await expect(savedSidebar.first()).toHaveText("My open");
  await resetBtn.click();
  await expect(firstChip).toHaveAttribute("aria-pressed", "false");
  await savedSidebar.first().click();
  await expect(firstChip).toHaveAttribute("aria-pressed", "true");
});
