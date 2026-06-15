import { describe, expect, it } from "vitest";
import { resolvePortalOrigin } from "./portal-redirect";

describe("resolvePortalOrigin", () => {
  const current = { protocol: "http:", hostname: "10.11.36.14", port: "89" };

  it("returns an explicit portalOrigin verbatim when provided", () => {
    expect(resolvePortalOrigin("http://portal.example:88", current)).toBe(
      "http://portal.example:88",
    );
  });

  it("strips a trailing slash from an explicit portalOrigin", () => {
    expect(resolvePortalOrigin("http://portal.example:88/", current)).toBe(
      "http://portal.example:88",
    );
    expect(resolvePortalOrigin("http://portal.example:88///", current)).toBe(
      "http://portal.example:88",
    );
  });

  it("derives :88 from the current origin when port is 89", () => {
    expect(resolvePortalOrigin(undefined, current)).toBe("http://10.11.36.14:88");
  });

  it("targets :88 for an empty current port", () => {
    expect(resolvePortalOrigin(undefined, { protocol: "https:", hostname: "host", port: "" })).toBe(
      "https://host:88",
    );
  });

  it("targets :88 for any other current port", () => {
    expect(
      resolvePortalOrigin(undefined, { protocol: "http:", hostname: "host", port: "5173" }),
    ).toBe("http://host:88");
  });

  it("treats an empty-string portalOrigin as absent and derives :88", () => {
    expect(resolvePortalOrigin("", current)).toBe("http://10.11.36.14:88");
  });
});
