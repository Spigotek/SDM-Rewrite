import { describe, expect, it } from "vitest";
import "./setup";

const BASE = "http://localhost";

describe("users + tenants handlers", () => {
  it("GET /me returns user + session shape", async () => {
    const res = await fetch(`${BASE}/me`, {
      headers: { "X-CA-SDM-Tenant": "globex" },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      user: { id: string; fullName: string };
      session: { activeTenantId: string };
    };
    expect(body.user.id).toBe("user-1");
    expect(body.user.fullName).toBe("Anna Analyst");
    expect(body.session.activeTenantId).toBe("globex");
  });

  it("GET /me defaults to acme-corp when no header / cookie", async () => {
    const res = await fetch(`${BASE}/me`);
    const body = (await res.json()) as { session: { activeTenantId: string } };
    expect(body.session.activeTenantId).toBe("acme-corp");
  });

  it("GET /me/tenants returns only tenants the user has roles in", async () => {
    const res = await fetch(`${BASE}/me/tenants`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { tenants: { id: string; isDefault: boolean }[] };
    const ids = body.tenants.map((t) => t.id);
    expect(ids).toContain("acme-corp");
    expect(ids).toContain("globex");
    expect(body.tenants.find((t) => t.isDefault)?.id).toBe("acme-corp");
  });

  it("POST /me/active-tenant rejects tenant without role", async () => {
    const res = await fetch(`${BASE}/me/active-tenant`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId: "unknown-tenant" }),
    });
    expect(res.status).toBe(403);
  });

  it("POST /me/active-tenant accepts tenant with role and sets cookie", async () => {
    const res = await fetch(`${BASE}/me/active-tenant`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId: "globex" }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toMatch(/sdm-active-tenant=globex/);
  });
});
