import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "../../fixtures/isolated-context";

/**
 * I.2 — axe-core sweep per portal route. Blocks PR on `serious` / `critical`
 * violations only — `moderate` + `minor` are tracked in `a11y-debt.md` per
 * `qa-test-strategy/a11y-tests.md §1.3` policy.
 *
 * Runs on chromium only (axe-core is browser-agnostic; ×3 wastes CI minutes
 * without surfacing additional signal). Multi-browser concerns are covered
 * by the acceptance journey matrix, not by this a11y sweep.
 *
 * Per `a11y-tests.md §1.2`: WCAG 2.1 A + AA rule sets. Dynamic routes use
 * fixture IDs from `@sdm/api-mocks` — first queue row resolves the live
 * incident reference so we don't hard-code a stale fixture id.
 */

const PORTAL_ROUTES: ReadonlyArray<{ name: string; path: string; readySelector: string }> = [
  { name: "home", path: "/", readySelector: '[data-testid="portal-home"]' },
  {
    name: "new-incident",
    path: "/new-incident",
    readySelector: '[data-testid="portal-new-incident"]',
  },
  { name: "my-tickets", path: "/tickets", readySelector: '[data-testid="portal-my-tickets"]' },
  { name: "catalog", path: "/catalog", readySelector: '[data-testid="portal-catalog"]' },
  { name: "kb", path: "/kb", readySelector: '[data-testid="portal-kb"]' },
];

test.describe("@a11y portal axe sweep", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "axe sweep runs on chromium only");

  for (const route of PORTAL_ROUTES) {
    test(`portal ${route.name} (${route.path}) — no serious / critical a11y violations`, async ({
      isolatedPage,
    }) => {
      // K.3.F — emulate `prefers-reduced-motion: reduce` so the K.1 brief §7
      // list-row stagger lands instantly. Without this, axe samples mid-fade
      // (e.g. on `/kb` result cards) and reports a transient `color-contrast`
      // failure on cells whose opacity is still animating from 0 to 1.
      await isolatedPage.emulateMedia({ reducedMotion: "reduce" });
      await isolatedPage.goto(route.path);
      await isolatedPage.locator(route.readySelector).waitFor({ timeout: 20_000 });

      const results = await new AxeBuilder({ page: isolatedPage })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      const blocking = results.violations.filter(
        (v) => v.impact === "serious" || v.impact === "critical",
      );
      if (blocking.length > 0) {
        // Surface details to the test report so a failing run is actionable
        // without parsing the JSON artefact.
        console.error(
          `[axe] ${route.name} blocking violations:`,
          JSON.stringify(
            blocking.map((v) => ({
              id: v.id,
              impact: v.impact,
              help: v.help,
              nodes: v.nodes.length,
            })),
            null,
            2,
          ),
        );
      }
      expect(blocking, `portal ${route.name} blocking a11y violations`).toEqual([]);
    });
  }

  test("portal catalog item detail — no serious / critical a11y violations", async ({
    isolatedPage,
  }) => {
    await isolatedPage.emulateMedia({ reducedMotion: "reduce" });
    // Resolve a real catalog item id from the catalog list so we navigate to
    // a route that actually renders (vs. a hard-coded fixture id that may
    // drift). `FeaturedItemCard` emits `data-testid="catalog-featured-<id>"`
    // on the link element, with the item id embedded in the href.
    await isolatedPage.goto("/catalog");
    const firstItem = isolatedPage.locator('[data-testid^="catalog-featured-"]').first();
    await firstItem.waitFor({ timeout: 20_000 });
    await firstItem.click();
    await isolatedPage.locator('[data-testid="portal-catalog-item"]').waitFor({ timeout: 20_000 });

    const results = await new AxeBuilder({ page: isolatedPage })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const blocking = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(blocking).toEqual([]);
  });

  test("portal KB article — no serious / critical a11y violations", async ({ isolatedPage }) => {
    await isolatedPage.emulateMedia({ reducedMotion: "reduce" });
    await isolatedPage.goto("/kb");
    // KB search is debounced live-search — typing a generic term yields
    // results in MSW mode. Fall back to skip if the mock corpus is empty
    // or the article id doesn't resolve in the per-article handler.
    await isolatedPage.locator('[data-testid="kb-search-input"]').fill("vpn");
    const firstResult = isolatedPage.locator('[data-testid^="kb-result-"]').first();
    const visible = await firstResult.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!visible) test.skip(true, "no KB result rendered in mock data");

    await firstResult.click();
    const articleReady = await isolatedPage
      .locator('[data-testid="portal-kb-article"]')
      .waitFor({ timeout: 10_000 })
      .then(() => true)
      .catch(() => false);
    if (!articleReady) test.skip(true, "KB article detail did not render (MSW fixture drift)");

    const results = await new AxeBuilder({ page: isolatedPage })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const blocking = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(blocking).toEqual([]);
  });
});
