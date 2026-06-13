import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "../../fixtures/isolated-context";

/**
 * I.2 — axe-core sweep per workspace route. Blocks PR on `serious` /
 * `critical` violations only. See `axe-sweep-portal.spec.ts` for the
 * shared policy + rationale.
 */

const WORKSPACE_ROUTES: ReadonlyArray<{ name: string; path: string; readySelector: string }> = [
  { name: "queue", path: "/queue", readySelector: '[data-testid="workspace-queue"]' },
  { name: "changes", path: "/changes", readySelector: '[data-testid="workspace-changes"]' },
  {
    name: "changes-calendar",
    path: "/changes/calendar",
    readySelector: '[data-testid="calendar-view"]',
  },
  { name: "problems", path: "/problems", readySelector: '[data-testid="workspace-problems"]' },
  { name: "cmdb", path: "/cmdb", readySelector: '[data-testid="workspace-cmdb"]' },
  { name: "kb", path: "/kb", readySelector: '[data-testid="workspace-kb"]' },
];

test.describe("@a11y workspace axe sweep", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "axe sweep runs on chromium only");

  for (const route of WORKSPACE_ROUTES) {
    test(`workspace ${route.name} (${route.path}) — no serious / critical a11y violations`, async ({
      isolatedPage,
    }) => {
      // K-fix — emulate `prefers-reduced-motion: reduce` so the K.1 brief §7
      // list-row stagger lands instantly. Without this, axe samples mid-fade
      // and reports a transient `color-contrast` failure on row cells whose
      // opacity is still animating from 0 to 1.
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
        console.error(
          `[axe] workspace ${route.name} blocking violations:`,
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
      expect(blocking, `workspace ${route.name} blocking a11y violations`).toEqual([]);
    });
  }

  test("workspace ticket detail — no serious / critical a11y violations", async ({
    isolatedPage,
  }) => {
    await isolatedPage.emulateMedia({ reducedMotion: "reduce" });
    await isolatedPage.goto("/queue");
    const firstRow = isolatedPage.getByTestId("queue-row").first();
    await firstRow.waitFor({ timeout: 20_000 });
    const rowId = await firstRow.getAttribute("data-row-id");
    if (!rowId) test.skip(true, "queue rendered no rows in mock data");

    await isolatedPage.goto(`/tickets/${encodeURIComponent(rowId!)}`);
    await isolatedPage.locator('[data-testid="ticket-detail-page"]').waitFor({ timeout: 20_000 });

    const results = await new AxeBuilder({ page: isolatedPage })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const blocking = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(blocking).toEqual([]);
  });

  test("workspace change detail — no serious / critical a11y violations", async ({
    isolatedPage,
  }) => {
    await isolatedPage.emulateMedia({ reducedMotion: "reduce" });
    await isolatedPage.goto("/changes");
    await isolatedPage.locator('[data-testid="workspace-changes"]').waitFor({ timeout: 20_000 });
    const firstRow = isolatedPage.locator("tr[data-row-id]").first();
    const visible = await firstRow.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!visible) test.skip(true, "changes list rendered no rows in mock data");

    const rowId = (await firstRow.getAttribute("data-row-id")) ?? null;
    if (!rowId) test.skip(true, "change row missing data-row-id");

    await isolatedPage.goto(`/changes/${encodeURIComponent(rowId!)}`);
    await isolatedPage.locator('[data-testid="change-detail-page"]').waitFor({ timeout: 20_000 });

    const results = await new AxeBuilder({ page: isolatedPage })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const blocking = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(blocking).toEqual([]);
  });

  test("workspace problem detail — no serious / critical a11y violations", async ({
    isolatedPage,
  }) => {
    await isolatedPage.emulateMedia({ reducedMotion: "reduce" });
    await isolatedPage.goto("/problems");
    await isolatedPage.locator('[data-testid="workspace-problems"]').waitFor({ timeout: 20_000 });
    const firstRow = isolatedPage.locator("tr[data-row-id]").first();
    const visible = await firstRow.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!visible) test.skip(true, "problems list rendered no rows in mock data");

    const rowId = (await firstRow.getAttribute("data-row-id")) ?? null;
    if (!rowId) test.skip(true, "problem row missing data-row-id");

    await isolatedPage.goto(`/problems/${encodeURIComponent(rowId!)}`);
    await isolatedPage.locator('[data-testid="problem-detail-page"]').waitFor({ timeout: 20_000 });

    const results = await new AxeBuilder({ page: isolatedPage })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const blocking = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(blocking).toEqual([]);
  });

  test("workspace CMDB CI detail — no serious / critical a11y violations", async ({
    isolatedPage,
  }) => {
    await isolatedPage.emulateMedia({ reducedMotion: "reduce" });
    await isolatedPage.goto("/cmdb");
    await isolatedPage.locator('[data-testid="workspace-cmdb"]').waitFor({ timeout: 20_000 });
    const firstRow = isolatedPage.locator("tr[data-row-id]").first();
    const visible = await firstRow.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!visible) test.skip(true, "cmdb list rendered no rows in mock data");

    const rowId = (await firstRow.getAttribute("data-row-id")) ?? null;
    if (!rowId) test.skip(true, "cmdb row missing data-row-id");

    await isolatedPage.goto(`/cmdb/ci/${encodeURIComponent(rowId!)}`);
    await isolatedPage.locator('[data-testid="cmdb-detail-page"]').waitFor({ timeout: 20_000 });

    const results = await new AxeBuilder({ page: isolatedPage })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const blocking = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(blocking).toEqual([]);
  });

  test("workspace KB article — no serious / critical a11y violations", async ({ isolatedPage }) => {
    await isolatedPage.emulateMedia({ reducedMotion: "reduce" });
    await isolatedPage.goto("/kb");
    await isolatedPage.locator('[data-testid="workspace-kb"]').waitFor({ timeout: 20_000 });
    const firstLink = isolatedPage.locator('a[href^="/kb/article/"]').first();
    const visible = await firstLink.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!visible) test.skip(true, "no KB article link rendered in mock data");

    await firstLink.click();
    const articleReady = await isolatedPage
      .locator('[data-testid="workspace-kb-article"]')
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
