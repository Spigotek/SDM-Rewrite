import { describe, expect, it } from "vitest";
import {
  PII_KEY_FRAGMENTS,
  REDACTED_SENTINEL,
  pseudonymize,
  sanitizeSentryEvent,
  stripPiiDeep,
} from "./observability";

describe("stripPiiDeep", () => {
  it("redacts every PII fragment at every depth", () => {
    const event = {
      email: "alice@example.com",
      profile: {
        displayName: "Alice",
        firstName: "Alice",
        lastName: "Doe",
        nested: {
          description: "free-text bug report",
          summary: "short title",
          deeper: {
            customerName: "Acme",
            assigneeEmail: "bob@example.com",
            phone: "+421900000000",
          },
        },
      },
      ticket: {
        body: "sensitive content",
        text: "another field",
        unrelated: { count: 42, status: "open" },
      },
    };
    const cleaned = stripPiiDeep(event) as typeof event;
    expect(cleaned.email).toBe(REDACTED_SENTINEL);
    expect(cleaned.profile.displayName).toBe(REDACTED_SENTINEL);
    expect(cleaned.profile.firstName).toBe(REDACTED_SENTINEL);
    expect(cleaned.profile.lastName).toBe(REDACTED_SENTINEL);
    expect(cleaned.profile.nested.description).toBe(REDACTED_SENTINEL);
    expect(cleaned.profile.nested.summary).toBe(REDACTED_SENTINEL);
    expect(cleaned.profile.nested.deeper.customerName).toBe(REDACTED_SENTINEL);
    expect(cleaned.profile.nested.deeper.assigneeEmail).toBe(REDACTED_SENTINEL);
    expect(cleaned.profile.nested.deeper.phone).toBe(REDACTED_SENTINEL);
    expect(cleaned.ticket.body).toBe(REDACTED_SENTINEL);
    expect(cleaned.ticket.text).toBe(REDACTED_SENTINEL);
    // Non-PII keys preserved.
    expect(cleaned.ticket.unrelated).toEqual({ count: 42, status: "open" });
  });

  it("preserves arrays length + recurses into entries", () => {
    const input = { tickets: [{ summary: "a" }, { summary: "b" }, { count: 3 }] };
    const cleaned = stripPiiDeep(input) as { tickets: Array<Record<string, unknown>> };
    expect(cleaned.tickets).toHaveLength(3);
    const [first, second, third] = cleaned.tickets;
    expect(first?.summary).toBe(REDACTED_SENTINEL);
    expect(second?.summary).toBe(REDACTED_SENTINEL);
    expect(third).toEqual({ count: 3 });
  });

  it("replaces non-plain objects with [object]", () => {
    const input = { when: new Date("2026-01-01"), err: new Error("boom") };
    const cleaned = stripPiiDeep(input) as Record<string, unknown>;
    expect(cleaned.when).toBe("[object]");
    expect(cleaned.err).toBe("[object]");
  });

  it("does not mutate input", () => {
    const input = { email: "a@b" };
    const cleaned = stripPiiDeep(input) as Record<string, unknown>;
    expect(input.email).toBe("a@b");
    expect(cleaned.email).toBe(REDACTED_SENTINEL);
  });

  it("matches all documented PII key fragments at least once", () => {
    // Sanity guard against silent regressions in PII_KEY_FRAGMENTS.
    const probe: Record<string, string> = {};
    for (const k of PII_KEY_FRAGMENTS) probe[`field_${k}`] = "secret";
    const cleaned = stripPiiDeep(probe) as Record<string, string>;
    for (const k of PII_KEY_FRAGMENTS) {
      expect(cleaned[`field_${k}`]).toBe(REDACTED_SENTINEL);
    }
  });
});

