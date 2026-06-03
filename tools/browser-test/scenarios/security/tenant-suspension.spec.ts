import { test, expect } from "../../fixtures/isolated-context";

/**
 * I.3 — `tenant-suspension` (`acceptance-criteria.md §4.2`).
 *
 * Three contracts the suspension flow must honour end-to-end against the
 * MSW build-mode SPA:
 *
 *  1. The switcher dropdown never lists suspended tenants (server-side
 *     filter in `/me/tenants` strips them; the MSW handler mirrors the BFF).
 *  2. A direct `POST /me/active-tenant` against a suspended tenant returns
 *     403 with `details.reason: "tenant_suspended"` — the SPA wraps this
 *     into `TenantSuspendedError`, fires the `sdm:tenant-suspended`
 *     custom event, and the session-context drops to anonymous.
 *  3. The active-tenant testid disappears (or the user pill flips to
 *     anonymous) within the toast timeout window.
 *
 * Runs on chromium only.
 */
test.describe("@security tenant suspension", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "single-vendor contract");

  test("suspended tenant is filtered from /me/tenants payload", async ({ isolatedPage }) => {
    await isolatedPage.goto("/");
    await expect(isolatedPage.getByTestId("top-bar")).toBeVisible({ timeout: 15_000 });

    const result = await isolatedPage.evaluate(async () => {
      const r = await fetch("/me/tenants");
      const body = (await r.json()) as { tenants: Array<{ id: string }> };
      return body.tenants.map((t) => t.id);
    });
    // Suspended fixture tenant is `initech` — it must NOT be in /me/tenants
    // even though Anna (user-1) has a role in it.
    expect(result).not.toContain("initech");
    expect(result).toContain("acme-corp");
    expect(result).toContain("globex");
  });

  test("POST /me/active-tenant against suspended tenant returns 403 + details.reason", async ({
    isolatedPage,
  }) => {
    await isolatedPage.goto("/");
    await expect(isolatedPage.getByTestId("top-bar")).toBeVisible({ timeout: 15_000 });

    const result = await isolatedPage.evaluate(async () => {
      const r = await fetch("/me/active-tenant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: "initech" }),
      });
      const body = (await r.json().catch(() => null)) as { details?: { reason?: string } } | null;
      return { status: r.status, reason: body?.details?.reason };
    });
    expect(result.status).toBe(403);
    expect(result.reason).toBe("tenant_suspended");
  });

  test("dispatching `sdm:tenant-suspended` drops the shell to anonymous", async ({
    isolatedPage,
  }) => {
    await isolatedPage.goto("/");
    await expect(isolatedPage.getByTestId("user-pill")).toBeVisible({ timeout: 15_000 });

    // Directly fire the event the `useActiveTenant` mutation would dispatch
    // on a `TenantSuspendedError`. The SessionContext listener wipes session
    // state without a round-trip; this isolates the receiver contract.
    await isolatedPage.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent("sdm:tenant-suspended", { detail: { tenantId: "initech" } }),
      );
    });

    // The user pill is only rendered when `status === "ready"` — it should
    // disappear within the React commit batch (well under 30 s — Playwright
    // poll budget per plan).
    await expect(isolatedPage.getByTestId("user-pill")).toBeHidden({ timeout: 30_000 });
  });
});
