import type { Hono } from "hono";
import type { Context } from "hono";
import type { Logger } from "pino";
import { z } from "zod";
import {
  contactId as toContactId,
  roleId as toRoleId,
  tenantId as toTenantId,
  userId as toUserId,
} from "@sdm/domain";
import { AUDIT_EVENTS, type AuditEmitter } from "../platform/audit";
import type { RuntimeConfig } from "../config/schema";
import { clearSessionCookie, getSessionCookie, setSessionCookie } from "../security/cookies";
import type { CookieConfig } from "../security/cookies";
import { generateSid } from "../session";
import type { SessionPayload, SessionStore } from "../session/types";
import { AppErrorException, toAppErrorBody } from "./errors";
import { resolveUiRoles, type RoleMappingConfig } from "./role-mapper";
import type { SdmBroker } from "./sdm-broker";

export interface AuthRouteDeps {
  readonly config: RuntimeConfig;
  readonly sessionStore: SessionStore;
  readonly broker: SdmBroker;
  readonly log: Logger;
  readonly audit: AuditEmitter;
}

const LoginSchema = z.object({
  username: z.string().min(1).max(256),
  password: z.string().min(1).max(1024),
});

export function buildCookieConfig(config: RuntimeConfig): CookieConfig {
  return {
    name: config.session.cookieName,
    secure: config.session.cookieSecure,
    sameSite: config.session.sameSite,
    maxAgeSec: config.session.cookieMaxAgeSec,
    path: "/",
  };
}

export function buildRoleMappingConfig(config: RuntimeConfig): RoleMappingConfig {
  return {
    explicit: config.uiRoleMapping,
    fallback: "requester",
  };
}

