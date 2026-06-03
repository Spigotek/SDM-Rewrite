import { describe, expect, it, vi } from "vitest";
import { HttpClient, CORRELATION_ID_HEADER, RESPONSE_TENANT_HEADER_NAME } from "./http";
import { isUlid } from "./correlation";
import { isAppError } from "./errors";

const okResponse = (body: unknown, status = 200, extraHeaders: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...extraHeaders },
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

  // I.3 — X-Response-Tenant race detector tests.
  describe("X-Response-Tenant race detection", () => {
    it("passes through when session and response tenants match", async () => {
      const fetchSpy = vi
        .fn()
        .mockResolvedValue(okResponse({ ok: true }, 200, { [RESPONSE_TENANT_HEADER_NAME]: "T1" }));
      const client = new HttpClient({
        baseUrl: "https://bff.test",
        fetchImpl: fetchSpy as unknown as typeof fetch,
        activeTenantResolver: () => "T1",
      });
      const result = await client.get<{ ok: boolean }>("/me");
      expect(result).toEqual({ ok: true });
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("retries once on first mismatch and resolves when the retry response matches", async () => {
      const onRace = vi.fn();
      const fetchSpy = vi
        .fn()
        // First call — response tenant is the stale one (T2 instead of T1).
        .mockResolvedValueOnce(
          okResponse({ stale: true }, 200, { [RESPONSE_TENANT_HEADER_NAME]: "T2" }),
        )
        // Second call — BFF has caught up, tenant matches.
        .mockResolvedValueOnce(
          okResponse({ fresh: true }, 200, { [RESPONSE_TENANT_HEADER_NAME]: "T1" }),
        );
      const client = new HttpClient({
        baseUrl: "https://bff.test",
        fetchImpl: fetchSpy as unknown as typeof fetch,
        activeTenantResolver: () => "T1",
        onTenantRace: onRace,
      });
      const result = await client.get<{ fresh: boolean }>("/api/incidents");
      expect(result).toEqual({ fresh: true });
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(onRace).toHaveBeenCalledTimes(1);
      expect(onRace).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: "tenant_race",
          sessionTenant: "T1",
          responseTenant: "T2",
          attempt: 1,
        }),
      );
    });

    it("throws TENANT_RACE on a second mismatch (retry exhausted)", async () => {
      const onRace = vi.fn();
      const fetchSpy = vi
        .fn()
        .mockResolvedValue(
          okResponse({ wrong: true }, 200, { [RESPONSE_TENANT_HEADER_NAME]: "T2" }),
        );
      const client = new HttpClient({
        baseUrl: "https://bff.test",
        fetchImpl: fetchSpy as unknown as typeof fetch,
        activeTenantResolver: () => "T1",
        onTenantRace: onRace,
      });
      await expect(client.get("/api/incidents")).rejects.toSatisfy(
        (e) => isAppError(e) && e.kind === "TENANT_RACE",
      );
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(onRace).toHaveBeenCalledTimes(2);
      expect(onRace.mock.calls[1]?.[0]).toMatchObject({ attempt: 2 });
    });

    it("passes through when the response omits X-Response-Tenant (legacy / pre-I.3 BFF)", async () => {
      const fetchSpy = vi.fn().mockResolvedValue(okResponse({ ok: true }, 200));
      const client = new HttpClient({
        baseUrl: "https://bff.test",
        fetchImpl: fetchSpy as unknown as typeof fetch,
        activeTenantResolver: () => "T1",
      });
      const result = await client.get<{ ok: boolean }>("/me");
      expect(result).toEqual({ ok: true });
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("passes through when no resolver is wired (pre-session bootstrap)", async () => {
      const fetchSpy = vi
        .fn()
        .mockResolvedValue(
          okResponse({ ok: true }, 200, { [RESPONSE_TENANT_HEADER_NAME]: "T-foo" }),
        );
      const client = new HttpClient({
        baseUrl: "https://bff.test",
        fetchImpl: fetchSpy as unknown as typeof fetch,
      });
      const result = await client.get<{ ok: boolean }>("/me");
      expect(result).toEqual({ ok: true });
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });
});
