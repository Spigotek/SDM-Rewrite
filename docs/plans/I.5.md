# I.5 — SP cockpit / cross-tenant view (sp_admin "All my tenants" overlay)

> **Status**: 🔜 (blokované na I.3 — uses tenant scoping infra)
> **Branch**: `chunk/I.5-sp-cockpit` > **PR**: TBD
> **Cieľ**: implementovať Service Provider admin cockpit — `sp_admin` persona
> sees "All my tenants" overlay v change calendar (cross-tenant conflict detection),
> shared-CI marker v CMDB (CIs assigned to multiple tenants), cross-tenant
> relationship graph (CMDB CI s neighbours in foreign tenant). Closes journey #12
> (cross-tenant-conflict) + #18 (shared-CI marker) + §4.2 vectors
> `cross-tenant-view-sp-l14`, `cross-tenant-cmdb-l9` shared marker, `cross-tenant-change-l10` overlay.

## Pivot vs ROADMAP

ROADMAP §v1 scope: "CMDB editor + Visualizer integration" + advanced calendar
features. SP cockpit cross-tenant view je explicitne v1+, **pulled-in** do Phase I
aby zatvorilo journeys #12/#18 a §4.2 SP vectors.

H.10 ChangeCalendar mentioned "Cross-tenant conflict overlay: per wireframe §UI
prvky calendar. **MVP scope**: skip; v1+." — I.5 implementuje.

H.13/H.14 CMDB: cross-tenant CI marker deferred per ROADMAP. I.5 dorobí.

## Inputs

- **`docs/spec/multi-tenancy.md` §SP_ADMIN** — autoritatívne SP impersonation flow.
- **`docs/agents/ux-persona-analyst/wireframes/shared/sp-cockpit.md`** — SP cockpit wireframe (if exists; else derive from `tenant-switcher.md` SP variant).
- **`docs/agents/qa-test-strategy/acceptance-criteria.md` §journey-12/18`** + `§4.2 cross-tenant-view-sp-l14`.
- **`apps/workspace/src/features/changes/`** — H.9/H.10/H.11 baseline (CalendarFilters need tenant overlay).
- **`apps/workspace/src/features/cmdb/`** — H.13/H.14 baseline (CMDB graph needs cross-tenant edges).
- **`packages/auth/src/permissions.ts`** — `cmdb.view.cross_tenant` + `change.view.cross_tenant` permissions (E.2 — verify exist; add if missing).
- **`apps/bff/src/auth/tenant-scoping.ts`** — I.3 baseline; needs SP cross-tenant exception.

## Outputs

```
apps/workspace/src/features/sp-cockpit/             # NEW feature dir
├── SpCockpitRoute.tsx                              # /sp/cockpit landing
├── components/
│   ├── TenantOverview.tsx                          # list all tenants user has SP rights over
│   ├── CrossTenantCalendarOverlay.tsx              # "All my tenants" overlay v ChangeCalendar
│   ├── SharedCiMarker.tsx                          # badge v CMDB CI list/detail
│   └── CrossTenantGraphEdge.tsx                    # different edge style v Cytoscape
├── api.ts
└── hooks.ts

apps/workspace/src/features/changes/components/CalendarFilters.tsx  # MOD: add "All my tenants" toggle (sp_admin only)
apps/workspace/src/features/changes/components/CalendarView.tsx     # MOD: render cross-tenant events with overlay color
apps/workspace/src/features/cmdb/components/CmdbTable.tsx           # MOD: add SharedCiMarker badge for shared CIs
apps/workspace/src/features/cmdb/components/CiHeader.tsx            # MOD: "Shared with N tenants" indicator
apps/workspace/src/features/cmdb/components/CmdbGraph.tsx           # MOD: cross-tenant edge style + tooltip "Foreign tenant: <name>"

apps/bff/src/auth/sp-impersonation.ts                # NEW: GET /me/sp-tenants returns full SP scope; POST /api/sp/view-as { tenantId } sets viewing-as context
apps/bff/src/api/tenant-scoping.ts                   # MOD: sp_admin can pass `?tenants=all` → BFF queries across all SP-scoped tenants (audit emit per query)
apps/bff/tests/sp-impersonation.test.ts              # NEW: 6+ cases (happy, non-sp-admin denied, audit emit, view-as expires, cross-tenant query, leakage check)

packages/api-mocks/src/handlers/users.ts             # MOD: sp_admin user fixture + SP tenant scope
packages/api-mocks/src/handlers/changes.ts           # MOD: ?tenants=all returns cross-tenant data (sp_admin only)
packages/api-mocks/src/handlers/cmdb.ts              # MOD: shared CI scenarios + cross-tenant relationships

apps/workspace/src/routes/index.tsx                  # MOD: /sp/cockpit route (sp.admin gated)
apps/workspace/lighthouserc.json                     # +/sp/cockpit graduated

packages/i18n/catalogs/workspace/{sk,en}.json        # +sp.* keys (~20)
tools/browser-test/scenarios/acceptance/
├── journey-12-workspace-change-cross-tenant.spec.ts # RESTORE: full overlay + step-up gate
└── journey-18-workspace-cmdb-cross-tenant.spec.ts   # RESTORE: shared marker + cross-tenant graph

