import { test, expect } from "../../fixtures/isolated-context";

/**
 * I.3 — `tenant-deep-link-l13` (`acceptance-criteria.md §4.2`).
 *
 * A user opens a deep link to a ticket (or CI) that belongs to a foreign
 * tenant. The BFF must surface 404 (NOT 403), so a probe can't enumerate
 * the existence of foreign records via deep-link guessing.
 *
 * The MSW handlers honour the rule: cross-tenant `/api/{incidents,ci}/{id}`
 * returns 404 verbatim. The SPA route guard renders the not-found state
 * instead of the detail panel.
 *
 * Runs on chromium only — same content invariant on every vendor.
 */
test.describe("@security tenant deep link", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "single-vendor contract");

  test("foreign-tenant incident id surfaces as 404 to the network layer", async ({
    isolatedPage,
  }) => {
    await isolatedPage.goto("/");
    await expect(isolatedPage.getByTestId("top-bar")).toBeVisible({ timeout: 15_000 });

    const result = await isolatedPage.evaluate(async () => {
      // Pull a real acme incident id, then re-fetch it scoped to globex.
      const list = await fetch("/api/incidents?size=1", {
        headers: { "X-CA-SDM-Tenant": "acme-corp" },
      });
      const body = (await list.json()) as { results: { id: string }[] };
      const acmeId = body.results[0]?.id;
      if (!acmeId) throw new Error("acme incident list empty");
      const foreign = await fetch(`/api/incidents/${encodeURIComponent(acmeId)}`, {
        headers: { "X-CA-SDM-Tenant": "globex" },
      });
      return { acmeId, foreignStatus: foreign.status };
    });
    // 404 — NOT 403 (enumeration non-leakage).
    expect(result.foreignStatus).toBe(404);
    expect(result.foreignStatus).not.toBe(403);
  });

  test("foreign-tenant CI id surfaces as 404 to the network layer", async ({ isolatedPage }) => {
    await isolatedPage.goto("/");
    await expect(isolatedPage.getByTestId("top-bar")).toBeVisible({ timeout: 15_000 });

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
    expect(result.foreignStatus).not.toBe(403);
  });
});
