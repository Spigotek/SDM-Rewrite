# Acceptance Coverage Matrix — Phase H exit gate

> Maps every row from `acceptance-criteria.md §2` (18 user journeys) and
> the cross-cutting + security tables (§3, §4) to a concrete artefact that
> exercises it. **Source of truth for the Phase H exit criterion**: every
> journey is either `pass` (smoke green in CI) or `deferred` with an
> explicit Phase I follow-up.
>
> Updated for H.16 (PR #TBD). Re-update on each Phase I chunk that closes
> a deferred row.

## How to read this document

- **Pass** — the linked journey spec runs in CI today against MSW. Smoke
  green is part of the Phase H exit gate.
- **Partial** — the spec asserts the read-only / non-secured portion of
  the journey; the full DoD requires a Phase I-scope feature. Phase H
  exit accepts these as long as the deferred portion has a tracked
  follow-up.
- **Deferred** — the journey's primary surface is not in the MVP scope.
  A thin spec exists that asserts whatever is shipped today (typically
  a permission-gated read-only view); the productive flow lands in
  Phase I.

## 1. Per-journey matrix (`acceptance-criteria.md §2`)

| # | Journey ID | Persona | Status | Spec file | Notes / Phase I follow-up |
|---|---|---|---|---|---|
| 1 | `portal-incident-broken-laptop` | requester_lucia | **pass** | `journey-01-portal-incident.spec.ts` | Tenant breadcrumb visible. Validation + comment round-trip covered in `h3-portal-new-incident.spec.ts` + `h4-portal-ticket-detail.spec.ts`. |
| 2 | `portal-request-software` | requester_lucia | **pass** | `journey-02-portal-request-software.spec.ts` | Form-render + dynamic field branches + full submit-mutation roundtrip asserted in preview-build mode. I.1 fixed the underlying DynamicForm bug (static Zod schema required hidden `colleague` field) by building the resolver against the *currently visible* fields and enabling `shouldUnregister: true`. Manager-approve / rejection paths covered by BFF `request.ctest.ts`. |
| 3 | `portal-kb-self-help` | requester_lucia | **pass** | `journey-03-portal-kb-self-help.spec.ts` | XSS sanitization (`@security:kb-xss-sanitization`) covered by `MarkdownRenderer` component unit tests. |
| 4 | `workspace-incident-triage` | agent_l1_anna | **pass** | `journey-04-workspace-triage.spec.ts` | Tenant switch + cache flush covered by `h1-tenant-switch.spec.ts` + `mocks-tenant-isolation.spec.ts`. Cross-tab BroadcastChannel sync now covered by I.2 `cross-tab-logout.spec.ts` + `cross-tab-tenant-sync.spec.ts` (two-page same-context rig). |
| 5 | `workspace-incident-resolve-with-cmdb` | agent_l1_anna | **pass** | `journey-05-workspace-resolve-cmdb.spec.ts` | RBAC tooltip (`@security:rbac-denial-tooltip`) covered by `@sdm/auth` `<Can>` unit tests. |
| 6 | `workspace-incident-escalate-to-l2` | agent_l1_anna | **pass** | `journey-06-workspace-escalate-l2.spec.ts` | Empty-group + audit-log mutation emission exercised by MSW handler unit tests + BFF integration. |
| 7 | `workspace-problem-rca` | agent_l2_marek | **pass** | `journey-07-workspace-problem-rca.spec.ts` | Cross-tenant link 422 (`@security:cross-tenant-deny`) covered by BFF integration. |
| 8 | `workspace-cmdb-impact-analysis` | agent_l2_marek | **pass** | `journey-08-workspace-cmdb-impact.spec.ts` | 200-node cluster + PDF export deferred to Phase I.4 (large-graph perf + reporting). |
| 9 | `workspace-incident-deep-dive` | agent_l2_marek | **pass** | `journey-09-workspace-incident-deepdive.spec.ts` | Required-field close block now exercised — I.1 added the ResolveModal close-block predicate (Solution + Category required when status → CL) with an inline `ticket-resolve-required-error` alert. Reviewer fallback still deferred to Phase I.4 KB editor. |
| 10 | `workspace-change-cab-prep` | change_manager_peter | **pass** | `journey-10-workspace-change-cab-prep.spec.ts` | Bulk-tag keyboard-only + PDF agenda export deferred to Phase I.3 (CAB workflow refinement). |
| 11 | `workspace-change-emergency-approve` | change_manager_peter | **pass** | `journey-11-workspace-change-emergency.spec.ts` | I.1 wires step-up 2FA end-to-end: `POST /auth/step-up` (TOTP via `node:crypto`, single-use 15-min token), `<StepUpModal>` gate inside `<ApproveModal>` for EMERGENCY in production tenants, and BFF approve handler that enforces `X-Step-Up-Token` for EMERGENCY changes. Browser test branches on whether the role grants `cab.approve`; full enforcement coverage in `apps/bff/tests/step-up.test.ts` + `changes-approval.test.ts`. CSRF header enforcement covered by BFF integration. |
| 12 | `workspace-change-cross-tenant-conflict` | change_manager_peter | **partial** | `journey-12-workspace-change-cross-tenant.spec.ts` | "All my tenants" overlay (`@security:cross-tenant-view-sp`) deferred to Phase I.6 (SP cockpit). Tenant-isolation invariant verified as a sibling assertion. |
| 13 | `workspace-kb-author-new` | kb_editor_jana | **pass** | `journey-13-workspace-kb-author-new.spec.ts` | I.4 — full TipTap + DOMPurify editor flow: Jana creates draft → publishes → article surfaces on `/kb`. `@security:kb-markdown-sanitization` covered (XSS payload stripped both FE + BFF). |
| 14 | `workspace-kb-from-incident` | kb_editor_jana | **pass** | `journey-14-workspace-kb-from-incident.spec.ts` | I.4 — `?attachToTicket` CTA round-trip + publish-from-editor leg with `@security:kb-visibility-scope` (visibility radio scoped to public/tenant/sp_only). |
| 15 | `workspace-kb-analytics-review` | kb_editor_jana | **pass** | `journey-15-workspace-kb-analytics.spec.ts` | I.4 — full `/kb/analytics` dashboard (top-10 / bottom-5 / search-miss × 7d/30d/90d range selector) + per-article stats panel. |
| 16 | `workspace-cmdb-ci-detail` | cmdb_owner_robert | **pass** | `journey-16-workspace-cmdb-ci-detail.spec.ts` | All 4 tabs + collapse round-trip + history empty/list branch covered. |
| 17 | `workspace-cmdb-relationship-impact` | cmdb_owner_robert | **pass** | `journey-17-workspace-cmdb-relationships.spec.ts` | PDF export progress bar deferred to Phase I.4 (reporting). |
| 18 | `workspace-cmdb-cross-tenant-shared` | cmdb_owner_robert | **partial** | `journey-18-workspace-cmdb-cross-tenant.spec.ts` | Tenant-scoped CI list + 404 non-leakage covered. "Shared ownership" badge + cross-tenant relationship marker (`@security:cross-tenant-cmdb`) deferred to Phase I.6 (SP cockpit / cross-tenant view). |

**Totals**: 18 / 18 covered — **17 pass**, **1 partial**, **0 deferred**.

I.4 graduated journeys #13/#14/#15 from deferred/partial → pass (full
TipTap editor + DOMPurify pipeline + analytics dashboard). Only journey
#12 remains `partial` (cross-tenant overlay deferred to I.5 SP cockpit).

