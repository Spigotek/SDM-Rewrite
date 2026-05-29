import { test, expect } from "../../fixtures/isolated-context";

/**
 * Journey #10 — `workspace-change-cab-prep` (change_manager_peter).
 *
 * Anchors `acceptance-criteria.md §2.10`:
 *   1. Changes list renders rows with risk/status/approval columns.
 *   2. Calendar view mounts the FullCalendar lazy chunk + view switch
 *      (week ↔ day ↔ month) works.
 *   3. Approvals tab on a change detail exposes the read-only approver list.
 *
 * Bulk-tag "discuss in CAB" via keyboard-only navigation + PDF agenda
 * export are deferred to Phase I.3 (CAB workflow refinement).
 */
test("journey-10 workspace change CAB prep — list + calendar view switch + approvals tab", async ({
  isolatedPage,
}) => {
  // List view.
  await isolatedPage.goto("/changes");
  await expect(isolatedPage.getByTestId("changes-table")).toBeVisible({ timeout: 15_000 });
  const rows = isolatedPage.getByTestId("changes-row");
  expect(await rows.count()).toBeGreaterThan(0);
  await expect(isolatedPage.getByTestId("changes-approval-state").first()).toBeVisible();

  // Calendar view.
  await isolatedPage.setViewportSize({ width: 1400, height: 900 });
  await isolatedPage.goto("/changes/calendar");
  await expect(isolatedPage.getByTestId("calendar-view")).toBeVisible({ timeout: 15_000 });

  const week = isolatedPage.getByTestId("calendar-view-timeGridWeek");
  await expect(week).toHaveAttribute("data-active", "true");
  await isolatedPage.getByTestId("calendar-view-dayGridMonth").click();
  await expect(isolatedPage.getByTestId("calendar-view-dayGridMonth")).toHaveAttribute(
    "data-active",
    "true",
  );

  // Open a change → approvals tab read-only contract.
  await isolatedPage.goto("/changes");
  const firstRow = isolatedPage.getByTestId("changes-row").first();
  await firstRow.click();
  await expect(isolatedPage).toHaveURL(/\/changes\//, { timeout: 10_000 });
  await isolatedPage.getByTestId("change-tab-approvals").click();
  await expect(isolatedPage.getByTestId("change-tabpanel-approvals")).toBeVisible();
  await expect(isolatedPage.getByTestId("change-approvals-list")).toBeVisible();
});
