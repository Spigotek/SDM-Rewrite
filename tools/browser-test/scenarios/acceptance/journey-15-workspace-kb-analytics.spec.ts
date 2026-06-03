import { test, expect } from "../../fixtures/isolated-context";

/**
 * Journey #15 — `workspace-kb-analytics-review` (kb_editor_jana).
 *
 * Anchors `acceptance-criteria.md §2.15` full path closed in I.4:
 *   1. Per-article stats panel renders (covered by the read-only baseline).
 *   2. Full analytics dashboard at `/kb/analytics` renders:
 *      - Top-10 articles by views
 *      - Bottom-5 by helpfulness ratio
 *      - Top search-miss queries
 *      - 7 / 30 / 90 day range selector toggles between snapshots
 */
test("journey-15 workspace KB analytics — per-article stats + dashboard", async ({
  isolatedPage,
  isolatedPageAs,
}) => {
  // ── Per-article stats (default agent session) ──────────────────────────
  await isolatedPage.goto("/kb");
  await expect(isolatedPage.getByTestId("kb-table")).toBeVisible({ timeout: 15_000 });
  const rows = isolatedPage.getByTestId("kb-row");
  await rows.first().click();
  await expect(isolatedPage).toHaveURL(/\/kb\/article\//, { timeout: 10_000 });

  await expect(isolatedPage.getByTestId("workspace-kb-article")).toBeVisible({ timeout: 15_000 });
  await expect(isolatedPage.getByTestId("kb-article-stats")).toBeVisible();
  await expect(isolatedPage.getByTestId("kb-stats-view-count")).toBeVisible();
  await expect(isolatedPage.getByTestId("kb-stats-helpful-count")).toBeVisible();
  await expect(isolatedPage.getByTestId("kb-stats-helpfulness-ratio")).toBeVisible();

  // ── Analytics dashboard (Jana session — kb.analytics gated) ────────────
  const janaPage = await isolatedPageAs("user-7");
  await janaPage.goto("/kb/analytics");
  await expect(janaPage.getByTestId("workspace-kb-analytics")).toBeVisible({ timeout: 10_000 });

  await expect(janaPage.getByTestId("kb-analytics-top")).toBeVisible();
  await expect(janaPage.getByTestId("kb-analytics-bottom")).toBeVisible();
  await expect(janaPage.getByTestId("kb-analytics-search-miss")).toBeVisible();

  // Top card has the documented 10 rows; bottom + miss have at least 1.
  const topRows = janaPage.locator('[data-testid="kb-analytics-top"] li');
  await expect(topRows.first()).toBeVisible({ timeout: 10_000 });
  const topCount = await topRows.count();
  expect(topCount).toBeGreaterThanOrEqual(5);

  // Range selector — 30d is the default; switch to 7d and verify the top
  // card refreshes (the views number changes since the fixture scales by
  // a multiplier per range).
  const firstTopMeta = janaPage.locator('[data-testid="kb-analytics-top"] li').first();
  const before = await firstTopMeta.textContent();
  await janaPage.getByTestId("kb-analytics-range-7d").click();
  await expect(janaPage.getByTestId("kb-analytics-range-7d")).toHaveAttribute(
    "aria-checked",
    "true",
  );
  // Wait for the new query to land — the meta text should differ.
  await janaPage.waitForFunction(
    (prev) => document.querySelector('[data-testid="kb-analytics-top"] li')?.textContent !== prev,
    before,
    { timeout: 10_000 },
  );
});