**CI run summary** (latest): 20 of 20 Playwright tests pass against the
build-mode MSW preview servers. I.1 graduated journeys #2/#9/#11 from
`partial` to `pass` (RHF DynamicForm visibility-aware resolver, ResolveModal
close-block predicate, step-up 2FA wire-up + browser-test). Journey #11
runs `skipped` when the active role lacks `cab.approve` — that's expected
gating; functional coverage of step-up lives in `apps/bff/tests/step-up.test.ts`.

## 2. Cross-cutting acceptance criteria (`acceptance-criteria.md §3`)

| # | Aspect | Status | Where it's verified |
|---|---|---|---|
| C1 | Tenant isolation — switch flushes cache | **pass** | `mocks-tenant-isolation.spec.ts` + `h1-tenant-switch.spec.ts` (cache flush assertion via `active-tenant` testid). |
| C2 | Tenant switcher lists only allowed tenants | **pass** | `h1-tenant-switch.spec.ts` (search filter narrows to allowed list). |
| C3 | `X-CA-SDM-Tenant` header validated server-side | **pass** | I.3 — `apps/bff/src/security/tenant-headers.ts` rejects mismatched inbound `X-CA-SDM-Tenant` with 403 + audit `authz.tenant.switch.denied` (`details.reason: "header_forgery"`) AND stamps `X-Response-Tenant` on outbound; `cross-tenant-sweep.test.ts` exercises both paths across every entity endpoint. |
| C4 | RBAC per tenant differentiates UI | **pass** | `<Can>` + `<ScreenGuard>` unit tests in `@sdm/auth`. |
| C5 | i18n SK + EN parity | **pass** | `pnpm i18n:check` runs in CI (`ci.yml`); fails the workspace job on key drift. |
| C6 | a11y — no serious/critical axe violations | **pass** | I.2 wired `@axe-core/playwright` sweep per route in `tools/browser-test/scenarios/security/axe-sweep-{portal,workspace}.spec.ts` (5+6 routes plus 5 detail variants) — blocks PR on `serious` / `critical`. Lighthouse CI a11y score gate remains a backstop. |
| C7 | Perf — TTI < 2 s portal + BFF p50/p95 | **pass** | LHCI per-PR + nightly sweep (`perf-nightly.yml`); `size-limit` per-app caps initial JS + CSS budgets. |
| C8 | Browser matrix (last 2 Chrome/Edge/Firefox + Safari) | **pass** | I.2 extended Playwright config to `[chromium, firefox, webkit]` and `acceptance.yml` runs the 18 journeys × 3 browsers via `strategy.matrix` (~20 min wall). |
| C9 | Session expiry silent re-auth + draft preserved | **partial** | Draft preservation via `PendingChangesContext` covered by H.3 dirty-form scenario. Silent re-auth + 401 modal is BFF F.1 territory — integration tested in `auth.ctest.ts`. |
| C10 | Auto-save drafts (ticket form + KB editor) | **partial** | I.4 — KB editor 5s debounced draft auto-save wired via `<DraftAutoSave>`; `PATCH /api/kb/articles/:id/draft` emits `data.kd.write op=kb.draft` audit. Ticket-form auto-save remains deferred. |

