import { test, expect } from "../../fixtures/isolated-context";

/**
 * Journey #4 — `workspace-incident-triage` (agent_l1_anna).
 *
 * Anchors `acceptance-criteria.md §2.4` happy path:
 *   1. Workspace `/` redirects to `/queue` with rows from MSW.
 *   2. Keyboard nav `j`/`k` moves the selected row.
 *   3. `Enter` opens the split-pane (`?selected=:id`).
 *   4. Filter chip narrows the list; reset clears.
 *
 * Tenant-switch alternate flow (`@security:tenant-switch` +
 * `@security:tenant-cache-flush`) is covered end-to-end by
 * `h1-tenant-switch.spec.ts` and `mocks-tenant-isolation.spec.ts`.
 * Cross-tab BroadcastChannel sync (`@security:cross-tab-tenant-sync`) is
 * deferred — requires a second Playwright context and the BroadcastChannel
 * shim; covered by `auth-flow.md §2.6` integration tests in BFF.
 */
test("journey-04 workspace triage — queue, keyboard nav, filter chip", async ({ isolatedPage }) => {
  await isolatedPage.goto("/");
  await expect(isolatedPage).toHaveURL(/\/queue/, { timeout: 30_000 });

  const table = isolatedPage.getByTestId("queue-table");
  await expect(table).toBeVisible({ timeout: 30_000 });
  const rows = isolatedPage.getByTestId("queue-row");
  await expect(rows.first()).toBeVisible({ timeout: 30_000 });
  expect(await rows.count()).toBeGreaterThan(0);

  // Keyboard nav.
  await isolatedPage.locator("body").click();
  await isolatedPage.keyboard.press("j");
  await expect(rows.first()).toHaveAttribute("data-selected", "true");
  await isolatedPage.keyboard.press("Enter");
  await expect(isolatedPage).toHaveURL(/selected=/);
  await isolatedPage.keyboard.press("Escape");
  await expect(isolatedPage).not.toHaveURL(/selected=/);

  // Filter chip toggle.
  const firstChip = isolatedPage.locator('[data-testid^="queue-chip-"]').first();
  await firstChip.click();
  await expect(firstChip).toHaveAttribute("aria-pressed", "true");
  await isolatedPage.getByTestId("queue-reset-filters").click();
  await expect(firstChip).toHaveAttribute("aria-pressed", "false");
});
