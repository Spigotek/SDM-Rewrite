# Service Desk Management v1.1

**Service Desk Management v1.1** — Phase J closure release. 8 merged chunks (J.1-J.8)
shipping workspace native arm64 image, SSE-driven tenant suspension push, KB binary image
upload, calendar drag-resize, portal PWA installability + read-only offline, and portal
mobile LCP fix. J.0 (staging validation) remains deferred until the on-prem cluster is
provisioned. J.2 + J.4 closed as N/A — the dev/test backend has no multi-tenant CA SDM
instance and no production traffic signal source.

> Released 2026-MM-DD. Source tag: [`v1.1.0`](https://github.com/Spigotek/SDM-Rewrite/releases/tag/v1.1.0).
> Full changelog: [`docs/CHANGELOG.md`](./CHANGELOG.md).

v1.1 builds on v1.0's full MVP scope by graduating five v1.0 known-issue deferrals —
real-time tenant push, calendar drag-resize, KB binary upload, portal PWA, and portal
mobile LCP — while keeping the CA SDM 17.4 backend contract and F.4 audit taxonomy frozen.

---

## Personas served

Each persona section lists **what changed vs v1.0**. The full v1.0 feature baseline
(incidents, requests, problems, changes, KB read+write, CMDB, multi-tenancy) is unchanged.

### Lucia — Customer (self-service requester)

- Portal is now **installable as a PWA** (Add to Home Screen on iOS Safari 17+ and Android
  Chrome). Full install flow: manifest + 4 PNG icons (`src/pwa/icons/`), `display: standalone`
  removes browser chrome (J.7, PR #53).
- **Read-only offline**: Workbox service worker precaches the app shell + runtime caches
  `/api/*` GET responses (stale-while-revalidate), `/me` + `/config` (network-first),
  `/api/attachments/kb/*` (cache-first). Cached article reads survive connectivity loss (J.7).
- **Faster initial mobile paint**: portal home `home.subgreeting` expanded from ~22 chars to
  a multi-line welcoming paragraph (~200 chars). The larger subtitle wins the Lighthouse LCP
  picker race; LCP ≈ FCP for cold loads, closing the GOAL.md sub-3 s gap without SSR (J.8,
  PR #54).

### Anna — L1 Service Desk Analyst

- **Real-time tenant suspension push** — if the active tenant is suspended while Anna's
  session is open, `tenant.suspended` arrives over SSE (`GET /api/events`) within seconds.
  The shell calls the existing I.3 logout + redirect flow immediately — no more waiting up to
  30 s for the next polling cycle to discover the suspension (J.3, PR #50).
- If a non-active tenant in Anna's list is suspended, the `/me/tenants` TanStack Query cache
  is invalidated so the tenant switcher reflects the new status at the next open.

### Peter — Change Manager / CAB chair

- **Calendar drag-resize** on `/changes/calendar` — events are now draggable and
  edge-resizable when the user has the `change.schedule` permission (`editable: true`). Drag
  or resize fires `PATCH /api/changes/:id/schedule` in the BFF (J.6, PR #52).
- **Conflict confirm dialog** (`ConflictConfirmModal`) — dropping a change onto an overlapping
  window prompts the user before committing. The drop is reverted on cancel or PATCH failure
  (`info.revert()` on all failure paths).
- Schedule mutations audited under `data.chg.write` + `details.op="schedule.update"` with
  `previous_start`/`previous_end` captured pre-flight (F.4 frozen taxonomy, no new event
  names).
- Foreign-tenant events (sp_admin overlay) remain non-draggable and are excluded from
  conflict detection.

### Robert — CMDB Owner

No v1.1-specific changes. Relationships graph, CI list, and read-only CI detail baseline
from v1.0 are unchanged.

### Marek — L2 Specialist / Problem Manager

No v1.1-specific changes.

### Jana — KB Editor

- **Binary image upload** in the KB TipTap editor — drag-drop or paste-from-clipboard
  uploads images via `POST /api/attachments/kb` multipart (5 MB cap). Supported formats:
  PNG, JPG, GIF, SVG. Drop-zone hover state in `kb.css` (J.5, PR #51).
- `GET /api/attachments/kb/:id` serves the stored image; cross-tenant GET returns 404
  (never 403) — tenant boundary is opaque to the caller.
- Magic-number sniff is authoritative (client `Content-Type` cross-checked after sniff —
  mismatch → 400). JPG EXIF/IPTC/XMP/vendor metadata stripped server-side via hand-rolled
  APP-marker drop (~93 LOC, no new runtime deps). SVG sanitized via strict `sanitize-html`
  allowlist (no `script`, `foreignObject`, event handlers, or dangerous `xlink:href`).
- Attachments audited under `data.kb.write` + `details.op="attachment.upload"` (F.4 frozen
  taxonomy, no new event names).

### SP Admin — Service Provider Admin (cross-tenant overlay)

- New dev/admin endpoints `POST /api/admin/tenants/:id/suspend` and
  `POST /api/admin/tenants/:id/unsuspend` — programmatic tenant lifecycle without a UI,
  gated by `tenant.admin` permission (J.3).
- Admin-driven flips are immediately honoured by `filterActiveTenants` + `assertTenantActive`
  via `resolvedTenantStatus` runtime override map (post-merge patch `6fb08f3`). Active session
  reads (`/me/tenants`, `/me/active-tenant` switch) see the new status without session
  re-bootstrap.
- Audit composed under `authz.tenant.switch.denied` + `details.op: "admin.tenant.suspend"` /
  `"admin.tenant.unsuspend"` (F.4 frozen taxonomy, no new event names).

---

## Security baseline

- **F.4 audit taxonomy frozen.** v1.1 adds no new event names. New operations are composed
  under existing event names with `details.op` discriminators: `admin.tenant.suspend`,
  `admin.tenant.unsuspend`, `schedule.update`, `attachment.upload`.
- **SVG XSS defence** — strict `sanitize-html` allowlist on every uploaded SVG: no `script`,
  no `foreignObject`, no event handlers, no `xlink:href` pointing to external URIs (J.5).
- **JPG metadata strip** — EXIF/IPTC/XMP/vendor APP markers stripped before persistence.
  Prevents inadvertent location data, camera serial, and copyright metadata leakage (J.5).
- **Path-traversal defence** — tenant ID + attachment ID validated against strict ULID regex
  before any `fs` operation. Storage keyed by `(tenantId, attachmentId)`; file extension
  derived from sniffed MIME, not client filename (J.5).
- **Tenant-isolation defence** — `GET /api/attachments/kb/:id` returns 404 (never 403) on
  cross-tenant miss — caller cannot distinguish "not in tenant" from "does not exist" (J.5).
- **SSE channel requires active session** — `GET /api/events` runs behind
  `requireActiveSession` middleware; unauthenticated access is denied (J.3).
- **Runtime tenant override map** — `runtimeStatusOverrides` in `tenant-suspension.ts` is
  authoritative for `filterActiveTenants` + `assertTenantActive` post-fix commit `6fb08f3`,
  so admin-suspended tenants are immediately invisible to `/me/tenants` reads without
  session re-bootstrap (J.3).
- All existing CI gates unchanged: CodeQL TS+JS, Trufflehog `--only-verified`, `pnpm audit
--audit-level=high`, `@axe-core/playwright` per-route sweep, Playwright chromium + Firefox
  - WebKit × 18 acceptance journeys.

---

## Performance

- **Workspace multi-arch** — `linux/amd64` + `linux/arm64` images via native
  `ubuntu-22.04-arm` GitHub-hosted runner (J.1, PR #49). Closes the v1.0 amd64-only
  workaround (commit `6ff143a`). No QEMU; native arm64 runner avoids SIGILL.
- **Portal mobile LCP closed** — HeroGreeting subtitle copy redesign (J.8, PR #54). New
  multi-line paragraph (~200 chars) wins the Lighthouse LCP picker race; LCP ≈ FCP for cold
  loads. Measured by nightly `perf-nightly.yml` on `main`.
- **SSE heartbeat** — server sends an SSE comment every 30 s to keep proxies and NLBs alive
  without polluting the client event stream (J.3).
- **Bundle budgets unchanged** — portal initial JS ~161 KB / 180 KB cap; workspace initial JS
  ~176 KB / 350 KB cap. Workbox SW is in a separate `sw.js` (not the initial bundle).
  Upload code lives in the existing lazy `vendor-editor` chunk from I.4.
- **PWA runtime cache** — Workbox SWR for `/api/*` GET, NetworkFirst for `/me` + `/config`,
  CacheFirst for `/api/attachments/kb/*`. Conditional registration via `VITE_USE_MOCKS` gate
  so MSW remains the dev/CI controller; Workbox wins production (J.7).

---

## Compatibility

- Backward-compatible with v1.0 deployments: `helm upgrade --install` from chart `1.0.0` to
  `1.1.0` works against the same Kube cluster with no breaking API changes.
- **CA SDM 17.4 contract unchanged** — still single-tenant on the dev/test instance at
  `10.11.35.35:8050` (vueuser broker per operator memory `real_backend.md`). No new WC
  filters, no new entity types.
- **No API breaking changes.** New endpoints are additive:
  - `GET /api/events` — SSE stream (J.3)
  - `POST /api/admin/tenants/:id/suspend` + `unsuspend` — admin tenant lifecycle (J.3)
  - `POST /api/attachments/kb` — multipart upload (J.5)
  - `GET /api/attachments/kb/:id` — attachment serve (J.5)
  - `PATCH /api/changes/:id/schedule` — calendar reschedule (J.6)
- Browsers: Chrome / Edge 120+, Firefox 120+, Safari 17+ (unchanged from v1.0).
- Portal PWA installability requires iOS Safari 17+ (Apple Web App Manifest support).

---

## Deployment

### Helm chart (OCI)

```bash
helm upgrade --install sdm oci://ghcr.io/spigotek/charts/sdm --version 1.1.0
```

- Pull: `helm pull oci://ghcr.io/spigotek/charts/sdm --version 1.1.0`
- Backward-compatible in-place upgrade from chart `1.0.0`.

### Container images

Multi-arch (`linux/amd64` + `linux/arm64`):

- `ghcr.io/spigotek/sdm-bff:1.1.0` (also `1.1`, `latest`)
- `ghcr.io/spigotek/sdm-portal:1.1.0` (also `1.1`, `latest`)
- `ghcr.io/spigotek/sdm-workspace:1.1.0` (also `1.1`, `latest`)

**Note:** v1.0 workspace was `linux/amd64` only (QEMU SIGILL workaround, commit `6ff143a`).
v1.1 ships true multi-arch for all three images via the J.1 native arm64 runner pattern.

### Staging values

`deploy/helm/sdm/values-staging.yaml` — vault-ref placeholders for secrets (unchanged
structure from v1.0). Image tags bumped to `1.1.0` in all three image blocks.

**New runtime config in v1.1:**

- `BFF_ATTACHMENTS_DIR` — base directory for KB attachment storage. Default: `./.attachments-kb`
  (dev) or `/var/lib/sdm/attachments-kb` (container). Must be mounted from a PVC for
  production durability — see Known issues.

### Dry-run + rollback

Same scripts as v1.0: `scripts/release-dry-run.sh` + `scripts/rollback-test.sh`.
`docs/RELEASE-DRY-RUN.md` post-mortem template + GO/NO-GO matrix — fill before exposing the
deploy to users (see J.0 Known issue).

---

## Architecture highlights

- **`apps/bff/src/platform/event-bus.ts`** (J.3) — module-level in-memory pub/sub keyed by
  `sessionId`. `publish(sessionId, event)` + `subscribe(sessionId, cb)` + `unsubscribe`.
  Heartbeat emitter every 30 s. Multi-instance Redis pub/sub adapter is v2.0 scope.
- **`apps/bff/src/auth/tenant-suspension.ts`** runtime override map (J.3) — `runtimeStatusOverrides`
  `Map<tenantId, TenantStatus>` drives `resolvedTenantStatus()`. Admin endpoints write into
  this map; `filterActiveTenants` + `assertTenantActive` read from it. Survives request
  boundaries within a single BFF process.
- **`apps/bff/src/platform/attachments/`** (J.5) — four focused modules:
  `magic-sniff.ts` (PNG/JPG/GIF/SVG magic-number patterns), `exif-strip.ts` (hand-rolled
  JPG APP-marker drop, ~93 LOC), `svg-sanitize.ts` (thin wrapper over `sanitize-html`
  allowlist), `storage.ts` (ULID-keyed file-system storage). Zero new runtime deps.
- **`apps/workspace/src/features/changes/components/CalendarView.tsx`** (J.6) — `editable`
  flag gated on `change.schedule` permission. `eventDrop` + `eventResize` call `useReschedule`
  hook which POSTs to `PATCH /api/changes/:id/schedule` and presents `ConflictConfirmModal`
  on `HTTP 409 CONFLICT`. `info.revert()` on all failure paths.
- **Portal Workbox SW** (J.7) — `apps/portal/src/pwa/register-sw.ts` checks `VITE_USE_MOCKS`
  at bundle time; production builds register `sw.js` (Workbox); dev/CI builds skip (MSW stays
  controller). Three runtime cache strategies cover the full API surface.

---

## Known issues

- **Staging validation pending (J.0 deferred).** v1.0 and v1.1 ship without a live BFF smoke
  test against the on-prem cluster — the deploy target host (`10.11.36.21`, per operator
  memory `deploy_target.md`) has no container runtime provisioned as of 2026-06-04 (no
  docker / k3s / microk8s / helm on the host). Unblock criteria in
  [`docs/plans/J.0.md`](./plans/J.0.md). Operators pulling the v1.1 chart should provision
  the cluster + run `scripts/release-dry-run.sh` before exposing the deploy to users.
- **Real cross-tenant query (J.2 closed N/A).** CA SDM 17.4 dev/test instance at
  `10.11.35.35:8050` is single-tenant (tenant collection `COUNT=0` per
  `real-backend-contracts.md §6`). The I.5-shipped BFF cross-tenant surface
  (`sp-impersonation.ts`, `tenant-scoping.ts` `?tenants=all`, audit emit) + MSW overlay is
  the production path on this instance. If a multi-tenant CA SDM comes online, the follow-up
  is verification of the existing I.5 code path, not new build.
- **KB analytics real ingest (J.4 closed N/A).** MSW fixture is the production behaviour on
  the dev/test backend. F.4 audit taxonomy is frozen; adding `data.kb.read` /
  `data.kb.search` emission would violate Hard rules. Purpose-built telemetry channel deferred
  to v2.0 until production traffic surfaces demand. Swap point at `kb-analytics.ts:103`.
- **PWA offline submit (J.7 read-only scope).** v1.1 PWA ships installability + cached reads
  only. IndexedDB mutation queue (offline draft + reconnect-replay) deferred to v1.2+ per
  user decision 2026-06-04, until production mobile traffic confirms demand (J.0 cluster
  still pending).
- **Incident attachments (H.3 deferral).** KB attachments shipped per J.5; incident-side
  binary attachments remain deferred to v1.2+.
- **Attachments storage durability.** File-system storage under `BFF_ATTACHMENTS_DIR` is
  per-BFF-instance and lost on container restart unless a PVC mounts the path. The Helm chart
  does NOT provision a PVC by default in v1.1 — operator must add a `hostPath` volume or
  external PVC in `values-staging.yaml` overrides. PVC chart template deferred to v1.2+.
- **Workspace image single-arch on v1.0 only.** v1.1 fixes this via J.1 native arm64 runner.
  v1.0 workspace (`ghcr.io/spigotek/sdm-workspace:1.0.0`) remains amd64-only; arm64 clusters
  cannot run v1.0 workspace (BFF + portal unaffected).
- **PWA `png iTXt` metadata.** PNG uploads via J.5 do not strip iTXt/tEXt metadata chunks
  (low-risk text; no EXIF equivalent in PNG). Deferred to v1.2+ alongside PVC template.

---

## Roadmap — v1.2 / v2.0

**v1.2 scope (indicative):**

- J.0 staging validation closure — when cluster runtime is provisioned on `10.11.36.21`,
  run `scripts/release-dry-run.sh` + fill `RELEASE-DRY-RUN.md` GO/NO-GO matrix.
- H.3 incident attachments — mirror J.5 pattern for portal new-incident + ticket-detail.
- PWA offline mutation queue — IndexedDB draft + reconnect-replay (J.7 deferred half).
- PNG `iTXt` metadata strip (J.5 follow-up).
- Attachments PVC chart template (Helm `v.bff.attachments.persistentVolumeClaim`).

**v2.0 scope (indicative):**

- Vite SSR pivot — fallback if LHCI nightly shows LCP regression after J.8 copy change
  (J.8 plan §Open questions).
- KB analytics real ingest — purpose-built telemetry channel + FE beacons + aggregation,
  once production traffic surfaces demand (J.4 N/A follow-up).
- Multi-instance SSE event-bus Redis adapter — J.3 in-memory bus is single-process; Redis
  pub/sub needed for multi-replica BFF deployment (J.3 architecture highlight).
- CMDB editor + Visualizer integration.
- KB editor multi-user (Yjs / Loro).
- Reporting widgets.
- Bulk operations in workspace queue (per `GOAL.md §3 v1`).
- CAB meeting big-screen mode (`CalendarPresenter`).

---

## Credits

SDM-Rewrite team + claude-code-orchestrated subagent dispatch — Phase J end-to-end was
authored via per-chunk plan-then-implement pattern with strict PR-flow discipline
(squash `--admin --delete-branch`, parent merges, no stacked PRs).

Maintainer: Spigotek &lt;dusan.lago@soimco.sk&gt;.
