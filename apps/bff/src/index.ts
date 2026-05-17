import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import pino from "pino";

const log = pino({
  level: process.env.PM_LOG_LEVEL ?? "info",
  redact: ["req.headers.authorization", "req.headers.cookie", "*.password"],
});

const port = Number(process.env.BFF_PORT ?? 5174);

const app = new Hono();

app.use("*", secureHeaders());
app.use(
  "*",
  logger((msg) => log.info(msg)),
);

app.get("/health", (c) => c.json({ status: "ok", service: "@sdm/bff", stub: true }));
app.get("/healthz", (c) => c.json({ status: "ok", service: "@sdm/bff", stub: true }));
app.get("/readyz", (c) => c.json({ status: "ready", checks: { sessionStore: "in-memory" } }));

app.notFound((c) => c.json({ error: "not_found" }, 404));
app.onError((err, c) => {
  log.error({ err }, "unhandled error");
  return c.json({ error: "internal_error" }, 500);
});

const server = serve({ fetch: app.fetch, port }, ({ port: bound }) => {
  log.info({ port: bound }, "bff: started");
});

const shutdown = (signal: NodeJS.Signals) => {
  log.info({ signal }, "bff: shutting down");
  server.close(() => process.exit(0));
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
