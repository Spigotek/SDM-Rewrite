import { test, expect } from "../../fixtures/isolated-context";

/**
 * Journey #3 — `portal-kb-self-help` (requester_lucia).
 *
 * Anchors `acceptance-criteria.md §2.3`:
 *   1. KB search renders the list (default = all published).
 *   2. Open an article → header + lazy markdown body.
 *   3. "Useful" vote flips the helpfulness widget into the thanks state.
 *   4. Empty search ("abrakadabra") surfaces the "open ticket" CTA with
 *      the query pre-filled.
 *
 * Markdown XSS sanitization (`@security:kb-xss-sanitization`) is asserted
 * via component unit tests against `MarkdownRenderer` — out of browser
 * smoke scope per H.16 plan (read-only §4 verification).
 */
test("journey-03 portal KB — search list → article → 'useful' vote", async ({ isolatedPage }) => {
  await isolatedPage.goto("/");
  await expect(isolatedPage.getByTestId("portal-home")).toBeVisible({ timeout: 15_000 });

  await isolatedPage.goto("/kb");
  await expect(isolatedPage.getByTestId("portal-kb")).toBeVisible({ timeout: 15_000 });
  await expect(isolatedPage.getByTestId("kb-result-list")).toBeVisible({ timeout: 10_000 });

  // Open the first article.
  await isolatedPage.locator('[data-testid^="kb-result-kb:"]').first().click();
  await expect(isolatedPage.getByTestId("portal-kb-article")).toBeVisible({ timeout: 15_000 });
  await expect(isolatedPage.getByTestId("kb-article-body")).toBeVisible({ timeout: 10_000 });

  // Helpfulness vote.
  await isolatedPage.getByTestId("kb-helpfulness-up").click();
  await expect(isolatedPage.getByTestId("kb-helpfulness")).toHaveAttribute(
    "data-helpfulness-vote",
    "up",
    { timeout: 5_000 },
  );
});

test("journey-03 portal KB — empty search surfaces 'open ticket' CTA", async ({ isolatedPage }) => {
  await isolatedPage.goto("/");
  await expect(isolatedPage.getByTestId("portal-home")).toBeVisible({ timeout: 15_000 });

  await isolatedPage.goto("/kb");
  await expect(isolatedPage.getByTestId("portal-kb")).toBeVisible({ timeout: 15_000 });

  await isolatedPage.getByTestId("kb-search-input").fill("abrakadabra-no-match");
  await isolatedPage.waitForTimeout(450);

  const cta = isolatedPage.getByTestId("kb-empty-open-ticket");
  await expect(cta).toBeVisible({ timeout: 5_000 });
  const href = await cta.getAttribute("href");
  expect(href).toContain("/new-incident?summary=");
  expect(href).toContain("abrakadabra-no-match");
});