export function registerAuthRoutes(app: Hono, deps: AuthRouteDeps): void {
  const cookieCfg = buildCookieConfig(deps.config);
  const roleCfg = buildRoleMappingConfig(deps.config);

  app.post("/auth/login", async (c) => {
    const correlationId = c.get("correlationId");
    let body: z.infer<typeof LoginSchema>;
    try {
      body = LoginSchema.parse(await c.req.json());
    } catch (err) {
      return c.json(
        toAppErrorBody({
          code: "VALIDATION",
          message: "Invalid login payload",
          httpStatus: 400,
          correlationId,
          details: err instanceof z.ZodError ? err.flatten().fieldErrors : undefined,
        }),
        400,
      );
    }

    try {
      const key = await deps.broker.bootstrap({ user: body.username, pass: body.password });
      const contact = await deps.broker.lookupContact(key.accessKey, body.username);
      const contactRoles = await safeListRoles(deps, key.accessKey, contact.id, correlationId);
      const roleSyms = contactRoles.map((r) => r.roleSym).filter((s): s is string => Boolean(s));
      const uiRoles = resolveUiRoles({
        roleSyms,
        accessTypeName: contact.accessTypeName,
        cfg: roleCfg,
      });

      const sid = generateSid();
      const nowMs = Date.now();
      const absoluteExpiresAt = nowMs + deps.config.session.absoluteSec * 1000;
      const defaultTenantId = toTenantId("default");
      const payload: SessionPayload = {
        sid,
        userId: toUserId(contact.userid),
        contactId: toContactId(contact.id),
        displayName: contact.displayName || `${contact.firstName} ${contact.lastName}`.trim(),
        email: contact.email,
        activeTenantId: defaultTenantId,
        tenants: [
          {
            id: defaultTenantId,
            name: "default",
            roles: uiRoles.map((uiRole, idx) => ({
              id: toRoleId(contactRoles[idx]?.id ?? `auto-${idx}`),
              sym: roleSyms[idx] ?? contact.accessTypeName,
              uiRole,
            })),
          },
        ],
        accessKey: key.accessKey,
        accessKeyId: key.accessKeyId,
        accessKeyExpiresAt: key.expiresAtMs,
        createdAt: nowMs,
        lastSeenAt: nowMs,
        absoluteExpiresAt,
        cookieVersion: 1,
      };
      await deps.sessionStore.create(sid, payload, deps.config.session.absoluteSec);
      setSessionCookie(c, sid, cookieCfg);

      deps.audit(
        c,
        {
          category: "auth",
          event: AUDIT_EVENTS.auth.LOGIN_SUCCESS,
          result: "success",
          resultCode: 200,
          details: { uiRoles },
        },
        payload,
      );

      return c.json(
        {
          ok: true,
          user: {
            userId: contact.userid,
            displayName: payload.displayName,
            email: payload.email,
          },
          uiRoles,
        },
        200,
      );
    } catch (err) {
      deps.audit(c, {
        category: "auth",
        event: AUDIT_EVENTS.auth.LOGIN_FAILURE,
        result: "failure",
        reason: err instanceof AppErrorException ? err.code : "unknown",
        actor: { userId: body.username },
      });
      return handleAuthError(c, err, correlationId, deps.log, "auth.login.failed");
    }
  });

  app.post("/auth/logout", async (c) => {
    const correlationId = c.get("correlationId");
    const sid = getSessionCookie(c, deps.config.session.cookieName);
    let outgoing: SessionPayload | null = null;
    if (sid) {
      const payload = await deps.sessionStore.get(sid);
      outgoing = payload;
      if (payload) {
        await deps.broker.revoke(payload.accessKey, payload.accessKeyId, correlationId);
      }
      await deps.sessionStore.destroy(sid);
    }
    clearSessionCookie(c, cookieCfg);
    deps.audit(
      c,
      {
        category: "auth",
        event: AUDIT_EVENTS.auth.LOGOUT,
        result: "success",
        details: { hadSession: Boolean(sid) },
      },
      outgoing ?? undefined,
    );
    return c.json({ ok: true }, 200);
  });

  app.post("/auth/heartbeat", async (c) => {
    const correlationId = c.get("correlationId");
    const sid = getSessionCookie(c, deps.config.session.cookieName);
    if (!sid) return unauthorized(c, correlationId, "no_session");
    const payload = await deps.sessionStore.get(sid);
    if (!payload) return unauthorized(c, correlationId, "no_session");
    const nowMs = Date.now();
    if (nowMs > payload.absoluteExpiresAt) {
      await deps.sessionStore.destroy(sid);
      deps.audit(
        c,
        {
          category: "auth",
          event: AUDIT_EVENTS.auth.SESSION_ABSOLUTE_EXPIRED,
          result: "failure",
          reason: "absolute_timeout",
        },
        payload,
      );
      return unauthorized(c, correlationId, "absolute_timeout");
    }
    if (nowMs - payload.lastSeenAt > deps.config.session.idleSec * 1000) {
      await deps.sessionStore.destroy(sid);
      deps.audit(
        c,
        {
          category: "auth",
          event: AUDIT_EVENTS.auth.SESSION_IDLE_EXPIRED,
          result: "failure",
          reason: "idle_timeout",
          details: { idleSeconds: Math.floor((nowMs - payload.lastSeenAt) / 1000) },
        },
        payload,
      );
      return unauthorized(c, correlationId, "idle_timeout");
    }
    await deps.sessionStore.touch(sid, nowMs);
    deps.audit(
      c,
      {
        category: "auth",
        event: AUDIT_EVENTS.auth.SESSION_HEARTBEAT,
        result: "success",
        details: { idleSeconds: Math.floor((nowMs - payload.lastSeenAt) / 1000) },
      },
      payload,
    );
    c.status(204);
    return c.body(null);
  });
}

async function safeListRoles(
  deps: AuthRouteDeps,
  accessKey: string,
  contactRawId: string,
  correlationId: string,
): Promise<Array<{ id: string; roleSym: string | null }>> {
  try {
    return await deps.broker.listContactRoles(accessKey, contactRawId);
  } catch (err) {
    deps.log.warn(
      { event: "sdm.cnt_role.lookup_failed", err, correlationId },
      "cnt_role lookup failed — falling back to access_type",
    );
    return [];
  }
}

function unauthorized(c: Context, correlationId: string, reason: string) {
  return c.json(
    {
      error: "unauthorized" as const,
      reason,
      correlationId,
    },
    401,
  );
}

function handleAuthError(
  c: Context,
  err: unknown,
  correlationId: string,
  log: Logger,
  event: string,
) {
  if (err instanceof AppErrorException) {
    log.warn({ event, code: err.code, correlationId, details: err.details }, err.message);
    return c.json(
      toAppErrorBody({
        code: err.code,
        message: err.message,
        httpStatus: err.httpStatus,
        correlationId,
      }),
      err.httpStatus as never,
    );
  }
  log.error({ event, err, correlationId }, "unhandled auth error");
  return c.json(
    toAppErrorBody({
      code: "UNKNOWN",
      message: "Internal error",
      httpStatus: 500,
      correlationId,
    }),
    500,
  );
}
