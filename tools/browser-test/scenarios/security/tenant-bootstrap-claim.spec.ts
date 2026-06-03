import { test, expect } from "../../fixtures/isolated-context";

/**
 * I.3 — `tenant-bootstrap-claim-l15` (`acceptance-criteria.md §4.2`).
 *
 * First login: the SPA bootstrap fetches `/me` and expects the BFF to
 * surface the user's *default* tenant (per the session claim populated at
 * login from CA SDM `cnt.tenant`), NOT a random pick from the allowed set.
 *
 * The MSW handler models the same contract: with no prior tenant cookie
 * the response's `activeTenant.id` equals `user.defaultTenantId`. This
 * scenario asserts that invariant + a second call confirms idempotency.
 *
 * Runs on chromium only.
 */
test.describe("@security tenant bootstrap claim", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "single-vendor contract");

  test("/me returns the user's default tenant on first call", async ({ isolatedPage }) => {
    await isolatedPage.goto("/");
    await expect(isolatedPage.getByTestId("top-bar")).toBeVisible({ timeout: 15_000 });

    const result = await isolatedPage.evaluate(async () => {
      const r = await fetch("/me");
      const body = (await r.json()) as { activeTenant: { id: string } };
      return body.activeTenant.id;
    });
    // Default tenant for Anna (user-1) is `acme-corp` per the fixture.
    expect(result).toBe("acme-corp");
  });

  test("/me bootstrap is stable across two consecutive calls (idempotent)", async ({
    isolatedPage,
  }) => {
    await isolatedPage.goto("/");
    await expect(isolatedPage.getByTestId("top-bar")).toBeVisible({ timeout: 15_000 });

    const result = await isolatedPage.evaluate(async () => {
      const a = await fetch("/me").then((r) => r.json());
      const b = await fetch("/me").then((r) => r.json());
      return {
        a: (a as { activeTenant: { id: string } }).activeTenant.id,
        b: (b as { activeTenant: { id: string } }).activeTenant.id,
      };
    });
    expect(result.a).toBe(result.b);
    expect(result.a).toBe("acme-corp");
  });
});
