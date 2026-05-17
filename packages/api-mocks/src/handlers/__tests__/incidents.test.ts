import { describe, expect, it } from "vitest";
import "./setup";

const BASE = "http://localhost";

interface Page<T> {
  results: T[];
  totalCount: number;
  start: number;
  size: number;
}

interface IncidentLite {
  id: string;
  ref: string;
  status: string;
  tenantId: string;
  summary: string;
}

describe("incident handlers", () => {
  it("GET /api/incidents returns paginated results scoped to tenant header", async () => {
    const acmeRes = await fetch(`${BASE}/api/incidents`, {
      headers: { "X-CA-SDM-Tenant": "acme-corp" },
    });
    const acme = (await acmeRes.json()) as Page<IncidentLite>;
    expect(acme.size).toBe(25);
    expect(acme.start).toBe(0);
    expect(acme.results.length).toBeLessThanOrEqual(25);
    expect(acme.results.every((r) => r.tenantId === "acme-corp")).toBe(true);

    const globexRes = await fetch(`${BASE}/api/incidents`, {
      headers: { "X-CA-SDM-Tenant": "globex" },
    });
    const globex = (await globexRes.json()) as Page<IncidentLite>;
    expect(globex.results.every((r) => r.tenantId === "globex")).toBe(true);
    expect(globex.totalCount).toBeGreaterThan(0);
    expect(globex.totalCount).toBeLessThan(acme.totalCount);
  });

  it("GET /api/incidents respects status filter and start/size", async () => {
    const res = await fetch(`${BASE}/api/incidents?status=OP&start=0&size=5`, {
      headers: { "X-CA-SDM-Tenant": "acme-corp" },
    });
    const page = (await res.json()) as Page<IncidentLite>;
    expect(page.size).toBe(5);
    expect(page.results.every((r) => r.status === "OP")).toBe(true);
  });

  it("GET /api/incidents/:id returns the matching record", async () => {
    const listRes = await fetch(`${BASE}/api/incidents`, {
      headers: { "X-CA-SDM-Tenant": "acme-corp" },
    });
    const firstRecord = ((await listRes.json()) as Page<IncidentLite>).results[0]!;
    const detailRes = await fetch(`${BASE}/api/incidents/${firstRecord.id}`, {
      headers: { "X-CA-SDM-Tenant": "acme-corp" },
    });
    expect(detailRes.status).toBe(200);
    const detail = (await detailRes.json()) as IncidentLite;
    expect(detail.id).toBe(firstRecord.id);
  });

  it("GET /api/incidents/:id 404s for unknown id within tenant", async () => {
    const res = await fetch(`${BASE}/api/incidents/incident:does-not-exist`, {
      headers: { "X-CA-SDM-Tenant": "acme-corp" },
    });
    expect(res.status).toBe(404);
  });

  it("POST /api/incidents creates a record in the tenant scope", async () => {
    const res = await fetch(`${BASE}/api/incidents`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CA-SDM-Tenant": "globex" },
      body: JSON.stringify({ summary: "Disk full on db-01", priority: 2, urgency: 2, impact: 2 }),
    });
    expect(res.status).toBe(201);
    const created = (await res.json()) as IncidentLite;
    expect(created.tenantId).toBe("globex");
    expect(created.summary).toBe("Disk full on db-01");
    expect(created.status).toBe("OP");
  });

  it("PATCH /api/incidents/:id updates status", async () => {
    const list = (await (
      await fetch(`${BASE}/api/incidents`, {
        headers: { "X-CA-SDM-Tenant": "acme-corp" },
      })
    ).json()) as Page<IncidentLite>;
    const target = list.results[0]!;
    const nextStatus = target.status === "RES" ? "CL" : "RES";
    const patch = await fetch(`${BASE}/api/incidents/${target.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "X-CA-SDM-Tenant": "acme-corp" },
      body: JSON.stringify({ status: nextStatus }),
    });
    expect(patch.status).toBe(200);
    const updated = (await patch.json()) as IncidentLite;
    expect(updated.status).toBe(nextStatus);
  });
});
