import { test, expect } from "../fixtures/isolated-context";

/**
 * H.8 workspace ticket-detail end-to-end — drives the agent split view.
 *
 * Path:
 *   1. Land on `/queue`, pick the first row, press Enter to seed
 *      `?selected=:id`. The H.7 split pane shows a placeholder.
 *   2. Navigate to `/tickets/:id` directly to enter the full detail page.
 *   3. Verify header + action bar + timeline + composer + context panel
 *      all render.
 *   4. Click Take — timeline gains a system entry.
 *   5. Switch to the Internal note tab, type a comment, submit, verify
 *      the new entry appears.
 *   6. Click Escalate — modal opens, fill note, submit, verify modal
 *      closes and an internal escalation entry shows up.
 */
test("H.8 ticket detail — open, take, reply, escalate, timeline updates", async ({
  isolatedPage,
}) => {
  await isolatedPage.goto("/");
  await expect(isolatedPage).toHaveURL(/\/queue/, { timeout: 15_000 });

  // Grab the first queue row's data-row-id to drive `/tickets/:id`.
  const firstRow = isolatedPage.getByTestId("queue-row").first();
  await expect(firstRow).toBeVisible({ timeout: 15_000 });
  const rowId = await firstRow.getAttribute("data-row-id");
  if (!rowId) throw new Error("Queue row missing data-row-id");

  await isolatedPage.goto(`/tickets/${encodeURIComponent(rowId)}`);

  // ── Page structure ───────────────────────────────────────────────────
  const page = isolatedPage.getByTestId("ticket-detail-page");
  await expect(page).toBeVisible({ timeout: 15_000 });
  await expect(isolatedPage.getByTestId("ticket-header")).toBeVisible();
  await expect(isolatedPage.getByTestId("ticket-actionbar")).toBeVisible();
  await expect(isolatedPage.getByTestId("ticket-timeline")).toBeVisible();
  await expect(isolatedPage.getByTestId("ticket-composer")).toBeVisible();
  await expect(isolatedPage.getByTestId("ticket-context-panel")).toBeVisible();

  // Baseline timeline count (seeded: created + initial public).
  const items = isolatedPage.getByTestId("ticket-timeline-item");
  const baselineCount = await items.count();
  expect(baselineCount).toBeGreaterThan(0);

  // ── Take ─────────────────────────────────────────────────────────────
  await isolatedPage.getByTestId("ticket-action-take").click();
  await expect(items).toHaveCount(baselineCount + 1, { timeout: 5_000 });

  // ── Internal note via composer ───────────────────────────────────────
  await isolatedPage.getByTestId("ticket-composer-tab-internal").click();
  const textarea = isolatedPage.getByTestId("ticket-composer-textarea");
  await textarea.fill("Note from H.8 browser test");
  await isolatedPage.getByTestId("ticket-composer-submit").click();
  await expect(items).toHaveCount(baselineCount + 2, { timeout: 5_000 });

  // The new entry should be tagged internal — at least one internal row exists.
  const internalRows = isolatedPage.locator(
    '[data-testid="ticket-timeline-item"][data-kind="internal"]',
  );
  expect(await internalRows.count()).toBeGreaterThan(0);

  // ── Filter tabs (Internal) ───────────────────────────────────────────
  await isolatedPage.getByTestId("ticket-timeline-tab-internal").click();
  const filtered = await items.count();
  // After filter, items.count() reflects only internal entries.
  expect(filtered).toBeGreaterThan(0);
  expect(filtered).toBeLessThan(baselineCount + 2);
  await isolatedPage.getByTestId("ticket-timeline-tab-all").click();
  await expect(items).toHaveCount(baselineCount + 2);

  // ── Escalate via modal ───────────────────────────────────────────────
  await isolatedPage.getByTestId("ticket-action-escalate").click();
  const modal = isolatedPage.getByTestId("ticket-escalate-modal");
  await expect(modal).toBeVisible({ timeout: 5_000 });
  await isolatedPage
    .getByTestId("ticket-escalate-note")
    .locator("textarea")
    .fill("Cannot reproduce — handing off to L2.");
  await isolatedPage.getByTestId("ticket-escalate-submit").click();
  await expect(modal).toBeHidden({ timeout: 5_000 });
  await expect(items).toHaveCount(baselineCount + 3, { timeout: 5_000 });
});