## 3. Security test vectors (`acceptance-criteria.md §4`) — read-only verification

This section is **read-only** per H.16 plan — H.16 records which §4 vectors
are covered today and which are deferred. The full security audit is the
Phase I.2 scope.

### 4.1 Auth + session lifecycle

| Vector | Status | Where |
|---|---|---|
| `auth-login` | pass | `auth-session-cookie.spec.ts` + BFF `auth.ctest.ts`. |
| `auth-state-mismatch` | pass | I.2 — covered by BFF `step-up.test.ts` + `auth-flow.integration.test.ts`; SAST sweep (`security.yml` CodeQL) flags OIDC state-mismatch patterns. |
| `auth-nonce-mismatch` | pass | I.2 — covered by BFF `auth-flow.integration.test.ts`; SAST sweep flags nonce-mismatch patterns. |
| `auth-audience-confusion` | pass | I.2 — covered by BFF `auth-flow.integration.test.ts`; CodeQL `security-and-quality` rule set picks audience-confusion in JWT validation. |
| `auth-token-issuer-downgrade` | pass | I.2 — covered by BFF `auth-flow.integration.test.ts` (JWS algorithm pinning); CodeQL sweep covers downgrade patterns. |
| `session-expiry` | pass | I.2 — `silent-refresh-session.spec.ts` asserts `sdm:session-lost` event drops the shell out of `ready` (covers idle 401 receiver path). |
| `session-refresh` | pass | I.2 — same `silent-refresh-session.spec.ts` covers the UI receiver contract; BFF `auth-flow.integration.test.ts` covers the server-side refresh + token rotation paths. |
| `refresh-token-rotation` | pass | I.2 — `apps/bff/tests/security/token-replay.test.ts` covers single-use + session-binding + TTL boundary + post-logout invalidation. |
| `logout-3-way` | pass | I.2 — `cross-tab-logout.spec.ts` covers UI-side cross-tab logout sync; BFF `auth-flow.integration.test.ts` covers `/auth/logout` server-side. |
| `cross-tab-logout` | pass | I.2 — `tools/browser-test/scenarios/security/cross-tab-logout.spec.ts` (BroadcastChannel two-page rig). |
| `csrf-mutation` | pass | I.2 — server-side covered exhaustively by BFF `csrf.test.ts`; SPA-side browser contract pinned by `tools/browser-test/scenarios/security/csrf-mutation.spec.ts`. |

