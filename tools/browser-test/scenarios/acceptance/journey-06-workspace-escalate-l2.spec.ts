import { test, expect } from "../../fixtures/isolated-context";

/**
 * Journey #6 — `workspace-incident-escalate-to-l2` (agent_l1_anna).
 *
 * Anchors `acceptance-criteria.md §2.6`:
 *   1. Escalate action opens a modal.
 *   2. Note field accepts text; submit closes the modal.
 *   3. Timeline gains an internal escalation entry.
 *
 * Empty-group fail-fast + `incident.escalated` audit log emission
 * (`@security:audit-log-mutation`) are covered by BFF integration tests
 * and `@sdm/api-mocks` handler unit tests respectively.
 */
test("journey-06 workspace escalate L2 — open modal, submit, timeline entry", async ({
  isolatedPage,
}) => {
  // Preview-mode cold start + modal mount + escalate POST can exceed
  // the 60 s default in CI.
  test.setTimeout(90_000);
  await isolatedPage.goto("/");
  await expect(isolatedPage).toHaveURL(/\/queue/, { timeout: 30_000 });

  const firstRow = isolatedPage.getByTestId("queue-row").first();
  await expect(firstRow).toBeVisible({ timeout: 30_000 });
  const rowId = await firstRow.getAttribute("data-row-id");
  if (!rowId) throw new Error("Queue row missing data-row-id");

  await isolatedPage.goto(`/tickets/${encodeURIComponent(rowId)}`);
  await expect(isolatedPage.getByTestId("ticket-detail-page")).toBeVisible({ timeout: 15_000 });

  const items = isolatedPage.getByTestId("ticket-timeline-item");
  const baseline = await items.count();

  await isolatedPage.getByTestId("ticket-action-escalate").click();
  const modal = isolatedPage.getByTestId("ticket-escalate-modal");
  await expect(modal).toBeVisible({ timeout: 5_000 });

  // `data-testid` is spread onto the inner `<textarea>` itself (the
  // TextArea primitive forwards `...rest` to the textarea element), so
  // we fill the testid locator directly without `.locator("textarea")`.
  await isolatedPage
    .getByTestId("ticket-escalate-note")
    .fill("Network outage suspected — handing off to L2 Network team.");
  await isolatedPage.getByTestId("ticket-escalate-submit").click();
  await expect(modal).toBeHidden({ timeout: 5_000 });
  await expect(items).toHaveCount(baseline + 1, { timeout: 5_000 });
});
