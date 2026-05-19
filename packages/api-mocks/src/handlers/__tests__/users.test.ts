import { describe, expect, it } from "vitest";
import "./setup";

const BASE = "http://localhost";

describe("users + tenants handlers", () => {
  it("GET /me returns canonical /me shape", async () => {
    const res = await fetch(`${BASE}/me`, {
      headers: { "X-CA-SDM-Tenant": "globex" },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      user: { id: string; userId: string; email: string; displayName: string };
      tenants: {
        id: string;
        name: string;
        isServiceProvider: boolean;
        roles: { id: string; name: string; uiRole: string }[];
      }[];
      activeTenant: { id: string; activeRoleId: string; effectivePermissions: string[] };
      uiRole: string;
      app: "portal" | "workspace";
      csrfToken: string;
      featureFlags: Record<string, boolean>;
      i18n: { locale: string; tz: string };
      session: { idleTimeoutSec: number; absoluteExpiresAt: string };
    };
    expect(body.user.id).toBe("user-1");
    expect(body.user.userId).toBe("anna.analyst");
    expect(body.user.displayName).toBe("Anna Analyst");
    expect(body.user.email).toBe("anna.analyst@acme-corp.example");
    expect(body.activeTenant.id).toBe("globex");
    expect(body.activeTenant.activeRoleId).toBe("role:agent_l1");
    expect(body.activeTenant.effectivePermissions.length).toBeGreaterThan(0);
    expect(body.uiRole).toBe("agent_l1");
    expect(body.app).toBe("workspace");
    expect(body.csrfToken).toBe("");
    expect(body.i18n).toEqual({ locale: "sk", tz: "Europe/Bratislava" });
    expect(body.session.idleTimeoutSec).toBe(1800);
    expect(body.tenants.map((t) => t.id).sort()).toEqual(["acme-corp", "globex"]);
    const globex = body.tenants.find((t) => t.id === "globex")!;
    expect(globex.isServiceProvider).toBe(false);
    expect(globex.roles[0]).toEqual({ id: "role:agent_l1", name: "agent_l1", uiRole: "agent_l1" });
  });

  it("GET /me defaults to user's defaultTenantId when no header / cookie", async () => {
    const res = await fetch(`${BASE}/me`);
    const body = (await res.json()) as { activeTenant: { id: string } };
    expect(body.activeTenant.id).toBe("acme-corp");
  });

  it("GET /me/tenants returns canonical MyTenantsResponse shape", async () => {
    const res = await fetch(`${BASE}/me/tenants`, {
      headers: { "X-CA-SDM-Tenant": "globex" },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      tenants: {
        id: string;
        name: string;
        isServiceProvider: boolean;
        roles: { id: string; name: string; uiRole: string }[];
      }[];
      defaultTenantId: string;
      activeTenantId: string;
    };
    const ids = body.tenants.map((t) => t.id).sort();
    expect(ids).toEqual(["acme-corp", "globex"]);
    expect(body.defaultTenantId).toBe("acme-corp");
    expect(body.activeTenantId).toBe("globex");
    const acme = body.tenants.find((t) => t.id === "acme-corp")!;
    expect(acme.isServiceProvider).toBe(false);
    expect(acme.roles[0]).toEqual({ id: "role:agent_l1", name: "agent_l1", uiRole: "agent_l1" });
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
