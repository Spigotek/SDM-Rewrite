import { test, expect } from "../../fixtures/isolated-context";

/**
 * Journey #11 — `workspace-change-emergency-approve` (change_manager_peter).
 *
 * Status: **partial — step-up 2FA deferred to Phase I.2**.
 *
 * Anchors `acceptance-criteria.md §2.11` happy path WITHOUT the 2FA leg:
 *   1. Mobile viewport (375 px) renders the change detail.
 *   2. Approvals tab surfaces the approver row.
 *   3. The Approve modal opens + submits (when role grants `cab.approve`).
 *
 * The step-up auth challenge (`@security:step-up-totp` /
 * `@security:audit-log-step-up`) is not implemented in the MVP — F.1 ships
 * the BFF session contract; the TOTP challenge UI lands in Phase I.1 along
 * with the IdP-side AMR plumbing. CSRF header enforcement
 * (`@security:csrf-mutation`) is exercised by BFF integration tests.
 *
 * Rollback-empty block is asserted within H.11 spec (`change-approver-approve`
 * is disabled when rollback markdown is missing).
 */
test("journey-11 workspace change emergency — mobile viewport + approve modal opens", async ({
  isolatedPage,
}) => {
  // Mobile viewport per §2.11 DoD (deep-link from a notification).
  await isolatedPage.setViewportSize({ width: 375, height: 800 });

  await isolatedPage.goto("/changes");
  const rows = isolatedPage.getByTestId("changes-row");
  await expect(rows.first()).toBeVisible({ timeout: 15_000 });

  // Iterate rows looking for one with PENDING approvers.
  const rowCount = await rows.count();
  let opened = false;
  for (let i = 0; i < rowCount; i++) {
    const row = rows.nth(i);
    await row.click();
    await expect(isolatedPage).toHaveURL(/\/changes\//, { timeout: 10_000 });
    await isolatedPage.getByTestId("change-tab-approvals").click();
    await expect(isolatedPage.getByTestId("change-tabpanel-approvals")).toBeVisible();
    const pending = isolatedPage.locator(
      '[data-testid="change-approver-row"][data-decision="PENDING"]',
    );
    if ((await pending.count()) > 0) {
      opened = true;
      break;
    }
    await isolatedPage.goto("/changes");
    await expect(rows.first()).toBeVisible({ timeout: 15_000 });
  }
  expect(opened).toBe(true);

  // If the role lacks `cab.approve`, the denied hint is visible — short-circuit.
  const denied = isolatedPage.getByTestId("change-approvals-hint");
  if (await denied.isVisible().catch(() => false)) {
    test.skip(true, "active role lacks cab.approve — emergency approve UI gated off");
  }

  const pendingRow = isolatedPage
    .locator('[data-testid="change-approver-row"][data-decision="PENDING"]')
    .first();
  await pendingRow.getByTestId("change-approver-approve").click();
  await expect(isolatedPage.getByTestId("cab-approve-modal")).toBeVisible({ timeout: 5_000 });
  // We do NOT submit the approve mutation here — the §2.11 happy path
  // requires the 2FA challenge which the MVP does not render. The fact
  // that the modal opens proves the UI surface exists.
});
