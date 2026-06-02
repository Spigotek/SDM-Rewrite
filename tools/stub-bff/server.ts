// Stub BFF harness — serves production-built SPA dist + replays
// `@sdm/api-mocks` handlers via plain Node HTTP. Used by LHCI so the
// SPA bundle measured is production-equivalent (no MSW client runtime
// inflating TTI on the mobile profile). Reuses the same `handlers`
// readonly array MSW uses in dev/test so fixture parity is automatic.

import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";
import { brotliCompressSync, gzipSync } from "node:zlib";
import { handlers } from "@sdm/api-mocks";
import type { RequestHandler } from "msw";

const PORT = Number(process.env["PORT"] ?? 5180);
const DIST_DIR_RAW = process.env["DIST_DIR"];
if (!DIST_DIR_RAW) {
  console.error("[stub-bff] DIST_DIR env var required (e.g. apps/portal/dist)");
  process.exit(1);
}
const DIST_DIR = resolve(DIST_DIR_RAW);
if (!existsSync(join(DIST_DIR, "index.html"))) {
  console.error(`[stub-bff] DIST_DIR ${DIST_DIR} has no index.html — run the SPA build first`);
  process.exit(1);
}

// File extensions worth compressing — text/JS/CSS/JSON/SVG/HTML/wasm. Skip
// already-compressed formats (woff2, png, jpg, ico) so we don't double-encode.
const COMPRESSIBLE: ReadonlySet<string> = new Set([
  ".html",
  ".js",
  ".mjs",
  ".css",
  ".json",
  ".map",
  ".svg",
  ".txt",
  ".wasm",
]);

const MIN_COMPRESS_BYTES = 1024;

interface Encoded {
  body: Buffer;
  encoding: string | null;
}

function pickEncoding(acceptEncoding: string | undefined): "br" | "gzip" | null {
  if (!acceptEncoding) return null;
  const tokens = acceptEncoding
    .toLowerCase()
    .split(",")
    .map((t) => t.trim().split(";")[0]?.trim());
  if (tokens.includes("br")) return "br";
  if (tokens.includes("gzip")) return "gzip";
  return null;
}

function maybeCompress(
  body: Buffer,
  encoding: "br" | "gzip" | null,
  compressible: boolean,
): Encoded {
  if (!encoding || !compressible || body.byteLength < MIN_COMPRESS_BYTES) {
    return { body, encoding: null };
  }
  const compressed = encoding === "br" ? brotliCompressSync(body) : gzipSync(body);
  return { body: compressed, encoding };
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".wasm": "application/wasm",
};

async function nodeReqToFetchRequest(req: IncomingMessage): Promise<Request> {
  const host = req.headers.host ?? `localhost:${PORT}`;
  const url = `http://${host}${req.url ?? "/"}`;
  const method = (req.method ?? "GET").toUpperCase();
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (Array.isArray(v)) {
      for (const item of v) headers.append(k, item);
    } else if (typeof v === "string") {
      headers.set(k, v);
    }
  }
  let body: Buffer | undefined;
  if (method !== "GET" && method !== "HEAD") {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(chunk as Buffer);
    }
    if (chunks.length > 0) body = Buffer.concat(chunks);
  }
  const init: RequestInit = { method, headers };
  if (body !== undefined) {
    // `duplex: "half"` is required by Node's fetch when sending a body.
    (init as RequestInit & { duplex?: string }).duplex = "half";
    init.body = body;
  }
  return new Request(url, init);
}

async function tryHandlers(request: Request): Promise<Response | null> {
  const requestId = randomUUID();
  for (const handler of handlers as readonly RequestHandler[]) {
    const result = await handler.run({ request: request.clone(), requestId });
    if (result?.response) return result.response;
  }
  return null;
}

function resolveStaticPath(urlPath: string): string | null {
  const cleanPath = urlPath.split("?")[0]?.split("#")[0] ?? "/";
  if (cleanPath.endsWith("/")) return null;
  const relative = normalize(cleanPath).replace(/^[/\\]+/, "");
  const absolute = resolve(DIST_DIR, relative);
  // Path traversal guard — must remain inside DIST_DIR.
  if (!absolute.startsWith(DIST_DIR + sep) && absolute !== DIST_DIR) return null;
  if (!existsSync(absolute)) return null;
  return absolute;
}

