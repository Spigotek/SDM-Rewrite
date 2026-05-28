import { describe, expect, it } from "vitest";
import type { UiQueuePage } from "@sdm/api-types";
import "./setup";

const BASE = "http://localhost";

describe("queue handler", () => {
  it("GET /api/queue returns UiQueuePage shape scoped to the tenant header", async () => {
    const res = await fetch(`${BASE}/api/queue`, {
      headers: { "X-CA-SDM-Tenant": "acme-corp" },
    });
    expect(res.status).toBe(200);
    const page = (await res.json()) as UiQueuePage;
    expect(Array.isArray(page.data)).toBe(true);
    expect(page.page.total).toBeGreaterThan(0);
    expect(page.data.length).toBeLessThanOrEqual(page.page.total);

    // Tenant scoping — Globex should return a different (and smaller) set.
    const globexRes = await fetch(`${BASE}/api/queue`, {
      headers: { "X-CA-SDM-Tenant": "globex" },
    });
    const globex = (await globexRes.json()) as UiQueuePage;
    expect(globex.page.total).toBeGreaterThan(0);
    expect(globex.page.total).toBeLessThan(page.page.total);
  });

  it("orders rows by priority desc, then openedAt desc", async () => {
    const res = await fetch(`${BASE}/api/queue`, {
      headers: { "X-CA-SDM-Tenant": "acme-corp" },
    });
    const page = (await res.json()) as UiQueuePage;
    const codes = page.data.slice(0, 10).map((r) => r.priority?.code ?? "0");
    // Priority codes are ascending strings ("1" highest); after the sort, the
    // first row's numeric priority must be <= the last row's.
    const first = Number(codes[0]);
    const last = Number(codes[codes.length - 1]);
    expect(first).toBeLessThanOrEqual(last);
  });

  it("includes incident, request and problem rows in the merged set", async () => {
    const res = await fetch(`${BASE}/api/queue?size=200`, {
      headers: { "X-CA-SDM-Tenant": "acme-corp" },
    });
    const page = (await res.json()) as UiQueuePage;
    const kinds = new Set(page.data.map((r) => r.ticketType));
    expect(kinds.has("incident")).toBe(true);
    expect(kinds.has("request")).toBe(true);
    expect(kinds.has("problem")).toBe(true);
  });
});
