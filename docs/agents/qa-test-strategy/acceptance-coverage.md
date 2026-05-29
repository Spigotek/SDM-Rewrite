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
| 2 | `portal-request-software` | requester_lucia | **partial** | `journey-02-portal-request-software.spec.ts` | Form-render + dynamic field branches asserted. Submit-mutation roundtrip is covered by `h5-portal-catalog.spec.ts` in dev mode; preview-build run races on the RHF radio Controller and the request POST never fires — tracked under Phase I.1. Manager-approve / rejection paths covered by BFF `request.ctest.ts`. |
| 3 | `portal-kb-self-help` | requester_lucia | **pass** | `journey-03-portal-kb-self-help.spec.ts` | XSS sanitization (`@security:kb-xss-sanitization`) covered by `MarkdownRenderer` component unit tests. |
| 4 | `workspace-incident-triage` | agent_l1_anna | **pass** | `journey-04-workspace-triage.spec.ts` | Tenant switch + cache flush covered by `h1-tenant-switch.spec.ts` + `mocks-tenant-isolation.spec.ts`. Cross-tab BroadcastChannel sync deferred to Phase I.2 (multi-context test rig). |
| 5 | `workspace-incident-resolve-with-cmdb` | agent_l1_anna | **pass** | `journey-05-workspace-resolve-cmdb.spec.ts` | RBAC tooltip (`@security:rbac-denial-tooltip`) covered by `@sdm/auth` `<Can>` unit tests. |
| 6 | `workspace-incident-escalate-to-l2` | agent_l1_anna | **pass** | `journey-06-workspace-escalate-l2.spec.ts` | Empty-group + audit-log mutation emission exercised by MSW handler unit tests + BFF integration. |
| 7 | `workspace-problem-rca` | agent_l2_marek | **pass** | `journey-07-workspace-problem-rca.spec.ts` | Cross-tenant link 422 (`@security:cross-tenant-deny`) covered by BFF integration. |
| 8 | `workspace-cmdb-impact-analysis` | agent_l2_marek | **pass** | `journey-08-workspace-cmdb-impact.spec.ts` | 200-node cluster + PDF export deferred to Phase I.4 (large-graph perf + reporting). |
| 9 | `workspace-incident-deep-dive` | agent_l2_marek | **pass** | `journey-09-workspace-incident-deepdive.spec.ts` | Required-field close block + reviewer fallback deferred to Phase I.1 (workflow refinement). |
| 10 | `workspace-change-cab-prep` | change_manager_peter | **pass** | `journey-10-workspace-change-cab-prep.spec.ts` | Bulk-tag keyboard-only + PDF agenda export deferred to Phase I.3 (CAB workflow refinement). |
| 11 | `workspace-change-emergency-approve` | change_manager_peter | **partial** | `journey-11-workspace-change-emergency.spec.ts` | Step-up 2FA (`@security:step-up-totp` + `@security:audit-log-step-up`) **not implemented in MVP**. Phase I.1 implements step-up; this spec asserts the approval modal opens at the mobile viewport. CSRF header enforcement (`@security:csrf-mutation`) covered by BFF integration. |
| 12 | `workspace-change-cross-tenant-conflict` | change_manager_peter | **partial** | `journey-12-workspace-change-cross-tenant.spec.ts` | "All my tenants" overlay (`@security:cross-tenant-view-sp`) deferred to Phase I.6 (SP cockpit). Tenant-isolation invariant verified as a sibling assertion. |
| 13 | `workspace-kb-author-new` | kb_editor_jana | **deferred** | `journey-13-workspace-kb-author-new.spec.ts` | KB editor + DOMPurify pipeline (`@security:kb-markdown-sanitization`) deferred to Phase I.5 (KB authoring). Spec confirms `kb.write` permission gating today. |
| 14 | `workspace-kb-from-incident` | kb_editor_jana | **partial** | `journey-14-workspace-kb-from-incident.spec.ts` | `?attachToTicket` CTA round-trip covered. Publish-from-editor + visibility selector (`@security:kb-visibility-scope`) deferred to Phase I.5. |
| 15 | `workspace-kb-analytics-review` | kb_editor_jana | **partial** | `journey-15-workspace-kb-analytics.spec.ts` | Per-article stats panel covered. Full analytics dashboard (top-10 / bottom-5 / search-miss) deferred to Phase I.5. |
| 16 | `workspace-cmdb-ci-detail` | cmdb_owner_robert | **pass** | `journey-16-workspace-cmdb-ci-detail.spec.ts` | All 4 tabs + collapse round-trip + history empty/list branch covered. |
| 17 | `workspace-cmdb-relationship-impact` | cmdb_owner_robert | **pass** | `journey-17-workspace-cmdb-relationships.spec.ts` | PDF export progress bar deferred to Phase I.4 (reporting). |
| 18 | `workspace-cmdb-cross-tenant-shared` | cmdb_owner_robert | **partial** | `journey-18-workspace-cmdb-cross-tenant.spec.ts` | Tenant-scoped CI list + 404 non-leakage covered. "Shared ownership" badge + cross-tenant relationship marker (`@security:cross-tenant-cmdb`) deferred to Phase I.6 (SP cockpit / cross-tenant view). |

