import { test, expect } from "../../fixtures/isolated-context";

/**
 * Journey #13 — `workspace-kb-author-new` (kb_editor_jana).
 *
 * Anchors `acceptance-criteria.md §2.13` full path closed in I.4:
 *   1. Jana navigates from `/kb` → `/kb/editor` (new article).
 *   2. Fills title + markdown body + tags + visibility.
 *   3. Saves draft → article gets an id and the route swaps to
 *      `/kb/editor/:id`.
 *   4. Publish modal confirms visibility + tags.
 *   5. After publish, the article surfaces on `/kb` browse list.
 *   6. XSS payload (`<script>alert(1)</script>`) is stripped from the
 *      persisted body — covers `@security:kb-markdown-sanitization`.
 *
 * Persona switch: the default MSW session is `agent_l1_anna` which lacks
 * `kb.write`. The fixture `isolatedPageAs("user-7")` swaps to Jana
 * (kb_editor) via the `x-msw-user-id` MSW header.
 */
test("journey-13 workspace KB author new — create + publish + sanitize XSS", async ({
  isolatedPageAs,
}) => {
  const page = await isolatedPageAs("user-7"); // Jana / kb_editor

  // Land on browse — new-article CTA is visible for kb_editor.
  await page.goto("/kb");
  await expect(page.getByTestId("kb-table")).toBeVisible({ timeout: 15_000 });
  const newCta = page.getByTestId("kb-new-article");
  await expect(newCta).toBeVisible({ timeout: 10_000 });
  await newCta.click();
  await expect(page).toHaveURL(/\/kb\/editor$/, { timeout: 10_000 });

  // Editor shell renders.
  await expect(page.getByTestId("workspace-kb-editor")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId("kb-editor-shell")).toBeVisible({ timeout: 15_000 });

  // Fill the title + body (XSS payload included; sanitizer must strip it).
  const articleTitle = `Reset VPN journey-13 ${Date.now()}`;
  await page.getByTestId("kb-editor-title").fill(articleTitle);

  // Type into the TipTap editor (contenteditable). The toolbar buttons
  // exercise the bold + heading toggles + XSS payload is dropped at sanitize.
  const editorBody = page.locator('[data-testid="kb-editor-body"]');
  await editorBody.click();
  await page.keyboard.type("Bezpečný obsah.");
  await page.keyboard.press("Enter");
  await page.keyboard.type("<script>alert(1)</script>");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Hotovo.");

  // Tags + tenant visibility (the default).
  await page.getByTestId("kb-editor-tags").fill("vpn, reset, journey-13");
  await page.getByTestId("kb-editor-visibility-tenant").check();

  // Save draft → id assigned → URL swaps to /kb/editor/:id.
  await page.getByTestId("kb-editor-save").click();
  await page.waitForURL(/\/kb\/editor\/.+/, { timeout: 15_000 });

  // Publish flow.
  await page.getByTestId("kb-editor-publish").click();
  await expect(page.getByTestId("kb-publish-modal")).toBeVisible({ timeout: 5_000 });
  await page.getByTestId("kb-publish-submit").click();

  // After publish the route auto-navigates to the article view.
  await page.waitForURL(/\/kb\/article\//, { timeout: 15_000 });
  await expect(page.getByTestId("workspace-kb-article")).toBeVisible({ timeout: 15_000 });

  // ── XSS sanitization assertion ─────────────────────────────────────────
  // The published article body must not contain a literal <script> tag.
  const body = page.getByTestId("kb-article-body");
  await expect(body).toBeVisible({ timeout: 15_000 });
  const html = await body.innerHTML();
  expect(html).not.toContain("<script");
  expect(html).not.toContain("onerror=");

  // ── Article appears on /kb browse ──────────────────────────────────────
  await page.goto("/kb");
  await expect(page.getByTestId("kb-table")).toBeVisible({ timeout: 15_000 });
  // The newly-published article shows in the table — search by title text.
  const newRow = page.locator(`[data-testid="kb-row"]:has-text("${articleTitle.slice(0, 30)}")`);
  await expect(newRow.first()).toBeVisible({ timeout: 10_000 });
});
