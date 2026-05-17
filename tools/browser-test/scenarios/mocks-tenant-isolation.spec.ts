import { test, expect } from "../fixtures/isolated-context";

test("tenant header switches the dataset (acme vs globex)", async ({ isolatedPage }) => {
  await isolatedPage.goto("/");
  await expect(isolatedPage.getByTestId("mocks-flag")).toHaveText(/Mocks: on/);
  await expect(isolatedPage.getByTestId("incidents-summary")).toBeVisible({ timeout: 15_000 });

  // Fetch through the page's JS context so the service worker (MSW) intercepts.
  const tenant = process.env["SDM_BROWSER_TEST_TENANT"] ?? "acme-corp";
  const otherTenant = tenant === "acme-corp" ? "globex" : "acme-corp";

  const result = await isolatedPage.evaluate(
    async ([primary, secondary]) => {
      const fetchJson = async (t: string) => {
        const r = await fetch("/api/incidents?size=100", { headers: { "X-CA-SDM-Tenant": t } });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()) as { totalCount: number; results: { tenantId: string }[] };
      };
      const a = await fetchJson(primary as string);
      const b = await fetchJson(secondary as string);
      return { primary: a, secondary: b };
    },
    [tenant, otherTenant] as const,
  );

  expect(result.primary.totalCount).toBeGreaterThan(0);
  expect(result.primary.results.every((r) => r.tenantId === tenant)).toBe(true);
  expect(result.secondary.results.every((r) => r.tenantId === otherTenant)).toBe(true);
});
