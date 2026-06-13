import { test, expect } from "../fixtures/isolated-context";

/**
 * K.3.C portal Command Palette — smoke. Verifies the Cmd+K hotkey opens the
 * palette, the navigate group is contributed, typing filters locally, and
 * pressing Enter dispatches the row's `onActivate` (router push to `/`).
 *
 * Tagged `@a11y` so the axe-spec sweep skips it (the palette ships its own
 * combobox a11y unit coverage in the design-system test suite — no need to
 * double-check in Playwright).
 */
test("@a11y portal Cmd+K opens palette and navigates", async ({ isolatedPage }) => {
  await isolatedPage.goto("/tickets");
  await expect(isolatedPage.getByTestId("top-bar")).toBeVisible({ timeout: 15_000 });

  // Open via the hotkey (Cmd on mac, Control elsewhere — Playwright maps
  // "Meta+K" to whichever the active platform uses).
  await isolatedPage.keyboard.press("Meta+k");
  const palette = isolatedPage.locator('[data-component="command-palette"]');
  await expect(palette).toBeVisible({ timeout: 5_000 });
  await expect(palette).toHaveAttribute("data-state", "open");

  // Type the Slovak label of the Home destination and activate it.
  const input = palette.getByRole("combobox");
  await input.fill("domov");

  // Local filter is instant — the single visible option is "Domov".
  await expect(palette.getByRole("option")).toHaveCount(1);
  await input.press("Enter");

  // Palette closes and the router lands on the home route.
  await expect(palette).not.toBeVisible({ timeout: 5_000 });
  await expect(isolatedPage).toHaveURL("/", { timeout: 5_000 });
});
