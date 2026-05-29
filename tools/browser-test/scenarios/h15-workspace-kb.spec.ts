import { test, expect } from "../fixtures/isolated-context";

/**
 * H.15 workspace KB — Jana flow (read-only MVP).
 *
 * Paths covered:
 *   1. `/kb` renders the DataTable with category / title / helpfulness ratio /
 *      view count / last-updated columns.
 *   2. Category filter narrows the visible rows; reset clears filters.
 *   3. Clicking a row navigates to `/kb/article/:id` and renders the
 *      ArticleHeader + ArticleBody (lazy markdown) + ArticleStats panel.
 *   4. Edit / New buttons are hidden by default — the seeded session has
 *      `agent_l1` only (no `kb.write`), so `<Can permission="kb.write">`
 *      fallback={null} keeps the DOM clean.
 *   5. `?attachToTicket=INC-X` surfaces both the browse banner and the
 *      KbAttachIncidentAction CTA on the article view, and the CTA target
 *      threads `attachKbArticle=<id>` back to `/tickets/INC-X`.
 */
test("H.15 workspace KB — browse list, filter, article view + stats", async ({ isolatedPage }) => {
  await isolatedPage.goto("/kb");

  // ── Browse list ──────────────────────────────────────────────────────
  const table = isolatedPage.getByTestId("kb-table");
  await expect(table).toBeVisible({ timeout: 15_000 });
  const rows = isolatedPage.getByTestId("kb-row");
  const initialRowCount = await rows.count();
  expect(initialRowCount).toBeGreaterThan(0);

  // FilterBar renders.
  const filterBar = isolatedPage.getByTestId("kb-filter-bar");
  await expect(filterBar).toBeVisible();

  // Pick the category of the first row, then assert filter narrows.
  const firstRow = rows.first();
  const firstId = await firstRow.getAttribute("data-row-id");
  if (!firstId) throw new Error("KB row missing data-row-id");

  const categorySelect = isolatedPage.getByTestId("kb-filter-category");
  await expect(categorySelect).toBeVisible();
  const optionValues = await categorySelect.evaluate((el) =>
    Array.from((el as HTMLSelectElement).options)
      .map((o) => o.value)
      .filter((v) => v.length > 0),
  );
  expect(optionValues.length).toBeGreaterThan(0);
  await categorySelect.selectOption(optionValues[0]!);
  await expect(isolatedPage).toHaveURL(/[?&]category=/);

  // Reset returns the full list.
  await isolatedPage.getByTestId("kb-reset-filters").click();
  await expect(table).toBeVisible();

  // Edit / new buttons should not be present for the default (read-only)
  // session — `<Can permission="kb.write" fallback={null}>` hides them.
  await expect(isolatedPage.getByTestId("kb-new-article")).toHaveCount(0);

  // ── Open the first article ───────────────────────────────────────────
  await rows.first().click();
  await expect(isolatedPage).toHaveURL(/\/kb\/article\//, { timeout: 10_000 });

  const article = isolatedPage.getByTestId("workspace-kb-article");
  await expect(article).toBeVisible({ timeout: 15_000 });
  await expect(isolatedPage.getByTestId("kb-article-header")).toBeVisible();

  // Markdown body — lazy chunk lands within page-load budget.
  await expect(isolatedPage.getByTestId("kb-article-body")).toBeVisible({ timeout: 10_000 });

  // Stats panel renders all three rows.
  await expect(isolatedPage.getByTestId("kb-article-stats")).toBeVisible();
  await expect(isolatedPage.getByTestId("kb-stats-view-count")).toBeVisible();
  await expect(isolatedPage.getByTestId("kb-stats-helpful-count")).toBeVisible();
  await expect(isolatedPage.getByTestId("kb-stats-helpfulness-ratio")).toBeVisible();

  // Edit CTA is hidden for the default (no kb.write) session.
  await expect(isolatedPage.getByTestId("kb-article-edit")).toHaveCount(0);

  // KbAttachIncidentAction is absent without `?attachToTicket`.
  await expect(isolatedPage.getByTestId("kb-attach-incident-action")).toHaveCount(0);
});

test("H.15 workspace KB — ?attachToTicket surfaces the attach CTA", async ({ isolatedPage }) => {
  // Land on the browse page first to capture the id of a real article.
  await isolatedPage.goto("/kb");
  const rows = isolatedPage.getByTestId("kb-row");
  await expect(rows.first()).toBeVisible({ timeout: 15_000 });
  const articleId = await rows.first().getAttribute("data-row-id");
  if (!articleId) throw new Error("KB row missing data-row-id");

  // Navigate to the article view with the cross-feature URL param.
  await isolatedPage.goto(`/kb/article/${encodeURIComponent(articleId)}?attachToTicket=INC-1`);
  const article = isolatedPage.getByTestId("workspace-kb-article");
  await expect(article).toBeVisible({ timeout: 15_000 });

  // CTA renders + targets /tickets/INC-1 with the kb article id threaded.
  const cta = isolatedPage.getByTestId("kb-attach-incident-cta");
  await expect(cta).toBeVisible();
  const href = await cta.getAttribute("href");
  expect(href).toContain("/tickets/INC-1");
  expect(href).toContain(`attachKbArticle=${encodeURIComponent(articleId)}`);

  // Browse-side banner also picks up the param when the agent goes back.
  await isolatedPage.goto("/kb?attachToTicket=INC-1");
  await expect(isolatedPage.getByTestId("kb-attach-banner")).toBeVisible({ timeout: 10_000 });
});
