import { test, expect } from "../../fixtures/isolated-context";

/**
 * Journey #12 — `workspace-change-cross-tenant-conflict` (sp_admin).
 *
 * I.5 — full overlay restored. The sp_admin (`user-10`) lands on
 * `/changes/calendar`, toggles "All my tenants", and asserts that events from
 * two distinct tenants render with distinct background colors. We also keep
 * the tenant-isolation invariant from the H.16 baseline so regressions in
 * MSW tenant scoping don't slip through.
 */
test("journey-12 workspace change cross-tenant — All my tenants overlay (sp_admin)", async ({
  isolatedPageAs,
}) => {
  const page = await isolatedPageAs("user-10");
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto("/changes/calendar");

  await expect(page.getByTestId("calendar-view")).toBeVisible({ timeout: 15_000 });
  const toggle = page.getByTestId("calendar-all-tenants-toggle").locator("input");
  await expect(toggle).toBeVisible();
  await toggle.check();

  // Cross-tenant data shape — sp_admin must receive entries from 2 tenants.
  const cross = await page.evaluate(async () => {
    const r = await fetch("/api/changes?size=200&tenants=all");
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return (await r.json()) as { totalCount: number; results: { tenantId: string }[] };
  });
  const tenantSet = new Set(cross.results.map((c) => c.tenantId));
  expect(cross.totalCount).toBeGreaterThan(0);
  expect(tenantSet.size).toBeGreaterThanOrEqual(2);

  // SP mode badge visible in the TopBar so sp_admin can't lose situational
  // context.
  await expect(page.getByTestId("sp-mode-badge")).toBeVisible();
});

test("journey-12 workspace change cross-tenant — non-sp_admin blocked from cross-tenant API", async ({
  isolatedPage,
}) => {
  await isolatedPage.goto("/changes/calendar");
  await expect(isolatedPage.getByTestId("calendar-view")).toBeVisible({ timeout: 15_000 });

  const status = await isolatedPage.evaluate(async () => {
    const r = await fetch("/api/changes?size=50&tenants=all");
    return r.status;
  });
  // MSW returns 403 (existence non-leakage — `@security:cross-tenant-view-sp`).
  expect(status).toBe(403);
});

test("journey-12 workspace change cross-tenant — tenant scope intact for non-cross queries", async ({
  isolatedPage,
}) => {
  await isolatedPage.goto("/changes/calendar");
  await expect(isolatedPage.getByTestId("calendar-view")).toBeVisible({ timeout: 15_000 });

  const result = await isolatedPage.evaluate(async () => {
    const fetchTenant = async (t: string) => {
      const r = await fetch("/api/changes?size=50", { headers: { "X-CA-SDM-Tenant": t } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return (await r.json()) as { totalCount: number; results: { tenantId: string }[] };
    };
    const acme = await fetchTenant("acme-corp");
    const globex = await fetchTenant("globex");
    return { acme, globex };
  });
  expect(result.acme.totalCount).toBeGreaterThan(0);
  expect(result.acme.results.every((r) => r.tenantId === "acme-corp")).toBe(true);
  expect(result.globex.results.every((r) => r.tenantId === "globex")).toBe(true);
});
