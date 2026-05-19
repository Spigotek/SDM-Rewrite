import type { MiddlewareHandler } from "hono";
import type { Logger } from "pino";
import { AUDIT_EVENTS, type AuditEmitter } from "../platform/audit";

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export interface CsrfOptions {
  readonly trustedOrigins: readonly string[];
  readonly log: Logger;
  /** Optional audit hook — when supplied, csrf rejections fire `security.csrf.violation`. */
  readonly audit?: AuditEmitter;
}

function originOf(url: string): string | null {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

export function csrfMiddleware(opts: CsrfOptions): MiddlewareHandler {
  const trusted = new Set(opts.trustedOrigins);
  return async (c, next) => {
    if (!MUTATING.has(c.req.method)) return next();

    const origin = c.req.header("Origin") ?? null;
    const referer = c.req.header("Referer") ?? null;
    const correlationId = (c.get("correlationId") as string | undefined) ?? crypto.randomUUID();

    const checkAgainst = origin ?? (referer ? originOf(referer) : null);
    if (!checkAgainst) {
      opts.log.warn(
        { event: "csrf.rejected", reason: "missing_origin", path: c.req.path, correlationId },
        "csrf rejected",
      );
      opts.audit?.(c, {
        category: "security",
        event: AUDIT_EVENTS.security.CSRF_VIOLATION,
        result: "denied",
        resultCode: 403,
        reason: "missing_origin",
      });
      return c.json({ error: "csrf_rejected", reason: "missing_origin", correlationId }, 403);
    }
    if (!trusted.has(checkAgainst)) {
      opts.log.warn(
        {
          event: "csrf.rejected",
          reason: "untrusted_origin",
          origin: checkAgainst,
          path: c.req.path,
          correlationId,
        },
        "csrf rejected",
      );
      opts.audit?.(c, {
        category: "security",
        event: AUDIT_EVENTS.security.CSRF_VIOLATION,
        result: "denied",
        resultCode: 403,
        reason: "untrusted_origin",
        details: { origin: checkAgainst },
      });
      return c.json({ error: "csrf_rejected", reason: "untrusted_origin", correlationId }, 403);
    }
    return next();
  };
}
