import { test, expect } from "../../fixtures/isolated-context";

/**
 * Journey #18 — `workspace-cmdb-cross-tenant-shared` (sp_admin / cmdb_owner).
 *
 * I.5 — shared CI marker + cross-tenant graph edges restored. sp_admin
 * (`user-10`) lands on `/cmdb`, sees the "Shared (N)" badge on shared CIs,
 * opens detail, asserts the header badge, and confirms `/api/ci/:id/relationships?tenants=all`
 * returns a foreign-tenant neighbour edge.
 */
test("journey-18 workspace CMDB cross-tenant — shared CI marker (sp_admin)", async ({
  isolatedPageAs,
}) => {
  const page = await isolatedPageAs("user-10");
  await page.goto("/cmdb");
  await expect(page.getByTestId("cmdb-table")).toBeVisible({ timeout: 15_000 });

  // Wait for at least one shared marker (the fixture tags 2 acme CIs as shared).
  await expect(page.getByTestId("cmdb-row-shared-marker").first()).toBeVisible({
    timeout: 15_000,
  });

  // Pluck the first shared CI id and visit its detail — the header badge
  // must surface too.
  const sharedCiId = await page.evaluate(async () => {
    const r = await fetch("/api/ci?size=200");
    const body = (await r.json()) as {
      results: Array<{ id: string; sharedWithTenantIds?: string[] }>;
    };
    return body.results.find((c) => (c.sharedWithTenantIds?.length ?? 0) > 0)?.id ?? null;
  });
  expect(sharedCiId).not.toBeNull();
  await page.goto(`/cmdb/ci/${encodeURIComponent(sharedCiId!)}`);
  await expect(page.getByTestId("cmdb-header-shared-marker")).toBeVisible({ timeout: 10_000 });
});

test("journey-18 workspace CMDB cross-tenant — cross-tenant relationship surfaces foreign neighbour", async ({
  isolatedPageAs,
}) => {
  const page = await isolatedPageAs("user-10");
  await page.goto("/cmdb");
  await expect(page.getByTestId("cmdb-table")).toBeVisible({ timeout: 15_000 });

  // The fixture has exactly one cross-tenant relationship — locate one
  // endpoint and pull `?tenants=all` neighbours.
  const result = await page.evaluate(async () => {
    const list = await fetch("/api/ci?size=200&tenants=all");
    const body = (await list.json()) as { results: Array<{ id: string; tenantId: string }> };
    const first = body.results.find((c) => c.tenantId === "acme-corp");
    if (!first) throw new Error("no acme CI in cross-tenant list");
    const rels = await fetch(`/api/ci/${encodeURIComponent(first.id)}/relationships?tenants=all`);
    const relsBody = (await rels.json()) as {
      relationships: Array<{ id: string; sourceCiId: string; targetCiId: string }>;
      neighbours: Array<{ id: string; tenantId: string }>;
    };
    const foreignNeighbours = relsBody.neighbours.filter((n) => n.tenantId !== first.tenantId);
    return {
      hasCrossRel: relsBody.relationships.some((r) => r.id.startsWith("rel:cross-tenant")),
      foreignNeighbourCount: foreignNeighbours.length,
    };
  });
  expect(result.hasCrossRel).toBe(true);
  expect(result.foreignNeighbourCount).toBeGreaterThan(0);
});

test("journey-18 workspace CMDB cross-tenant — non-sp_admin still 404s across tenants", async ({
  isolatedPage,
}) => {
  await isolatedPage.goto("/cmdb");
  await expect(isolatedPage.getByTestId("cmdb-table")).toBeVisible({ timeout: 30_000 });

  const result = await isolatedPage.evaluate(async () => {
    const list = await fetch("/api/ci?size=1", { headers: { "X-CA-SDM-Tenant": "acme-corp" } });
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
