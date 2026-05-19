import { describe, expect, it } from "vitest";
import { pseudonymize, redact, stripQuery } from "../../src/platform/audit/redact";

describe("redact", () => {
  it("hard-redacts password / accessKey / cookie / authorization", () => {
    const out = redact({
      password: "secret",
      accessKey: "key-123",
      cookie: "sdm.sid=abc",
      authorization: "Basic xyz",
      visible: "ok",
    }) as Record<string, unknown>;
    expect(out.password).toBe("[REDACTED]");
    expect(out.accessKey).toBe("[REDACTED]");
    expect(out.cookie).toBe("[REDACTED]");
    expect(out.authorization).toBe("[REDACTED]");
    expect(out.visible).toBe("ok");
  });

  it("matches keys case-insensitively (X-AccessKey, X-CSRF-Token)", () => {
    const out = redact({ "X-AccessKey": "key", "X-CSRF-Token": "t" }) as Record<string, unknown>;
    expect(out["X-AccessKey"]).toBe("[REDACTED]");
    expect(out["X-CSRF-Token"]).toBe("[REDACTED]");
  });

  it("pseudonymizes email / recordId / sessionId via stable SHA256 prefix", () => {
    const a = redact({ email: "vueuser@example" }) as { email: string };
    const b = redact({ email: "vueuser@example" }) as { email: string };
    expect(a.email).toBe(b.email);
    expect(a.email).toHaveLength(16);
    expect(a.email).not.toContain("@");
  });

  it("truncates userAgent to 200 chars", () => {
    const ua = "x".repeat(300);
    const out = redact({ userAgent: ua }) as { userAgent: string };
    expect(out.userAgent).toHaveLength(200);
  });

  it("walks nested objects + arrays", () => {
    const out = redact({
      details: { password: "p", entries: [{ accessKey: "k" }, { ok: 1 }] },
    }) as { details: { password: string; entries: Array<{ accessKey?: string; ok?: number }> } };
    expect(out.details.password).toBe("[REDACTED]");
    expect(out.details.entries[0]?.accessKey).toBe("[REDACTED]");
    expect(out.details.entries[1]?.ok).toBe(1);
  });

  it("passes through primitives + null", () => {
    expect(redact(null)).toBeNull();
    expect(redact(42)).toBe(42);
    expect(redact("ok")).toBe("ok");
  });

  it("no banned substring in serialised output", () => {
    const json = JSON.stringify(
      redact({
        password: "topsecret",
        cookie: "sid=xyz",
        nested: { access_token: "deep" },
      }),
    );
    expect(json).not.toContain("topsecret");
    expect(json).not.toContain("xyz");
    expect(json).not.toContain("deep");
  });
});

describe("pseudonymize", () => {
  it("is deterministic", () => {
    expect(pseudonymize("a")).toBe(pseudonymize("a"));
  });
  it("returns 16 hex chars (8 bytes)", () => {
    expect(pseudonymize("hello")).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe("stripQuery", () => {
  it("removes ?... suffix", () => {
    expect(stripQuery("/api/queue?page=0&filter=x")).toBe("/api/queue");
  });
  it("leaves clean paths intact", () => {
    expect(stripQuery("/me")).toBe("/me");
  });
});
