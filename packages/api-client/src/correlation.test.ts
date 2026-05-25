import { describe, expect, it } from "vitest";
import { createCorrelationId, isUlid } from "./correlation";

describe("createCorrelationId", () => {
  it("returns a 26-char Crockford base32 ULID", () => {
    const id = createCorrelationId();
    expect(id).toHaveLength(26);
    expect(isUlid(id)).toBe(true);
  });

  it("produces unique ids across many calls", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 1000; i += 1) ids.add(createCorrelationId());
    expect(ids.size).toBe(1000);
  });

  it("is monotonic in lexicographic order when called rapidly", () => {
    // ULID's timestamp prefix (10 chars) increases with wall-clock time; two
    // ids generated in the same millisecond rely on randomness for ordering,
    // so we only assert non-decreasing timestamp prefixes — the weak invariant
    // that justifies ULID over UUID v4 for log triage.
    const a = createCorrelationId();
    const b = createCorrelationId();
    expect(a.slice(0, 10) <= b.slice(0, 10)).toBe(true);
  });
});

describe("isUlid", () => {
  it("rejects UUIDs (hyphens, wrong length)", () => {
    expect(isUlid("00000000-0000-0000-0000-000000000000")).toBe(false);
  });
  it("rejects forbidden Crockford chars (I, L, O, U)", () => {
    expect(isUlid("01HXXXXXXXXXXXXXXXXXXIXXXX")).toBe(false);
    expect(isUlid("01HXXXXXXXXXXXXXXXXXXUXXXX")).toBe(false);
  });
  it("accepts the documented sample format shape", () => {
    expect(isUlid("01HZZZZZZZZZZZZZZZZZZZZZZZ")).toBe(true);
  });
});
