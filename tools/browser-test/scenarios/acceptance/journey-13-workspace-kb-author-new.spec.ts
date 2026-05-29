import { test, expect } from "../../fixtures/isolated-context";

/**
 * Journey #13 — `workspace-kb-author-new` (kb_editor_jana).
 *
 * Status: **deferred — KB editor not implemented in MVP**.
 *
 * Anchors `acceptance-criteria.md §2.13` read-only baseline:
 *   1. KB workspace browse renders the article list.
 *   2. The default session lacks `kb.write`; new/edit CTAs are hidden via
 *      `<Can permission="kb.write" fallback={null}>`.
 *
 * The full WYSIWYG editor (template "How-to", drag-drop screenshot,
 * autosave recovery, DOMPurify markdown sanitization
 * `@security:kb-markdown-sanitization`) is **out of MVP scope** per
 * ROADMAP — first cut ships in Phase I.5. This spec confirms the
 * read-only contract holds today.
 */
test("journey-13 workspace KB author new — editor hidden for read-only session", async ({
  isolatedPage,
}) => {
  await isolatedPage.goto("/kb");
  await expect(isolatedPage.getByTestId("kb-table")).toBeVisible({ timeout: 15_000 });

  // New-article CTA is hidden — `kb.write` permission denied.
  await expect(isolatedPage.getByTestId("kb-new-article")).toHaveCount(0);

  // Article detail also hides the edit CTA.
  const rows = isolatedPage.getByTestId("kb-row");
  await rows.first().click();
  await expect(isolatedPage).toHaveURL(/\/kb\/article\//, { timeout: 10_000 });
  await expect(isolatedPage.getByTestId("workspace-kb-article")).toBeVisible({ timeout: 15_000 });
  await expect(isolatedPage.getByTestId("kb-article-edit")).toHaveCount(0);
});
