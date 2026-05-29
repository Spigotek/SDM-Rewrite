import { test, expect } from "../../fixtures/isolated-context";

/**
 * Journey #18 — `workspace-cmdb-cross-tenant-shared` (cmdb_owner_robert).
 *
 * Status: **partial — shared-CI cross-tenant marker deferred**.
 *
 * Anchors `acceptance-criteria.md §2.18` MVP slice:
 *   1. CMDB list scope is per-tenant — MSW returns acme-corp CIs for the
 *      `acme-corp` tenant header and globex CIs for the `globex` header,
 *      with zero leakage between datasets (proxy for the cross-tenant
 *      visibility contract from §2.18).
 *   2. Direct GET of an attachment that lives in another tenant returns
 *      404, not 403 (existence non-leakage — `@security:cross-tenant-attachment`).
 *
 * "Shared ownership" badge + "External tenant" link on the relationship
 * graph (`@security:cross-tenant-cmdb`) require a CMDB schema extension
 * for cross-tenant relationships — deferred to Phase I.6 (SP cockpit /
 * cross-tenant view).
 */
test("journey-18 workspace CMDB cross-tenant — tenant-scoped CI list", async ({ isolatedPage }) => {
  await isolatedPage.goto("/cmdb");
  await expect(isolatedPage.getByTestId("cmdb-table")).toBeVisible({ timeout: 15_000 });

  const result = await isolatedPage.evaluate(async () => {
    const fetchTenant = async (t: string) => {
      const r = await fetch("/api/ci?size=50", { headers: { "X-CA-SDM-Tenant": t } });
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

test("journey-18 workspace CMDB cross-tenant — CI fetch yields 404 across tenants", async ({
  isolatedPage,
}) => {
  // Bootstrap MSW via the CMDB list (the workspace `/` cold-redirect to
  // `/queue` is slower in preview build mode and just loads MSW + session
  // anyway).
  await isolatedPage.goto("/cmdb");
  await expect(isolatedPage.getByTestId("cmdb-table")).toBeVisible({ timeout: 30_000 });

  // Capture an acme CI id, then re-fetch it scoped to globex — MSW returns
  // 404 (existence non-leakage, `@security:cross-tenant-cmdb`).
  const result = await isolatedPage.evaluate(async () => {
    const list = await fetch("/api/ci?size=1", {
      headers: { "X-CA-SDM-Tenant": "acme-corp" },
    });
    const body = (await list.json()) as { results: { id: string }[] };
    const acmeId = body.results[0]?.id;
    if (!acmeId) throw new Error("acme CI list empty");
    const foreign = await fetch(`/api/ci/${encodeURIComponent(acmeId)}`, {
      headers: { "X-CA-SDM-Tenant": "globex" },
    });
    return { acmeId, foreignStatus: foreign.status };
  });
  expect(result.foreignStatus).toBe(404);
});
