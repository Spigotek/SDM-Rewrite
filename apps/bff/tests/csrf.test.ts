import { Hono } from "hono";
import pino from "pino";
import { describe, expect, it } from "vitest";
import { csrfMiddleware } from "../src/security/csrf.js";

function buildApp() {
  const log = pino({ level: "silent" });
  const app = new Hono();
  app.use("*", csrfMiddleware({ trustedOrigins: ["https://portal.example"], log }));
  app.post("/x", (c) => c.json({ ok: true }));
  app.get("/y", (c) => c.json({ ok: true }));
  app.on(["OPTIONS"], "/x", (c) => c.json({ ok: true }));
  return app;
}

describe("csrfMiddleware", () => {
  it("allows POST with trusted Origin", async () => {
    const app = buildApp();
    const res = await app.request("/x", {
      method: "POST",
      headers: { Origin: "https://portal.example" },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("rejects POST with untrusted Origin", async () => {
    const app = buildApp();
    const res = await app.request("/x", {
      method: "POST",
      headers: { Origin: "https://evil.example" },
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { reason: string };
    expect(body.reason).toBe("untrusted_origin");
  });

  it("rejects POST with no Origin and no Referer", async () => {
    const app = buildApp();
    const res = await app.request("/x", { method: "POST" });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { reason: string };
    expect(body.reason).toBe("missing_origin");
  });

  it("allows POST when Origin missing but Referer is trusted", async () => {
    const app = buildApp();
    const res = await app.request("/x", {
      method: "POST",
      headers: { Referer: "https://portal.example/some/path" },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("rejects POST when Origin missing but Referer is untrusted", async () => {
    const app = buildApp();
    const res = await app.request("/x", {
      method: "POST",
      headers: { Referer: "https://evil.example/path" },
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { reason: string };
    expect(body.reason).toBe("untrusted_origin");
  });

  it("bypasses GET requests entirely", async () => {
    const app = buildApp();
    const res = await app.request("/y", { method: "GET" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("bypasses OPTIONS requests entirely", async () => {
    const app = buildApp();
    const res = await app.request("/x", { method: "OPTIONS" });
    expect(res.status).toBe(200);
  });
});
