import { z } from "zod";
import { RuntimeConfigSchema, type RuntimeConfig } from "./schema.js";

function splitOrigins(raw: string | undefined): string[] | undefined {
  if (raw === undefined) return undefined;
  const parts = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return parts;
}

function parseRoleMapping(raw: string | undefined): unknown {
  if (raw === undefined || raw.trim() === "") return undefined;
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `invalid BFF config: UI_ROLE_MAPPING_JSON is not valid JSON (${(err as Error).message})`,
    );
  }
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  const input: Record<string, unknown> = {
    nodeEnv: env.NODE_ENV,
    bff: {
      port: env.BFF_PORT,
      trustedOrigins: splitOrigins(env.BFF_TRUSTED_ORIGINS),
      logLevel: env.BFF_LOG_LEVEL,
    },
    casdm: {
      baseUrl: env.CASDM_BASE_URL,
      basicAuthUser: env.CASDM_BASIC_AUTH_USER,
      basicAuthPass: env.CASDM_BASIC_AUTH_PASS,
      requestTimeoutMs: env.CASDM_REQUEST_TIMEOUT_MS,
    },
    session: {
      driver: env.SESSION_DRIVER,
      cookieName: env.SESSION_COOKIE_NAME,
      cookieSecure: env.SESSION_COOKIE_SECURE,
      sameSite: env.SESSION_SAME_SITE,
      idleSec: env.SESSION_IDLE_SEC,
      absoluteSec: env.SESSION_ABSOLUTE_SEC,
      cookieMaxAgeSec: env.SESSION_COOKIE_MAX_AGE_SEC,
    },
    uiRoleMapping: parseRoleMapping(env.UI_ROLE_MAPPING_JSON),
  };

  // Strip undefined values so Zod defaults apply (exactOptionalPropertyTypes hygiene).
  for (const section of ["bff", "casdm", "session"] as const) {
    const obj = input[section] as Record<string, unknown>;
    for (const k of Object.keys(obj)) {
      if (obj[k] === undefined) delete obj[k];
    }
  }
  if (input.nodeEnv === undefined) delete input.nodeEnv;
  if (input.uiRoleMapping === undefined) delete input.uiRoleMapping;

  let parsed: RuntimeConfig;
  try {
    parsed = RuntimeConfigSchema.parse(input);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const issues = err.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      }));
      throw new Error("invalid BFF config: " + JSON.stringify(issues));
    }
    throw err;
  }

  if (
    parsed.nodeEnv === "production" &&
    parsed.session.cookieName.startsWith("__Host-") &&
    parsed.session.cookieSecure !== true
  ) {
    throw new Error(
      "invalid BFF config: __Host- cookie prefix requires SESSION_COOKIE_SECURE=true in production",
    );
  }

  return parsed;
}
