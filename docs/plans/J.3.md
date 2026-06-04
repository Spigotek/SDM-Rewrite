# J.3 — Real-time tenant push via SSE (graduates I.3 next-API-call detection)

> **Status**: ✅ DONE (squash `0676d77`, PR #50)
> **Branch**: `chunk/J.3-sse-tenant-push` (deleted)
> **Outcome**: BFF `GET /api/events` Hono `streamSSE` endpoint + module-level event-bus
> (`apps/bff/src/platform/event-bus.ts`) keyed by sessionId. Emits two event types:
> `tenant.suspended` (admin-driven via new `POST /api/admin/tenants/:id/{suspend,unsuspend}`,
> gated by `tenant.admin` permission, audited under existing `authz.tenant.switch.denied` with
> `details.op` discriminator — F.4 taxonomy frozen) + `session.expired` (emitted before session
> destroy in F.1 middleware). Runtime override map `runtimeStatusOverrides` in
> `tenant-suspension.ts` is authoritative — `isActiveTenant` (post-merge fix `6fb08f3`) reads
> via `resolvedTenantStatus` so `filterActiveTenants` (/me, /me/tenants) + `assertTenantActive`
> (/me/active-tenant switch) honour admin-driven flips without session re-bootstrap.
> Heartbeat every 30 s via SSE comment. Stream-abort cleanup unsubscribes from bus + clears
> heartbeat. FE: `AppEventSource` (api-client, exponential backoff 1-30 s, no reconnect on
> `session.expired`) + `EventSourceProvider` wired into portal + workspace shells; on
> `tenant.suspended` for active tenant calls existing I.3 redirect /login + toast handler,
> for non-active tenant invalidates `/me/tenants` TanStack Query. MSW SSE handler + admin
> mirror for browser-test fixture seam. Browser test `j3-sse-tenant-push.spec.ts` (3 specs)
> verifies push delivery <5 s vs I.3 next-API-call up to 30 s. Bundle delta <2 KB initial
> (provider lazy after session bootstrap) — portal/workspace budgets unchanged. 26 new test
> cases (events.test.ts ×9, admin-tenants.test.ts ×9, event-source.test.ts ×7, browser ×3),
> 372/372 BFF tests + all CI checks green (acceptance × 3 browsers, lint+typecheck+test+build,
> CodeQL × 2, Trufflehog, helm-chart-lint, security browser scenarios). No new runtime deps
> (`streamSSE` in `hono/streaming` already transitive; EventSource native).
> **Cieľ**: replace I.3's "next-API-call detection" pattern for tenant suspension + session
> expiry with a push channel (Server-Sent Events) so the FE learns about state changes within
> seconds instead of waiting for the next user-initiated API call. SSE per prompt rec
> (half-duplex sufficient, Hono native `streamSSE` from `hono/streaming`, no new runtime deps,
> no WebSocket dep). I.3 next-API-call path stays as fallback when SSE is blocked (proxy /
> firewall / EventSource error).

## Pivot vs ROADMAP

J.md §C5 + ROADMAP entry J.3: "SSE-first via Hono `c.stream()` (WebSocket fallback if
insufficient); replaces I.3 next-API-call detection."

