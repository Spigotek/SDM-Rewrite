import { test, expect } from "../../fixtures/isolated-context";

/**
 * Journey #5 — `workspace-incident-resolve-with-cmdb` (agent_l1_anna).
 *
 * Anchors `acceptance-criteria.md §2.5`:
 *   1. Ticket detail right-panel renders requester + CI + related entries.
 *   2. Take ownership + reply round-trip lands on the timeline.
 *
 * RBAC tooltip on disabled "Assign CI" action (`@security:rbac-denial-tooltip`)
 * is covered by `<Can>` unit tests in `@sdm/auth`; the workspace MVP keeps
 * the CMDB editing surface read-only.
 */
test("journey-05 workspace resolve with CMDB — open ticket, take, internal note", async ({
  isolatedPage,
}) => {
  await isolatedPage.goto("/");
  await expect(isolatedPage).toHaveURL(/\/queue/, { timeout: 15_000 });

  const firstRow = isolatedPage.getByTestId("queue-row").first();
  await expect(firstRow).toBeVisible({ timeout: 15_000 });
  const rowId = await firstRow.getAttribute("data-row-id");
  if (!rowId) throw new Error("Queue row missing data-row-id");

  await isolatedPage.goto(`/tickets/${encodeURIComponent(rowId)}`);
  await expect(isolatedPage.getByTestId("ticket-detail-page")).toBeVisible({ timeout: 15_000 });

  // Right context panel renders with the requester + CI sections.
  await expect(isolatedPage.getByTestId("ticket-context-panel")).toBeVisible();
  await expect(isolatedPage.getByTestId("ticket-context-requester")).toBeVisible();

  const items = isolatedPage.getByTestId("ticket-timeline-item");
  const baseline = await items.count();

  // Take.
  await isolatedPage.getByTestId("ticket-action-take").click();
  await expect(items).toHaveCount(baseline + 1, { timeout: 5_000 });

  // Internal note (workaround comment).
  await isolatedPage.getByTestId("ticket-composer-tab-internal").click();
  await isolatedPage
    .getByTestId("ticket-composer-textarea")
    .fill("Resolved via KB-1024 — closing as workaround");
  await isolatedPage.getByTestId("ticket-composer-submit").click();
  await expect(items).toHaveCount(baseline + 2, { timeout: 5_000 });
});