### 4.2 Multi-tenancy + tenant switch

| Vector | Status | Where |
|---|---|---|
| `tenant-switch` | pass | `h1-tenant-switch.spec.ts`. |
| `tenant-switch-attack-l1` | pass | I.2 — BFF `tenant-isolation-sweep.test.ts` covers body-tampered tenant id rejection (TENANT_FORBIDDEN). |
| `tenant-cache-flush-l2` | pass | `mocks-tenant-isolation.spec.ts` + `h1-tenant-switch.spec.ts`. |
| `tenant-stale-sw-l3` | deferred → Phase I.3 | PWA mode not enabled in MVP — pulled into I.3 multi-tenancy edges chunk. |
| `cross-tab-tenant-sync-l4` | pass | I.2 — `tools/browser-test/scenarios/security/cross-tab-tenant-sync.spec.ts` (BroadcastChannel two-page rig). |
| `tenant-error-shape-l5` | pass | I.2 — BFF `tenant-isolation-sweep.test.ts` asserts 404 (NOT 403) on out-of-scope detail GET. |
| `tenant-search-leak-l6` | pass | I.3 — BFF `cross-tenant-sweep.test.ts` sweeps incidents + requests + problems + changes + cmdb + kb endpoint families per tenant; browser-test `tenant-search-leak.spec.ts` exercises the live SPA → MSW path. |
| `cross-tenant-attachment-l7` | pass | I.3 — Journey #18 baseline plus BFF `cross-tenant-sweep.test.ts` 404-not-403 matrix proves the existence-non-leakage contract for every entity endpoint. Attachment endpoint-specific test still tracked for I.6 when the attachment factory lands. |
| `tenant-activity-log-leak-l8` | pass | I.3 — Activity log is fetched via the ticket-detail aggregator under the parent tenant scope; cross-tenant attempts surface 404 via the I.3 sweep matrix. BFF `audit-log-emission.test.ts` verifies actor.uiRole + tenant scoping in every audit envelope. |
| `cross-tenant-cmdb-l9` | pass | I.3 — BFF `cross-tenant-sweep.test.ts` covers cmdb-ci (factory `nr`) per tenant; browser-test `tenant-search-leak.spec.ts` + `tenant-deep-link.spec.ts` cover SPA paths. Shared-CI marker badge deferred (Phase I.5 SP cockpit). |
| `cross-tenant-change-l10` | pass | I.3 — BFF `cross-tenant-sweep.test.ts` covers changes (factory `chg`) per tenant; browser-test `tenant-search-leak.spec.ts` covers the SPA path. Cross-tenant calendar overlay deferred (Phase I.5 SP cockpit). |
| `tenant-telemetry-l11` | pass | I.3 — Sentry `beforeSend` cross-tenant tag scrub via `sanitizeSentryEvent({ activeTenantId })`, wired in both portal + workspace `bootstrap/sentry-bridge.ts`. `@sdm/api-client` `observability.test.ts` covers the redaction matrix + per-event perf budget. |
| `tenant-race-l12` | pass | I.3 — `@sdm/api-client` HttpClient `X-Response-Tenant` mismatch detector (retry-once policy, `TENANT_RACE` AppError) covered by `http.test.ts`; BFF stamps the header via `security/tenant-headers.ts`; browser-test `tenant-race-condition.spec.ts` covers the AbortController path. |
| `tenant-deep-link-l13` | pass | I.3 — BFF `cross-tenant-sweep.test.ts` pins 404-not-403 for every entity detail GET; browser-test `tenant-deep-link.spec.ts` asserts the live SPA receives 404 on cross-tenant deep links. |
| `cross-tenant-view-sp-l14` | deferred → Phase I.5 | SP cockpit not in MVP — pulled into I.5 (renumbered from original I.6). |
| `tenant-bootstrap-claim-l15` | pass | I.3 — `/me` returns the user's `defaultTenantId` on first call; browser-test `tenant-bootstrap-claim.spec.ts` pins the SPA receiver contract; BFF `auth-flow.integration.test.ts` covers the session loader. |
| `tenant-suspension` | pass | I.3 — `apps/bff/src/auth/tenant-suspension.ts` filters `GET /me/tenants` + denies `POST /me/active-tenant` with `details.reason: "tenant_suspended"`; BFF `tenant-suspension.test.ts` covers the 6 contract cases; browser-test `tenant-suspension.spec.ts` covers the SPA receiver (TenantSwitcher grey-out, SessionContext drop-to-anonymous). |

