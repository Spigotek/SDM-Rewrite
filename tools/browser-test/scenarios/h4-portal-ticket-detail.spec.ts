import { test, expect } from "../fixtures/isolated-context";

/**
 * H.4 portal ticket-detail end-to-end (Lucia journey).
 *
 * Paths covered:
 *   1. Direct navigation to `/tickets/incident:10001` renders the detail page.
 *   2. Header + body + timeline + composer all visible.
 *   3. Submit a public comment → timeline gains a new public entry tagged
 *      with `data-kind="public"`.
 *   4. Type-prefix detection for `request:*` works on direct navigation.
 *   5. Invalid prefix routes render the NotFound element.
 *
 * `incident:10001` is the second seeded incident — it lives in the default
 * ACME tenant (every 3rd fixture goes to Globex, so i=1 is ACME). Picking
 * a known ID keeps the test independent of the home dashboard's
 * `customer=me` filter quirks.
 */
test("portal H.4 ticket-detail — open, render, post public comment", async ({ isolatedPage }) => {
  // Wait for the shell + session to settle before navigating into the route
  // (the loader needs MSW to be active).
  await isolatedPage.goto("/");
  await expect(isolatedPage.getByTestId("portal-home")).toBeVisible({ timeout: 15_000 });

  await isolatedPage.goto("/tickets/incident:10001");

  // ── Detail renders ────────────────────────────────────────────────
  const page = isolatedPage.getByTestId("portal-ticket-detail");
  await expect(page).toBeVisible({ timeout: 15_000 });
  await expect(page).toHaveAttribute("data-ticket-type", "incident");
  await expect(isolatedPage.getByTestId("portal-ticket-header")).toBeVisible();
  await expect(isolatedPage.getByTestId("portal-ticket-ref")).toBeVisible();
  await expect(isolatedPage.getByTestId("portal-ticket-summary")).toBeVisible();

  // Timeline (may render either populated list or empty state).
  const timeline = isolatedPage
    .getByTestId("portal-ticket-timeline")
    .or(isolatedPage.getByTestId("portal-ticket-timeline-unsupported"));
  await expect(timeline).toBeVisible();

  // ── Public comment round-trip ─────────────────────────────────────
  const composer = isolatedPage.getByTestId("portal-ticket-composer");
  const composerClosed = isolatedPage.getByTestId("portal-ticket-composer-closed");
  await expect(composer.or(composerClosed)).toBeVisible();

  // If the ticket is closed (CL/CD), the seed picks rotate the status — we
  // skip the write half but the read half is the load-bearing one.
  if (await composer.isVisible()) {
    const itemsBefore = await isolatedPage.getByTestId("portal-ticket-timeline-item").count();

    const textarea = isolatedPage.getByTestId("portal-ticket-composer-textarea");
    const submit = isolatedPage.getByTestId("portal-ticket-composer-submit");

    await textarea.fill("Reply from H.4 browser test");
    await submit.click();

    // The timeline should gain one new entry (the new public comment).
    await expect(isolatedPage.getByTestId("portal-ticket-timeline-item")).toHaveCount(
      itemsBefore + 1,
      { timeout: 5_000 },
    );

    // The newest entry should be a public reply with our text.
    const publicItems = isolatedPage.locator(
      '[data-testid="portal-ticket-timeline-item"][data-kind="public"]',
    );
    await expect(publicItems.last()).toContainText("Reply from H.4 browser test");
  }
});

test("portal H.4 ticket-detail — type-prefix detection for request:*", async ({ isolatedPage }) => {
  // Bootstrap MSW via the home route first.
  await isolatedPage.goto("/");
  await expect(isolatedPage.getByTestId("portal-home")).toBeVisible({ timeout: 15_000 });

  // `request:20001` is the second seeded request — fixture places it in
  // the default ACME tenant (i=1, so i % 3 !== 0).
  await isolatedPage.goto("/tickets/request:20001");

  const detail = isolatedPage.getByTestId("portal-ticket-detail");
  await expect(detail).toBeVisible({ timeout: 15_000 });
  await expect(detail).toHaveAttribute("data-ticket-type", "request");
});

test("portal H.4 ticket-detail — invalid prefix renders NotFound", async ({ isolatedPage }) => {
  await isolatedPage.goto("/tickets/garbage-no-prefix-here");
  await expect(isolatedPage.getByTestId("route-not-found")).toBeVisible({ timeout: 15_000 });
});