function serveStatic(filePath: string, req: IncomingMessage, res: ServerResponse): void {
  const ext = extname(filePath).toLowerCase();
  const mime = MIME[ext] ?? "application/octet-stream";
  const raw = readFileSync(filePath);
  const encoded = maybeCompress(
    raw,
    pickEncoding(req.headers["accept-encoding"] as string | undefined),
    COMPRESSIBLE.has(ext),
  );
  // Disable caching so consecutive LHCI runs measure cold loads.
  const headers: Record<string, string> = {
    "Content-Type": mime,
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "Content-Length": String(encoded.body.byteLength),
    Vary: "Accept-Encoding",
  };
  if (encoded.encoding) headers["Content-Encoding"] = encoded.encoding;
  res.writeHead(200, headers);
  res.end(encoded.body);
}

function serveSpaFallback(req: IncomingMessage, res: ServerResponse): void {
  const indexPath = join(DIST_DIR, "index.html");
  const raw = readFileSync(indexPath);
  const encoded = maybeCompress(
    raw,
    pickEncoding(req.headers["accept-encoding"] as string | undefined),
    true,
  );
  const headers: Record<string, string> = {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "Content-Length": String(encoded.body.byteLength),
    Vary: "Accept-Encoding",
  };
  if (encoded.encoding) headers["Content-Encoding"] = encoded.encoding;
  res.writeHead(200, headers);
  res.end(encoded.body);
}

function sendHandlerResponse(
  handlerResp: Response,
  req: IncomingMessage,
  res: ServerResponse,
  rawBody: Buffer,
): void {
  const headers: Record<string, string> = {};
  handlerResp.headers.forEach((value, key) => {
    headers[key] = value;
  });
  const contentType = handlerResp.headers.get("content-type") ?? "";
  const isCompressible = /^(application\/(json|javascript)|text\/)/i.test(contentType);
  const encoded = maybeCompress(
    rawBody,
    pickEncoding(req.headers["accept-encoding"] as string | undefined),
    isCompressible,
  );
  headers["content-length"] = String(encoded.body.byteLength);
  headers["vary"] = "Accept-Encoding";
  if (encoded.encoding) headers["content-encoding"] = encoded.encoding;
  res.writeHead(handlerResp.status, headers);
  res.end(encoded.body);
}

const server = createServer((req, res) => {
  void (async () => {
    try {
      const method = (req.method ?? "GET").toUpperCase();
      const urlPath = (req.url ?? "/").split("?")[0] ?? "/";

      // 1. Static file lookup for GET/HEAD with an extension.
      if ((method === "GET" || method === "HEAD") && extname(urlPath) !== "") {
        const filePath = resolveStaticPath(urlPath);
        if (filePath) {
          serveStatic(filePath, req, res);
          return;
        }
      }

      // 2. MSW handler dispatch — covers /config, /api/*, /me, /auth/*, etc.
      const fetchReq = await nodeReqToFetchRequest(req);
      const handlerResp = await tryHandlers(fetchReq);
      if (handlerResp) {
        const body = Buffer.from(await handlerResp.arrayBuffer());
        sendHandlerResponse(handlerResp, req, res, body);
        return;
      }

      // 3. SPA fallback for client-side routes (no extension, GET/HEAD).
      if ((method === "GET" || method === "HEAD") && extname(urlPath) === "") {
        serveSpaFallback(req, res);
        return;
      }

      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not Found");
    } catch (err) {
      console.error("[stub-bff] handler error", err);
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      }
      res.end("Internal Server Error");
    }
  })();
});

server.listen(PORT, () => {
  console.log(`[stub-bff] listening on http://localhost:${PORT} (dist: ${DIST_DIR})`);
});

const shutdown = (signal: string): void => {
  console.log(`[stub-bff] received ${signal}, shutting down`);
  server.close(() => process.exit(0));
};
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
