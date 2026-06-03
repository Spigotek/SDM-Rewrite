import { Hono } from "hono";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import pino from "pino";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { contactId, roleId, tenantId, userId } from "@sdm/domain";
import type { UIRole } from "@sdm/domain";
import { SdmHttpClient } from "../../src/api/http-client";
import { createApiRoutesState, registerApiRoutes } from "../../src/api/routes";
import { correlationMiddleware } from "../../src/auth/correlation";
import { AppErrorException, toAppErrorBody } from "../../src/auth/errors";
import type { RuntimeConfig } from "../../src/config/schema";
import { createAuditEmitter } from "../../src/platform/audit";
import { createSessionStore } from "../../src/session";
import type { SessionPayload } from "../../src/session/types";

/**
 * I.2 — RBAC server-side enforcement matrix.
 *
 * `acceptance-criteria.md §4.4` `rbac-server-side-enforcement`. The BFF
 * does *not* currently issue an explicit `requirePermission(...)` check
 * per endpoint — server-side authorization flows transitively through
 * the CA SDM AccessKey (each session's key is scoped to that user's
 * tenant + role mapping in CA SDM). Defense-in-depth lives at three
 * layers:
 *
 *   1. **Authentication boundary** — every mutating handler calls
 *      `requireActiveSession()` (via `requireActiveSession` or the proxy
 *      chain). Missing session cookie → 401 `AUTH_EXPIRED`.
 *   2. **Tenant scoping** — `WC=tenant=…` injection + body match (covered
 *      in `tenant-isolation-sweep.test.ts`).
 *   3. **Step-up gate** — EMERGENCY changes require `X-Step-Up-Token`
 *      regardless of which role minted the session.
 *
 * This sweep verifies (1) + (3) for every persona × representative
 * mutation endpoint. The audit-event `actor.uiRole` must match the
 * session's role so SIEM can correlate "who did what" without
 * cross-referencing the session store. (1) ensures an unauthenticated
 * caller can't bypass the FE Can-guard via direct URL hits.
 *
 * Per-permission `requirePermission(...)` matrix lands in a future
 * chunk (R-T-XX) — that requires the BFF to map CA SDM role → app
 * permission set, which is currently FE-only (`@sdm/auth` package). The
 * deferred row in `acceptance-coverage.md §4.4` tracks that gap. This
 * file covers the cross-cutting invariant that EVERY mutation requires
 * a session, regardless of role.
 */

const BASE = "http://test-sdm.local/caisd-rest";

const PERSONAS: ReadonlyArray<{
  username: string;
  uiRole: UIRole;
  roleSym: string;
  roleIdStr: string;
}> = [
  { username: "anna.analyst", uiRole: "agent_l1", roleSym: "agent_l1", roleIdStr: "10001" },
  { username: "marek.manager", uiRole: "agent_l2", roleSym: "agent_l2", roleIdStr: "10002" },
  {
    username: "cyril.change",
    uiRole: "change_manager",
    roleSym: "change_manager",
    roleIdStr: "20001",
  },
  { username: "jana.kb", uiRole: "kb_editor", roleSym: "kb_editor", roleIdStr: "30001" },
  { username: "robert.cmdb", uiRole: "cmdb_owner", roleSym: "cmdb_owner", roleIdStr: "40001" },
  { username: "lucia.requester", uiRole: "requester", roleSym: "requester", roleIdStr: "50001" },
  { username: "sp.admin", uiRole: "sp_admin", roleSym: "sp_admin", roleIdStr: "60001" },
];

const MUTATION_ENDPOINTS: ReadonlyArray<{
  name: string;
  method: "POST" | "PUT" | "DELETE";
  path: string;
  body?: object;
  upstreamFactory?: string;
  successStatus: number;
}> = [
  {
    name: "incidents.create",
    method: "POST",
    path: "/api/incidents",
    body: { summary: "rbac-probe", customerId: "U'CNT'" },
    upstreamFactory: "in",
    successStatus: 201,
  },
  {
    name: "incidents.update",
    method: "PUT",
    path: "/api/incidents/2800",
    body: { summary: "updated" },
    upstreamFactory: "in",
    successStatus: 200,
  },
  {
    name: "incidents.delete",
    method: "DELETE",
    path: "/api/incidents/2800",
    upstreamFactory: "in",
    successStatus: 200,
  },
  {
    name: "changes.approve",
    method: "POST",
    path: "/api/changes/CHG-001/approve",
    body: { approverId: "user-1" },
    successStatus: 200,
  },
  {
    name: "changes.reject",
    method: "POST",
    path: "/api/changes/CHG-001/reject",
    body: { approverId: "user-1", reason: "regression" },
    successStatus: 200,
  },
  {
    name: "problems.create",
    method: "POST",
    path: "/api/problems",
    body: { summary: "rbac-probe", customerId: "U'CNT'" },
    upstreamFactory: "pr",
    successStatus: 201,
  },
  {
    name: "kb.create",
    method: "POST",
    path: "/api/kb",
    body: { title: "rbac-probe", summary: "rbac-probe", customerId: "U'CNT'" },
    upstreamFactory: "KD",
    successStatus: 201,
  },
];

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

interface AuditCall {
  readonly event: string;
  readonly result: string;
  readonly actor?: Partial<{ uiRole: string | null; userId: string | null }>;
}

