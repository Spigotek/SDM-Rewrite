import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config/load.js";

function baseEnv(): NodeJS.ProcessEnv {
  return {
    BFF_TRUSTED_ORIGINS: "https://portal.example",
    CASDM_BASE_URL: "https://casdm.example",
    CASDM_BASIC_AUTH_USER: "vueuser",
    CASDM_BASIC_AUTH_PASS: "secret",
  } as NodeJS.ProcessEnv;
}

describe("loadConfig", () => {
  it("produces typed config from valid env", () => {
    const cfg = loadConfig({
      ...baseEnv(),
      NODE_ENV: "development",
      BFF_PORT: "5174",
      BFF_LOG_LEVEL: "info",
    });
    expect(cfg.nodeEnv).toBe("development");
    expect(cfg.bff.port).toBe(5174);
    expect(cfg.bff.trustedOrigins).toEqual(["https://portal.example"]);
    expect(cfg.casdm.baseUrl).toBe("https://casdm.example");
    expect(cfg.casdm.basicAuthUser).toBe("vueuser");
    expect(cfg.session.cookieName).toBe("sdm.sid");
    expect(cfg.session.sameSite).toBe("Lax");
    expect(cfg.uiRoleMapping).toEqual({});
  });

  it("throws when CASDM_BASE_URL is missing", () => {
    const env = baseEnv();
    delete env.CASDM_BASE_URL;
    expect(() => loadConfig(env)).toThrow(/casdm|baseUrl/i);
  });

  it("throws when BFF_TRUSTED_ORIGINS is missing (no default)", () => {
    const env = baseEnv();
    delete env.BFF_TRUSTED_ORIGINS;
    expect(() => loadConfig(env)).toThrow(/trustedOrigins/);
  });

  it("parses comma-separated trusted origins into an array", () => {
    const cfg = loadConfig({
      ...baseEnv(),
      BFF_TRUSTED_ORIGINS: "https://a.example, https://b.example",
    });
    expect(cfg.bff.trustedOrigins).toEqual(["https://a.example", "https://b.example"]);
  });

  it("parses UI_ROLE_MAPPING_JSON when valid", () => {
    const cfg = loadConfig({
      ...baseEnv(),
      UI_ROLE_MAPPING_JSON: '{"Administrator":"sp_admin","Customer":"requester"}',
    });
    expect(cfg.uiRoleMapping).toEqual({
      Administrator: "sp_admin",
      Customer: "requester",
    });
  });

  it("throws when UI_ROLE_MAPPING_JSON contains an invalid UIRole value", () => {
    expect(() =>
      loadConfig({
        ...baseEnv(),
        UI_ROLE_MAPPING_JSON: '{"Administrator":"god_mode"}',
      }),
    ).toThrow(/uiRoleMapping/);
  });

  it("rejects __Host- cookie name without secure flag in production", () => {
    expect(() =>
      loadConfig({
        ...baseEnv(),
        NODE_ENV: "production",
        SESSION_COOKIE_NAME: "__Host-sdm.sid",
        SESSION_COOKIE_SECURE: "false",
      }),
    ).toThrow(/__Host-/);
  });

  it("applies BFF_PORT default of 5174 when unset", () => {
    const env = baseEnv();
    delete env.BFF_PORT;
    const cfg = loadConfig(env);
    expect(cfg.bff.port).toBe(5174);
  });
});
