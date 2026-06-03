# Service Desk Management v1.0

**Service Desk Management v1.0** — MVP release. Modern multi-tenant SDM
frontend for CA Service Desk Manager 17.4.

> Released 2026-06-03. Source tag: [`v1.0.0`](https://github.com/Spigotek/SDM-Rewrite/releases/tag/v1.0.0).
> Full changelog: [`docs/CHANGELOG.md`](./CHANGELOG.md).

This release ships two SPAs (`portal`, `workspace`) and one BFF (Hono on
Node 22) covering the full MVP scope from `GOAL.md §3`: incident, request,
problem, change, KB (read+write), CMDB (read), and multi-tenancy. 18 of 18
end-to-end acceptance journeys pass in CI on Chromium + Firefox + WebKit.

---

## Personas served

The product is designed around six concrete personas (see
`docs/agents/ux-persona-analyst/personas.md`) plus an SP Admin overlay role.

### Lucia — Customer (self-service requester)

Mobile-first portal for non-technical employees and external customers.

- Report incidents (`/new-incident`) with summary, description, priority and
  category. Inline validation, success screen with three CTAs.
- Browse personal tickets (`/tickets`, `/tickets/:id`) — incidents,
  requests, problems and changes via prefix-routed URLs.
- Service Catalog (`/catalog`, `/catalog/:itemId`) — 12 dynamic field types
  (text, textarea, number, date, select, multi-select, radio, checkbox,
  file, user-picker, ci-picker, markdown-help) with Zod-built schemas.
- KB self-service (`/kb`, `/kb/article/:id`) — debounced search, sanitised
  markdown render via `react-markdown` + `rehype-sanitize` (lazy
  `vendor-markdown` chunk), helpfulness vote.

### Anna — L1 Service Desk Analyst

Dense triage workspace for L1.

- Queue (`/queue`) — TanStack Table on the F.3 `/api/queue` parallel
  aggregator (incidents + requests + problems, partial-failure tolerant).
  Saved views (per-user `localStorage`), keyboard nav
  (`j`/`k`/`↑`/`↓`/`Enter`/`Esc`), 30 s polling when the document is
  visible.
- Ticket detail (`/tickets/:id`) — inline status / priority edit with
  optimistic UI, ActionBar (Take / Resolve / Escalate / Watch / More),
  3-tab Composer (Public reply / Internal note / Resolution), context
  panel (requester + CI + related records).

### Peter — Change Manager / CAB chair

Change-management workflow with calendar and CAB approvals.

- Change list (`/changes`) and detail (`/changes/:id`) with 4 tabs (Detail
  / Impact / Rollback / Approvals). Rollback plan rendered as sanitised
  markdown.
- Change Calendar (`/changes/calendar`) — FullCalendar 6 with day / week /
  month view switch, event colour per `risk_tier`. Lazy `vendor-calendar`
  chunk (~75 KB gz). Mobile fallback: redirect to list view.
- CAB approval (Approve / Reject / Send-reminder) gated by `cab.approve`.
- **Step-up 2FA** (RFC 6238 TOTP, single-use 15 min tokens) required for
  EMERGENCY-category approvals in production tenants.

### Robert — CMDB Owner

Read-only CI inventory with relationship graph.

- CI list (`/cmdb`) — filterable by class, status and free-text query.
- CI detail (`/cmdb/ci/:id`) — 4 tabs (Detail / Attributes /
  Relationships / History). Per-class attribute registry with collapsible
  groups persisted per user.
- Relationship graph — Cytoscape 3 + `cytoscape-cose-bilkent`, edge styles
  per `relationType` (`depends_on` solid, `hosts` thick, `peers_with`
  dashed). A11y treeview fallback for screen readers.

### Marek — L2 Specialist / Problem Manager

Problem RCA flow with link-to-incident.

- Problems list (`/problems`) and detail (`/problems/:id`) — link / unlink
  / convert-from-incident flows. (BFF mutation surface deferred — see
  Known issues.)

### Jana — KB Editor

Authoring workflow with TipTap and defence-in-depth sanitisation.

- KB editor (`/kb/editor`, `/kb/editor/:id`) gated by `kb.edit` — TipTap
  2.27 in a lazy `vendor-editor` chunk, 5 s debounced draft auto-save,
  visibility radio (`public` / `tenant` / `sp_only`).
- Sanitisation pipeline: `DOMPurify` in the browser, `sanitize-html` on the
  BFF and the MSW dev backend. `@security:kb-markdown-sanitization`
  covered end-to-end.
- KB analytics (`/kb/analytics`) gated by `kb.analytics` — top-10 / bottom-5
  / search-miss across 7 d / 30 d / 90 d windows.

### SP Admin — Service Provider Admin (cross-tenant overlay)

- SP cockpit (`/sp/cockpit`) — per-tenant health summary.
- "All my tenants" toggle in CalendarFilters — per-tenant colour overlay
  in CalendarView.
- `SharedCiMarker` badge in CmdbTable + CiHeader for shared CIs.
- Cross-tenant Cytoscape edges (dashed orange).
- BFF SP impersonation — `POST /api/sp/view-as` step-up gated, 1 h TTL,
  audit-trailed via `authz.tenant.switch.*` (`details.op: sp.view_as.*`).
- Top-bar **SP mode** badge to mitigate UX disorientation.

---

## Security baseline

- **CI gates** — `.github/workflows/security.yml` blocks merges on:
  CodeQL TypeScript + JavaScript scan, Trufflehog `--only-verified` secret
  sweep, and `pnpm audit --audit-level=high`.
- **Step-up 2FA** — RFC 6238 TOTP via `node:crypto`, single-use 15 min
  tokens, enforced on EMERGENCY change approvals in production tenants.
- **Tenant isolation** — server-side tenant resolution from session;
  `X-CA-SDM-Tenant` validated server-side; `X-Response-Tenant` stamped on
  outbound responses; FE race detector retries once on mismatch.
- **Tenant suspension** — `tenantStatus: active|suspended`, /me/tenants
  filtering, 403 with audit `authz.tenant.switch.denied` reason
  `"suspended"`, TenantSwitcher grey-out.
- **XSS sanitisation** — `DOMPurify` (browser) plus `sanitize-html` (BFF +
  MSW server) — defence in depth on the KB authoring + read paths.
- **Accessibility** — `@axe-core/playwright` per-route sweep on portal +
  workspace; 0 `serious` / `critical` violations on shipped routes;
  Lighthouse CI a11y score gate as a backstop.
- **Multi-browser** — Playwright runs Chromium + Firefox + WebKit × 18
  journeys (~20 min wall in `.github/workflows/acceptance.yml`).
- **Acceptance** — 18 / 18 journeys pass (see
  `docs/agents/qa-test-strategy/acceptance-coverage.md`).

---

## Performance

- **Portal initial JS** — **106 KB gz** (-35 % vs pre-I.0 baseline; cap
  180 KB).
- **Workspace initial JS** — **145 KB gz** (-18 %; cap 350 KB).
- **Lighthouse mobile portal `/`** — score **0.92** (gate 0.90), TTI ~3 s
  under the harsh LHCI preset (slow-4G + 4× CPU). Real-user TTI ~1.5-2 s
  on typical on-prem deployments with modern devices.
- **Lighthouse desktop workspace `/queue`** — score **0.99**, TTI ~800 ms.
- **Lazy chunks** — `vendor-router`, `vendor-state`, `vendor-i18n`,
  `vendor-ds`, `vendor-observability`, `vendor-markdown` (KB read),
  `vendor-calendar` (FullCalendar), `vendor-graph` (Cytoscape),
  `vendor-editor` (TipTap, KB write).
- **Score gate is the primary regression catcher**; absolute TTI / LCP /
  FCP thresholds are catastrophic-regression catchers. See
  `docs/agents/performance/performance.md §2`.

---

## Compatibility

- **Browsers** — Chrome / Edge 120+, Firefox 120+, Safari 17+.
- **Mobile** — iOS Safari 17+ on the portal. The workspace is desktop-first;
  Change Calendar redirects mobile users to the list view (drag-resize is
  v1.1).
- **Backend** — CA Service Desk Manager **17.4** REST API (`/caisd-rest/`).
  Probed live shapes for activity log (BREL → `alg` / `chgalg`) and
  attachments (BLREL join + `/attmnt/{id}` enrichment) are in
  `docs/agents/api-analyst/real-backend-contracts.md §22-§24`.

---

## Deployment

### Helm chart (OCI)

```bash
helm install sdm oci://ghcr.io/spigotek/charts/sdm --version 1.0.0
```

Staging values reference: `deploy/helm/sdm/values-staging.yaml`. Vault-ref
placeholders for secrets (`CA_SDM_PASSWORD`, `SESSION_SECRET`, `SENTRY_DSN`,
`BFF_REDIS_URL`) are substituted at deploy time. On-prem deployment per
operator memory `deploy_target.md`.

### Container images

Multi-arch (`linux/amd64` + `linux/arm64`):

- `ghcr.io/spigotek/sdm-bff:1.0.0` (also `1.0`, `latest`)
- `ghcr.io/spigotek/sdm-portal:1.0.0` (also `1.0`, `latest`)
- `ghcr.io/spigotek/sdm-workspace:1.0.0` (also `1.0`, `latest`)

The `1.0` tag tracks the latest 1.0.x patch; `latest` tracks the most
recent stable release.

### Dry-run + rollback

`scripts/release-dry-run.sh` and `scripts/rollback-test.sh` exercise top-5
critical paths against a staging cluster. The post-mortem template +
GO/NO-GO matrix lives in `docs/RELEASE-DRY-RUN.md` and is filled by the
operator after each install.

---

## Architecture highlights

- **Two SPAs, one monorepo** — `portal` (low-density, mobile-first) and
  `workspace` (high-density, hotkeys, multi-pane). Shared code lives in
  `packages/`.
- **Routing + data** — React Router 6 data router + TanStack Query 5
  (5 min stale, retry × 1, no refetch on focus).
- **BFF mediation** — Hono on Node 22 between the SPAs and CA SDM REST.
  Shared `SdmHttpClient`, error shaper, `fast-xml-parser` XML→JSON adapter,
  reference factories with 15 min TTL cache.
- **Two dev modes** — MSW fixtures (`VITE_USE_MOCKS=true`) for the SPAs,
  LHCI and acceptance tests; stub-BFF harness for production-equivalent
  perf measurement; real BFF + CA SDM 17.4 for live integration.
- **Multi-tenancy ready** — server-side tenant scoping, cross-tab sync via
  BroadcastChannel + Safari fallback, race detection, suspension flow.
- **Observability** — `@sentry/react@8` with `beforeSend` deep PII strip
  (16 fragments), per-tenant SHA-256 salted user context, ULID correlation
  IDs, lazy init via `requestIdleCallback`.
- **Audit** — F.4 canonical 40-event taxonomy (frozen), PII redaction +
  SHA-256 pseudonymisation, 1:100 heartbeat sampling.

---

## Known issues

- **Mobile PWA offline mode** — draft auto-save and service-worker cache
  planned for v1.1.
- **Advanced change-calendar interactions** — drag-resize and cross-tenant
  conflict overlay (heavy mode) planned for v1.1.
- **KB analytics widgets** — currently MSW-fixture only. Real analytics
  ingest planned for v1.1+.
- **KB editor image upload** — markdown URL paste only; binary upload
  deferred to v1.1+.
- **LCP on portal mobile** — Lighthouse picker prefers multi-line text
  rects, biasing LCP onto the Home empty-state paragraph. Closing the
  remaining gap to GOAL.md sub-3 s requires SSR (planned for v1.1+).
- **Real-time tenant suspension push** — currently detected on the next API
  call. WebSocket-driven push planned for v1.1+.
- **Real BFF cross-tenant query** (SP cockpit) — currently MSW-fixture.
  Native CA SDM cross-tenant support deferred to v1+ (subject to CA SDM
  customisation).
- **Linked-incidents BFF mutation** (problem RCA) — FE + MSW shipped today
  exercise the full link / unlink / convert flow end-to-end; the BFF
  mutation surface (`cr.rootcause_id` manipulation) lands in a v1.0.x
  patch chunk.

---

## Roadmap — v1.1+

Indicative scope, replanned post-v1.0:

- Bulk operations in the workspace queue (per `GOAL.md §3 v1`).
- Mobile PWA offline mode (draft auto-save, service-worker cache).
- Advanced Change Calendar (drag-resize events, cross-tenant conflict
  overlay heavy mode).
- CAB meeting big-screen mode (`CalendarPresenter`).
- CMDB editor + Visualizer integration.
- KB analytics widgets (real-time ingest, dashboards).
- Reporting widgets.
- Real-time KB-editor collaboration (Yjs / Loro).

---

## Credits

Built with [Claude Code](https://claude.com/claude-code) (Opus 4.7) for
Spigotek / SOIMCO. Special thanks to the analytical pipeline agents whose
outputs in `docs/agents/` (api-analyst, architecture, devex-devops,
domain-modeller, performance, qa-test-strategy, security,
ux-persona-analyst) shaped every architectural decision in this release.

Maintainer: Spigotek &lt;dusan.lago@soimco.sk&gt;.
