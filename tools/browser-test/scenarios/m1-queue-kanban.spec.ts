import { test, expect } from "../fixtures/isolated-context";

/**
 * M.1.B — workspace `/queue` Kanban view toggle (v1.4.0).
 *
 *   1. Default view is the table; toggling to "Tabuľa" lazy-loads the Kanban
 *      board and renders all four columns.
 *   2. At least one column has rows under it (drives the lazy-chunk render
 *      path past Suspense).
 *   3. The choice persists in `localStorage["sdm.workspace.queue.view"]`
 *      across a full page reload.
 *
 * Drag-and-drop is not exercised — Playwright's native dispatch is unreliable
 * for the HTML5 `DataTransfer.setData(...)` round-trip, and v1.4's drop
 * handler is covered separately by the BFF mutation integration tests.
 */
test("M.1.B queue — kanban toggle renders columns and persists across reload", async ({
  isolatedPage,
}) => {
  await isolatedPage.goto("/");
  await expect(isolatedPage).toHaveURL(/\/queue/, { timeout: 15_000 });

  // Default view is the table.
  await expect(isolatedPage.getByTestId("queue-table")).toBeVisible({ timeout: 15_000 });
  await expect(isolatedPage.getByTestId("queue-kanban")).toHaveCount(0);

  // Toggle to Kanban.
  await isolatedPage.getByTestId("queue-view-toggle-kanban").click();

  // Lazy chunk resolves — the board container shows up.
  const board = isolatedPage.getByTestId("queue-kanban");
  await expect(board).toBeVisible({ timeout: 10_000 });

  // All four columns present.
  for (const id of ["open", "inProgress", "waiting", "resolved"] as const) {
    await expect(isolatedPage.getByTestId(`queue-kanban-column-${id}`)).toBeVisible();
  }

  // At least one column reports a non-zero count. The MSW fixtures seed a mix
  // of statuses; we don't pin the exact distribution.
  const counts = await isolatedPage.locator('[data-testid^="queue-kanban-count-"]').allInnerTexts();
  const totals = counts.map((s) => Number.parseInt(s.trim(), 10)).filter((n) => Number.isFinite(n));
  expect(totals.some((n) => n > 0)).toBe(true);

  // Cards rendered.
  await expect(isolatedPage.getByTestId("queue-kanban-card").first()).toBeVisible();

  // Persistence — localStorage holds the choice, and reloading lands on Kanban.
  const persisted = await isolatedPage.evaluate(() =>
    window.localStorage.getItem("sdm.workspace.queue.view"),
  );
  expect(persisted).toBe("kanban");

  await isolatedPage.reload();
  await expect(isolatedPage.getByTestId("queue-kanban")).toBeVisible({ timeout: 15_000 });
  await expect(isolatedPage.getByTestId("queue-table")).toHaveCount(0);

  // Toggle back to table and confirm persistence.
  await isolatedPage.getByTestId("queue-view-toggle-table").click();
  await expect(isolatedPage.getByTestId("queue-table")).toBeVisible();
  const persistedBack = await isolatedPage.evaluate(() =>
    window.localStorage.getItem("sdm.workspace.queue.view"),
  );
  expect(persistedBack).toBe("table");
});
