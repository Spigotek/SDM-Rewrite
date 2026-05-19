import type { Context } from "hono";
import type { Logger } from "pino";
import type { SessionPayload } from "../../session/types";
import { AUDIT_SCHEMA_VERSION, samplingRate, type AuditCategory, type AuditResult } from "./events";
import { pseudonymize, redact, stripQuery } from "./redact";

/**
 * Structured `AuditEvent` payload per `audit-and-compliance.md` §2.
 *
 * Emit happens via pino at `level: "info"` with the payload nested under the
 * `auditEvent` key so a SIEM filter (`@field.auditEvent.category exists`) can
 * cleanly slice out audit events from operational logs.
 */

export interface AuditEventInput {
  readonly category: AuditCategory;
  readonly event: string;
  readonly result: AuditResult;
  readonly resultCode?: number;
  readonly reason?: string;
  readonly details?: Record<string, unknown>;
  /**
   * Override the actor — used at /auth/login.failure when no session exists
   * yet, or at logout where we want to attribute the event to the soon-to-be-
   * destroyed session.
   */
  readonly actor?: Partial<AuditActor>;
  /** Override tenant context — used at tenant.switch to capture from/to. */
  readonly tenant?: Partial<AuditTenant>;
  /** Override appOrigin when the request context cannot infer it. */
  readonly appOrigin?: AuditAppOrigin;
}

export interface AuditActor {
  readonly userId: string | null;
  readonly cntId: string | null;
  readonly sessionId: string | null;
  readonly uiRole: string | null;
  readonly isServiceProvider: boolean;
}

export interface AuditTenant {
  readonly activeTenantId: string | null;
  readonly sourceTenantId?: string;
  readonly targetTenantId?: string;
}

export type AuditAppOrigin = "portal" | "workspace" | "unknown";

export interface AuditEventPayload {
  readonly schemaVersion: typeof AUDIT_SCHEMA_VERSION;
  readonly ts: string;
  readonly correlationId: string;
  readonly category: AuditCategory;
  readonly event: string;
  readonly actor: AuditActor;
  readonly tenant: AuditTenant;
  readonly request: {
    readonly method: string;
    readonly path: string;
    readonly ip: string;
    readonly userAgent: string;
    readonly appOrigin: AuditAppOrigin;
  };
  readonly result: AuditResult;
  readonly resultCode?: number;
  readonly reason?: string;
  readonly details?: Record<string, unknown>;
}

export interface AuditEmitterDeps {
  readonly log: Logger;
  /** Override Math.random for deterministic sampling in tests. */
  readonly random?: () => number;
  /** Override Date.now for deterministic timestamps in tests. */
  readonly now?: () => number;
}

export type AuditEmitter = (c: Context, input: AuditEventInput, session?: SessionPayload) => void;

export function createAuditEmitter(deps: AuditEmitterDeps): AuditEmitter {
  const random = deps.random ?? Math.random;
  const now = deps.now ?? Date.now;
  return (c, input, session) => {
    const rate = samplingRate(input.event);
    if (rate < 1.0 && random() >= rate) return;

    const correlationId = (c.get("correlationId") as string | undefined) ?? "unknown";
    const userAgent = c.req.header("user-agent") ?? "";
    const ip = extractIp(c);
    const appOrigin = input.appOrigin ?? inferAppOrigin(c);

    const sessionActor: AuditActor = session
      ? {
          userId: session.userId,
          cntId: session.contactId,
          sessionId: pseudonymize(session.sid),
          uiRole:
            session.tenants.find((t) => t.id === session.activeTenantId)?.roles[0]?.uiRole ?? null,
          isServiceProvider: false,
        }
      : { userId: null, cntId: null, sessionId: null, uiRole: null, isServiceProvider: false };

    const sessionTenant: AuditTenant = session
      ? { activeTenantId: session.activeTenantId }
      : { activeTenantId: null };

    const payload: AuditEventPayload = {
      schemaVersion: AUDIT_SCHEMA_VERSION,
      ts: new Date(now()).toISOString(),
      correlationId,
      category: input.category,
      event: input.event,
      actor: { ...sessionActor, ...input.actor },
      tenant: { ...sessionTenant, ...input.tenant },
      request: {
        method: c.req.method,
        path: stripQuery(c.req.path),
        ip,
        userAgent: userAgent.slice(0, 200),
        appOrigin,
      },
      result: input.result,
      ...(input.resultCode !== undefined ? { resultCode: input.resultCode } : {}),
      ...(input.reason !== undefined ? { reason: input.reason } : {}),
      ...(input.details !== undefined
        ? { details: redact(input.details) as Record<string, unknown> }
        : {}),
    };

    deps.log.info({ auditEvent: payload }, input.event);
  };
}

function extractIp(c: Context): string {
  return (
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? c.req.header("x-real-ip") ?? "unknown"
  );
}

function inferAppOrigin(c: Context): AuditAppOrigin {
  const origin = c.req.header("origin") ?? c.req.header("referer") ?? "";
  if (origin.includes("/portal") || origin.includes("portal.")) return "portal";
  if (origin.includes("/workspace") || origin.includes("workspace.")) return "workspace";
  return "unknown";
}
