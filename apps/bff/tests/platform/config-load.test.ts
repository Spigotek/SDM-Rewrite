import { Hono } from "hono";
import pino from "pino";
import { describe, expect, it } from "vitest";
import { createConfigLoader } from "../../src/platform/config/load";
import { registerConfigRoute } from "../../src/platform/config/endpoint";

const VALID = {
  apiBaseUrl: "https://sdm.example.org",
  auth: { mode: "sso-oidc", bffOrigin: "https://sdm.example.org/bff" },
  tenants: { defaultMode: "user-profile" },
  features: {},
  meta: { appVersion: "1.0.0", buildId: "abc", deployedAt: "2026-05-19T10:00:00Z" },
};

describe("createConfigLoader", () => {
  it("parses a valid config.json", () => {
    const load = createConfigLoader({
      log: pino({ level: "silent" }),
      env: {},
      readFile: () => JSON.stringify(VALID),
    });
    const cfg = load();
    expect(cfg.apiBaseUrl).toBe("https://sdm.example.org");
    expect(cfg.auth.mode).toBe("sso-oidc");
    expect(cfg.apiBasePath).toBe("/api"); // schema default
  });

  it("overrides meta.* + auth.bffOrigin from env", () => {
    const load = createConfigLoader({
      log: pino({ level: "silent" }),
      env: {
        BFF_APP_VERSION: "1.1.0",
        BFF_BUILD_ID: "deadbeef",
        BFF_DEPLOYED_AT: "2026-06-01T08:00:00Z",
        BFF_PUBLIC_ORIGIN: "https://override.example.org",
      },
      readFile: () => JSON.stringify(VALID),
    });
    const cfg = load();
    expect(cfg.meta.appVersion).toBe("1.1.0");
    expect(cfg.meta.buildId).toBe("deadbeef");
    expect(cfg.auth.bffOrigin).toBe("https://override.example.org");
  });

  it("falls back to defaults when file is missing (ENOENT)", () => {
    const load = createConfigLoader({
      log: pino({ level: "silent" }),
      env: {},
      readFile: () => {
        const e = new Error("ENOENT") as NodeJS.ErrnoException;
        e.code = "ENOENT";
        throw e;
      },
    });
    const cfg = load();
    expect(cfg.auth.mode).toBe("rest-access-key");
    expect(cfg.apiBaseUrl).toContain("localhost");
  });

  it("fails loud when BFF_REQUIRE_CONFIG_FILE=true and file is missing", () => {
    const load = createConfigLoader({
      log: pino({ level: "silent" }),
      env: { BFF_REQUIRE_CONFIG_FILE: "true" },
      readFile: () => {
        const e = new Error("ENOENT") as NodeJS.ErrnoException;
        e.code = "ENOENT";
        throw e;
      },
    });
    expect(() => load()).toThrow(/missing/);
  });

  it("rejects invalid JSON with a path hint", () => {
    const load = createConfigLoader({
      log: pino({ level: "silent" }),
      env: {},
      readFile: () => "{ broken",
    });
    expect(() => load()).toThrow(/not valid JSON/);
  });
});

describe("registerConfigRoute", () => {
  it("returns 200 + cache-control: no-store + canonical shape", async () => {
    const app = new Hono();
    registerConfigRoute(app, {
      log: pino({ level: "silent" }),
      loader: () => ({
        apiBaseUrl: "https://x",
        apiBasePath: "/api",
        auth: { mode: "rest-access-key", bffOrigin: "https://x" },
        tenants: {
          defaultMode: "user-profile",
          tenantContextHeader: "X-CA-SDM-Tenant",
          allowSwitching: true,
        },
        features: {
          kbEditor: false,
          cmdbVisualizer: false,
          bulkOperations: false,
          changeCalendar: false,
          reportingWidgets: false,
        },
        observability: {},
        meta: { appVersion: "0.1.0", buildId: "local", deployedAt: "2026-05-19T10:00:00Z" },
      }),
    });
    const res = await app.fetch(new Request("http://bff/config"));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = (await res.json()) as { apiBaseUrl: string; meta: { appVersion: string } };
    expect(body.apiBaseUrl).toBe("https://x");
    expect(body.meta.appVersion).toBe("0.1.0");
  });

  it("returns 500 with structured detail when loader throws", async () => {
    const app = new Hono();
    registerConfigRoute(app, {
      log: pino({ level: "silent" }),
      loader: () => {
        throw new Error("boom");
      },
    });
    const res = await app.fetch(new Request("http://bff/config"));
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string; detail: { message: string } };
    expect(body.error).toBe("config_invalid");
    expect(body.detail.message).toBe("boom");
  });
});
