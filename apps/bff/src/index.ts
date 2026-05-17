import { createServer } from "node:http";

const port = Number(process.env.BFF_PORT ?? 5174);

const server = createServer((req, res) => {
  if (req.url === "/health" || req.url === "/healthz") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ status: "ok", service: "@sdm/bff", stub: true }));
    return;
  }
  res.writeHead(404, { "content-type": "application/json" });
  res.end(JSON.stringify({ error: "not_found" }));
});

server.listen(port, () => {
  console.log(`[bff stub] listening on :${port}`);
});

const shutdown = (signal: NodeJS.Signals) => {
  console.log(`[bff stub] ${signal} received — shutting down`);
  server.close(() => process.exit(0));
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
