import { describe, expect, it, vi } from "vitest";
import { HttpClient, CORRELATION_ID_HEADER } from "./http";
import { isUlid } from "./correlation";
import { isAppError } from "./errors";

const okResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("HttpClient", () => {
  it("injects X-Correlation-ID and does NOT inject any tenant header (server-side resolution)", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(okResponse({ ok: true }));
    const client = new HttpClient({
      baseUrl: "https://bff.test",
      fetchImpl: fetchSpy as unknown as typeof fetch,
      correlationIdGenerator: () => "cid-fixed",
    });

    await client.get("/me");

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://bff.test/me");
    const headers = init.headers as Record<string, string>;
    expect(headers[CORRELATION_ID_HEADER]).toBe("cid-fixed");
    // H.1: BFF resolves tenant from session.activeTenantId — the client must
    // not inject `X-CA-SDM-Tenant` (or any tenant header) anymore.
    expect(headers["X-CA-SDM-Tenant"]).toBeUndefined();
  });

  it("maps non-2xx response to typed AppError", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(new Response("forbidden", { status: 403, statusText: "Forbidden" }));
    const client = new HttpClient({
      baseUrl: "https://bff.test",
      fetchImpl: fetchSpy as unknown as typeof fetch,
    });

    await expect(client.get("/x")).rejects.toSatisfy(
      (e) => isAppError(e) && e.kind === "FORBIDDEN",
    );
  });

  it("wraps fetch failure into NETWORK AppError", async () => {
    const fetchSpy = vi.fn().mockRejectedValue(new TypeError("connection refused"));
    const client = new HttpClient({
      baseUrl: "https://bff.test",
      fetchImpl: fetchSpy as unknown as typeof fetch,
    });

    await expect(client.get("/x")).rejects.toSatisfy(
      (e) => isAppError(e) && e.kind === "NETWORK" && e.message.includes("connection refused"),
    );
  });

  it("serializes body for POST and sets Content-Type", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(okResponse({ id: 1 }));
    const client = new HttpClient({
      baseUrl: "https://bff.test",
      fetchImpl: fetchSpy as unknown as typeof fetch,
    });

    await client.post("/incidents", { title: "boom" });

    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ title: "boom" }));
    const headers = init.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("default correlation generator emits a ULID", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(okResponse({}));
    const client = new HttpClient({
      baseUrl: "https://bff.test",
      fetchImpl: fetchSpy as unknown as typeof fetch,
    });
    await client.get("/x");
    const headers = (fetchSpy.mock.calls[0]?.[1] as RequestInit).headers as Record<string, string>;
    const id = headers[CORRELATION_ID_HEADER];
    expect(id).toBeDefined();
    expect(isUlid(id as string)).toBe(true);
  });

  it("returns undefined for 204 No Content", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const client = new HttpClient({
      baseUrl: "https://bff.test",
      fetchImpl: fetchSpy as unknown as typeof fetch,
    });

    const result = await client.delete<undefined>("/x");
    expect(result).toBeUndefined();
  });
});
