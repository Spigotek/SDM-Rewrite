import { describe, expect, it } from "vitest";
import { buildAggregator, COOKIE, SID_COOKIE } from "./_helpers";

describe("GET /me/tenants", () => {
  it("returns shape derived from session.tenants[] with defaultTenantId + activeTenantId", async () => {
    const { app } = await buildAggregator();
    const res = await app.fetch(
      new Request("http://bff/me/tenants", { headers: { [COOKIE]: SID_COOKIE } }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      tenants: Array<{ id: string; name: string; roles: Array<{ uiRole: string }> }>;
      defaultTenantId: string;
      activeTenantId: string;
    };
    expect(body.tenants).toHaveLength(1);
    expect(body.tenants[0]?.id).toBe("default");
    expect(body.tenants[0]?.roles[0]?.uiRole).toBe("agent_l1");
    expect(body.defaultTenantId).toBe("default");
    expect(body.activeTenantId).toBe("default");
  });

  it("returns 401 without a session cookie", async () => {
    const { app } = await buildAggregator();
    const res = await app.fetch(new Request("http://bff/me/tenants"));
    expect(res.status).toBe(401);
  });
});
