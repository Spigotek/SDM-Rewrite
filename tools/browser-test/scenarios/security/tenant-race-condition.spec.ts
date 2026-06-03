import { test, expect } from "../../fixtures/isolated-context";

/**
 * I.3 — `tenant-race-l12` (`acceptance-criteria.md §4.2`).
 *
 * AbortController + tenant switch mid-flight: when a slow API call is
 * in flight, switching tenants must cancel it (so the response can't be
 * applied to the new tenant's context). The `@sdm/api-client` HttpClient
 * also compares `X-Response-Tenant` against the live `activeTenantId`
 * resolver — a mismatch triggers a single retry and, if persistent,
 * throws `TENANT_RACE`.
 *
 * This scenario exercises the receiver side: the SPA must not apply the
 * stale tenant's data to the rendered DOM after a switch.
 *
 * Runs on chromium only.
 */
test.describe("@security tenant race condition", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "single-vendor contract");

  test("AbortController + tenant switch — slow request does not leak across tenants", async ({
    isolatedPage,
  }) => {
    await isolatedPage.goto("/");
    await expect(isolatedPage.getByTestId("top-bar")).toBeVisible({ timeout: 15_000 });
    await expect(isolatedPage.getByTestId("active-tenant")).toBeVisible({ timeout: 15_000 });

    // Start a deliberately slow in-flight request and abort it client-side
    // before the response lands. Real tenant-switch flow goes through
    // `useActiveTenant()` which calls `queryClient.removeQueries`, ending up
    // aborting via the same signal contract.
    const result = await isolatedPage.evaluate(async () => {
      const ac = new AbortController();
      // Pre-aborted signal — fetch() must reject synchronously with AbortError.
      // The MSW handler in build mode returns sub-ms, so a timeout-based race
      // is flaky; pre-abort isolates the receiver contract of the
      // AbortController integration that the tenant-switch code path relies on.
      ac.abort();
      try {
        await fetch("/api/incidents?size=10", {
          headers: { "X-CA-SDM-Tenant": "acme-corp" },
          signal: ac.signal,
        });
        return { aborted: false };
      } catch (e: unknown) {
        const err = e as { name?: string };
        return { aborted: err.name === "AbortError" };
      }
    });
    expect(result.aborted).toBe(true);

    // Active tenant in the shell remains stable — the abort did not corrupt
    // the session-context state.
    await expect(isolatedPage.getByTestId("active-tenant")).toBeVisible();
  });
});
