import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import {
  clearSessionCookie,
  getSessionCookie,
  setSessionCookie,
  type CookieConfig,
} from "../src/security/cookies";

const hostCfg: CookieConfig = {
  name: "__Host-sdm.sid",
  secure: true,
  sameSite: "Lax",
  maxAgeSec: 28800,
  path: "/",
};

function buildSetApp(cfg: CookieConfig): Hono {
  const app = new Hono();
  app.get("/set", (c) => {
    setSessionCookie(c, "sid-value-123", cfg);
    return c.text("ok");
  });
  return app;
}

describe("setSessionCookie", () => {
  it("emits HttpOnly + Path=/ + Max-Age=28800 with __Host- prefix", async () => {
    const res = await buildSetApp(hostCfg).request("/set");
    const header = res.headers.get("set-cookie");
    expect(header).not.toBeNull();
    expect(header).toContain("__Host-sdm.sid=sid-value-123");
    expect(header).toContain("HttpOnly");
    expect(header).toContain("Path=/");
    expect(header).toContain("Max-Age=28800");
  });

  it("includes Secure when secure=true", async () => {
    const res = await buildSetApp(hostCfg).request("/set");
    expect(res.headers.get("set-cookie")).toContain("Secure");
  });

  it("omits Secure when secure=false (non-host-prefix cookie)", async () => {
    const cfg: CookieConfig = {
      name: "sdm.sid",
      secure: false,
      sameSite: "Lax",
      maxAgeSec: 28800,
      path: "/",
    };
    const res = await buildSetApp(cfg).request("/set");
    const header = res.headers.get("set-cookie");
    expect(header).not.toBeNull();
    expect(header).not.toMatch(/;\s*Secure/i);
  });

  it("maps sameSite=Lax to SameSite=Lax", async () => {
    const res = await buildSetApp(hostCfg).request("/set");
    expect(res.headers.get("set-cookie")).toMatch(/SameSite=Lax/i);
  });

  it("throws when __Host- cookie has non-root path", () => {
    const app = new Hono();
    app.get("/set", (c) => {
      setSessionCookie(c, "x", { ...hostCfg, path: "/" as const, name: "__Host-x" });
      return c.text("ok");
    });
    expect(() =>
      setSessionCookie({} as never, "x", {
        name: "__Host-x",
        secure: true,
        sameSite: "Lax",
        maxAgeSec: 60,
        path: "/sub" as unknown as "/",
      }),
    ).toThrowError(/Path=\//);
  });

  it("throws when __Host- cookie is not Secure", () => {
    expect(() =>
      setSessionCookie({} as never, "x", {
        name: "__Host-x",
        secure: false,
        sameSite: "Lax",
        maxAgeSec: 60,
        path: "/",
      }),
    ).toThrowError(/Secure/);
  });

  it("throws when __Host- cookie sets Domain", () => {
    expect(() =>
      setSessionCookie({} as never, "x", {
        name: "__Host-x",
        secure: true,
        sameSite: "Lax",
        maxAgeSec: 60,
        path: "/",
        domain: "example.com",
      }),
    ).toThrowError(/Domain/);
  });
});

describe("getSessionCookie", () => {
  it("returns null when cookie is absent", async () => {
    const app = new Hono();
    app.get("/read", (c) => c.json({ value: getSessionCookie(c, "__Host-sdm.sid") }));
    const res = await app.request("/read");
    expect(await res.json()).toEqual({ value: null });
  });

  it("returns the cookie value when present", async () => {
    const app = new Hono();
    app.get("/read", (c) => c.json({ value: getSessionCookie(c, "__Host-sdm.sid") }));
    const res = await app.request("/read", {
      headers: { Cookie: "__Host-sdm.sid=sid-xyz" },
    });
    expect(await res.json()).toEqual({ value: "sid-xyz" });
  });
});

describe("clearSessionCookie", () => {
  it("emits Set-Cookie with Max-Age=0", async () => {
    const app = new Hono();
    app.get("/clear", (c) => {
      clearSessionCookie(c, hostCfg);
      return c.text("ok");
    });
    const res = await app.request("/clear");
    const header = res.headers.get("set-cookie");
    expect(header).not.toBeNull();
    expect(header).toContain("__Host-sdm.sid=");
    expect(header).toMatch(/Max-Age=0/);
    expect(header).toContain("Path=/");
  });

  it("throws when __Host- prefix violated on clear", () => {
    expect(() =>
      clearSessionCookie({} as never, {
        name: "__Host-x",
        secure: false,
        sameSite: "Lax",
        maxAgeSec: 0,
        path: "/",
      }),
    ).toThrowError(/Secure/);
  });
});
