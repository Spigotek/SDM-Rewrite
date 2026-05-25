# BFF Failover & Session Recovery (MVP)

> Status: F.5 (Phase F exit). Operational doc for on-prem deploy: what happens
> when the BFF process restarts, how the SPA recovers, what is acceptable for
> MVP and what's deferred.

## TL;DR

- BFF session store is **in-memory single-instance** in MVP per
  `04 components/bff.md §2.2` (resolved in round 2). One BFF process holds the
  entire `Map<sid, SessionPayload>`.
- **BFF restart ⇒ full session loss ⇒ all SPAs re-login.** This is acceptable
  in MVP per `audit-and-compliance.md §8` — "users re-login on DR; sessions
  are ephemeral."
- Redis-backed session store (drop-in `SessionStore` adapter) is **deferred
  post-MVP** gating on `[08-devex-devops] session-store`. Trigger: horizontal
  scaling or in-flight rolling deploys without re-login UX cost.

## Observed behaviour

1. SPA holds the `__Host-sdm.sid` cookie (HttpOnly, `Path=/`, `SameSite=Lax`).
2. BFF process exits (deploy / crash / `systemctl restart sdm-bff`).
3. BFF restarts cold: empty `Map`. No persistence.
4. Next FE request hits BFF → `sid` cookie present, but `sessionStore.get(sid)`
   returns `null` → BFF responds **401 Unauthorized** (often with
   `reason="no_session"`).
5. SPA's `bootstrap/session.ts` sees the 401, throws `UnauthorizedError`,
   `SessionProvider` flips to `status: "anonymous"`, `AppShell` renders the
   `LoginPage` (per F.5 — `apps/{portal,workspace}/src/shell/login-page.tsx`).
6. User re-authenticates → BFF creates a new session → cookie rotates →
   normal operation resumes.

In-flight requests during the restart fail with 502/ECONNREFUSED briefly;
React Query / TanStack Query layers (added in Phase H) will retry per their
default policy. The shell itself does not retry — it relies on the user's
next interaction to surface the re-login.

## Acceptance criteria (MVP)

| Property | Status |
|---|---|
| Process exit ⇒ no data loss in CA SDM | ✅ — sessions are FE↔BFF only; CA SDM Access Keys are re-bootstrapped at next login. |
| BFF restart triggers re-login UX | ✅ — documented and tested via F.5 login form. |
| Active CA SDM `access_key`s linger on CA SDM until expiry | ⚠️ Known. BFF does **not** call `DELETE /caisd-rest/rest_access/<keyId>` on its own restart (no shutdown hook). Keys naturally expire per CA SDM policy. |
| Audit log captures restart-induced 401s | ✅ — emitted as `auth.unauthorized.no_session` once a request hits the cold BFF. |

## Deferred to post-MVP

| Concern | Trigger | Owner |
|---|---|---|
| Redis (or any KV) session store | Horizontal scaling — multi-replica BFF behind a load balancer | `08-devex-devops` |
| Graceful session migration during deploy | Zero-downtime rolling deploys with no re-login | `08-devex-devops` + `04-architecture` |
| BFF shutdown hook revoking outstanding CA SDM access keys | If CA SDM key-leak audit pressure rises | `05-security` |
| FE-side telemetry on `auth.client.idle.warning` | Sentry/RUM rollout (Phase G.3) — currently logged BFF-side only | `09-qa-test-strategy` |

## How to verify locally

1. Start BFF + portal in BFF mode:
   ```
   pnpm --filter @sdm/bff dev
   VITE_USE_MOCKS=false pnpm --filter @sdm/portal dev
   ```
2. Login via the form (real CA SDM creds in `SDM_BFF_SMOKE_*` env vars per
   `dev-handbook.md`).
3. While logged in, hit the BFF process: `Ctrl+C`, then restart it.
4. Click any UI element that triggers a request — the next 401 puts the SPA
   back at `/login`.
5. Re-login — normal operation resumes.

Cross-tab logout, idle modal, and heartbeat (auth-flow.md §2.4, §2.6) all
funnel through the same 401 → anonymous path, so the recovery flow is shared.

## Related

- `docs/agents/security/auth-flow.md` §2.4 idle, §2.6 cross-tab.
- `docs/agents/security/audit-and-compliance.md` §8 Backups & DR.
- `docs/agents/architecture/components/bff.md` §2.2 session store decision.
- `docs/plans/F.md` D2 (Redis deferred).
