import { test, expect } from "../fixtures/isolated-context";

/**
 * H.1 — pending-changes guard.
 *
 * Forms (Composer, NewIncidentForm, etc.) will be added in later chunks; for
 * H.1 the guard is exercised via the dev-only `<PendingChangesTestBridge>`
 * which lets Playwright register a synthetic "dirty form" by dispatching a
 * `sdm:test-set-dirty` custom event. The bridge is tree-shaken from production
 * builds so this scenario is only valid against the dev server (port 5173).
 */
test("H.1 pending-changes guard — dialog appears, cancel preserves, confirm switches", async ({
  isolatedPage,
}) => {
  await isolatedPage.goto("/");
  await expect(isolatedPage.getByTestId("tenant-display")).toBeVisible({ timeout: 15_000 });

  // Mark a synthetic form as dirty via the test bridge.
  await isolatedPage.evaluate(() => {
    window.dispatchEvent(
      new CustomEvent("sdm:test-set-dirty", {
        detail: { formId: "h1-test-form", dirty: true },
      }),
    );
  });

  // Open the dropdown.
  await isolatedPage.getByTestId("tenant-display").click();
  await expect(isolatedPage.getByTestId("tenant-list")).toBeVisible();

  // Clicking Globex must NOT switch — the confirm dialog opens first.
  await isolatedPage.getByTestId("tenant-row-globex").click();
  const confirm = isolatedPage.getByTestId("tenant-switch-confirm");
  await expect(confirm).toBeVisible();

  // Cancel — tenant stays on Acme.
  await isolatedPage.getByTestId("tenant-switch-confirm-cancel").click();
  await expect(confirm).toBeHidden();
  await expect(isolatedPage.getByTestId("tenant-display")).toContainText("Acme Corporation");
  await expect(isolatedPage.getByTestId("active-tenant")).toHaveText("acme-corp");

  // Re-open + confirm — tenant switches.
  await isolatedPage.getByTestId("tenant-display").click();
  await isolatedPage.getByTestId("tenant-row-globex").click();
  await expect(isolatedPage.getByTestId("tenant-switch-confirm")).toBeVisible();
  await isolatedPage.getByTestId("tenant-switch-confirm-accept").click();
  await expect(isolatedPage.getByTestId("tenant-display")).toContainText("Globex Industries", {
    timeout: 5_000,
  });
  await expect(isolatedPage.getByTestId("active-tenant")).toHaveText("globex");
});
