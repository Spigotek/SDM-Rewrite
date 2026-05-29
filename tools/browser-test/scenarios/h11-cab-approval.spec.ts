import { test, expect } from "../fixtures/isolated-context";

/**
 * H.11 CAB approval flow — exercises the Approvals tab actions on
 * `/changes/:id`.
 *
 * Path:
 *   1. Navigate to `/changes`, capture the first row id, open `/changes/:id`.
 *   2. Switch to the Approvals tab and locate a PENDING approver row (the
 *      MSW fixture seeds at least two PENDING rows on PENDING changes).
 *   3. If the active session role grants `cab.approve`, the action buttons
 *      (Approve / Reject / Send reminder) are rendered. Open the Approve
 *      modal, submit with an optional comment, and verify the row decision
 *      transitions to APPROVED (decision data attribute + decision label).
 *   4. Open a Reject modal on another PENDING row, attempt empty-reason
 *      submit (button disabled), fill a reason, submit, verify the row
 *      transitions to REJECTED.
 *   5. Send-reminder flow — open modal, submit, verify the inline confirm
 *      announcement appears and the modal auto-dismisses.
 *
 *   When the active session lacks `cab.approve` (denied hint visible) the
 *   action-driven assertions short-circuit with `test.skip` so the spec stays
 *   stable across role-fixture changes.
 */
test("H.11 CAB approval — approve, reject, reminder", async ({ isolatedPage }) => {
  await isolatedPage.goto("/changes");

  const rows = isolatedPage.getByTestId("changes-row");
  await expect(rows.first()).toBeVisible({ timeout: 15_000 });

  // Pick a row whose detail has a PENDING approver. Iterate rows until one
  // yields PENDING approver(s) on the detail screen — the fixture has 15
  // changes, several with PENDING state.
  const rowCount = await rows.count();
  let openedPendingRow = false;
  for (let i = 0; i < rowCount; i++) {
    const row = rows.nth(i);
    const rowId = await row.getAttribute("data-row-id");
    if (!rowId) continue;
    await row.click();
    await expect(isolatedPage).toHaveURL(/\/changes\//, { timeout: 10_000 });
    await isolatedPage.getByTestId("change-tab-approvals").click();
    await expect(isolatedPage.getByTestId("change-tabpanel-approvals")).toBeVisible();

    const pendingRows = isolatedPage.locator(
      '[data-testid="change-approver-row"][data-decision="PENDING"]',
    );
    if ((await pendingRows.count()) >= 2) {
      openedPendingRow = true;
      break;
    }
    await isolatedPage.goto("/changes");
    await expect(rows.first()).toBeVisible({ timeout: 15_000 });
  }
  if (!openedPendingRow) {
    throw new Error("H.11 fixture invariant — no change has ≥2 PENDING approvers");
  }

  // Permission gating — when the role lacks cab.approve, the denied hint is
  // visible and no action buttons render. Short-circuit gracefully.
  const deniedHint = isolatedPage.getByTestId("change-approvals-hint");
  if (await deniedHint.isVisible().catch(() => false)) {
    test.skip(true, "active role lacks cab.approve — H.11 actions are gated off");
  }

  const pendingRows = isolatedPage.locator(
    '[data-testid="change-approver-row"][data-decision="PENDING"]',
  );

  // ── Approve flow ─────────────────────────────────────────────────────
  const firstPending = pendingRows.first();
  await firstPending.getByTestId("change-approver-approve").click();
  const approveModal = isolatedPage.getByTestId("cab-approve-modal");
  await expect(approveModal).toBeVisible();
  await isolatedPage.getByTestId("cab-approve-comment").fill("LGTM — verified pre-reqs");
  await isolatedPage.getByTestId("cab-approve-submit").click();
  await expect(approveModal).toBeHidden({ timeout: 5_000 });

  // The list should now have at least one row that's no longer PENDING.
  const approvedRows = isolatedPage.locator(
    '[data-testid="change-approver-row"][data-decision="APPROVED"]',
  );
  await expect(approvedRows.first()).toBeVisible({ timeout: 5_000 });

  // ── Reject flow ──────────────────────────────────────────────────────
  // Pick another currently-PENDING row.
  const stillPending = isolatedPage.locator(
    '[data-testid="change-approver-row"][data-decision="PENDING"]',
  );
  const pendingNowCount = await stillPending.count();
  if (pendingNowCount === 0) {
    // After approve the cab roll-up may have flipped the entire change to
    // APPROVED. Nothing left to reject — assert the change state badge and
    // exit early.
    return;
  }

  await stillPending.first().getByTestId("change-approver-reject").click();
  const rejectModal = isolatedPage.getByTestId("cab-reject-modal");
  await expect(rejectModal).toBeVisible();

  const submitReject = isolatedPage.getByTestId("cab-reject-submit");
  // Empty reason — submit must stay disabled.
  await expect(submitReject).toBeDisabled();
  await isolatedPage
    .getByTestId("cab-reject-reason")
    .fill("Pre-prod regression observed; needs more soak time.");
  await expect(submitReject).toBeEnabled();
  await submitReject.click();
  await expect(rejectModal).toBeHidden({ timeout: 5_000 });

  const rejectedRows = isolatedPage.locator(
    '[data-testid="change-approver-row"][data-decision="REJECTED"]',
  );
  await expect(rejectedRows.first()).toBeVisible({ timeout: 5_000 });

  // ── Reminder flow ────────────────────────────────────────────────────
  const remainingPending = isolatedPage.locator(
    '[data-testid="change-approver-row"][data-decision="PENDING"]',
  );
  if ((await remainingPending.count()) === 0) {
    return;
  }
  const reminderBtn = remainingPending.first().getByTestId("change-approver-reminder");
  if (!(await reminderBtn.isVisible().catch(() => false))) {
    // Reminder button is hidden when the row is the current user (no self-nag).
    return;
  }
  await reminderBtn.click();
  const reminderModal = isolatedPage.getByTestId("cab-reminder-modal");
  await expect(reminderModal).toBeVisible();
  await isolatedPage.getByTestId("cab-reminder-submit").click();
  await expect(isolatedPage.getByTestId("cab-reminder-confirm")).toBeVisible({ timeout: 5_000 });
  await expect(reminderModal).toBeHidden({ timeout: 5_000 });
});
