import { test, expect } from "../../fixtures/isolated-context";

/**
 * Journey #14 — `workspace-kb-from-incident` (kb_editor_jana).
 *
 * Anchors `acceptance-criteria.md §2.14` MVP read-only slice:
 *   1. `/kb/article/:id?attachToTicket=INC-X` surfaces the
 *      KbAttachIncidentAction CTA on the article view.
 *   2. CTA href threads `attachKbArticle=<articleId>` back to the ticket.
 *   3. Browse-side banner picks up `?attachToTicket` and points back.
 *
 * The publish-from-editor + per-tenant visibility selector
 * (`@security:kb-visibility-scope`) are deferred — KB editor is Phase I.5
 * (same dependency as journey #13).
 */
test("journey-14 workspace KB from incident — attach CTA threads article id back to ticket", async ({
  isolatedPage,
}) => {
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

  // Browse-side banner.
  await isolatedPage.goto("/kb?attachToTicket=INC-1");
  await expect(isolatedPage.getByTestId("kb-attach-banner")).toBeVisible({ timeout: 10_000 });
});
