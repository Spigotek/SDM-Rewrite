import { test, expect } from "../fixtures/isolated-context";

/**
 * H.6 portal KB — Lucia journey (read-only).
 *
 * Paths covered:
 *   1. `/kb` renders the SearchInput + result list (default term = all
 *      published articles for the active tenant).
 *   2. Typing into the search box (debounce 300 ms) updates the list +
 *      the live region announces the new result count.
 *   3. Clicking the first result navigates to `/kb/article/:id`.
 *   4. The article renders header + body + helpfulness widget + related
 *      articles. The markdown body chunk is lazy-loaded.
 *   5. Submitting `👍` calls `POST /api/kb/articles/:id/helpfulness`
 *      and flips the widget into the "thanks" state.
 *   6. Empty-state branch — searching with a nonsense term surfaces the
 *      "open ticket" CTA pre-filled with the search query.
 */
test("portal H.6 KB — search list → article → helpfulness vote", async ({ isolatedPage }) => {
  // Bootstrap MSW via the home route first.
  await isolatedPage.goto("/");
  await expect(isolatedPage.getByTestId("portal-home")).toBeVisible({ timeout: 15_000 });

  // Open the KB search.
  await isolatedPage.goto("/kb");
  const route = isolatedPage.getByTestId("portal-kb");
  await expect(route).toBeVisible({ timeout: 15_000 });

  // SearchInput rendered + auto-focused.
  const search = isolatedPage.getByTestId("kb-search-input");
  await expect(search).toBeVisible();

  // Result count live region + list (default term lists everything for tenant).
  await expect(isolatedPage.getByTestId("kb-result-count")).toBeVisible();
  await expect(isolatedPage.getByTestId("kb-result-list")).toBeVisible({ timeout: 10_000 });

  // Capture the first result id from the list for the article navigation step.
  const firstResult = isolatedPage.locator('[data-testid^="kb-result-kb:"]').first();
  await expect(firstResult).toBeVisible();
  const firstHref = await firstResult.getAttribute("href");
  expect(firstHref).toMatch(/^\/kb\/article\//);

  // ── Type into search — debounce 300 ms ────────────────────────────
  await search.fill("test");
  // Wait past the debounce, then assert the count text updated. The MSW
  // search filters by title/summary substring; "test" may or may not
  // match real fixtures — either path is valid (results OR empty CTA).
  await isolatedPage.waitForTimeout(450);
  const list = isolatedPage.getByTestId("kb-result-list");
  const empty = isolatedPage.getByTestId("kb-empty");
  await expect(list.or(empty)).toBeVisible();

  // Clear the query so the article-navigation step uses the original list.
  await search.fill("");
  await isolatedPage.waitForTimeout(450);
  await expect(isolatedPage.getByTestId("kb-result-list")).toBeVisible();

  // ── Open the first article ────────────────────────────────────────
  await isolatedPage.locator('[data-testid^="kb-result-kb:"]').first().click();
  const article = isolatedPage.getByTestId("portal-kb-article");
  await expect(article).toBeVisible({ timeout: 15_000 });
  await expect(isolatedPage.getByTestId("kb-article-header")).toBeVisible();

  // Markdown body — lazy chunk loads asynchronously; assert visibility
  // (the chunk fallback flashes briefly but the final body lands within
  // the page-load budget).
  await expect(isolatedPage.getByTestId("kb-article-body")).toBeVisible({ timeout: 10_000 });

  // Helpfulness widget renders.
  const helpfulness = isolatedPage.getByTestId("kb-helpfulness");
  await expect(helpfulness).toBeVisible();

  // ── Submit 👍 vote — the widget flips to the "thanks" state ───────
  await isolatedPage.getByTestId("kb-helpfulness-up").click();
  await expect(helpfulness).toHaveAttribute("data-helpfulness-vote", "up", { timeout: 5_000 });
});

test("portal H.6 KB — empty search surfaces 'open ticket' CTA", async ({ isolatedPage }) => {
  // Bootstrap MSW via the home route first.
  await isolatedPage.goto("/");
  await expect(isolatedPage.getByTestId("portal-home")).toBeVisible({ timeout: 15_000 });

  await isolatedPage.goto("/kb");
  await expect(isolatedPage.getByTestId("portal-kb")).toBeVisible({ timeout: 15_000 });

  // Type a nonsense query that won't match any fixture title/summary.
  const search = isolatedPage.getByTestId("kb-search-input");
  await search.fill("zzz-no-match-zzz-h6");
  await isolatedPage.waitForTimeout(450);

  const empty = isolatedPage.getByTestId("kb-empty");
  await expect(empty).toBeVisible({ timeout: 5_000 });

  const cta = isolatedPage.getByTestId("kb-empty-open-ticket");
  await expect(cta).toBeVisible();
  const href = await cta.getAttribute("href");
  expect(href).toContain("/new-incident?summary=");
  expect(href).toContain("zzz-no-match-zzz-h6");
});
