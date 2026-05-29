import { test, expect } from "../../fixtures/isolated-context";

/**
 * Journey #12 — `workspace-change-cross-tenant-conflict` (change_manager_peter).
 *
 * Status: **partial — cross-tenant calendar overlay deferred**.
 *
 * Anchors `acceptance-criteria.md §2.12` (MVP scope):
 *   1. Calendar view renders for the active tenant.
 *   2. Tenant switch from the global switcher swaps the displayed data
 *      (proxy for cross-tenant view via per-tenant load, since the
 *      "All my tenants" toggle is not implemented in the MVP).
 *
 * The "All my tenants" overlay (`@security:cross-tenant-view-sp`) +
 * step-up auth gate land in Phase I.2 (cross-tenant SP cockpit). MSW
 * tenant-isolation contract (`mocks-tenant-isolation.spec.ts`) covers the
 * dataset-scope invariant — included here as a sibling assertion.
 */
test("journey-12 workspace change cross-tenant — calendar + tenant-isolated data", async ({
  isolatedPage,
}) => {
  await isolatedPage.setViewportSize({ width: 1400, height: 900 });
  await isolatedPage.goto("/changes/calendar");
  await expect(isolatedPage.getByTestId("calendar-view")).toBeVisible({ timeout: 15_000 });

  // Tenant scope assertion — same as `mocks-tenant-isolation`, ensures
  // T1 vs T2 fetches return disjoint datasets per the X-CA-SDM-Tenant
  // header (proxy for the cross-tenant overlay in the future).
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
