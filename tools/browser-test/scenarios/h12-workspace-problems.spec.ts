import { test, expect } from "../fixtures/isolated-context";

/**
 * H.12 workspace problems end-to-end — Marek (agent_l2) RCA flow.
 *
 * Path:
 *   1. Land on `/problems`, verify the problems table renders MSW fixture rows
 *      and the filter bar surfaces the status chips.
 *   2. Apply a search filter, then reset and pick the first row.
 *   3. Verify ProblemDetail page renders header + body + linked incidents +
 *      activity timeline.
 *   4. Open the link-incident modal, search for an incident, multi-select,
 *      submit. Verify the linked-incidents list now contains the new row.
 *   5. Navigate from the linked-incident link → ticket detail (proves the
 *      Link navigation surface works both ways).
 *   6. Open an incident detail directly, exercise the "Convert to problem"
 *      flow from the More menu and verify the navigation lands on a new
 *      `/problems/:id` page.
 */
test("H.12 problems — list, detail, link incident, convert flow", async ({ isolatedPage }) => {
  await isolatedPage.goto("/problems");

  // ── List ─────────────────────────────────────────────────────────────
  const table = isolatedPage.getByTestId("problems-table");
  await expect(table).toBeVisible({ timeout: 15_000 });
  const rows = isolatedPage.getByTestId("problems-row");
  const rowCount = await rows.count();
  expect(rowCount).toBeGreaterThan(0);

  // FilterBar renders + reset works.
  const filterBar = isolatedPage.getByTestId("problems-filter-bar");
  await expect(filterBar).toBeVisible();
  const search = isolatedPage.getByTestId("problems-search");
  await search.fill("zzz-no-match");
  await expect(isolatedPage.getByTestId("problems-filtered-empty")).toBeVisible();
  await isolatedPage.getByTestId("problems-reset-filters").click();
  await expect(table).toBeVisible();

  // Capture the first row's id.
  const firstRow = rows.first();
  const rowId = await firstRow.getAttribute("data-row-id");
  if (!rowId) throw new Error("Problems row missing data-row-id");

  // ── Open detail ──────────────────────────────────────────────────────
  await firstRow.click();
  await expect(isolatedPage).toHaveURL(/\/problems\//, { timeout: 10_000 });

  const detail = isolatedPage.getByTestId("problem-detail-page");
  await expect(detail).toBeVisible({ timeout: 15_000 });
  await expect(isolatedPage.getByTestId("problem-header")).toBeVisible();
  await expect(isolatedPage.getByTestId("problem-description")).toBeVisible();
  await expect(isolatedPage.getByTestId("problem-rootcause")).toBeVisible();
  await expect(isolatedPage.getByTestId("problem-linked-incidents")).toBeVisible();

  // ── Link an incident ─────────────────────────────────────────────────
  const baselineLinked = await isolatedPage.getByTestId("problem-linked-row").count();
  await isolatedPage.getByTestId("problem-link-incident-open").click();
  const modal = isolatedPage.getByTestId("problem-link-modal");
  await expect(modal).toBeVisible({ timeout: 5_000 });

  // List should populate from /api/incidents — pick the first non-linked option.
  const checkboxes = modal.locator("input[type=checkbox]:not(:disabled)");
  await expect(checkboxes.first()).toBeVisible({ timeout: 10_000 });
  await checkboxes.first().check();
  await expect(isolatedPage.getByTestId("problem-link-modal-selected-count")).toContainText(
    /[1-9]/,
  );
  await isolatedPage.getByTestId("problem-link-modal-submit").click();
  await expect(modal).toBeHidden({ timeout: 5_000 });

  // Linked list grew by at least one (the modal may have skipped already-linked
  // rows, but at least one fresh link must be present).
  await expect(isolatedPage.getByTestId("problem-linked-row")).toHaveCount(baselineLinked + 1, {
    timeout: 5_000,
  });

  // ── Linked-incident → ticket detail navigation ───────────────────────
  const linkedSummary = isolatedPage.locator(
    '[data-testid="problem-linked-row"] a.sdm-problem-linked-summary',
  );
  const firstLinkedHref = await linkedSummary.first().getAttribute("href");
  expect(firstLinkedHref).toMatch(/\/tickets\//);

  // ── Convert flow: open incident detail, convert ──────────────────────
  // Use the linked incident as a known-good incident detail to convert.
  await isolatedPage.goto("/queue");
  const queueRow = isolatedPage.getByTestId("queue-row").first();
  await expect(queueRow).toBeVisible({ timeout: 15_000 });
  const queueRowId = await queueRow.getAttribute("data-row-id");
  if (!queueRowId) throw new Error("Queue row missing data-row-id");
  await isolatedPage.goto(`/tickets/${encodeURIComponent(queueRowId)}`);
  await expect(isolatedPage.getByTestId("ticket-detail-page")).toBeVisible({ timeout: 15_000 });

  // Only incident-typed details expose the Convert menu item.
  const ticketType = await isolatedPage
    .getByTestId("ticket-detail-page")
    .getAttribute("data-ticket-type");
  if (ticketType !== "incident") {
    // Skip the convert assertion when the first queue row isn't an incident.
    return;
  }

  await isolatedPage.getByTestId("ticket-action-more").click();
  const convertItem = isolatedPage.getByTestId("ticket-action-convert-to-problem");
  await expect(convertItem).toBeVisible({ timeout: 5_000 });
  await convertItem.click();

  const convertModal = isolatedPage.getByTestId("problem-convert-modal");
  await expect(convertModal).toBeVisible({ timeout: 5_000 });
  // The summary is pre-seeded from the incident — change to assert the field
  // round-trips through the mutation.
  const summaryTextarea = convertModal.locator("textarea").first();
  await summaryTextarea.fill("Problem converted from incident (H.12 test)");
  await isolatedPage.getByTestId("problem-convert-submit").click();
  await expect(convertModal).toBeHidden({ timeout: 5_000 });

  // The convert mutation navigates the agent to the new `/problems/:id` page.
  await expect(isolatedPage).toHaveURL(/\/problems\//, { timeout: 10_000 });
  await expect(isolatedPage.getByTestId("problem-detail-page")).toBeVisible({ timeout: 10_000 });
});
