import { describe, expect, it } from "vitest";
import { AppErrorException } from "../src/auth/errors";
import { assertSdmOk, classifySdmResponse } from "../src/api/error-shaper";

function slice(
  status: number,
  text: string,
  contentType = "application/json",
): {
  status: number;
  text: string;
  headers: Headers;
  op: string;
} {
  return {
    status,
    text,
    headers: new Headers(contentType ? { "Content-Type": contentType } : {}),
    op: "GET /api/incidents",
  };
}

describe("classifySdmResponse", () => {
  it("returns null on 200 (default success)", () => {
    expect(classifySdmResponse(slice(200, ""))).toBeNull();
  });

  it("returns null on 201 and 204 (default success set)", () => {
    expect(classifySdmResponse(slice(201, ""))).toBeNull();
    expect(classifySdmResponse(slice(204, ""))).toBeNull();
  });

  it("honours a custom success set (broker uses 200-only)", () => {
    const err = classifySdmResponse(slice(201, ""), [200]);
    expect(err).toBeInstanceOf(AppErrorException);
  });

  it("maps 400 + 'Invalid REST Access Key' → AUTH_EXPIRED (the §8 trap)", () => {
    const xml = `<?xml version="1.0"?><error><message>Invalid REST Access Key (FAKE) provided via X-AccessKey header.</message><status>400</status></error>`;
    const err = classifySdmResponse(slice(400, xml, "application/xml"));
    expect(err).toMatchObject({ code: "AUTH_EXPIRED", httpStatus: 401 });
  });

  it("maps 400 + 'Required attribute … missing' → VALIDATION (entity POST)", () => {
    const json = JSON.stringify({
      status: "400",
      message: "Required attribute Affected End User is missing",
    });
    const err = classifySdmResponse(slice(400, json));
    expect(err).toMatchObject({ code: "VALIDATION", httpStatus: 400 });
    expect(err?.message).toContain("Affected End User");
  });

  it("maps 400 + DAL exception → VALIDATION and strips the com.ca.sdm prefix", () => {
    const json = JSON.stringify({
      status: "400",
      message:
        "com.ca.sdm.dal.sql.DALException: Found no valid identifiers (id, REL_ATTR, COMMON_NAME) for attribute 'customer'.",
    });
    const err = classifySdmResponse(slice(400, json));
    expect(err?.code).toBe("VALIDATION");
    expect(err?.message).toMatch(/^Found no valid identifiers/);
  });

  it("maps 400 'Invalid payload' → VALIDATION", () => {
    const json = JSON.stringify({
      status: "400",
      message: "Invalid payload.  The provided request body does not contain any valid attributes.",
    });
    expect(classifySdmResponse(slice(400, json))?.code).toBe("VALIDATION");
  });

  it("maps 400 'unexpected Database error' (masked WC) → VALIDATION", () => {
    const json = JSON.stringify({
      status: "400",
      message: "An unexpected Database error occurred. Contact your administrator.",
    });
    expect(classifySdmResponse(slice(400, json))?.code).toBe("VALIDATION");
  });

  it("maps 401 on a non-bootstrap endpoint → AUTH_FORBIDDEN (§8 footnote)", () => {
    const err = classifySdmResponse(slice(401, "forbidden", "text/plain"));
    expect(err).toMatchObject({ code: "AUTH_FORBIDDEN", httpStatus: 403 });
  });

  it("maps 404 → NOT_FOUND with the upstream message preserved", () => {
    const json = JSON.stringify({ status: "404", message: "No records found." });
    const err = classifySdmResponse(slice(404, json));
    expect(err).toMatchObject({ code: "NOT_FOUND", httpStatus: 404 });
    expect(err?.message).toBe("No records found.");
  });

  it("maps 404 with empty body → NOT_FOUND with synthesised message", () => {
    const err = classifySdmResponse(slice(404, "", ""));
    expect(err?.code).toBe("NOT_FOUND");
    expect(err?.message).toMatch(/not found/);
  });

  it("maps 409 'Invalid number of rows (0) affected' → NOT_FOUND (PUT-on-unknown-id quirk)", () => {
    const json = JSON.stringify({
      status: "409",
      message: "Invalid number of rows (0) affected by the operation. Expecting (1).",
    });
    const err = classifySdmResponse(slice(409, json));
    expect(err).toMatchObject({ code: "NOT_FOUND", httpStatus: 404 });
  });

  it("maps 409 with other message → CONFLICT (passes through)", () => {
    const json = JSON.stringify({ status: "409", message: "Record was modified by another user" });
    expect(classifySdmResponse(slice(409, json))?.code).toBe("CONFLICT");
  });

  it("maps 415 (Content-Type missing) → VALIDATION", () => {
    expect(classifySdmResponse(slice(415, "", ""))?.code).toBe("VALIDATION");
  });

  it("maps 5xx → BACKEND_UNAVAILABLE", () => {
    expect(classifySdmResponse(slice(500, "", ""))?.code).toBe("BACKEND_UNAVAILABLE");
    expect(classifySdmResponse(slice(503, "", ""))?.code).toBe("BACKEND_UNAVAILABLE");
  });

  it("falls back to UNKNOWN for unmapped statuses (e.g. 405)", () => {
    expect(classifySdmResponse(slice(405, "", ""))?.code).toBe("UNKNOWN");
  });

  it("includes op + sdmStatus + truncated message in details", () => {
    const err = classifySdmResponse(slice(404, "missing"));
    expect(err?.details).toMatchObject({
      op: "GET /api/incidents",
      sdmStatus: 404,
    });
  });

  it("parses XML error bodies the same way as JSON (§20 — Accept-driven shape)", () => {
    const xml = `<?xml version="1.0"?><error><message>No records found.</message><status>404</status></error>`;
    const err = classifySdmResponse(slice(404, xml, "application/xml"));
    expect(err?.message).toBe("No records found.");
  });
});

describe("assertSdmOk", () => {
  it("throws the same exception classifySdmResponse would return", () => {
    expect(() => assertSdmOk(slice(404, ""))).toThrow(AppErrorException);
  });

  it("does not throw on success", () => {
    expect(() => assertSdmOk(slice(200, "ok"))).not.toThrow();
  });

  it("respects custom success set", () => {
    expect(() => assertSdmOk(slice(201, ""), [200])).toThrow(AppErrorException);
    expect(() => assertSdmOk(slice(201, ""), [200, 201])).not.toThrow();
  });
});
