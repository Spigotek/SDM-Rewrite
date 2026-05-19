import { Hono } from "hono";
import pino from "pino";
import { contactId, roleId, tenantId, userId } from "@sdm/domain";
import { SdmHttpClient } from "../../src/api/http-client";
import { correlationMiddleware } from "../../src/auth/correlation";
import { AppErrorException, toAppErrorBody } from "../../src/auth/errors";
import { createAggregatorState, registerAggregatorRoutes } from "../../src/aggregator/routes";
import type { RuntimeConfig } from "../../src/config/schema";
import { createSessionStore } from "../../src/session";
import type { SessionPayload, SessionStore } from "../../src/session/types";

export const BASE = "http://test-sdm.local/caisd-rest";

export function makeConfig(): RuntimeConfig {
  return {
    nodeEnv: "test",
    bff: { port: 5175, trustedOrigins: ["http://localhost:5500"], logLevel: "fatal" },
    casdm: { baseUrl: BASE, basicAuthUser: "u", basicAuthPass: "p", requestTimeoutMs: 2000 },
    session: {
      driver: "memory",
      cookieName: "sdm.sid",
      cookieSecure: false,
      sameSite: "Lax",
      idleSec: 1800,
      absoluteSec: 28800,
      cookieMaxAgeSec: 28800,
    },
    uiRoleMapping: {},
  };
}

export interface BuildAggregatorResult {
  app: Hono;
  sid: string;
  sessionStore: SessionStore;
}

export async function buildAggregator(): Promise<BuildAggregatorResult> {
  const config = makeConfig();
  const log = pino({ level: "silent" });
  const sessionStore = createSessionStore({ driver: "memory" });
  const client = new SdmHttpClient(
    { baseUrl: BASE, requestTimeoutMs: 2000, maxRetries: 0 },
    { fetch: globalThis.fetch, log },
  );
  const sid = "integ-sid";
  const now = Date.now();
  const payload: SessionPayload = {
    sid,
    userId: userId("vueuser"),
    contactId: contactId("U'BDE'"),
    displayName: "User, Vue",
    email: "vueuser@example",
    activeTenantId: tenantId("default"),
    tenants: [
      {
        id: tenantId("default"),
        name: "default",
        roles: [{ id: roleId("10002"), sym: "Administrator", uiRole: "agent_l1" }],
      },
    ],
    accessKey: "51299815abc",
    accessKeyId: "402020",
    accessKeyExpiresAt: now + 3600_000,
    createdAt: now,
    lastSeenAt: now,
    absoluteExpiresAt: now + 28800_000,
    cookieVersion: 1,
  };
  await sessionStore.create(sid, payload, 28800);

  const app = new Hono();
  app.use("*", correlationMiddleware());
  registerAggregatorRoutes(app, { client, sessionStore, config, log }, createAggregatorState());
  app.onError((err, c) => {
    if (err instanceof AppErrorException) {
      return c.json(
        toAppErrorBody({ code: err.code, message: err.message, httpStatus: err.httpStatus }),
        err.httpStatus as never,
      );
    }
    return c.json({ error: "internal_error" }, 500);
  });
  return { app, sid, sessionStore };
}

export const SID_COOKIE = "sdm.sid=integ-sid";
export const COOKIE = "Cookie";