docs/agents/qa-test-strategy/acceptance-coverage.md  # UPDATE
docs/ROADMAP.md
docs/plans/I.5.md
```

## Done-when

- [ ] `/sp/cockpit` route gated `<RouteGuard requires={["sp.admin"]}>`. Renders TenantOverview list.
- [ ] **Cross-tenant calendar overlay**: sp_admin v `/changes/calendar` sees toggle "All my tenants". Toggled ON → events from all SP-scope tenants rendered, color-coded by tenant. Toggle OFF → only active tenant (default).
- [ ] **Shared-CI marker**: CMDB CI listed/detail s `sharedWithTenantIds: string[]` → badge "Shared (N)" + tooltip listing tenants.
- [ ] **Cross-tenant CMDB graph**: CI relationships pointing to foreign-tenant CI rendered with different edge style + tooltip "Foreign tenant: <name>". Click → drill-in (if sp_admin) OR 403 page (if regular agent).
- [ ] **BFF SP impersonation**: `POST /api/sp/view-as { tenantId }` sets viewing-as context; subsequent queries scope appropriately. Audit emit per impersonation start/stop.
- [ ] **Step-up gate** (per I.1) on critical SP actions (impersonation start, cross-tenant approve, etc.). Per H.11 step-up infra.
- [ ] §4.2 vectors `cross-tenant-view-sp-l14` → pass; journey #12 + #18 partial → pass.

## Stratégia

### Fáza A — BFF SP impersonation + cross-tenant query

1. `apps/bff/src/auth/sp-impersonation.ts`:
   - `GET /me/sp-tenants` → list tenants where user has `sp_admin` role.
   - `POST /api/sp/view-as { tenantId }` → set session `viewingAsTenantId` (separate from `activeTenantId`); audit emit `authz.sp.impersonation.start`.
   - `DELETE /api/sp/view-as` → clear; audit `authz.sp.impersonation.stop`.
2. `tenant-scoping.ts` modify: if request includes `?tenants=all` AND session has `sp_admin` AND no `viewingAsTenantId` → query across all SP-scope tenants. Single mode (viewing as specific tenant) uses `activeTenantId` standard scoping per I.3.
3. Tests: happy, non-sp denied, audit per start/stop/query, expires (1h default), cross-tenant query result shape, no leakage to non-SP users.

### Fáza B — Cross-tenant FE features

1. `CalendarFilters.tsx`: add toggle `<Switch>` "All my tenants" — visible only if `<Can permission="change.view.cross_tenant">`.
2. `CalendarView.tsx`: events colored per `change.tenantId` mapping ku tenant.color (additional dim layer over risk_tier color). Tooltip shows tenant name.
3. `SharedCiMarker.tsx`: simple Badge component "Shared (N)" + Popover with tenant list.
4. `CmdbGraph.tsx`: edge style `relationType === "foreign_tenant"` → dashed orange with tooltip. Cytoscape config addition v `cytoscape-config.ts`.
5. `SpCockpitRoute.tsx`: TenantOverview lists SP-scoped tenants s health summary (open incidents, pending changes, critical CIs count).

### Fáza C — Browser tests + journey restoration + PR

1. Journey #12 spec: sp_admin login → /changes/calendar → toggle "All my tenants" → assert events from 2+ tenants visible → click event → drill-in.
2. Journey #18 spec: sp_admin login → /cmdb → assert SharedCiMarker on shared CI → open detail → SharedWithTenants list → graph → assert cross-tenant edge style.
3. Update `acceptance-coverage.md`.

## Open questions / risks — recommended resolutions

- **`sp_admin` role assignment**: per E.2 RBAC matrix sp_admin je 8th role. Verify permission keys exist (`sp.admin`, `change.view.cross_tenant`, `cmdb.view.cross_tenant`, `kb.view.sp_only`). Add to `packages/auth/permissions.ts` if missing.
- **Cross-tenant data shape**: each entity must carry `tenantId` v API response. F.2 entity proxies might strip this (single-tenant assumption per real-backend-contracts §6). I.5 needs `tenantId` exposed pre sp_admin queries. Verify per endpoint.
- **CA SDM cross-tenant query**: real backend may not support cross-tenant `WC` natively. I.5 mock mode (MSW) sufficient pre journey pass. Real implementation deferred to v1++ (Service Provider mode).
- **Impersonation audit trail**: each cross-tenant query must audit-emit s `details.impersonating_tenant: <id>`. Distinguishable from regular tenant access.
- **UX disorientation risk**: sp_admin viewing "all tenants" must always show tenant badge prominently. Else risk wrong actions in wrong tenant.

## Notes pre subagenta

- I.5 dotyká H.10 (calendar) + H.13/H.14 (CMDB) — careful surgical changes, NIE rewrite.
- Reuse Cytoscape `vendor-graph` chunk z H.14 — no new vendor split needed.
- Subagent **NESMIE**:
  - Implementovať full Service Provider billing / multi-tenant onboarding flow (out of scope).
  - Add real-time cross-tenant push (WebSocket out of scope per I.3 precedent).
  - Mergovať vlastný PR.
