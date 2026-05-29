import { test, expect } from "../../fixtures/isolated-context";

/**
 * Journey #1 — `portal-incident-broken-laptop` (requester_lucia).
 *
 * Anchors `acceptance-criteria.md §2.1` happy path:
 *   1. Portal home shows "Report a problem" as the primary action.
 *   2. Tenant breadcrumb visible during the flow.
 *   3. New-incident form submits with category + summary + urgency.
 *   4. Success screen exposes the new ticket ref.
 *
 * Alternate flows already covered by `h3-portal-new-incident.spec.ts`
 * (validation block) and `h4-portal-ticket-detail.spec.ts` (comment
 * round-trip).
 */
test("journey-01 portal incident — home CTA → form submit → ticket ref", async ({
  isolatedPage,
}) => {
  await isolatedPage.goto("/");
  await expect(isolatedPage.getByTestId("portal-home")).toBeVisible({ timeout: 15_000 });

  // Tenant breadcrumb visible (§2.1 DoD).
  await expect(isolatedPage.getByTestId("tenant-display")).toBeVisible();

  // Primary CTA — "Report a problem".
  const cta = isolatedPage.getByTestId("home-action-new-incident");
  await expect(cta).toBeVisible();
  await cta.click();
  await expect(isolatedPage).toHaveURL(/\/new-incident$/);

  // Form renders.
  const form = isolatedPage.getByTestId("portal-new-incident-form");
  await expect(form).toBeVisible({ timeout: 10_000 });

  // Fill category (Select via Radix portal) + summary + urgency.
  await isolatedPage.locator('[data-component="select"]').first().locator("button").click();
  await isolatedPage.getByRole("option", { name: /Hardvér|Hardware/ }).click();

  await isolatedPage.getByTestId("portal-new-incident-summary").fill("Notebook sa nespúšťa");
  await isolatedPage
    .getByTestId("portal-new-incident-description")
    .fill("Stlačil som power, žiadne svetlá.");
  await isolatedPage.getByTestId("portal-new-incident-urgency-2").check();

  await isolatedPage.getByTestId("portal-new-incident-submit").click();

  const success = isolatedPage.getByTestId("portal-new-incident-success");
  await expect(success).toBeVisible({ timeout: 10_000 });
  await expect(success).toHaveAttribute("data-ticket-ref", /^IN-\d+$/);
});
