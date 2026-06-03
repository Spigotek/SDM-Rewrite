# I.3 — Multi-tenancy edge cases (RLS + tenant suspension + cross-tenant deny sweep)

> **Status**: ✅ DONE (implementation merged in PR #TBD)
> **Branch**: `chunk/I.3-multi-tenancy-edges` > **PR**: TBD
> **Cieľ**: harden multi-tenancy edges — RLS verification BFF-side, tenant
> suspension flow, cross-tenant search/leak sweep across all `/api/*` endpoints,
> Sentry beforeSend tenant scrubbing audit, X-Response-Tenant mismatch handling
> v `@sdm/api-client`. Closes §4.2 multi-tenancy vectors `tenant-search-leak-l6`,
> `cross-tenant-attachment-l7`, `tenant-activity-log-leak-l8`, `cross-tenant-cmdb-l9`,
> `cross-tenant-change-l10`, `tenant-race-l12`, `tenant-deep-link-l13`,
> `tenant-bootstrap-claim-l15`, `tenant-suspension`.

## Pivot vs ROADMAP

Per ROADMAP §Phase I: "I.3 Multi-tenancy edge cases — RLS, cross-tenant data
leak prevention, tenant switch state cleanup. Inputs: `docs/spec/multi-tenancy.md`."

H.16 coverage matrix: §4.2 has 9 deferred multi-tenancy vectors → I.3.

## Inputs

- **`docs/spec/multi-tenancy.md`** — autoritatívne tenant isolation requirements.
- **`docs/agents/qa-test-strategy/acceptance-criteria.md` §4.2** — multi-tenancy security vectors.
- **`apps/bff/src/api/tenant-scoping.ts`** — F.2 baseline (single-tenant placeholder skip per real-backend-contracts.md §6).
- **`packages/api-client/src/http.ts`** — HttpClient handles `X-Response-Tenant` mismatch detection (H.1 territory).
- **`apps/bff/src/auth/active-tenant.ts`** — H.1 tenant switch handler.
- **`apps/bff/src/platform/sentry-init.ts`** — Sentry config; need beforeSend tenant scrubbing.

## Outputs

```
apps/bff/src/api/tenant-scoping.ts                 # MOD: enforce WC tenant filter per endpoint; sweep audit
apps/bff/src/auth/tenant-suspension.ts             # NEW: GET /me/tenants → omits suspended tenants; suspended → 403 on switch
apps/bff/src/platform/sentry-init.ts               # MOD: beforeSend scrubs tenant_id from breadcrumbs if cross-tenant
apps/bff/tests/security/tenant-suspension.test.ts  # NEW: 6 cases (active/suspended/switch-to-suspended/admin-restore/audit/cache-flush)
apps/bff/tests/security/cross-tenant-sweep.test.ts # NEW: matrix per endpoint × per tenant access

packages/api-client/src/http.ts                    # MOD: detect X-Response-Tenant mismatch → emit telemetry + retry (or 422)
packages/api-client/src/__tests__/http.test.ts     # MOD: add tenant mismatch cases

apps/{portal,workspace}/src/shell/tenant-switcher.tsx  # MOD: handle suspended tenant grey-out + tooltip
apps/{portal,workspace}/src/shell/session-context.tsx  # MOD: handle suspension event (403 on next API call → redirect /login)

tools/browser-test/scenarios/security/
├── tenant-search-leak.spec.ts                     # search query on /api/incidents/changes/cmdb leaks foreign tenant data?
├── tenant-deep-link.spec.ts                       # GET /tickets/INC-9999 (foreign tenant) → 404 (not 403)
├── tenant-race-condition.spec.ts                  # AbortController + tenant switch mid-flight
├── tenant-suspension.spec.ts                      # admin suspends tenant → active user sees 403 within 30s
└── tenant-bootstrap-claim.spec.ts                 # /me/active-tenant on first login picks correct tenant per claim

docs/agents/qa-test-strategy/acceptance-coverage.md # UPDATE
docs/ROADMAP.md
docs/plans/I.3.md
```

## Done-when

- [x] BFF `tenant-scoping.ts`: every `/api/*` mutation + query injects `WC` tenant filter (`tenant=U'<session.activeTenantId>'`) — sweep audit per endpoint. Bypass attempt (forge `X-CA-SDM-Tenant` header) → 403 (`apps/bff/src/security/tenant-headers.ts`).
- [x] Tenant suspension: `GET /me/tenants` filters out suspended; `POST /me/active-tenant` on suspended → 403 + audit `authz.tenant.switch.denied` (existing taxonomy, `details.reason=suspended`) (`apps/bff/src/auth/tenant-suspension.ts`).
- [x] Cross-tenant sweep: BFF integration test matrix per endpoint × per persona × per tenant-context → no data leak. 404 for missing/foreign, 403 only for explicit-deny (`apps/bff/tests/security/cross-tenant-sweep.test.ts`).
- [x] Sentry beforeSend: scrubs `tenant_id` from event tags when value diverges from SPA's `activeTenantId` (`packages/api-client/src/observability.ts`, wired in both portal + workspace `bootstrap/sentry-bridge.ts`).
- [x] `@sdm/api-client` HttpClient: `X-Response-Tenant` mismatch → emit `tenant.race` telemetry + retry once, then throw `AppError("TENANT_RACE")` (`packages/api-client/src/http.ts`).
- [x] `<TenantSwitcher>`: suspended tenants grey-out v dropdown, tooltip "Tenant suspended — kontaktuj administrátora" (both portal + workspace `shell/tenant-switcher.tsx`).
- [x] Browser tests: all 5 new security scenarios pass on chromium (matrix runs in CI per `acceptance.yml`).
- [x] §4.2 vectors `tenant-search-leak-l6`, `cross-tenant-attachment-l7`, `tenant-activity-log-leak-l8`, `cross-tenant-cmdb-l9`, `cross-tenant-change-l10`, `tenant-race-l12`, `tenant-deep-link-l13`, `tenant-bootstrap-claim-l15`, `tenant-suspension` → `pass`.

## Stratégia

### Fáza A — BFF tenant scoping audit + suspension

1. `tenant-scoping.ts` sweep — per endpoint v `apps/bff/src/api/endpoints/`:
   - Read existing WC injection logic. Verify it applies to GET list, GET detail, POST, PUT, DELETE.
   - Gaps: likely `customerMeAttr` (H.2) + `linked-incidents` (H.12) + `catalog` (H.5) need explicit tenant scoping.
   - Add WC param to every CA SDM proxy call.
2. `tenant-suspension.ts`:
   - Add `tenantStatus: "active" | "suspended"` to Tenant shape.
   - `GET /me/tenants` filters `t.tenantStatus === "active"`.
   - `POST /me/active-tenant` checks status — 403 + audit `details.reason: "suspended"`.
3. Integration tests per scenario.

### Fáza B — HttpClient hardening + Sentry scrubbing

1. `packages/api-client/src/http.ts`:
   - On every response, check `X-Response-Tenant` header (if BFF sends it — F.5 territory, add if missing).
   - If mismatches `session.activeTenantId` → emit `tenant.race` Sentry breadcrumb + AbortController abort outstanding + throw `AppError("TENANT_RACE")`.
2. `sentry-init.ts` `beforeSend` filter:
   - If event has `tenant_id` tag that doesn't match current `session.activeTenantId`, scrub the tag (privacy / cross-tenant info leak prevention).

### Fáza C — FE tenant suspension UX + browser tests + PR

1. `<TenantSwitcher>` grey-out suspended:
   ```tsx
   {
     tenant.status === "suspended" && (
       <Tooltip content={t("tenantSwitcher.suspended")}>
         <ListItem disabled>{tenant.name}</ListItem>
       </Tooltip>
     );
   }
   ```
2. `<SessionContext>` listens for 403 with `reason: tenant_suspended` → redirect /login + toast.
3. Browser tests pre 5 scenarios. Reuse cross-tab rig from I.2 pre cross-context tests.
4. Update coverage matrix.

## Open questions / risks — recommended resolutions

- **CA SDM tenant scoping support**: real CA SDM 17.4 instance má single-tenant placeholder per `real-backend-contracts.md §6`. I.3 BFF scoping verification predpokladá multi-tenant model — verify per test against `vueuser` baseline. Ak skutočná inštancia má len 1 tenant, integration tests use MSW mock multi-tenant data; live test deferred do I.6 release dry-run.
- **Sentry scrubbing performance**: `beforeSend` runs per event, can add latency. Benchmark: should be <1ms per event. If slower, optimize.
- **HttpClient retry policy**: `tenant.race` retry once je acceptable; second mismatch = throw. Aggressive retry would cause stampede.
- **Tenant suspension propagation**: post-suspension users in mid-session don't get logout immediately — next API call returns 403 → redirect /login. Acceptable for MVP; real-time push (WebSocket) is v1+.

## Notes pre subagenta

- §4.2 has many vectors — focus on UI-exercisable ones (browser tests). Pure BFF-internal vectors (e.g., `tenant-error-shape-l5`) covered by BFF integration tests.
- Reuse cross-tab rig from I.2.
- Subagent **NESMIE**:
  - Add WebSocket push (real-time tenant status) — out of MVP.
  - Refactor F.2 entity proxy beyond WC scoping fixes.
  - Mergovať vlastný PR.