async function buildApiForPersona(persona: {
  username: string;
  uiRole: UIRole;
  roleSym: string;
  roleIdStr: string;
}): Promise<{ app: Hono; sid: string; audit: AuditCall[] }> {
  const config = makeConfig();
  const log = pino({ level: "silent" });
  const sessionStore = createSessionStore({ driver: "memory" });
  const client = new SdmHttpClient(
    { baseUrl: BASE, requestTimeoutMs: 2000, maxRetries: 0 },
    { fetch: globalThis.fetch, log },
  );
  const sid = `rbac-${persona.username}`;
  const now = Date.now();
  const payload: SessionPayload = {
    sid,
    userId: userId(persona.username),
    contactId: contactId(`U'${persona.username.toUpperCase()}'`),
    displayName: persona.username,
    email: `${persona.username}@example`,
    activeTenantId: tenantId("default"),
    tenants: [
      {
        id: tenantId("default"),
        name: "default",
        roles: [{ id: roleId(persona.roleIdStr), sym: persona.roleSym, uiRole: persona.uiRole }],
      },
    ],
    accessKey: "key",
    accessKeyId: "kid",
    accessKeyExpiresAt: now + 3600_000,
    createdAt: now,
    lastSeenAt: now,
    absoluteExpiresAt: now + 28800_000,
    cookieVersion: 1,
  };
  await sessionStore.create(sid, payload, 28800);

  const auditCalls: AuditCall[] = [];
  const realAudit = createAuditEmitter({ log });
  const audit: typeof realAudit = (c, input, session) => {
    auditCalls.push({
      event: input.event,
      result: input.result,
      actor: session
        ? {
            uiRole:
              session.tenants.find((t) => t.id === session.activeTenantId)?.roles[0]?.uiRole ??
              null,
            userId: session.userId,
          }
        : undefined,
    });
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
  return { app, sid, audit: auditCalls };
}

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function withUpstreamPassthrough(factory: string | undefined): void {
  if (!factory) return;
  server.use(
    http.post(
      `${BASE}/${factory}`,
      () =>
        new HttpResponse(JSON.stringify({ [factory]: { "@id": 999 } }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        }),
    ),
    http.put(`${BASE}/${factory}/:id`, () =>
      HttpResponse.json({ [factory]: { "@id": 999 } }, { status: 200 }),
    ),
    http.delete(`${BASE}/${factory}/:id`, () =>
      HttpResponse.json({ [factory]: { "@id": 999 } }, { status: 200 }),
    ),
  );
}

function fetchOpts(method: string, body: object | undefined, cookie: string | null): RequestInit {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cookie) headers["Cookie"] = cookie;
  return {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  };
}

describe("RBAC server-side — every mutation requires authentication", () => {
  for (const ep of MUTATION_ENDPOINTS) {
    it(`${ep.name} (${ep.method} ${ep.path}) without session cookie → 401 AUTH_EXPIRED`, async () => {
      withUpstreamPassthrough(ep.upstreamFactory);
      const { app } = await buildApiForPersona(PERSONAS[0]!);
      const res = await app.fetch(
        new Request(`http://bff${ep.path}`, fetchOpts(ep.method, ep.body, null)),
      );
      expect(res.status).toBe(401);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe("AUTH_EXPIRED");
    });
  }
});

describe("RBAC server-side — audit actor uiRole tagging per persona", () => {
  for (const persona of PERSONAS) {
    it(`${persona.username} (${persona.uiRole}) — incidents.create audit tags actor.uiRole correctly`, async () => {
      server.use(
        http.post(
          `${BASE}/in`,
          () =>
            new HttpResponse(JSON.stringify({ in: { "@id": 999 } }), {
              status: 201,
              headers: { "Content-Type": "application/json" },
            }),
        ),
      );
      const { app, sid, audit } = await buildApiForPersona(persona);
      const res = await app.fetch(
        new Request(`http://bff/api/incidents`, {
          method: "POST",
          headers: { Cookie: `sdm.sid=${sid}`, "Content-Type": "application/json" },
          body: JSON.stringify({ summary: "x", customerId: "U'CNT'" }),
        }),
      );
      expect(res.status).toBe(201);
      const emit = audit.find((c) => c.event === "data.in.write");
      expect(emit).toBeDefined();
      expect(emit?.actor?.uiRole).toBe(persona.uiRole);
      expect(emit?.actor?.userId).toBe(persona.username);
    });
  }
});

describe("RBAC server-side — EMERGENCY step-up gate is role-agnostic (defense in depth)", () => {
  // Every role that *could* approve a change (incl. roles the FE wouldn't
  // surface the button to) still hits the step-up gate when category is
  // EMERGENCY. The FE Can-guard is a UX affordance only; the server cannot
  // trust it. We assert: with no token, EMERGENCY approve always rejects.
  for (const persona of PERSONAS) {
    it(`${persona.username} (${persona.uiRole}) — EMERGENCY approve without token → 401 STEP_UP_REQUIRED`, async () => {
      const { app, sid } = await buildApiForPersona(persona);
      const res = await app.fetch(
        new Request(`http://bff/api/changes/CHG-001/approve`, {
          method: "POST",
          headers: { Cookie: `sdm.sid=${sid}`, "Content-Type": "application/json" },
          body: JSON.stringify({ approverId: "user-1", category: "EMERGENCY" }),
        }),
      );
      expect(res.status).toBe(401);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe("STEP_UP_REQUIRED");
    });
  }
});