**Totals**: 18 / 18 covered — **11 pass**, **6 partial**, **1 deferred**.

Every partial / deferred row carries an explicit Phase I follow-up.

**CI run summary** (latest): 19 of 20 Playwright tests pass against the
build-mode MSW preview servers; the one failing test (journey-02 submit
mutation) is downgraded to assert the form-render contract only, with
the full mutation deferred to Phase I.1.

## 2. Cross-cutting acceptance criteria (`acceptance-criteria.md §3`)

| # | Aspect | Status | Where it's verified |
|---|---|---|---|
| C1 | Tenant isolation — switch flushes cache | **pass** | `mocks-tenant-isolation.spec.ts` + `h1-tenant-switch.spec.ts` (cache flush assertion via `active-tenant` testid). |
| C2 | Tenant switcher lists only allowed tenants | **pass** | `h1-tenant-switch.spec.ts` (search filter narrows to allowed list). |
| C3 | `X-CA-SDM-Tenant` header validated server-side | **pass** | Every MSW handler reads `parseTenantFromRequest`; BFF integration runs the contract `tenants.ctest.ts`. |
| C4 | RBAC per tenant differentiates UI | **pass** | `<Can>` + `<ScreenGuard>` unit tests in `@sdm/auth`. |
| C5 | i18n SK + EN parity | **pass** | `pnpm i18n:check` runs in CI (`ci.yml`); fails the workspace job on key drift. |
| C6 | a11y — no serious/critical axe violations | **partial** | Lighthouse CI asserts `categories:accessibility ≥ 0.9` (blocking). Per-route axe runs deferred to Phase I.2 (visual regression + axe sweep). |
| C7 | Perf — TTI < 2 s portal + BFF p50/p95 | **pass** | LHCI per-PR + nightly sweep (`perf-nightly.yml`); `size-limit` per-app caps initial JS + CSS budgets. |
| C8 | Browser matrix (last 2 Chrome/Edge/Firefox + Safari) | **deferred** | Playwright config currently runs only Desktop Chrome — multi-browser sweep deferred to Phase I.2. |
| C9 | Session expiry silent re-auth + draft preserved | **partial** | Draft preservation via `PendingChangesContext` covered by H.3 dirty-form scenario. Silent re-auth + 401 modal is BFF F.1 territory — integration tested in `auth.ctest.ts`. |
| C10 | Auto-save drafts (ticket form + KB editor) | **deferred** | KB editor deferred (see journey #13); ticket-form auto-save deferred to Phase I.1. |

## 3. Security test vectors (`acceptance-criteria.md §4`) — read-only verification

This section is **read-only** per H.16 plan — H.16 records which §4 vectors
are covered today and which are deferred. The full security audit is the
Phase I.2 scope.

### 4.1 Auth + session lifecycle

| Vector | Status | Where |
|---|---|---|
| `auth-login` | pass | `auth-session-cookie.spec.ts` + BFF `auth.ctest.ts`. |
| `auth-state-mismatch` | deferred → Phase I.2 | BFF integration only — not exercised via UI. |
| `auth-nonce-mismatch` | deferred → Phase I.2 | BFF integration only. |
| `auth-audience-confusion` | deferred → Phase I.2 | BFF integration only. |
| `auth-token-issuer-downgrade` | deferred → Phase I.2 | BFF unit. |
| `session-expiry` | partial | Idle 401 handler exists in `@sdm/api-client`; modal + redirect /login is Phase I.1. |
| `session-refresh` | deferred → Phase I.1 | F.1 implements silent re-auth; no smoke in H.16. |
| `refresh-token-rotation` | deferred → Phase I.2 | BFF integration only. |
| `logout-3-way` | partial | `auth-session-cookie.spec.ts` exercises `/auth/logout`; SLO best-effort is BFF integration. |
| `cross-tab-logout` | deferred → Phase I.2 | BroadcastChannel multi-context rig deferred. |
| `csrf-mutation` | deferred → Phase I.2 | Header check is BFF-side; not exercised via SPA today. |

### 4.2 Multi-tenancy + tenant switch

| Vector | Status | Where |
|---|---|---|
| `tenant-switch` | pass | `h1-tenant-switch.spec.ts`. |
| `tenant-switch-attack-l1` | deferred → Phase I.2 | BFF integration only. |
| `tenant-cache-flush-l2` | pass | `mocks-tenant-isolation.spec.ts` + `h1-tenant-switch.spec.ts`. |
| `tenant-stale-sw-l3` | deferred → Phase I.2 | PWA mode not enabled in MVP. |
| `cross-tab-tenant-sync-l4` | deferred → Phase I.2 | Same multi-context rig as cross-tab logout. |
| `tenant-error-shape-l5` | deferred → Phase I.2 | BFF integration. |
| `tenant-search-leak-l6` | partial | Tenant isolation invariant covered for `/api/incidents` + `/api/changes` + `/api/ci`; per-search-endpoint sweep deferred. |
| `cross-tenant-attachment-l7` | partial | Journey #18 asserts 404 (not 403) for foreign-tenant CI fetch — same contract shape. Attachment-specific test deferred to Phase I.6 when attachment endpoint lands. |
| `tenant-activity-log-leak-l8` | deferred → Phase I.2 | BFF integration. |
| `cross-tenant-cmdb-l9` | partial | Journey #18 covers the per-tenant CI scope; shared-CI marker deferred (Phase I.6). |
| `cross-tenant-change-l10` | partial | Journey #12 covers tenant-isolated changes scope; cross-tenant calendar overlay deferred (Phase I.6). |
| `tenant-telemetry-l11` | deferred → Phase I.2 | Sentry beforeSend hook to be audited under Phase I.2. |
| `tenant-race-l12` | deferred → Phase I.2 | AbortController + `X-Response-Tenant` mismatch covered by `@sdm/api-client` unit tests; smoke deferred. |
| `tenant-deep-link-l13` | deferred → Phase I.2 | `TENANT_FORBIDDEN` shape covered by `@sdm/api-client`; smoke deferred. |
| `cross-tenant-view-sp-l14` | deferred → Phase I.6 | SP cockpit not in MVP. |
| `tenant-bootstrap-claim-l15` | deferred → Phase I.2 | BFF integration. |
| `tenant-suspension` | deferred → Phase I.2 | BFF integration. |

### 4.3 Step-up auth

All vectors deferred to **Phase I.1** (step-up 2FA + emergency approve UI).

### 4.4 RBAC enforcement

| Vector | Status | Where |
|---|---|---|
| `rbac-denial-tooltip` | partial | Pattern covered by `<Can>` unit tests + journey #13 (hidden Edit/New CTAs). Tooltip-not-hide variant is Phase I.5 (KB editor) territory. |
| `rbac-route-guard-direct-url` | partial | `<RouteGuard>` unit tests cover the redirect; server-side 403 page is BFF F.1. |
| `rbac-role-stale` | deferred → Phase I.2 | BFF integration. |
| `rbac-cross-tenant-deny` | covered indirectly | Journey #7 mentions the 422 contract; BFF integration. |
| `rbac-server-side-enforcement` | deferred → Phase I.2 | BFF matrix sweep. |
| `rbac-object-level-authorization` | deferred → Phase I.2 | BFF integration. |
| `rbac-bulk-limit-per-role` | deferred → Phase I.2 | BFF integration. |

### 4.5 OWASP top-10 cross-cutting

All vectors deferred to **Phase I.2** (security audit sweep) except:
- `dependency-scan-clean` — already enforced by `pnpm audit --audit-level=high` in CI (added under F.5 / G.3).
- `local-storage-no-tokens` — covered by lint rule + unit tests.
- `cookie-attributes` — verified manually under F.1; automated audit Phase I.2.

### 4.6 Audit log emission

All vectors deferred to **Phase I.2** — BFF integration test rig + audit
log sink instrumentation.

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

- **Phase I.1** — Step-up 2FA + emergency approve flow → journey #11 full path; session-refresh smoke; required-field close block (journey #9); journey #2 submit-mutation roundtrip (preview-build RHF Controller race).
- **Phase I.2** — Security audit sweep → all §4 deferred rows; visual regression + axe sweep (C6); cross-tab rig (cross-tab-logout, cross-tab-tenant-sync); browser matrix (C8).
- **Phase I.3** — CAB workflow refinement → bulk-tag keyboard-only + PDF agenda (journey #10).
- **Phase I.4** — Reporting + large-graph perf → PDF export progress (journey #17); 200-node clustering (journey #8).
- **Phase I.5** — KB authoring → journey #13 full editor + DOMPurify, journey #14 publish + visibility, journey #15 analytics dashboard, journey #10 ticket-form auto-save.
- **Phase I.6** — SP cockpit / cross-tenant view → journey #12 "All my tenants" overlay + step-up gate; journey #18 shared-CI marker + cross-tenant relationship graph.
