/**
 * J.3 — GET /api/events SSE endpoint.
 *
 * Requires an active session (401 if no session cookie or session expired).
 * On connect:
 *  - Sends a `connected` event with { sessionId, tenantId, at }.
 *  - Registers a subscription on the event bus for the session's sid.
 *  - Sends a SSE comment heartbeat every 30 s to keep proxies alive (nginx
 *    default read_timeout is 60 s; 30 s heartbeat stays comfortably below).
 *  - On stream abort (client disconnect / network drop): unsubscribes + clears
 *    the heartbeat timer.
 *
 * Headers set by Hono's streamSSE: Content-Type, Cache-Control, Connection.
 * We additionally set X-Accel-Buffering: no (nginx proxy_buffering hint).
 *
 * NOTE: the `requireActiveSession` call here intentionally does NOT touch
 * lastSeenAt on the heartbeat path because the SSE endpoint stays open
 * indefinitely — continuous idle-timer bumping would prevent idle expiry.
 * The FE heartbeat (auth/heartbeat) handles activity-based session extension.
 */

import type { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { Logger } from "pino";
import { subscribe } from "../platform/event-bus";
import { getSessionCookie } from "../security/cookies";
import type { RuntimeConfig } from "../config/schema";
import type { SessionStore } from "../session/types";
import { toAppErrorBody } from "../auth/errors";
import { getCorrelationId } from "../auth/correlation";

export interface EventsRouteDeps {
  readonly config: RuntimeConfig;
  readonly sessionStore: SessionStore;
  readonly log: Logger;
}

const HEARTBEAT_INTERVAL_MS = 30_000;

export function registerEventsRoute(app: Hono, deps: EventsRouteDeps): void {
  app.get("/api/events", async (c) => {
    const correlationId = getCorrelationId(c);

    // Authenticate — read session without bumping lastSeenAt (SSE is passive).
    const sid = getSessionCookie(c, deps.config.session.cookieName);
    if (!sid) {
      return c.json(
        toAppErrorBody({
          code: "AUTH_EXPIRED",
          message: "Session expired or missing",
          httpStatus: 401,
          correlationId,
        }),
        401,
      );
    }

    const payload = await deps.sessionStore.get(sid);
    if (!payload) {
      return c.json(
        toAppErrorBody({
          code: "AUTH_EXPIRED",
          message: "Session expired or missing",
          httpStatus: 401,
          correlationId,
        }),
        401,
      );
    }

    const nowMs = Date.now();
    if (
      nowMs > payload.absoluteExpiresAt ||
      nowMs - payload.lastSeenAt > deps.config.session.idleSec * 1000
    ) {
      await deps.sessionStore.destroy(sid);
      return c.json(
        toAppErrorBody({
          code: "AUTH_EXPIRED",
          message: "Session expired or missing",
          httpStatus: 401,
          correlationId,
        }),
        401,
      );
    }

    // Hint nginx not to buffer this stream.
    c.header("X-Accel-Buffering", "no");

    return streamSSE(c, async (stream) => {
      let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

      const unsubscribe = subscribe(payload.sid, (event) => {
        stream
          .writeSSE({
            data: JSON.stringify(event),
            event: event.type,
          })
          .catch(() => {
            // Client disconnected mid-write — abort cleans up below.
          });
      });

      stream.onAbort(() => {
        unsubscribe();
        if (heartbeatTimer !== null) {
          clearInterval(heartbeatTimer);
          heartbeatTimer = null;
        }
      });

      // Initial connected event.
      await stream.writeSSE({
        data: JSON.stringify({
          type: "connected",
          sessionId: payload.sid,
          tenantId: payload.activeTenantId,
          at: new Date().toISOString(),
        }),
        event: "connected",
      });

      // Heartbeat: SSE comment line — not parsed as an event by the browser.
      heartbeatTimer = setInterval(() => {
        stream.write(": heartbeat\n\n").catch(() => {});
      }, HEARTBEAT_INTERVAL_MS);

      // Keep the stream open until the client disconnects.
      await new Promise<void>((resolve) => {
        stream.onAbort(resolve);
      });

      // Cleanup on normal promise resolution (stream closed from server side).
      unsubscribe();
      if (heartbeatTimer !== null) {
        clearInterval(heartbeatTimer);
      }
    });
  });
}

// Exported for tests — override heartbeat interval.
export { HEARTBEAT_INTERVAL_MS };
