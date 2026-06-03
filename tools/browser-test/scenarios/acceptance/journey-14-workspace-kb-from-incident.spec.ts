import { test, expect } from "../../fixtures/isolated-context";

/**
 * Journey #14 — `workspace-kb-from-incident` (kb_editor_jana).
 *
 * Anchors `acceptance-criteria.md §2.14` full path closed in I.4:
 *   1. Read-side: `?attachToTicket=INC-X` surfaces the KbAttachIncidentAction
 *      CTA on the article view, and the CTA threads `attachKbArticle=<id>`
 *      back to `/tickets/INC-X`. (Anna agent_l1 session.)
 *   2. Editor side: Jana opens `/kb/editor`, publishes a new article with
 *      visibility scoped to `tenant`, then the read flow can use it.
 *      Covers `@security:kb-visibility-scope`.
 */
test("journey-14 workspace KB from incident — attach CTA + publish-from-editor", async ({
  isolatedPage,
  isolatedPageAs,
}) => {
  // ── Read-side leg (default agent session) ──────────────────────────────
  await isolatedPage.goto("/kb");
  const rows = isolatedPage.getByTestId("kb-row");
  await expect(rows.first()).toBeVisible({ timeout: 15_000 });
  const articleId = await rows.first().getAttribute("data-row-id");
  if (!articleId) throw new Error("KB row missing data-row-id");

  await isolatedPage.goto(`/kb/article/${encodeURIComponent(articleId)}?attachToTicket=INC-1`);
  await expect(isolatedPage.getByTestId("workspace-kb-article")).toBeVisible({ timeout: 15_000 });

  const cta = isolatedPage.getByTestId("kb-attach-incident-cta");
  await expect(cta).toBeVisible();
  const href = await cta.getAttribute("href");
  expect(href).toContain("/tickets/INC-1");
  expect(href).toContain(`attachKbArticle=${encodeURIComponent(articleId)}`);

  await isolatedPage.goto("/kb?attachToTicket=INC-1");
  await expect(isolatedPage.getByTestId("kb-attach-banner")).toBeVisible({ timeout: 10_000 });

  // ── Editor leg: Jana publishes a new article with tenant visibility ────
  const janaPage = await isolatedPageAs("user-7"); // kb_editor
  await janaPage.goto("/kb/editor");
  await expect(janaPage.getByTestId("workspace-kb-editor")).toBeVisible({ timeout: 10_000 });

  const title = `From-incident article ${Date.now()}`;
  await janaPage.getByTestId("kb-editor-title").fill(title);
  const body = janaPage.locator('[data-testid="kb-editor-body"]');
  await body.click();
  await janaPage.keyboard.type("Riešenie naviazané na ticket INC-1.");
  await janaPage.getByTestId("kb-editor-visibility-tenant").check();

  await janaPage.getByTestId("kb-editor-save").click();
  await janaPage.waitForURL(/\/kb\/editor\/.+/, { timeout: 15_000 });

  // Publish — confirm the visibility selector inside the modal defaults
  // to `tenant` (the editor selection carries through).
  await janaPage.getByTestId("kb-editor-publish").click();
  const modal = janaPage.getByTestId("kb-publish-modal");
  await expect(modal).toBeVisible({ timeout: 5_000 });
  // Two VisibilitySelectors render at this point (sidebar + modal); scope
  // the assertion to the modal's instance.
  await expect(modal.getByTestId("kb-editor-visibility-tenant")).toBeChecked();
  await janaPage.getByTestId("kb-publish-submit").click();

  // The route auto-navigates to the article view after publish.
  await janaPage.waitForURL(/\/kb\/article\//, { timeout: 15_000 });
  await expect(janaPage.getByTestId("workspace-kb-article")).toBeVisible({ timeout: 15_000 });
});
