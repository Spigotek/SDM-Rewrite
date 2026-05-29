import { test, expect } from "../../fixtures/isolated-context";

/**
 * Journey #9 — `workspace-incident-deep-dive` (agent_l2_marek).
 *
 * Anchors `acceptance-criteria.md §2.9` happy path:
 *   1. Escalated ticket detail renders + timeline visible.
 *   2. Internal comment round-trip preserves earlier notes.
 *   3. Composer tabs work (public ↔ internal).
 *
 * Required-field inline block + reviewer fallback flows depend on the
 * close-ticket modal + KB-draft pipeline which are stubbed in the MVP —
 * deferred to Phase I.1 (workflow refinement) per H.16 plan.
 */
test("journey-09 workspace incident deep-dive — composer tab swap + internal note", async ({
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

  const items = isolatedPage.getByTestId("ticket-timeline-item");
  const baseline = await items.count();
  expect(baseline).toBeGreaterThan(0);

  // Public composer tab → reply.
  await isolatedPage.getByTestId("ticket-composer-tab-public").click();
  await isolatedPage
    .getByTestId("ticket-composer-textarea")
    .fill("Reviewed earlier notes — confirming next steps.");
  await isolatedPage.getByTestId("ticket-composer-submit").click();
  await expect(items).toHaveCount(baseline + 1, { timeout: 5_000 });

  // Swap to internal tab → internal note.
  await isolatedPage.getByTestId("ticket-composer-tab-internal").click();
  await isolatedPage
    .getByTestId("ticket-composer-textarea")
    .fill("Considering KB draft after close.");
  await isolatedPage.getByTestId("ticket-composer-submit").click();
  await expect(items).toHaveCount(baseline + 2, { timeout: 5_000 });
});