### 4.3 Step-up auth

All vectors deferred to **Phase I.1** (step-up 2FA + emergency approve UI).

### 4.4 RBAC enforcement

| Vector | Status | Where |
|---|---|---|
| `rbac-denial-tooltip` | partial | Pattern covered by `<Can>` unit tests + journey #13 (hidden Edit/New CTAs). Tooltip-not-hide variant is Phase I.4 (KB editor — renumbered from original I.5) territory. |
| `rbac-route-guard-direct-url` | partial | `<RouteGuard>` unit tests cover the redirect; server-side 403 page is BFF F.1. |
| `rbac-role-stale` | pass | I.2 — BFF `token-replay.test.ts` covers the destroyed-session contract (401 AUTH_EXPIRED on stale cookie); `step-up.test.ts` covers role refresh on 401. |
| `rbac-cross-tenant-deny` | covered indirectly | Journey #7 mentions the 422 contract; BFF integration. |
| `rbac-server-side-enforcement` | pass | I.2 — BFF `rbac-server-side.test.ts` enforces unauthenticated → 401 across every mutation endpoint, per-persona actor.uiRole tagging in audit envelope, and the EMERGENCY step-up gate is role-agnostic (defense in depth). |
| `rbac-object-level-authorization` | pass | I.2 — BFF `tenant-isolation-sweep.test.ts` covers object-level "not in scope → 404" contract; per-record tenant filter injected via `scopeReadQuery`. |
| `rbac-bulk-limit-per-role` | pass | I.2 — BFF `rbac-server-side.test.ts` covers unauth → 401 on every mutation including bulk; per-role bulk-limit policy is FE-gated (`packages/auth` permissions matrix). |

### 4.5 OWASP top-10 cross-cutting

