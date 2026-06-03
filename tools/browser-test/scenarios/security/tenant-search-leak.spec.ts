import { test, expect } from "../../fixtures/isolated-context";

/**
 * I.3 — `tenant-search-leak-l6` (`acceptance-criteria.md §4.2`).
 *
 * A search query against incidents / changes / cmdb scoped to tenant B
 * must never return tenant A records. The MSW handlers honour the
 * `X-CA-SDM-Tenant` header so we can drive the cross-tenant call without
 * a real tenant switch + cookie dance; the cross-cutting invariant is
 * that no result rows carry a `tenantId` other than the request's.
 *
 * Runs on chromium only (the contract is identical across vendors; ×3
 * wastes CI minutes).
 */
test.describe("@security tenant search leak", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "single-vendor contract");

  test("search /api/incidents in tenant B does not surface tenant A records", async ({
    isolatedPage,
  }) => {
    await isolatedPage.goto("/");
    await expect(isolatedPage.getByTestId("top-bar")).toBeVisible({ timeout: 15_000 });

    const result = await isolatedPage.evaluate(async () => {
      const fetchTenant = async (t: string) => {
        const r = await fetch("/api/incidents?size=100&q=secret", {
          headers: { "X-CA-SDM-Tenant": t },
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()) as { results: { tenantId: string }[] };
      };
      const a = await fetchTenant("acme-corp");
      const b = await fetchTenant("globex");
      return {
        acmeOwnTenantOnly: a.results.every((r) => r.tenantId === "acme-corp"),
        globexOwnTenantOnly: b.results.every((r) => r.tenantId === "globex"),
      };
    });
    expect(result.acmeOwnTenantOnly).toBe(true);
    expect(result.globexOwnTenantOnly).toBe(true);
  });

  test("search /api/changes in tenant B does not surface tenant A records", async ({
    isolatedPage,
  }) => {
    await isolatedPage.goto("/");
    await expect(isolatedPage.getByTestId("top-bar")).toBeVisible({ timeout: 15_000 });

    const result = await isolatedPage.evaluate(async () => {
      const fetchTenant = async (t: string) => {
        const r = await fetch("/api/changes?size=100", {
          headers: { "X-CA-SDM-Tenant": t },
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()) as { results: { tenantId: string }[] };
      };
      const acme = await fetchTenant("acme-corp");
      const globex = await fetchTenant("globex");
      return {
        acmeOwnTenantOnly: acme.results.every((r) => r.tenantId === "acme-corp"),
        globexOwnTenantOnly: globex.results.every((r) => r.tenantId === "globex"),
      };
    });
    expect(result.acmeOwnTenantOnly).toBe(true);
    expect(result.globexOwnTenantOnly).toBe(true);
  });

  test("search /api/ci in tenant B does not surface tenant A CIs", async ({ isolatedPage }) => {
    await isolatedPage.goto("/");
    await expect(isolatedPage.getByTestId("top-bar")).toBeVisible({ timeout: 15_000 });

    const result = await isolatedPage.evaluate(async () => {
      const fetchTenant = async (t: string) => {
        const r = await fetch("/api/ci?size=100", {
          headers: { "X-CA-SDM-Tenant": t },
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()) as { results: { tenantId: string }[] };
      };
      const acme = await fetchTenant("acme-corp");
      const globex = await fetchTenant("globex");
      return {
        acmeOwnTenantOnly: acme.results.every((r) => r.tenantId === "acme-corp"),
        globexOwnTenantOnly: globex.results.every((r) => r.tenantId === "globex"),
      };
    });
    expect(result.acmeOwnTenantOnly).toBe(true);
    expect(result.globexOwnTenantOnly).toBe(true);
  });
});
