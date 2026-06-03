import { Hono } from "hono";
import pino from "pino";
import { beforeEach, describe, expect, it } from "vitest";
import { contactId, roleId, tenantId, userId } from "@sdm/domain";
import { SdmHttpClient } from "../src/api/http-client";
import { createApiRoutesState, registerApiRoutes } from "../src/api/routes";
import { correlationMiddleware } from "../src/auth/correlation";
import { AppErrorException, toAppErrorBody } from "../src/auth/errors";
import type { RuntimeConfig } from "../src/config/schema";
import { createAuditEmitter } from "../src/platform/audit";
import { createSessionStore } from "../src/session";
import type { SessionPayload } from "../src/session/types";

/**
 * I.4 — KB write endpoint test matrix. Covers the 8+ cases the chunk plan
 * mandates:
 *
 *   1. create (POST /api/kb/articles) — 201 + audit `data.kd.write op=kb.create`.
 *   2. update (PATCH /api/kb/articles/:id) — 200 + audit `op=kb.update`.
 *   3. draft  (PATCH .../draft) — 200 with savedAt + audit `op=kb.draft`.
 *   4. publish (POST .../publish) — 200 + audit `op=kb.publish` + visibility carried in details.
 *   5. delete (DELETE .../:id) — 200 + audit `data.kd.delete op=kb.delete`.
 *   6. visibility validation — invalid → falls back to "tenant".
 *   7. server-side sanitization — `<script>` payload stripped before persist.
 *   8. audit shape — F.4 invariant: only `data.kd.{write,delete}` event names.
 *   9. permission deny — kb_editor session OK; kb-write without kb.write
 *      permission → 403 + AppError.
 *  10. NOT_FOUND on draft/publish for unknown id.
 */

const BASE = "http://test-sdm.local/caisd-rest";

