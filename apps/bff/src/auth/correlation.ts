import type { MiddlewareHandler } from "hono";

const HEADER = "X-Correlation-ID";

declare module "hono" {
  interface ContextVariableMap {
    correlationId: string;
  }
}

export function correlationMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    const incoming = c.req.header(HEADER);
    const id =
      incoming && incoming.length > 0 && incoming.length <= 128 ? incoming : crypto.randomUUID();
    c.set("correlationId", id);
    c.header(HEADER, id);
    await next();
  };
}

export function getCorrelationId(c: { get: (key: "correlationId") => string | undefined }): string {
  return c.get("correlationId") ?? "00000000-0000-0000-0000-000000000000";
}
