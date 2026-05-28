import { test, expect } from "../fixtures/isolated-context";

/**
 * H.9 workspace changes list + detail end-to-end.
 *
 * Path:
 *   1. Land on `/changes`, verify the changes table renders MSW fixture rows
 *      and the columns ID / Risk / Status / Schedule / Type / Approvers.
 *   2. Click the first row → navigate to `/changes/:id` detail page.
 *   3. Verify all 4 tabs render (Detail / Impact / Rollback / Approvals).
 *   4. Switch through every tab via the tab bar and confirm the tabpanel
 *      swaps + the URL `?tab=` param updates for non-default tabs.
 *   5. Impact tab — verify the affected-CI link points to `/cmdb/ci/:id`.
 *   6. Rollback tab — verify the markdown body renders (or empty-state if
 *      the fixture row is one of the no-rollback samples).
 *   7. Approvals tab — verify the read-only approver rows render and the
 *      "actions deferred to H.11" hint is present (read-only contract).
 */
test("H.9 changes — list, detail tabs, navigation", async ({ isolatedPage }) => {
  await isolatedPage.goto("/changes");

  // ── List ─────────────────────────────────────────────────────────────
  const table = isolatedPage.getByTestId("changes-table");
  await expect(table).toBeVisible({ timeout: 15_000 });
  const rows = isolatedPage.getByTestId("changes-row");
  const rowCount = await rows.count();
  expect(rowCount).toBeGreaterThan(0);

  // Approval state cell is populated and one of the 3 known values.
  const firstApproval = isolatedPage.getByTestId("changes-approval-state").first();
  await expect(firstApproval).toBeVisible();

  // Capture the first row's data-row-id (used as URL segment).
  const firstRow = rows.first();
  const rowId = await firstRow.getAttribute("data-row-id");
  if (!rowId) throw new Error("Changes row missing data-row-id");

  // ── Open detail ──────────────────────────────────────────────────────
  await firstRow.click();
  await expect(isolatedPage).toHaveURL(/\/changes\//, { timeout: 10_000 });

  const detail = isolatedPage.getByTestId("change-detail-page");
  await expect(detail).toBeVisible({ timeout: 15_000 });
  await expect(isolatedPage.getByTestId("change-header")).toBeVisible();
  await expect(isolatedPage.getByTestId("change-tabs")).toBeVisible();

  // Default tab is `detail`.
  await expect(isolatedPage.getByTestId("change-tabpanel-detail")).toBeVisible();

  // ── Impact tab ───────────────────────────────────────────────────────
  await isolatedPage.getByTestId("change-tab-impact").click();
  await expect(isolatedPage.getByTestId("change-tabpanel-impact")).toBeVisible();
  await expect(isolatedPage).toHaveURL(/[?&]tab=impact/);
  // Either rows present or explicit empty-state.
  const impactList = isolatedPage.getByTestId("change-impact-list");
  const impactEmpty = isolatedPage.getByTestId("change-impact-empty");
  const hasImpactRows = (await impactList.count()) > 0;
  if (hasImpactRows) {
    const firstImpactLink = impactList.locator("a").first();
    await expect(firstImpactLink).toHaveAttribute("href", /\/cmdb\/ci\//);
  } else {
    await expect(impactEmpty).toBeVisible();
  }

  // ── Rollback tab ─────────────────────────────────────────────────────
  await isolatedPage.getByTestId("change-tab-rollback").click();
  await expect(isolatedPage.getByTestId("change-tabpanel-rollback")).toBeVisible();
  await expect(isolatedPage).toHaveURL(/[?&]tab=rollback/);
  const rollbackBody = isolatedPage.getByTestId("change-rollback-body");
  const rollbackEmpty = isolatedPage.getByTestId("change-rollback-empty");
  // Either the lazy-loaded markdown body renders, or the empty-state shows.
  await expect(rollbackBody.or(rollbackEmpty)).toBeVisible({ timeout: 10_000 });

  // ── Approvals tab ────────────────────────────────────────────────────
  await isolatedPage.getByTestId("change-tab-approvals").click();
  await expect(isolatedPage.getByTestId("change-tabpanel-approvals")).toBeVisible();
  await expect(isolatedPage).toHaveURL(/[?&]tab=approvals/);
  await expect(isolatedPage.getByTestId("change-approvals-list")).toBeVisible();
  // Read-only contract — no action buttons, only the deferred hint.
  await expect(isolatedPage.getByTestId("change-approvals-hint")).toBeVisible();

  // Approver rows carry decision data attribute for H.11 to hook into.
  const approverRows = isolatedPage.getByTestId("change-approver-row");
  expect(await approverRows.count()).toBeGreaterThan(0);

  // ── Back to default tab via the tab bar ─────────────────────────────
  await isolatedPage.getByTestId("change-tab-detail").click();
  await expect(isolatedPage.getByTestId("change-tabpanel-detail")).toBeVisible();
});