function makeConfig(): RuntimeConfig {
  return {
    nodeEnv: "test",
    bff: { port: 5174, trustedOrigins: ["http://localhost:5500"], logLevel: "fatal" },
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

interface AuditMock {
  readonly calls: Array<{ event: string; details?: Record<string, unknown> }>;
}

const KB_EDITOR_SID = "kb-editor-sid";
const REQUESTER_SID = "requester-sid";

async function buildApi(): Promise<{ app: Hono; audit: AuditMock }> {
  const config = makeConfig();
  const log = pino({ level: "silent" });
  const sessionStore = createSessionStore({ driver: "memory" });
  const client = new SdmHttpClient(
    { baseUrl: BASE, requestTimeoutMs: 2000, maxRetries: 0 },
    { fetch: globalThis.fetch, log },
  );

  const now = Date.now();
  const baseSession = {
    activeTenantId: tenantId("default"),
    accessKey: "key",
    accessKeyId: "kid",
    accessKeyExpiresAt: now + 3600_000,
    createdAt: now,
    lastSeenAt: now,
    absoluteExpiresAt: now + 28800_000,
    cookieVersion: 1,
  };

  const editorPayload: SessionPayload = {
    sid: KB_EDITOR_SID,
    userId: userId("kb.jana"),
    contactId: contactId("U'JANA'"),
    displayName: "Jana, KB",
    email: "jana@example",
    tenants: [
      {
        id: tenantId("default"),
        name: "default",
        roles: [{ id: roleId("20002"), sym: "KbEditor", uiRole: "kb_editor" }],
      },
    ],
    ...baseSession,
  };
  await sessionStore.create(KB_EDITOR_SID, editorPayload, 28800);

  const requesterPayload: SessionPayload = {
    sid: REQUESTER_SID,
    userId: userId("lucia"),
    contactId: contactId("U'LUCIA'"),
    displayName: "Lucia",
    email: "lucia@example",
    tenants: [
      {
        id: tenantId("default"),
        name: "default",
        roles: [{ id: roleId("10001"), sym: "Requester", uiRole: "requester" }],
      },
    ],
    ...baseSession,
  };
  await sessionStore.create(REQUESTER_SID, requesterPayload, 28800);

  const calls: AuditMock["calls"] = [];
  const realAudit = createAuditEmitter({ log });
  const audit: typeof realAudit = (c, input, session) => {
    calls.push({ event: input.event, details: input.details });
    realAudit(c, input, session);
  };

  const app = new Hono();
  app.use("*", correlationMiddleware());
  registerApiRoutes(app, { client, sessionStore, config, log, audit }, createApiRoutesState());
  app.onError((err, c) => {
    if (err instanceof AppErrorException) {
      return c.json(
        toAppErrorBody({
          code: err.code,
          message: err.message,
          httpStatus: err.httpStatus,
        }),
        err.httpStatus as never,
      );
    }
    return c.json({ error: "internal_error" }, 500);
  });
  return { app, audit: { calls } };
}

function reqInit(method: string, sid: string, body?: unknown): RequestInit {
  return {
    method,
    headers: {
      Cookie: `sdm.sid=${sid}`,
      "Content-Type": "application/json",
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  };
}

describe("/api/kb/articles — write flow (I.4)", () => {
  let app: Hono;
  let audit: AuditMock;

  beforeEach(async () => {
    const built = await buildApi();
    app = built.app;
    audit = built.audit;
  });

  it("create returns 201 + emits data.kd.write op=kb.create", async () => {
    const res = await app.fetch(
      new Request(
        "http://bff/api/kb/articles",
        reqInit("POST", KB_EDITOR_SID, {
          title: "Reset VPN",
          body: "## Postup\n\nReštartuj klienta.",
          visibility: "tenant",
          tags: ["vpn", "reset"],
        }),
      ),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body["title"]).toBe("Reset VPN");
    expect(body["status"]).toBe("DRAFT");
    expect(body["visibility"]).toBe("tenant");
    const emit = audit.calls.find((c) => c.event === "data.kd.write");
    expect(emit).toBeDefined();
    expect(emit?.details?.["op"]).toBe("kb.create");
    expect(emit?.details?.["recordId"]).toBe(body["id"]);
  });

  it("update emits data.kd.write op=kb.update + applies field changes", async () => {
    const created = (await (
      await app.fetch(
        new Request(
          "http://bff/api/kb/articles",
          reqInit("POST", KB_EDITOR_SID, {
            title: "Old title",
            body: "first body",
          }),
        ),
      )
    ).json()) as { id: string };

    const res = await app.fetch(
      new Request(
        `http://bff/api/kb/articles/${encodeURIComponent(created.id)}`,
        reqInit("PATCH", KB_EDITOR_SID, {
          title: "New title",
          tags: ["vpn"],
        }),
      ),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body["title"]).toBe("New title");
    const emit = audit.calls.findLast(
      (c) => c.event === "data.kd.write" && c.details?.["op"] === "kb.update",
    );
    expect(emit).toBeDefined();
    expect(emit?.details?.["recordId"]).toBe(created.id);
  });

  it("draft save emits data.kd.write op=kb.draft + returns savedAt", async () => {
    const created = (await (
      await app.fetch(
        new Request(
          "http://bff/api/kb/articles",
          reqInit("POST", KB_EDITOR_SID, {
            title: "T",
            body: "draft body",
          }),
        ),
      )
    ).json()) as { id: string };

    const res = await app.fetch(
      new Request(
        `http://bff/api/kb/articles/${encodeURIComponent(created.id)}/draft`,
        reqInit("PATCH", KB_EDITOR_SID, { draftBody: "updated draft body" }),
      ),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(typeof body["savedAt"]).toBe("string");
    const emit = audit.calls.findLast(
      (c) => c.event === "data.kd.write" && c.details?.["op"] === "kb.draft",
    );
    expect(emit?.details?.["recordId"]).toBe(created.id);
  });

  it("publish flips status + emits data.kd.write op=kb.publish with visibility", async () => {
    const created = (await (
      await app.fetch(
        new Request(
          "http://bff/api/kb/articles",
          reqInit("POST", KB_EDITOR_SID, {
            title: "T",
            body: "draft",
            visibility: "tenant",
          }),
        ),
      )
    ).json()) as { id: string };

    const res = await app.fetch(
      new Request(
        `http://bff/api/kb/articles/${encodeURIComponent(created.id)}/publish`,
        reqInit("POST", KB_EDITOR_SID, { visibility: "public", tags: ["vpn"] }),
      ),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body["status"]).toBe("PUBLISHED");
    expect(body["visibility"]).toBe("public");
    expect(body["publishedAt"]).toBeTruthy();
    const emit = audit.calls.findLast(
      (c) => c.event === "data.kd.write" && c.details?.["op"] === "kb.publish",
    );
    expect(emit?.details?.["visibility"]).toBe("public");
  });

  it("delete emits data.kd.delete op=kb.delete", async () => {
    const created = (await (
      await app.fetch(
        new Request(
          "http://bff/api/kb/articles",
          reqInit("POST", KB_EDITOR_SID, {
            title: "T",
            body: "x",
          }),
        ),
      )
    ).json()) as { id: string };

    const res = await app.fetch(
      new Request(
        `http://bff/api/kb/articles/${encodeURIComponent(created.id)}`,
        reqInit("DELETE", KB_EDITOR_SID),
      ),
    );
    expect(res.status).toBe(200);
    const emit = audit.calls.find((c) => c.event === "data.kd.delete");
    expect(emit?.details?.["op"]).toBe("kb.delete");
  });

  it("invalid visibility falls back to tenant default", async () => {
    const res = await app.fetch(
      new Request(
        "http://bff/api/kb/articles",
        reqInit("POST", KB_EDITOR_SID, {
          title: "T",
          body: "x",
          visibility: "WHATEVER",
        }),
      ),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body["visibility"]).toBe("tenant");
  });

  it("server-side sanitization strips <script> + on-handlers before persist", async () => {
    const xss = '<p>safe</p><script>alert(1)</script><img src=x onerror="alert(2)">';
    const res = await app.fetch(
      new Request(
        "http://bff/api/kb/articles",
        reqInit("POST", KB_EDITOR_SID, {
          title: "X",
          body: xss,
        }),
      ),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { body: string };
    expect(body.body).not.toContain("<script");
    expect(body.body).not.toContain("onerror");
    expect(body.body).toContain("<p>safe</p>");
  });

  it("F.4 invariant — only data.kd.{write,delete} event names emitted", async () => {
    const created = (await (
      await app.fetch(
        new Request(
          "http://bff/api/kb/articles",
          reqInit("POST", KB_EDITOR_SID, {
            title: "T",
            body: "x",
          }),
        ),
      )
    ).json()) as { id: string };
    await app.fetch(
      new Request(
        `http://bff/api/kb/articles/${encodeURIComponent(created.id)}`,
        reqInit("PATCH", KB_EDITOR_SID, { title: "T2" }),
      ),
    );
    await app.fetch(
      new Request(
        `http://bff/api/kb/articles/${encodeURIComponent(created.id)}/publish`,
        reqInit("POST", KB_EDITOR_SID, {}),
      ),
    );
    await app.fetch(
      new Request(
        `http://bff/api/kb/articles/${encodeURIComponent(created.id)}`,
        reqInit("DELETE", KB_EDITOR_SID),
      ),
    );
    const events = new Set(audit.calls.map((c) => c.event));
    expect(events.has("data.kd.write")).toBe(true);
    expect(events.has("data.kd.delete")).toBe(true);
    for (const e of events) {
      const isWrite = e === "data.kd.write" || e === "data.kd.delete";
      const isOther = e.startsWith("authz.") || e.startsWith("auth.") || e.startsWith("security.");
      // Forbid net-new KB-specific event names like "kb.publish" emerging.
      if (!isWrite && !isOther) {
        expect(e.startsWith("kb.")).toBe(false);
      }
    }
  });

  it("permission gate — requester (no kb.write) → 403 AUTH_FORBIDDEN", async () => {
    const res = await app.fetch(
      new Request(
        "http://bff/api/kb/articles",
        reqInit("POST", REQUESTER_SID, {
          title: "T",
          body: "x",
        }),
      ),
    );
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("AUTH_FORBIDDEN");
    // No audit emit on permission deny (handled by the middleware before
    // the route body runs; same as other AUTH_FORBIDDEN paths).
    const kbWrites = audit.calls.filter((c) => c.event === "data.kd.write");
    expect(kbWrites).toHaveLength(0);
  });

  it("publish on unknown id → 404 NOT_FOUND", async () => {
    const res = await app.fetch(
      new Request(
        "http://bff/api/kb/articles/kb%3Adoes-not-exist/publish",
        reqInit("POST", KB_EDITOR_SID, {}),
      ),
    );
    expect(res.status).toBe(404);
  });
});

describe("/api/kb/analytics (I.4)", () => {
  it("returns fixture snapshot for kb_editor session", async () => {
    const { app } = await buildApi();
    const res = await app.fetch(
      new Request("http://bff/api/kb/analytics?range=30d", {
        method: "GET",
        headers: { Cookie: `sdm.sid=${KB_EDITOR_SID}` },
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { range: string; top: unknown[] };
    expect(body.range).toBe("30d");
    expect(Array.isArray(body.top)).toBe(true);
    expect(body.top.length).toBe(10);
  });

  it("denies access without kb.analytics permission", async () => {
    const { app } = await buildApi();
    const res = await app.fetch(
      new Request("http://bff/api/kb/analytics", {
        method: "GET",
        headers: { Cookie: `sdm.sid=${REQUESTER_SID}` },
      }),
    );
    expect(res.status).toBe(403);
  });
});
