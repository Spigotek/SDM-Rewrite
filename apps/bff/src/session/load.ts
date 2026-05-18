import type { Context } from "hono";
import type { Logger } from "pino";
import { AppErrorException } from "../auth/errors";
import type { RuntimeConfig } from "../config/schema";
import { getSessionCookie } from "../security/cookies";
import type { SessionPayload, SessionStore } from "./types";

/**
 * Read the session cookie, hydrate the payload from the store, apply idle +
 * absolute expiry checks, and update `lastSeenAt`. Single source of truth
 * for "is this caller authenticated right now?".
 *
 * Throws `AUTH_EXPIRED` (httpStatus 401) on missing cookie, missing store
 * entry, or any expiry hit — callers can let the BFF onError handler shape
 * the response, or catch + redirect as needed.
 */
export interface SessionLoadDeps {
  readonly config: RuntimeConfig;
  readonly sessionStore: SessionStore;
  readonly log: Logger;
}

export async function requireActiveSession(
  c: Context,
  deps: SessionLoadDeps,
): Promise<SessionPayload> {
  const sid = getSessionCookie(c, deps.config.session.cookieName);
  if (!sid) throw unauthenticated("no session cookie");

  const payload = await deps.sessionStore.get(sid);
  if (!payload) throw unauthenticated("no session for sid");

  const nowMs = Date.now();
  if (nowMs > payload.absoluteExpiresAt) {
    await deps.sessionStore.destroy(sid);
    throw unauthenticated("absolute expiry");
  }
  if (nowMs - payload.lastSeenAt > deps.config.session.idleSec * 1000) {
    await deps.sessionStore.destroy(sid);
    throw unauthenticated("idle expiry");
  }
  await deps.sessionStore.touch(sid, nowMs);
  return payload;
}

function unauthenticated(reason: string): AppErrorException {
  return new AppErrorException({
    code: "AUTH_EXPIRED",
    httpStatus: 401,
    message: "Session expired or missing",
    details: { reason },
  });
}
