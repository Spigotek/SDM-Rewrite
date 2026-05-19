import type { Hono } from "hono";
import type { Logger } from "pino";
import { z } from "zod";
import { createConfigLoader } from "./load";
import type { RuntimeConfigPublic } from "./types";

export interface ConfigEndpointDeps {
  readonly log: Logger;
  /** Override loader for tests (skip filesystem). */
  readonly loader?: () => RuntimeConfigPublic;
}

/**
 * GET /config — serves the canonical FE `RuntimeConfig`. No HTTP cache
 * (Cache-Control: no-store) so deploys take effect immediately; the SPA
 * caches in-memory after first load per `bootstrap/config.ts`.
 *
 * Validation errors surface as 500 with structured detail — the SPA
 * cannot recover from a malformed config, and ops needs the path/field hint.
 */
export function registerConfigRoute(app: Hono, deps: ConfigEndpointDeps): void {
  const load = deps.loader ?? createConfigLoader({ log: deps.log });
  app.get("/config", (c) => {
    c.header("Cache-Control", "no-store");
    try {
      const cfg = load();
      return c.json(cfg as never, 200);
    } catch (err) {
      const detail =
        err instanceof z.ZodError
          ? err.flatten()
          : { message: err instanceof Error ? err.message : "unknown" };
      deps.log.error({ event: "config.load_failed", err: detail }, "config load failed");
      return c.json({ error: "config_invalid", detail }, 500);
    }
  });
}