I.3 (PR #44) Open questions §1 ("real-time push WebSocket is v1+") + I.3 outcome line: "Tenant
suspension propagation: post-suspension users in mid-session don't get logout immediately —
next API call returns 403 → redirect /login. Acceptable for MVP; real-time push (WebSocket)
is v1+." — J.3 closes this exact follow-up.

**Scope boundary**: J.3 ships SSE _only_ for the two cases I.3 documented (tenant.suspended +
session.expired). It does NOT ship real-time queue updates, KB editor collaboration, or any
other channel — those are v2.0 scope per ROADMAP `v1+ scope` section.

## Inputs

- **`apps/bff/src/auth/tenant-suspension.ts`** — I.3 baseline (`tenantStatus`, `filterActiveTenants`,
  `assertTenantActive`). J.3 wires the event-bus emit into the suspension status-change site.
- **`apps/bff/src/session/`** — F.1 session store. J.3 needs `sessionId → SSE connection` map.
- **`apps/{portal,workspace}/src/shell/session-context.tsx`** — I.3 FE 403 handler. J.3 adds
  an EventSource subscriber that calls the same handlers when push arrives first.
- **`apps/bff/src/aggregator/me.ts`** — line 218 emits `details.reason: "tenant_suspended"`
  on `/me` — confirms the discriminator pattern J.3 will reuse for SSE events.
- **`packages/api-mocks/src/handlers/users.ts`** — I.3's MSW `TENANT_INITECH` suspended fixture
  - stateful `Map<userId, activeTenantId>`. J.3 needs a way to flip tenant status mid-test for
    the browser-test scenario; MSW handler exposes that.
- **`apps/bff/src/platform/audit/events.ts`** — frozen taxonomy reference (no new event names
  allowed; J.3 emits no new audit names — see Strategy §F.4 compliance below).
- **`hono` package** — `streamSSE` from `hono/streaming` (already a transitive dep; verify
  exact import path before write).
- **`docs/agents/architecture/decision-records/`** (if a related ADR exists; otherwise no-op).

## Outputs

```
apps/bff/src/platform/event-bus.ts                  # NEW: in-memory pub/sub. Map<sessionId, Set<Sink>>; publish() + subscribe() + unsubscribe()
apps/bff/src/api/events.ts                          # NEW: GET /api/events SSE handler (Hono streamSSE). Authenticated via requireActiveSession middleware.
apps/bff/src/auth/tenant-suspension.ts              # MOD: notifyTenantSuspended() helper publishes onto event-bus on status change (called from admin endpoint + MSW seam)
apps/bff/src/api/admin-tenants.ts                   # NEW: POST /api/admin/tenants/:id/suspend + /unsuspend (dev-only, gated by tenant.admin permission). Flips status, audits via existing authz.tenant.switch.denied with details.op="admin.tenant.suspend", then notifyTenantSuspended()
apps/bff/src/api/routes.ts                          # MOD: register /api/events + /api/admin/tenants/*
apps/bff/tests/events.test.ts                       # NEW: 8+ cases (connect, heartbeat, tenant.suspended delivery, session.expired delivery, unauthenticated → 401, disconnect cleanup, multi-tab same session, backpressure)
apps/bff/tests/admin-tenants.test.ts                # NEW: 6+ cases (suspend → emit event, permission gate, audit emit shape, MSW fixture compat)

packages/api-client/src/event-source.ts             # NEW: EventSourceClient class — opens /api/events, reconnect w/ backoff, dispatch typed events
packages/api-client/tests/event-source.test.ts      # NEW: 5+ cases (connect, reconnect, parse, close on session.expired, error handling)

apps/{portal,workspace}/src/shell/event-source.tsx  # NEW: useAppEventSource() hook + EventSourceProvider. Mounts at session-context boundary, dispatches to existing handlers.
apps/{portal,workspace}/src/shell/session-context.tsx  # MOD: consume EventSourceContext events (tenant.suspended → existing redirect /login + toast; session.expired → same)

packages/api-mocks/src/handlers/events.ts           # NEW: SSE handler for /api/events in MSW (browser-test scenarios). Streams via ReadableStream + text/event-stream.
packages/api-mocks/src/handlers/admin-tenants.ts    # NEW: MSW POST /api/admin/tenants/:id/suspend mirror — flips fixture state + emits via MSW event bus.

tools/browser-test/scenarios/j3-sse-tenant-push.spec.ts  # NEW: 2-3 cases
  # — admin suspends current user's active tenant → FE redirects /login within 5s (vs 30s polling)
  # — admin suspends non-active tenant → switcher updates in place (no logout)
  # — SSE blocked (simulated) → falls back to I.3 next-API-call detection still works

docs/agents/qa-test-strategy/acceptance-coverage.md # UPDATE: row "tenant-suspension" — push-delivery latency column flipped 30s → <5s
docs/ROADMAP.md                                     # J.3 ⏳ → ✅ DONE; Aktuálny stav updated
docs/plans/J.3.md                                   # Status NEXT → DONE; PR #
```

**No new runtime deps.** `streamSSE` is part of `hono/streaming` (already in BFF). EventSource
is native browser API.

## Done-when

- [ ] BFF `GET /api/events` SSE endpoint: - Requires active session (401 if no session cookie). - Sends initial `{type: "connected", sessionId, tenantId, at}` event on connect. - Heartbeat every 30 s (SSE comment line `: heartbeat\n\n` — keeps proxies / NLBs alive without polluting client event stream). - On `tenant.suspended` for any tenant in session's `allowedTenants[]`: emits `{type: "tenant.suspended", tenantId, reason, at}`. - On session expiry (any cause — idle, absolute, manual logout): emits `{type: "session.expired", at}` immediately before closing the stream. - Cleans up event-bus subscription on connection close (client disconnect, network drop, server-initiated close). - Returns `Connection: keep-alive` + `Content-Type: text/event-stream` + `Cache-Control: no-cache` + `X-Accel-Buffering: no` (nginx hint).
- [ ] `apps/bff/src/platform/event-bus.ts` — in-memory pub/sub keyed by `sessionId`. No persistence (intentional — multi-instance Redis pub/sub is v2.0; document limitation in BFF README or runtime-config doc).
- [ ] Admin endpoint `POST /api/admin/tenants/:id/suspend` + `/unsuspend`: - Gated by `tenant.admin` permission. 403 if missing. - Flips `tenantStatus` for the target tenant ID across all sessions whose `allowedTenants[]` includes it. - Calls `notifyTenantSuspended(tenantId, reason)` → event-bus publish. - Emits existing audit `authz.tenant.switch.denied` shape with `details.op="admin.tenant.suspend"` discriminator (NO new event name — composed under frozen F.4 taxonomy).
- [ ] FE `useAppEventSource()`: - Opens EventSource on mount (after session established). - Reconnect with exponential backoff (1 s, 2 s, 4 s, 8 s, max 30 s — capped). EventSource's built-in `retry:` is too aggressive on flaky networks; client-side backoff override via close+reopen. - On `tenant.suspended` for `session.activeTenantId` → call existing `handleTenantSuspended()` (redirect /login + toast). - On `tenant.suspended` for any other tenant → invalidate `/me/tenants` TanStack Query (switcher refreshes without logout). - On `session.expired` → call existing `handleSessionExpired()`. Do NOT reconnect after this event. - On EventSource `error` → fall back to I.3 next-API-call detection silently (no toast — invisible degradation).
- [ ] Browser-test scenario `j3-sse-tenant-push.spec.ts`: admin suspend → FE logout < 5 s (well under I.3's "next API call ≤ 30 s" measurement).
- [ ] BFF test coverage: - `events.test.ts`: ≥ 8 cases (connect, heartbeat, tenant.suspended delivery, session.expired delivery, unauthenticated → 401, disconnect cleanup, multi-tab same session, backpressure / slow client). - `admin-tenants.test.ts`: ≥ 6 cases (suspend happy, unsuspend happy, permission gate, audit emit shape, suspended-tenant-bus-publish, MSW fixture compat).
- [ ] `api-client/event-source.test.ts`: ≥ 5 cases.
- [ ] `acceptance-coverage.md`: `tenant-suspension` row push-delivery latency column updated.
- [ ] `pnpm i18n:check` green (no new keys — existing tenant suspension toast strings reused).
- [ ] Bundle budgets: portal ≤ 180 KB, workspace ≤ 350 KB (initial JS gzip). EventSource code lazy-loaded after session bootstrap → adds <2 KB to initial bundle.
- [ ] `pnpm typecheck` + `pnpm lint` + `pnpm test` + `pnpm build` all green on PR.
- [ ] CI green: ci.yml + acceptance.yml + security.yml.

## Stratégia

### Fáza A — BFF event-bus + SSE endpoint

1. **`apps/bff/src/platform/event-bus.ts`** — minimal pub/sub:

   ```ts
   type Sink = (event: BusEvent) => void;
   const subscribers = new Map<string, Set<Sink>>(); // key = sessionId

   export function subscribe(sessionId: string, sink: Sink): () => void {
     // returns unsubscribe fn
   }
   export function publishToSession(sessionId: string, event: BusEvent): void { ... }
   export function publishToAllSessionsWithTenant(tenantId: string, event: BusEvent): void { ... }
   export function publishSessionExpired(sessionId: string): void { ... }
   ```

2. **`apps/bff/src/api/events.ts`** — Hono handler:

   ```ts
   import { streamSSE } from "hono/streaming";

   app.get("/api/events", requireActiveSession, async (c) => {
     const session = c.get("session");
     return streamSSE(c, async (stream) => {
       const unsubscribe = subscribe(session.id, (evt) =>
         stream.writeSSE({
           data: JSON.stringify(evt),
           event: evt.type,
         }),
       );
       stream.onAbort(() => unsubscribe());

       await stream.writeSSE({
         data: JSON.stringify({
           type: "connected",
           sessionId: session.id,
           tenantId: session.activeTenantId,
           at: new Date().toISOString(),
         }),
         event: "connected",
       });

       const heartbeat = setInterval(() => stream.write(": heartbeat\n\n").catch(() => {}), 30_000);
       stream.onAbort(() => clearInterval(heartbeat));

       // keep promise pending until client disconnects
       await new Promise<void>((resolve) => stream.onAbort(resolve));
     });
   });
   ```

3. **`apps/bff/src/auth/tenant-suspension.ts` MOD** — add `notifyTenantSuspended(tenantId, reason)` that calls `publishToAllSessionsWithTenant(tenantId, {type: "tenant.suspended", tenantId, reason, at: nowIso()})`.
4. **`apps/bff/src/api/admin-tenants.ts` NEW** — `POST /api/admin/tenants/:id/suspend` + `/unsuspend`:
   - `requirePermission("tenant.admin")` middleware.
   - Flip in-memory tenant status (Map<tenantId, "active"|"suspended"> in tenant-suspension module).
   - `notifyTenantSuspended(...)`.
   - Audit emit `authz.tenant.switch.denied` with `details.op: "admin.tenant.suspend" | "admin.tenant.unsuspend"`, `details.target_tenant_id`, `details.actor_id`. F.4-compliant composition (no new event name).
5. **`apps/bff/src/api/routes.ts` MOD** — register `/api/events` + `/api/admin/tenants/*`.

### Fáza B — FE EventSource wiring

1. **`packages/api-client/src/event-source.ts` NEW** — typed wrapper:

   ```ts
   export type AppEvent =
     | { type: "connected"; sessionId: string; tenantId: string | null; at: string }
     | { type: "tenant.suspended"; tenantId: string; reason: string; at: string }
     | { type: "session.expired"; at: string };

   export class AppEventSource {
     constructor(opts: { url: string; onEvent: (e: AppEvent) => void; onError?: (e: Error) => void }) { ... }
     close(): void { ... }
   }
   ```

   Implementation: EventSource + reconnect backoff + JSON parse + dispatcher.

2. **`apps/{portal,workspace}/src/shell/event-source.tsx` NEW** — React provider:
   ```tsx
   export function EventSourceProvider({ children }: { children: ReactNode }) {
     const session = useSession();
     useEffect(() => {
       if (!session) return;
       const es = new AppEventSource({
         url: "/api/events",
         onEvent: (e) => {
           /* dispatch to session context */
         },
       });
       return () => es.close();
     }, [session?.id]);
     return <>{children}</>;
   }
   ```
3. **`apps/{portal,workspace}/src/shell/session-context.tsx` MOD** — wire event handlers:
   - `tenant.suspended` matching `session.activeTenantId` → `handleTenantSuspended()` (reuse I.3 redirect /login + toast).
   - `tenant.suspended` for non-active tenant in `session.allowedTenants[]` → `queryClient.invalidateQueries({queryKey: ["me", "tenants"]})`.
   - `session.expired` → `handleSessionExpired()`.
4. **Bundle**: `EventSourceProvider` mounted _after_ session bootstrap (no entry-bundle cost; loads via existing shell chunk). Verify size-limit JSON unchanged.

### Fáza C — MSW + tests

1. **`packages/api-mocks/src/handlers/events.ts`** — MSW SSE handler:
   ```ts
   http.get("/api/events", () => {
     const stream = new ReadableStream({
       start(ctrl) {
         ctrl.enqueue(new TextEncoder().encode(`event: connected\ndata: ${JSON.stringify({...})}\n\n`));
         // expose enqueue to test fixture so tests can flip tenant + push event
       }
     });
     return new Response(stream, { headers: { "Content-Type": "text/event-stream" } });
   });
   ```
2. **`packages/api-mocks/src/handlers/admin-tenants.ts`** — MSW mirror of BFF admin endpoint. Flips fixture state + pushes via MSW event bus (test fixture seam exposed for browser-test).
3. **BFF tests** — happy + edge cases per Done-when matrix.
4. **api-client tests** — fake EventSource + dispatch correctness + backoff timing (use vitest fake timers).
5. **Browser test `j3-sse-tenant-push.spec.ts`** — workspace persona = anna.analyst, target tenant = TENANT_INITECH (reused from I.3). Steps:
   - Login.
   - In a parallel context (admin), POST `/api/admin/tenants/TENANT_INITECH/suspend`.
   - Assert anna's tab redirects to `/login` within 5 s (Playwright `expect.toHaveURL` + 5 s timeout).
   - Assert toast "Tenant has been suspended" surfaces.

### Fáza D — Docs + PR

1. Update `docs/agents/qa-test-strategy/acceptance-coverage.md` — `tenant-suspension` row push-delivery latency column flipped.
2. PR `chore(realtime): SSE tenant suspension + session expiry push (J.3)`.
3. PR body summarises: scope (2 events), no new audit names, no new deps, fallback to I.3 next-API-call detection unchanged.
4. Subagent does NOT merge. Parent verifies CI + merges.

### Fáza E — Post-merge

Parent updates ROADMAP J.3 → ✅ DONE + J.4 NEXT + commit `docs(J.3): refresh PR # + status after merge`.

## Open questions / risks — recommended resolutions

- **SSE vs WebSocket** — SSE. Half-duplex sufficient (server → client only; admin actions
  travel through normal POST endpoints), zero new deps, simpler reconnect semantics. WebSocket
  upgrade overhead + heartbeat protocol + binary frame handling all unnecessary for 2 event
  types. WebSocket revisit only if a future channel (e.g. KB editor multi-user) needs
  bidirectional / binary — v2.0 scope.
- **Reconnect backoff** — client-side override of EventSource default (3 s fixed). Use 1, 2,
  4, 8, ..., 30 s cap. Reset to 1 s on successful reconnect. On `session.expired` event,
  close without reconnect (terminal state — user must re-login).
- **Multi-instance BFF** — out of MVP. Document in BFF README + J.3 PR body: "single-instance
  event bus only; for multi-instance deploys add Redis pub/sub adapter in v2.0". Acceptable —
  v1.0 deploy is single BFF replica per `values-staging.yaml` (`replicaCount: 1`).
- **Audit on SSE delivery** — NONE. Per prompt constraint "Žiadne nové audit event names —
  F.4 taxonomy frozen". The mutation that _causes_ the event (tenant suspension by admin)
  emits `authz.tenant.switch.denied` with `details.op="admin.tenant.suspend"` already —
  audit at source, not at delivery. Transport-layer events have no value for SIEM.
- **Connection ceiling per session** — none enforced in MVP. Browser caps EventSource at 6
  per origin over HTTP/1.1; HTTP/2 unlimited (multiplexed). Production nginx ingress in
  `deploy/helm/sdm/templates/ingress.yaml` should be reviewed for `proxy_read_timeout`
  (default 60 s breaks SSE without heartbeat); J.3 ships 30 s heartbeat which is below the
  default. Document.
- **Heartbeat interval** — 30 s (below typical proxy idle timeouts: nginx 60 s, AWS NLB 350 s,
  HAProxy 50 s default). Compromise between aliveness and bandwidth.
- **MSW SSE** — needs `ReadableStream` + manual `text/event-stream` writes. Verify MSW v2
  Node + browser builds both support `ReadableStream` response. If MSW doesn't, fall back to
  test-only direct EventSource opening against a tiny in-process Node SSE server (vitest
  setup). Subagent should verify before committing — document path chosen in PR body.
- **`tenant.admin` permission** — verify it exists in `packages/auth/src/permissions.ts` E.2
  baseline. If missing, add (composed under existing taxonomy; no new namespace). Likely
  already present under `sp_admin` role.
- **Backpressure** — if a single sink is slow (network buffer full), `stream.writeSSE` will
  block. For MVP: synchronous publish (drop event with `console.warn` if write throws). Each
  user has at most a handful of tabs; backpressure unlikely. Document.

## Notes pre subagenta

- **Subagent NESMIE**:
  - Pridať akýkoľvek nový audit event name (F.4 frozen — viď prompt + events.ts header).
  - Pridať WebSocket implementation alebo `ws` dep.
  - Implementovať Redis pub/sub adapter (v2.0 scope).
  - Pridať FE admin UI pre tenant suspend (out of MVP — BFF endpoint only).
  - Pridať real-time queue / KB editor / chat channels (v2.0 scope).
  - Mergovať vlastný PR.
- **Subagent musí**:
  - Use `streamSSE` from `hono/streaming` for the BFF SSE handler.
  - Verify `hono/streaming` import path before committing — if API differs from this plan, document the actual API in PR body.
  - Compose audit emit under existing taxonomy with `details.op` discriminator only.
  - Honour `requireActiveSession` middleware on `/api/events`.
  - Clean up event-bus subscription on stream abort (memory leak prevention — confirm with `events.test.ts` cleanup case).
  - Single PR commit, squash-friendly.
- **READ FIRST** (subagent should read these before editing):
  - `docs/plans/J.3.md` (this file) end-to-end
  - `apps/bff/src/auth/tenant-suspension.ts` (full file)
  - `apps/bff/src/aggregator/me.ts` lines 200-250 (existing tenant_suspended details.reason emit shape)
  - `apps/bff/src/platform/audit/events.ts` (frozen taxonomy)
  - `apps/{portal,workspace}/src/shell/session-context.tsx` (existing handlers to dispatch to)
  - `packages/api-mocks/src/handlers/users.ts` (TENANT_INITECH fixture)
  - `docs/plans/I.3.md` (baseline tenant suspension flow)
  - `hono/streaming` Hono module documentation (https://hono.dev/helpers/streaming)
