import { test, expect } from "../fixtures/isolated-context";

/**
 * H.3 portal new-incident form — Lucia journey AC #1 (happy path).
 *
 * Paths covered:
 *   1. `/new-incident` renders the form with all 4 fields visible.
 *   2. Validation: submitting an empty form surfaces inline errors and
 *      does NOT navigate to the success state.
 *   3. Happy path: fill category + summary + urgency → submit → success
 *      screen with the new ticket ref + 3 CTAs.
 *   4. "Report another" resets the form back to an empty state.
 */
test("portal H.3 new-incident — form renders + validation + happy-path submit", async ({
  isolatedPage,
}) => {
  // Bootstrap MSW via the home route first.
  await isolatedPage.goto("/");
  await expect(isolatedPage.getByTestId("portal-home")).toBeVisible({ timeout: 15_000 });

  // Navigate to the form route.
  await isolatedPage.goto("/new-incident");
  const route = isolatedPage.getByTestId("portal-new-incident");
  await expect(route).toBeVisible({ timeout: 15_000 });

  const form = isolatedPage.getByTestId("portal-new-incident-form");
  await expect(form).toBeVisible();

  const summaryInput = isolatedPage.getByTestId("portal-new-incident-summary");
  const descriptionInput = isolatedPage.getByTestId("portal-new-incident-description");
  const submitBtn = isolatedPage.getByTestId("portal-new-incident-submit");
  const urgencyGroup = isolatedPage.getByTestId("portal-new-incident-urgency-group");

  await expect(summaryInput).toBeVisible();
  await expect(descriptionInput).toBeVisible();
  await expect(urgencyGroup).toBeVisible();
  await expect(submitBtn).toBeVisible();

  // ── Validation: empty submit blocks navigation ────────────────────
  await submitBtn.click();
  // Stay on the form (no success element).
  await expect(isolatedPage.getByTestId("portal-new-incident-success")).toHaveCount(0);
  // Field errors surface on at least the required Select + summary fields.
  await expect(isolatedPage.locator('[role="alert"]').first()).toBeVisible();

  // ── Happy path: fill and submit ───────────────────────────────────
  // Select — Radix portal renders the listbox into <body>; click the
  // trigger first to open it, then click the option by text.
  await isolatedPage
    .locator('button[data-component="select"], [data-component="select"] button')
    .or(isolatedPage.locator('[data-component="select"] [role="combobox"]'))
    .first()
    .click();
  // Hardware option label text comes from the SK catalog — assert by role.
  await isolatedPage.getByRole("option", { name: /Hardvér|Hardware/ }).click();

  await summaryInput.fill("Notebook sa náhodne reštartuje");
  await descriptionInput.fill("Od dnes rána sa mi notebook reštartuje pri otváraní Outlooku.");

  // Urgency radio — pick the default (level 2).
  await isolatedPage.getByTestId("portal-new-incident-urgency-2").check();

  await submitBtn.click();

  // ── Success screen ───────────────────────────────────────────────
  const success = isolatedPage.getByTestId("portal-new-incident-success");
  await expect(success).toBeVisible({ timeout: 10_000 });
  // The success block carries the newly minted ticket ref as `data-ticket-ref`.
  await expect(success).toHaveAttribute("data-ticket-ref", /^IN-\d+$/);

  // 3 CTAs visible.
  await expect(isolatedPage.getByTestId("portal-new-incident-success-view")).toBeVisible();
  await expect(isolatedPage.getByTestId("portal-new-incident-success-another")).toBeVisible();
  await expect(isolatedPage.getByTestId("portal-new-incident-success-done")).toBeVisible();

  // ── Report another → back to fresh form ──────────────────────────
  await isolatedPage.getByTestId("portal-new-incident-success-another").click();
  await expect(isolatedPage.getByTestId("portal-new-incident-form")).toBeVisible({
    timeout: 5_000,
  });
  // Summary input should be empty again.
  await expect(isolatedPage.getByTestId("portal-new-incident-summary")).toHaveValue("");
});

/**
 * Pending-changes integration: typing into the form registers the dirty
 * marker with `PendingChangesContext`, which makes the tenant switcher
 * prompt for confirmation before switching.
 */
test("portal H.3 new-incident — dirty form blocks tenant switch", async ({ isolatedPage }) => {
  await isolatedPage.goto("/");
  await expect(isolatedPage.getByTestId("portal-home")).toBeVisible({ timeout: 15_000 });

  await isolatedPage.goto("/new-incident");
  await expect(isolatedPage.getByTestId("portal-new-incident-form")).toBeVisible({
    timeout: 15_000,
  });

  // Dirty the form — a single keystroke in summary flips RHF isDirty.
  await isolatedPage.getByTestId("portal-new-incident-summary").fill("Test draft");

  // Attempt tenant switch — confirm dialog must open.
  await isolatedPage.getByTestId("tenant-display").click();
  await isolatedPage.getByTestId("tenant-row-globex").click();
  await expect(isolatedPage.getByTestId("tenant-switch-confirm")).toBeVisible();

  // Cancel — tenant stays. The `active-tenant` testid only lives inside
  // `HomeRoute`, so we verify the visible `tenant-display` text instead.
  await isolatedPage.getByTestId("tenant-switch-confirm-cancel").click();
  await expect(isolatedPage.getByTestId("tenant-switch-confirm")).toBeHidden();
  await expect(isolatedPage.getByTestId("tenant-display")).toContainText("Acme Corporation");
});