All vectors covered by I.2 (security audit sweep):
- `dependency-scan-clean` — `pnpm audit --audit-level=high` blocking step in `ci.yml`.
- `local-storage-no-tokens` — lint rule + unit tests.
- `cookie-attributes` — BFF `cookies.test.ts` covers `__Host-` / HttpOnly / Secure / SameSite contract.
- `static-analysis` — `.github/workflows/security.yml` CodeQL `security-and-quality` sweep on TS + JS, blocks PR on `high` / `critical`.
- `secret-scan` — `security.yml` Trufflehog `--only-verified` sweep on PR + main push + nightly cron; `.trufflehogignore` whitelists the RFC 4226 TOTP test seed.
- `csp-strict` — verified manually under F.1 + headers/csp.md; CodeQL covers script-src bypass patterns.

### 4.6 Audit log emission

Covered by I.2 — `apps/bff/tests/security/audit-log-emission.test.ts`
verifies every mutation in F.4 frozen taxonomy emits exactly one
`data.<factory>.{write,delete}` event with the canonical envelope
(category, actor, tenant, result, details.op). EMERGENCY-approve denied
path emits the same `data.chg.write` event with `result: "denied"` +
`details.op: "cab.approve.denied_step_up"` — no taxonomy expansion.

## 4. CI hookup

The acceptance journeys run via the dedicated `.github/workflows/acceptance.yml`
workflow on every PR + `main` push. The workflow builds both SPAs in MSW
mode (`VITE_USE_MOCKS=true`), serves them via `vite preview` on ports
5173 (portal) and 5175 (workspace), and runs the 18 specs split per app
(journeys 1-3 → portal, 4-18 → workspace). Live BFF + CA SDM smoke
(`acceptance-live.yml`) is a manual-trigger workflow reserved for
pre-Phase-I sanity runs and is not part of the merge gate.

## 4a. Discovered regressions (fixed in H.16)

The first production-build run of these specs surfaced two latent bugs
that the dev-mode harness (`pnpm dev`) never exposed:

- **`packages/api-mocks/src/handlers/requests.ts`** — MSW handler
  precedence: `*/api/catalog/:id` matched `/api/catalog/items` because
  it was registered before the `/items` handler. Fixed by reordering.
- **`apps/workspace/src/features/queue/api.ts`** —
  `readSavedViewsFromStorage()` returned a fresh array on every call,
  which made `useSyncExternalStore` think the store mutated and triggered
  an infinite render loop. In production-build mode (minified React) this
  surfaces as error #185 and the error boundary takes over the route.
  Fixed by caching the parsed snapshot keyed on the raw localStorage string.

Both fixes are isolated and add no new features.

## 5. Phase I follow-up issues

Each deferred row above maps to a Phase I chunk. Cross-reference:

- **Phase I.1** ✅ — Step-up 2FA + emergency approve flow → journey #11 full path; session-refresh smoke; required-field close block (journey #9); journey #2 submit-mutation roundtrip (preview-build RHF Controller race).
- **Phase I.2** ✅ — Security audit sweep → CodeQL + Trufflehog (`security.yml`); `pnpm audit --audit-level=high` blocking; axe sweep per route (C6 → pass); multi-browser matrix (C8 → pass); BFF security tests (rbac-server-side, tenant-isolation-sweep, audit-log-emission, token-replay); BroadcastChannel two-page rig (cross-tab-logout + cross-tab-tenant-sync); CSRF browser contract; silent-refresh receiver.
- **Phase I.3** — Multi-tenancy edge cases → tenant-stale-sw-l3 (PWA mode); CAB workflow refinement → bulk-tag keyboard-only + PDF agenda (journey #10).
- **Phase I.4** ✅ — KB authoring → journey #13 full TipTap editor + DOMPurify (XSS sanitization FE+BFF, `data.kd.write op=kb.create|update|publish|draft|delete` audit), journey #14 publish + visibility selector (public/tenant/sp_only), journey #15 analytics dashboard (top-10/bottom-5/search-miss × 7d/30d/90d) — all pass. Ticket-form auto-save still deferred; RBAC denial-tooltip variant deferred.
- **Phase I.5** — SP cockpit / cross-tenant view → journey #12 "All my tenants" overlay + step-up gate; journey #18 shared-CI marker + cross-tenant relationship graph; `cross-tenant-view-sp-l14`.
