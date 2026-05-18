import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { logger as honoLogger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import pino from "pino";
import { registerMeRoutes } from "./aggregator/me";
import { correlationMiddleware } from "./auth/correlation";
import { registerAuthRoutes } from "./auth/routes";
import { SdmBroker } from "./auth/sdm-broker";
import { loadConfig } from "./config/load";
import type { RuntimeConfig } from "./config/schema";
import { csrfMiddleware } from "./security/csrf";
import { createSessionStore } from "./session";
import type { SessionStore } from "./session/types";

export interface BuildAppDeps {
  readonly config: RuntimeConfig;
  readonly sessionStore: SessionStore;
  readonly broker: SdmBroker;
  readonly log: pino.Logger;
}

export function buildApp(deps: BuildAppDeps): Hono {
  const app = new Hono();

  app.use("*", secureHeaders());
  app.use("*", correlationMiddleware());
  app.use(
    "*",
    honoLogger((msg) => deps.log.info({ event: "http.request" }, msg)),
  );
  app.use("*", csrfMiddleware({ trustedOrigins: deps.config.bff.trustedOrigins, log: deps.log }));

  app.get("/health", (c) => c.json({ status: "ok", service: "@sdm/bff" }));
  app.get("/healthz", (c) => c.json({ status: "ok", service: "@sdm/bff" }));
  app.get("/readyz", (c) =>
    c.json({
      status: "ready",
      checks: { sessionStore: deps.config.session.driver },
    }),
  );

  registerAuthRoutes(app, deps);
  registerMeRoutes(app, { config: deps.config, sessionStore: deps.sessionStore, log: deps.log });

  app.notFound((c) => c.json({ error: "not_found" }, 404));
  app.onError((err, c) => {
    deps.log.error({ err, event: "http.unhandled_error" }, "unhandled error");
    return c.json({ error: "internal_error" }, 500);
  });

  return app;
}

async function main(): Promise<void> {
  const config = loadConfig();
  const log = pino({
    level: config.bff.logLevel,
    redact: ["req.headers.authorization", "req.headers.cookie", "*.password", "*.accessKey"],
  });
  const sessionStore = createSessionStore({ driver: config.session.driver });
  const broker = new SdmBroker(
    {
      baseUrl: config.casdm.baseUrl,
      basicAuthUser: config.casdm.basicAuthUser,
      basicAuthPass: config.casdm.basicAuthPass,
      requestTimeoutMs: config.casdm.requestTimeoutMs,
      maxRetries: 2,
    },
    { fetch: globalThis.fetch, log, now: () => Date.now() },
  );

  const app = buildApp({ config, sessionStore, broker, log });

  const server = serve({ fetch: app.fetch, port: config.bff.port }, ({ port: bound }) => {
    log.info({ port: bound }, "bff: started");
  });

  const shutdown = (signal: NodeJS.Signals) => {
    log.info({ signal }, "bff: shutting down");
    server.close(() => {
      void sessionStore.close().then(() => process.exit(0));
    });
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  (process.argv[1].endsWith("/src/index.ts") || process.argv[1].endsWith("/dist/index.js"));

if (invokedDirectly) {
  main().catch((err) => {
    console.error("bff: bootstrap failed", err);
    process.exit(1);
  });
}
