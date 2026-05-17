import { describe, expect, it } from "vitest";
import "./setup";

const BASE = "http://localhost";
const ACME = { "X-CA-SDM-Tenant": "acme-corp" };

interface Page<T> {
  results: T[];
  totalCount: number;
  start: number;
  size: number;
}

describe("requests + catalog handlers", () => {
  it("GET /api/requests returns paginated tenant-scoped records", async () => {
    const res = await fetch(`${BASE}/api/requests`, { headers: ACME });
    const page = (await res.json()) as Page<{ tenantId: string }>;
    expect(page.results.every((r) => r.tenantId === "acme-corp")).toBe(true);
  });

  it("GET /api/catalog returns offerings for the tenant only", async () => {
    const res = await fetch(`${BASE}/api/catalog`, { headers: ACME });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { offerings: { id: string; tenantId: string }[] };
    expect(body.offerings.length).toBeGreaterThan(0);
    expect(body.offerings.every((o) => o.tenantId === "acme-corp")).toBe(true);
  });

  it("GET /api/catalog/:id/form returns the dynamic form schema", async () => {
    const list = (await (await fetch(`${BASE}/api/catalog`, { headers: ACME })).json()) as {
      offerings: { id: string }[];
    };
    const target = list.offerings[0]!;
    const res = await fetch(`${BASE}/api/catalog/${encodeURIComponent(target.id)}/form`, {
      headers: ACME,
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { form: { fields: { key: string }[] } };
    expect(body.form.fields.length).toBeGreaterThan(0);
  });
});

describe("problems handlers", () => {
  it("GET /api/problems returns tenant-scoped records", async () => {
    const res = await fetch(`${BASE}/api/problems`, { headers: ACME });
    const page = (await res.json()) as Page<{ tenantId: string }>;
    expect(page.results.every((p) => p.tenantId === "acme-corp")).toBe(true);
  });

  it("GET /api/problems/:id/related-incidents returns linked incidents only", async () => {
    const list = (await (await fetch(`${BASE}/api/problems`, { headers: ACME })).json()) as Page<{
      id: string;
    }>;
    const target = list.results[0]!;
    const res = await fetch(
      `${BASE}/api/problems/${encodeURIComponent(target.id)}/related-incidents`,
      {
        headers: ACME,
      },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { incidents: { tenantId: string }[] };
    expect(body.incidents.every((i) => i.tenantId === "acme-corp")).toBe(true);
  });
});

describe("changes handlers", () => {
  it("POST /api/changes/:id/approve transitions to APPROVED", async () => {
    const list = (await (await fetch(`${BASE}/api/changes`, { headers: ACME })).json()) as Page<{
      id: string;
    }>;
    const target = list.results.find(() => true)!;
    const res = await fetch(`${BASE}/api/changes/${encodeURIComponent(target.id)}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...ACME },
      body: JSON.stringify({ decision: "approve" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; approvalState: string };
    expect(body.status).toBe("APPROVED");
    expect(body.approvalState).toBe("APPROVED");
  });
});

describe("knowledge handlers", () => {
  it("GET /api/kb supports q query filter", async () => {
    const all = (await (await fetch(`${BASE}/api/kb`, { headers: ACME })).json()) as Page<{
      title: string;
    }>;
    expect(all.results.length).toBeGreaterThan(0);
    const sampleTerm = all.results[0]!.title.split(" ")[0]!.toLowerCase();
    const filteredRes = await fetch(`${BASE}/api/kb?q=${encodeURIComponent(sampleTerm)}`, {
      headers: ACME,
    });
    const filtered = (await filteredRes.json()) as Page<{ title: string }>;
    expect(filtered.results.length).toBeGreaterThan(0);
    expect(filtered.results.every((a) => a.title.toLowerCase().includes(sampleTerm))).toBe(true);
  });

  it("GET /api/kb/categories returns tenant categories", async () => {
    const res = await fetch(`${BASE}/api/kb/categories`, { headers: ACME });
    const body = (await res.json()) as { categories: { tenantId: string }[] };
    expect(body.categories.length).toBeGreaterThan(0);
    expect(body.categories.every((c) => c.tenantId === "acme-corp")).toBe(true);
  });
});

describe("cmdb handlers", () => {
  it("GET /api/ci paginates and filters by class", async () => {
    const res = await fetch(`${BASE}/api/ci?class=DatabaseInstance`, { headers: ACME });
    const page = (await res.json()) as Page<{ class: string }>;
    expect(page.results.every((c) => c.class === "DatabaseInstance")).toBe(true);
  });

  it("GET /api/ci/:id/relationships returns related links", async () => {
    const list = (await (await fetch(`${BASE}/api/ci`, { headers: ACME })).json()) as Page<{
      id: string;
    }>;
    const target = list.results[0]!;
    const res = await fetch(`${BASE}/api/ci/${encodeURIComponent(target.id)}/relationships`, {
      headers: ACME,
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      relationships: { sourceCiId: string; targetCiId: string }[];
    };
    expect(
      body.relationships.every((r) => r.sourceCiId === target.id || r.targetCiId === target.id),
    ).toBe(true);
  });
});

describe("audit handlers", () => {
  it("GET /api/audit/event-types returns taxonomy", async () => {
    const res = await fetch(`${BASE}/api/audit/event-types`);
    const body = (await res.json()) as { eventTypes: string[] };
    expect(body.eventTypes).toContain("auth.login");
    expect(body.eventTypes).toContain("change.approved");
  });

  it("GET /api/audit/events filters by eventType + tenant", async () => {
    const res = await fetch(`${BASE}/api/audit/events?eventType=auth.login`, { headers: ACME });
    const page = (await res.json()) as Page<{ eventType: string; tenantId: string }>;
    expect(page.results.every((e) => e.eventType === "auth.login")).toBe(true);
    expect(page.results.every((e) => e.tenantId === "acme-corp")).toBe(true);
  });

  it("GET /api/audit/events returns descending timestamps", async () => {
    const res = await fetch(`${BASE}/api/audit/events?size=10`, { headers: ACME });
    const page = (await res.json()) as Page<{ timestamp: string }>;
    const stamps = page.results.map((r) => r.timestamp);
    const sorted = [...stamps].sort((a, b) => b.localeCompare(a));
    expect(stamps).toEqual(sorted);
  });
});

describe("config handler", () => {
  it("GET /config returns stable runtime shape", async () => {
    const res = await fetch(`${BASE}/config`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      apiBaseUrl: string;
      features: Record<string, boolean>;
    };
    expect(body.apiBaseUrl).toBe("/api");
    expect(body.features.enableTenantSwitcher).toBe(true);
  });
});
