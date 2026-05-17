import { test, expect } from "../fixtures/isolated-context";

test("POST /api/incidents persists into the in-memory store for this context", async ({
  isolatedPage,
}) => {
  await isolatedPage.goto("/");
  await expect(isolatedPage.getByTestId("mocks-flag")).toHaveText(/Mocks: on/);
  await expect(isolatedPage.getByTestId("incidents-summary")).toBeVisible({ timeout: 15_000 });

  const tenant = process.env["SDM_BROWSER_TEST_TENANT"] ?? "acme-corp";
  const summary = `browser-test mutation ${Date.now()}`;

  const result = await isolatedPage.evaluate(
    async ([t, s]) => {
      const created = await fetch("/api/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CA-SDM-Tenant": t as string },
        body: JSON.stringify({ summary: s, priority: 2, urgency: 2, impact: 2 }),
      });
      if (created.status !== 201) {
        return { ok: false as const, stage: "create", status: created.status };
      }
      const createdBody = (await created.json()) as {
        id: string;
        summary: string;
        tenantId: string;
      };
      const detail = await fetch(`/api/incidents/${encodeURIComponent(createdBody.id)}`, {
        headers: { "X-CA-SDM-Tenant": t as string },
      });
      if (!detail.ok) {
        return { ok: false as const, stage: "detail", status: detail.status };
      }
      const detailBody = (await detail.json()) as { id: string; summary: string };
      return { ok: true as const, createdBody, detailBody };
    },
    [tenant, summary] as const,
  );

  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.createdBody.tenantId).toBe(tenant);
  expect(result.createdBody.summary).toBe(summary);
  expect(result.detailBody.id).toBe(result.createdBody.id);
  expect(result.detailBody.summary).toBe(summary);
});
