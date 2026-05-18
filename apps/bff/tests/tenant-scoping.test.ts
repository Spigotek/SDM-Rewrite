import { describe, expect, it, vi } from "vitest";
import { AppErrorException } from "../src/auth/errors";
import {
  assertBodyTenantMatchesSession,
  scopeReadQuery,
  type TenantScope,
} from "../src/api/tenant-scoping";

const DEFAULT_SCOPE: TenantScope = { activeTenantId: "default" };
const REAL_SCOPE: TenantScope = { activeTenantId: "U'BDE1683C44FCCB4DAE50BA4DDB5DCBE6'" };

describe("scopeReadQuery", () => {
  it("is a no-op on the single-tenant placeholder", () => {
    expect(scopeReadQuery("/in?size=5", DEFAULT_SCOPE)).toBe("/in?size=5");
    expect(scopeReadQuery("/cnt", DEFAULT_SCOPE)).toBe("/cnt");
  });

  it("warns once when skipping (so we can audit single-tenant deployments)", () => {
    const warn = vi.fn();
    scopeReadQuery("/in", DEFAULT_SCOPE, { log: { warn } });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({ event: "bff.tenant_scoping.placeholder_skip" }),
      expect.any(String),
    );
  });

  it("injects a tenant predicate when WC is absent", () => {
    const out = scopeReadQuery("/in?size=5", REAL_SCOPE);
    const url = new URL(`http://x${out}`);
    expect(url.searchParams.get("WC")).toBe("tenant=U'BDE1683C44FCCB4DAE50BA4DDB5DCBE6'");
    expect(url.searchParams.get("size")).toBe("5");
  });

  it("ANDs an existing WC with the tenant predicate (no double-encoding)", () => {
    const out = scopeReadQuery("/in?WC=status.code%3D%27OP%27&size=5", REAL_SCOPE);
    const url = new URL(`http://x${out}`);
    expect(url.searchParams.get("WC")).toBe(
      "status.code='OP' AND tenant=U'BDE1683C44FCCB4DAE50BA4DDB5DCBE6'",
    );
  });

  it("works when the path has no query string at all", () => {
    const out = scopeReadQuery("/in", REAL_SCOPE);
    const url = new URL(`http://x${out}`);
    expect(url.searchParams.get("WC")).toBe("tenant=U'BDE1683C44FCCB4DAE50BA4DDB5DCBE6'");
  });

  it("escapes non-GUID tenant ids with single-quote wrapping (forward-compat)", () => {
    const out = scopeReadQuery("/in", { activeTenantId: "acme-corp" });
    const url = new URL(`http://x${out}`);
    expect(url.searchParams.get("WC")).toBe("tenant='acme-corp'");
  });

  it("escapes embedded single quotes in non-GUID tenant ids", () => {
    const out = scopeReadQuery("/in", { activeTenantId: "o'malley" });
    const url = new URL(`http://x${out}`);
    expect(url.searchParams.get("WC")).toBe("tenant='o''malley'");
  });
});

describe("assertBodyTenantMatchesSession", () => {
  it("is a no-op on the single-tenant placeholder", () => {
    expect(() =>
      assertBodyTenantMatchesSession({ tenantId: "anything" }, DEFAULT_SCOPE),
    ).not.toThrow();
  });

  it("accepts a body that omits any tenant field", () => {
    expect(() => assertBodyTenantMatchesSession({ summary: "incident" }, REAL_SCOPE)).not.toThrow();
  });

  it("accepts a matching tenantId on the FE shape", () => {
    expect(() =>
      assertBodyTenantMatchesSession(
        { tenantId: "U'BDE1683C44FCCB4DAE50BA4DDB5DCBE6'", summary: "x" },
        REAL_SCOPE,
      ),
    ).not.toThrow();
  });

  it("accepts a matching nested tenant.id (CA SDM FK projection style)", () => {
    expect(() =>
      assertBodyTenantMatchesSession(
        { tenant: { id: "U'BDE1683C44FCCB4DAE50BA4DDB5DCBE6'" } },
        REAL_SCOPE,
      ),
    ).not.toThrow();
  });

  it("accepts a matching nested tenant['@REL_ATTR'] (post-XML→JSON style)", () => {
    expect(() =>
      assertBodyTenantMatchesSession(
        { tenant: { "@REL_ATTR": "U'BDE1683C44FCCB4DAE50BA4DDB5DCBE6'" } },
        REAL_SCOPE,
      ),
    ).not.toThrow();
  });

  it("rejects mismatched tenantId with TENANT_FORBIDDEN", () => {
    let err: unknown;
    try {
      assertBodyTenantMatchesSession({ tenantId: "U'OTHER'" }, REAL_SCOPE);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(AppErrorException);
    expect(err).toMatchObject({ code: "TENANT_FORBIDDEN", httpStatus: 403 });
  });

  it("rejects mismatched nested tenant.id with TENANT_FORBIDDEN", () => {
    expect(() =>
      assertBodyTenantMatchesSession({ tenant: { id: "U'OTHER'" } }, REAL_SCOPE),
    ).toThrow(AppErrorException);
  });

  it("ignores tenant-shaped junk (non-string id) — treated as 'no tenant in body'", () => {
    expect(() =>
      assertBodyTenantMatchesSession({ tenant: { id: 12345 } }, REAL_SCOPE),
    ).not.toThrow();
    expect(() => assertBodyTenantMatchesSession({ tenantId: null }, REAL_SCOPE)).not.toThrow();
  });
});
