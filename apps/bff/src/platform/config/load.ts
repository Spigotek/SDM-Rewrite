import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Logger } from "pino";
import { RuntimeConfigSchema, type RuntimeConfigPublic } from "./types";

/**
 * Read `config.json` from `process.cwd()` (or `BFF_CONFIG_PATH` if set) on
 * every `GET /config`. Lazy re-read — no file watcher (per F.4.md MVP
 * decision; watcher adds chokidar dep + edge-case handling for partial
 * writes).
 *
 * Env overrides for deploy-injected meta keep build-time + deploy-time
 * fields source-of-truth-correct without re-writing the file in CI:
 *  - `BFF_APP_VERSION`  → `meta.appVersion`
 *  - `BFF_BUILD_ID`     → `meta.buildId`
 *  - `BFF_DEPLOYED_AT`  → `meta.deployedAt`
 *  - `BFF_PUBLIC_ORIGIN` → `auth.bffOrigin` (also used as `apiBaseUrl` if
 *    the file omits it — typical when one deploy serves both)
 *
 * When the file is missing the loader falls back to a minimal in-memory
 * default so `pnpm dev` doesn't crash. Production deploys MUST ship a real
 * file — set `BFF_REQUIRE_CONFIG_FILE=true` to fail-loud instead.
 */

export interface ConfigLoaderDeps {
  readonly log: Logger;
  readonly env?: NodeJS.ProcessEnv;
  readonly cwd?: string;
  readonly readFile?: (path: string) => string;
}

export function createConfigLoader(deps: ConfigLoaderDeps) {
  const env = deps.env ?? process.env;
  const cwd = deps.cwd ?? process.cwd();
  const read = deps.readFile ?? ((p: string) => readFileSync(p, "utf8"));

  return function load(): RuntimeConfigPublic {
    const path = resolve(cwd, env.BFF_CONFIG_PATH ?? "config.json");
    let raw: unknown;
    try {
      raw = JSON.parse(read(path));
    } catch (err) {
      const errno = (err as NodeJS.ErrnoException).code;
      if (errno === "ENOENT") {
        if (env.BFF_REQUIRE_CONFIG_FILE === "true") {
          throw new Error(`config: missing ${path} (BFF_REQUIRE_CONFIG_FILE=true)`);
        }
        deps.log.warn({ event: "config.fallback", path }, "config.json not found; using defaults");
        raw = defaultConfig(env);
      } else if (err instanceof SyntaxError) {
        throw new Error(`config: ${path} is not valid JSON: ${err.message}`);
      } else {
        throw err;
      }
    }

    const merged = applyEnvOverrides(raw, env);
    return RuntimeConfigSchema.parse(merged);
  };
}

function defaultConfig(env: NodeJS.ProcessEnv): Record<string, unknown> {
  const origin = env.BFF_PUBLIC_ORIGIN ?? "http://localhost:5174";
  return {
    apiBaseUrl: origin,
    apiBasePath: "/api",
    auth: {
      mode: "rest-access-key",
      bffOrigin: origin,
      restAccessKeyEndpoint: "/caisd-rest/rest_access",
    },
    tenants: {
      defaultMode: "user-profile",
      tenantContextHeader: "X-CA-SDM-Tenant",
      allowSwitching: true,
    },
    features: {},
    observability: {},
    meta: {
      appVersion: env.BFF_APP_VERSION ?? "0.0.0-dev",
      buildId: env.BFF_BUILD_ID ?? "local",
      deployedAt: env.BFF_DEPLOYED_AT ?? new Date().toISOString(),
    },
  };
}

function applyEnvOverrides(raw: unknown, env: NodeJS.ProcessEnv): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const out = { ...(raw as Record<string, unknown>) };
  const meta = (out.meta ?? {}) as Record<string, unknown>;
  if (env.BFF_APP_VERSION) meta.appVersion = env.BFF_APP_VERSION;
  if (env.BFF_BUILD_ID) meta.buildId = env.BFF_BUILD_ID;
  if (env.BFF_DEPLOYED_AT) meta.deployedAt = env.BFF_DEPLOYED_AT;
  out.meta = meta;
  if (env.BFF_PUBLIC_ORIGIN) {
    const auth = (out.auth ?? {}) as Record<string, unknown>;
    auth.bffOrigin = env.BFF_PUBLIC_ORIGIN;
    out.auth = auth;
    if (!out.apiBaseUrl) out.apiBaseUrl = env.BFF_PUBLIC_ORIGIN;
  }
  return out;
}
