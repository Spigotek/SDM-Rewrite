import { test, expect } from "../fixtures/isolated-context";

/**
 * K.3.C workspace Command Palette — smoke. Mirrors the portal scenario but
 * exercises the workspace action set (target route `/changes`).
 */
test("@a11y workspace Cmd+K opens palette and navigates", async ({ isolatedPage }) => {
  await isolatedPage.goto("/queue");
  await expect(isolatedPage.getByTestId("top-bar")).toBeVisible({ timeout: 15_000 });

  await isolatedPage.keyboard.press("Meta+k");
  const palette = isolatedPage.locator('[data-component="command-palette"]');
  await expect(palette).toBeVisible({ timeout: 5_000 });

  const input = palette.getByRole("combobox");
  await input.fill("zmeny");

  await expect(palette.getByRole("option").first()).toBeVisible();
  await input.press("Enter");

  await expect(palette).not.toBeVisible({ timeout: 5_000 });
  await expect(isolatedPage).toHaveURL(/\/changes/, { timeout: 5_000 });
});
