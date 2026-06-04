/**
 * J.3 — GET /api/events SSE endpoint tests.
 *
 * 8+ cases per Done-when:
 *  1. Connect → 401 when no session cookie.
 *  2. Connect → 401 when session not found in store.
 *  3. Connect → streams `connected` event on valid session.
 *  4. SSE event-bus subscription cleaned up on abort (memory leak prevention).
 *  5. `tenant.suspended` event delivered to subscribed session.
 *  6. `session.expired` event delivered to subscribed session.
 *  7. Multiple subscribers on same session (multi-tab) both receive events.
 *  8. Expired session (idle) → 401 before stream opens.
 *  9. X-Accel-Buffering: no header is set.
 */

import { Hono } from "hono";
import pino from "pino";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { contactId, roleId, tenantId, userId } from "@sdm/domain";
import { correlationMiddleware } from "../src/auth/correlation";
import type { RuntimeConfig } from "../src/config/schema";
import { publishToSession, subscriberCount } from "../src/platform/event-bus";
import { registerEventsRoute } from "../src/api/events";
import { createSessionStore } from "../src/session";
import type { SessionPayload, SessionStore } from "../src/session/types";

const SID = "events-test-sid";
const COOKIE = `sdm.sid=${SID}`;

function makeConfig(): RuntimeConfig {
  return {
    nodeEnv: "test",
    bff: { port: 5180, trustedOrigins: ["http://localhost:5500"], logLevel: "silent" },
    casdm: {
      baseUrl: "http://test-sdm.local/caisd-rest",
      basicAuthUser: "u",
      basicAuthPass: "p",
      requestTimeoutMs: 2000,
    },
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

function makePayload(overrides: Partial<SessionPayload> = {}): SessionPayload {
  const now = Date.now();
  return {
    sid: SID,
    userId: userId("vueuser"),
    contactId: contactId("CNT001"),
    displayName: "Vue User",
    email: "vue@example.com",
    activeTenantId: tenantId("acme"),
    tenants: [
      {
        id: tenantId("acme"),
        name: "Acme",
        roles: [{ id: roleId("r1"), sym: "sp_admin", uiRole: "sp_admin" }],
        status: "active",
      },
    ],
    accessKey: "key-abc",
    accessKeyId: "kid-001",
    accessKeyExpiresAt: now + 3600_000,
    createdAt: now,
    lastSeenAt: now,
    absoluteExpiresAt: now + 28800_000,
    cookieVersion: 1,
    ...overrides,
  };
}

async function buildApp(sessionStore: SessionStore) {
  const config = makeConfig();
  const log = pino({ level: "silent" });
  const app = new Hono();
  app.use("*", correlationMiddleware());
  registerEventsRoute(app, { config, sessionStore, log });
  return app;
}

describe("GET /api/events", () => {
  let sessionStore: SessionStore;

  beforeEach(async () => {
    sessionStore = createSessionStore({ driver: "memory" });
  });

  afterEach(async () => {
    await sessionStore.close();
  });

  it("1. returns 401 when no session cookie", async () => {
    const app = await buildApp(sessionStore);
    const res = await app.fetch(new Request("http://bff/api/events"));
    expect(res.status).toBe(401);
  });

  it("2. returns 401 when session not found in store", async () => {
    const app = await buildApp(sessionStore);
    const res = await app.fetch(
      new Request("http://bff/api/events", { headers: { Cookie: COOKIE } }),
    );
    expect(res.status).toBe(401);
  });

  it("3. streams connected event on valid session", async () => {
    await sessionStore.create(SID, makePayload(), 28800);
    const app = await buildApp(sessionStore);

    const res = await app.fetch(
      new Request("http://bff/api/events", { headers: { Cookie: COOKIE } }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");

    // Read just the first chunk (connected event) then abort.
    const reader = res.body?.getReader();
    expect(reader).toBeDefined();

    const { value } = await reader!.read();
    const text = new TextDecoder().decode(value);
    expect(text).toContain("event: connected");
    expect(text).toContain('"type":"connected"');
    expect(text).toContain(SID);

    reader!.cancel();
  });

  it("4. unsubscribes on stream abort — no subscriber leak", async () => {
    await sessionStore.create(SID, makePayload(), 28800);
    const app = await buildApp(sessionStore);

    const res = await app.fetch(
      new Request("http://bff/api/events", { headers: { Cookie: COOKIE } }),
    );
    const reader = res.body?.getReader();
    await reader!.read(); // read connected event
    const before = subscriberCount();
    expect(before).toBeGreaterThan(0);
    reader!.cancel();

    // Give the stream abort callback a tick to fire.
    await new Promise<void>((r) => setTimeout(r, 10));
    expect(subscriberCount()).toBe(0);
  });

  it("5. tenant.suspended event delivered to subscribed session", async () => {
    await sessionStore.create(SID, makePayload(), 28800);
    const app = await buildApp(sessionStore);

    const res = await app.fetch(
      new Request("http://bff/api/events", { headers: { Cookie: COOKIE } }),
    );
    const reader = res.body?.getReader();
    await reader!.read(); // discard connected

    // Publish a tenant.suspended event via the event bus directly.
    publishToSession(SID, {
      type: "tenant.suspended",
      tenantId: "acme",
      reason: "admin.tenant.suspend",
      at: new Date().toISOString(),
    });

    const { value } = await reader!.read();
    const text = new TextDecoder().decode(value);
    expect(text).toContain("event: tenant.suspended");
    expect(text).toContain('"type":"tenant.suspended"');
    expect(text).toContain('"tenantId":"acme"');

    reader!.cancel();
  });

  it("6. session.expired event delivered to subscribed session", async () => {
    await sessionStore.create(SID, makePayload(), 28800);
    const app = await buildApp(sessionStore);

    const res = await app.fetch(
      new Request("http://bff/api/events", { headers: { Cookie: COOKIE } }),
    );
    const reader = res.body?.getReader();
    await reader!.read(); // discard connected

    publishToSession(SID, {
      type: "session.expired",
      at: new Date().toISOString(),
    });

    const { value } = await reader!.read();
    const text = new TextDecoder().decode(value);
    expect(text).toContain("event: session.expired");
    expect(text).toContain('"type":"session.expired"');

    reader!.cancel();
  });

  it("7. multiple subscribers on same session receive same event (multi-tab)", async () => {
    await sessionStore.create(SID, makePayload(), 28800);
    const app = await buildApp(sessionStore);

    const res1 = await app.fetch(
      new Request("http://bff/api/events", { headers: { Cookie: COOKIE } }),
    );
    const res2 = await app.fetch(
      new Request("http://bff/api/events", { headers: { Cookie: COOKIE } }),
    );

    const r1 = res1.body!.getReader();
    const r2 = res2.body!.getReader();
    await r1.read(); // discard connected
    await r2.read(); // discard connected

    publishToSession(SID, {
      type: "session.expired",
      at: new Date().toISOString(),
    });

    const [{ value: v1 }, { value: v2 }] = await Promise.all([r1.read(), r2.read()]);
    expect(new TextDecoder().decode(v1)).toContain("session.expired");
    expect(new TextDecoder().decode(v2)).toContain("session.expired");

    r1.cancel();
    r2.cancel();
  });

  it("8. expired session (idle) → 401 before stream opens", async () => {
    const stalePayload = makePayload({
      lastSeenAt: Date.now() - 7200_000, // 2h ago — well past idleSec=1800
    });
    await sessionStore.create(SID, stalePayload, 28800);
    const app = await buildApp(sessionStore);

    const res = await app.fetch(
      new Request("http://bff/api/events", { headers: { Cookie: COOKIE } }),
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("AUTH_EXPIRED");
  });

  it("9. X-Accel-Buffering: no header is set on SSE response", async () => {
    await sessionStore.create(SID, makePayload(), 28800);
    const app = await buildApp(sessionStore);

    const res = await app.fetch(
      new Request("http://bff/api/events", { headers: { Cookie: COOKIE } }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("x-accel-buffering")).toBe("no");
    res.body?.cancel();
  });
});