describe("sanitizeSentryEvent", () => {
  it("drops user.email + user.username + ip_address, keeps user.id", () => {
    const event = {
      user: { id: "pseud-abc", email: "a@b", username: "alice", ip_address: "1.2.3.4" },
    };
    const cleaned = sanitizeSentryEvent({ ...event });
    expect(cleaned.user).toEqual({ id: "pseud-abc" });
  });

  it("strips PII from extra + contexts + request.data + breadcrumbs.data", () => {
    const cleaned = sanitizeSentryEvent({
      extra: { description: "x", count: 1 },
      contexts: { ticket: { summary: "y", id: "z" } },
      request: {
        cookies: "session=xyz",
        data: { customerEmail: "c@d", url: "/api/incidents" },
      },
      breadcrumbs: [{ data: { body: "secret" } }, { data: { route: "/queue" } }],
    });
    expect((cleaned.extra as Record<string, unknown>).description).toBe(REDACTED_SENTINEL);
    expect((cleaned.extra as Record<string, unknown>).count).toBe(1);
    expect(
      ((cleaned.contexts as Record<string, Record<string, unknown>>).ticket as { summary: string })
        .summary,
    ).toBe(REDACTED_SENTINEL);
    expect(cleaned.request?.cookies).toBe(REDACTED_SENTINEL);
    expect((cleaned.request?.data as Record<string, unknown>).customerEmail).toBe(
      REDACTED_SENTINEL,
    );
    expect((cleaned.request?.data as Record<string, unknown>).url).toBe("/api/incidents");
    const [b0, b1] = cleaned.breadcrumbs ?? [];
    expect((b0?.data as Record<string, unknown>).body).toBe(REDACTED_SENTINEL);
    expect((b1?.data as Record<string, unknown>).route).toBe("/queue");
  });

  it("does not crash on a sparse event", () => {
    expect(() => sanitizeSentryEvent({})).not.toThrow();
  });

  // I.3 — cross-tenant tag scrub.
  it("scrubs tenant tag when it does not match the SPA active tenant", () => {
    const event = {
      tags: { tenantId: "tenant-leaked", route: "/queue", locale: "sk" },
    };
    const cleaned = sanitizeSentryEvent(event, { activeTenantId: "tenant-active" });
    expect(cleaned.tags?.tenantId).toBe(REDACTED_SENTINEL);
    expect(cleaned.tags?.route).toBe("/queue");
    expect(cleaned.tags?.locale).toBe("sk");
  });

  it("preserves the tenant tag when it matches the SPA active tenant", () => {
    const cleaned = sanitizeSentryEvent(
      { tags: { tenantId: "tenant-A", route: "/queue" } },
      { activeTenantId: "tenant-A" },
    );
    expect(cleaned.tags?.tenantId).toBe("tenant-A");
  });

  it("ignores tenant scrubbing when no active tenant is supplied (bootstrap path)", () => {
    const cleaned = sanitizeSentryEvent({ tags: { tenantId: "tenant-foo" } });
    expect(cleaned.tags?.tenantId).toBe("tenant-foo");
  });

  it("handles all three tenant tag key variants (tenantId / tenant_id / tenant)", () => {
    const cleaned = sanitizeSentryEvent(
      { tags: { tenantId: "x", tenant_id: "x", tenant: "x" } },
      { activeTenantId: "y" },
    );
    expect(cleaned.tags?.tenantId).toBe(REDACTED_SENTINEL);
    expect(cleaned.tags?.tenant_id).toBe(REDACTED_SENTINEL);
    expect(cleaned.tags?.tenant).toBe(REDACTED_SENTINEL);
  });

  // I.3 perf gate — `beforeSend` runs per event. Sub-millisecond on a modern
  // laptop; CI bound is generous (5 ms) so a slow runner doesn't flake.
  it("scrub overhead stays under the 5ms per-event ceiling", () => {
    const iterations = 1000;
    const event = {
      tags: { tenantId: "tenant-other", env: "prod" },
      extra: { description: "x", count: 1 },
      contexts: { ticket: { summary: "y" } },
    };
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      sanitizeSentryEvent({ ...event, tags: { ...event.tags } }, { activeTenantId: "tenant-self" });
    }
    const totalMs = performance.now() - start;
    const perEventMs = totalMs / iterations;
    expect(perEventMs).toBeLessThan(5);
  });
});

describe("pseudonymize", () => {
  it("is deterministic for same input + salt", async () => {
    const a = await pseudonymize("user-42", "tenant-acme");
    const b = await pseudonymize("user-42", "tenant-acme");
    expect(a).toBe(b);
  });

  it("differs across salts (resists cross-tenant correlation)", async () => {
    const a = await pseudonymize("user-42", "tenant-acme");
    const b = await pseudonymize("user-42", "tenant-globex");
    expect(a).not.toBe(b);
  });

  it("returns a 16-char hex prefix", async () => {
    const a = await pseudonymize("user-42", "salt");
    expect(a).toHaveLength(16);
    expect(/^[0-9a-f]{16}$/.test(a)).toBe(true);
  });
});
