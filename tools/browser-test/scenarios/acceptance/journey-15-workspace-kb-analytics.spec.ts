import { test, expect } from "../../fixtures/isolated-context";

/**
 * Journey #15 — `workspace-kb-analytics-review` (kb_editor_jana).
 *
 * Status: **partial — analytics dashboard deferred**.
 *
 * Anchors `acceptance-criteria.md §2.15` MVP slice:
 *   1. Article detail surfaces the read-only ArticleStats panel
 *      (view count + helpful count + helpfulness ratio).
 *
 * Full analytics dashboard (top-10 views, bottom-5 helpfulness, search
 * miss heatmap) is **out of MVP scope** — lands in Phase I.5 alongside
 * the editor. The per-article stats panel is the only analytics surface
 * shipped today.
 */
test("journey-15 workspace KB analytics — per-article stats panel renders", async ({
  isolatedPage,
}) => {
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
});
