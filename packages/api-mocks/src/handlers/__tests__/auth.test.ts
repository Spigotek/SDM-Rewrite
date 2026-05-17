import { describe, expect, it } from "vitest";
import "./setup";

const BASE = "http://localhost";

describe("auth handlers", () => {
  it("POST /auth/login returns session with default tenant", async () => {
    const res = await fetch(`${BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "anna.analyst", password: "x" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      user: { id: string };
      session: { activeTenantId: string };
    };
    expect(body.user.id).toBe("user-1");
    expect(body.session.activeTenantId).toBe("acme-corp");
    expect(res.headers.get("set-cookie")).toMatch(/sdm-active-tenant=acme-corp/);
  });

  it("POST /auth/login rejects missing username", async () => {
    const res = await fetch(`${BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { kind: string } };
    expect(body.error.kind).toBe("VALIDATION");
  });

  it("POST /auth/logout clears the tenant cookie", async () => {
    const res = await fetch(`${BASE}/auth/logout`, { method: "POST" });
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toMatch(/sdm-active-tenant=;.*Max-Age=0/);
  });
});
