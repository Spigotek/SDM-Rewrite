import type { Hono } from "hono";
import { createReadinessProbe, type ReadinessDeps } from "./readiness";

export interface HealthRouteDeps extends ReadinessDeps {
  readonly serviceName?: string;
}

/**
 * /health  — liveness (process is up). Always 200, no upstream dependency.
 * /readyz — readiness (CA SDM reachable via cached bootstrap + small read).
 * /healthz is kept as an alias for liveness per F.1 deploy probes.
 */
export function registerHealthRoutes(app: Hono, deps: HealthRouteDeps): void {
  const probe = createReadinessProbe(deps);
  const service = deps.serviceName ?? "@sdm/bff";

  app.get("/health", (c) => c.json({ status: "ok", service }));
  app.get("/healthz", (c) => c.json({ status: "ok", service }));

  app.get("/readyz", async (c) => {
    const result = await probe();
    return c.json(
      {
        status: result.ok ? "ready" : "not_ready",
        service,
        checks: result.checks,
        ...(result.reason ? { reason: result.reason } : {}),
        probedAt: result.probedAt,
      },
      result.ok ? 200 : 503,
    );
  });
}
