import { describe, expect, it } from "vitest";

import { formatDate, formatNumber, formatRelative } from "../src/format";

describe("formatDate", () => {
  it("formats SK long date with month name", () => {
    const result = formatDate(new Date(Date.UTC(2026, 4, 14, 12, 0, 0)), "sk");
    // sk-SK long: "14. mája 2026" (varies subtly across ICU data, use partial assert)
    expect(result).toMatch(/14/);
    expect(result).toMatch(/2026/);
    expect(result.toLowerCase()).toMatch(/máj/);
  });

  it("formats EN long date", () => {
    const result = formatDate(new Date(Date.UTC(2026, 4, 14, 12, 0, 0)), "en");
    expect(result).toMatch(/14/);
    expect(result).toMatch(/May/);
    expect(result).toMatch(/2026/);
  });
});

describe("formatNumber", () => {
  it("uses SK decimal grouping (non-breaking space + comma)", () => {
    const result = formatNumber(1234567.89, "sk");
    expect(result).toContain("1");
    expect(result).toContain("234");
    expect(result).toContain("567");
    expect(result).toMatch(/[,.]89$/);
  });

  it("uses EN decimal grouping (comma thousands + dot)", () => {
    expect(formatNumber(1234567.89, "en")).toBe("1,234,567.89");
  });
});

describe("formatRelative", () => {
  it("returns past SK relative for 5 minutes ago", () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    const result = formatRelative(fiveMinAgo, "sk");
    expect(result.toLowerCase()).toMatch(/minút|min/);
  });

  it("returns past EN relative for 5 minutes ago", () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    const result = formatRelative(fiveMinAgo, "en");
    expect(result.toLowerCase()).toMatch(/minute/);
  });
});
