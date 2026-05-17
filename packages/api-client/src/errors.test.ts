import { describe, expect, it } from "vitest";
import { AppError, fromStatus, isAppError } from "./errors";

describe("fromStatus", () => {
  it.each([
    [401, "AUTH"],
    [403, "FORBIDDEN"],
    [404, "NOT_FOUND"],
    [409, "CONFLICT"],
    [422, "VALIDATION"],
    [429, "RATE_LIMIT"],
    [500, "SERVER"],
    [503, "SERVER"],
    [418, "UNKNOWN"],
  ] as const)("maps %s → %s", (status, expected) => {
    expect(fromStatus(status, "x").kind).toBe(expected);
  });

  it("preserves correlation id", () => {
    const err = fromStatus(500, "boom", "abc-123");
    expect(err.correlationId).toBe("abc-123");
    expect(err.status).toBe(500);
  });
});

describe("isAppError", () => {
  it("detects AppError instances", () => {
    expect(isAppError(new AppError({ kind: "UNKNOWN", message: "x" }))).toBe(true);
  });

  it("rejects plain errors and non-error values", () => {
    expect(isAppError(new Error("x"))).toBe(false);
    expect(isAppError("not an error")).toBe(false);
    expect(isAppError(null)).toBe(false);
  });
});
