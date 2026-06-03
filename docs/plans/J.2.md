# J.2 — Real BFF cross-tenant query (CA SDM 17.4 eval + impl)

> **Status**: ✅ N/A — closed without code change. BFF cross-tenant surface (endpoint, audit emit,
> MSW overlay) was already shipped in I.5 (PR #46); the unique J.2 delta would have been "real CA
> SDM cross-tenant query", which is structurally inapplicable to the dev/test instance at
> `10.11.35.35:8050` (tenant table empty per `real-backend-contracts.md §6`).
> **Branch**: none (docs-only closure on `main`).
> **Outcome**: pre-flight capability eval against real backend confirmed single-tenant config (zero
> rows in `/tenant` collection). I.5's BFF (`sp-impersonation.ts` + `tenant-scoping.ts` `?tenants=all`
>
> - audit emit) + MSW overlay already cover the FE journeys (#12 cross-tenant-conflict, #18
>   shared-CI marker). No graduation path exists on this instance; chunk closes as N/A.

## Cieľ (had it been actionable)

J.0/J.md skeleton listed J.2 as "real BFF cross-tenant query against CA SDM 17.4 — graduates I.5
MSW-overlay primary path to real backend; may require WC `tenant in (...)` syntax". The intent was
to swap the MSW-overlay code path for a real backend round-trip when the BFF is configured with
`BFF_CA_SDM_USE_MOCKS=false`.

## Pre-flight finding (2026-06-04)

Cross-tenant query against real CA SDM was eval'd:

| Probe               | Endpoint                                  | Result                                                                 |
| ------------------- | ----------------------------------------- | ---------------------------------------------------------------------- |
| Reachability        | `10.11.35.35:8050` ping + TCP 8050        | OK (4 ms RTT, port open)                                               |
| Tenant collection   | `GET /caisd-rest/tenant?size=10` (per §6) | `<collection_tenant COUNT="0" START="0" TOTAL_COUNT="0"/>` — zero rows |
| Implication for J.2 | —                                         | No tenants configured → no cross-tenant WC query meaningful            |

This matches `real-backend-contracts.md §6` (line 172-180) which already concluded _"this instance
is single-tenant"_ during Phase F.1. Phase F.2+ dropped tenant scoping at the BFF entity-proxy
layer per that finding.

## What I.5 already shipped

PR #46 (squash `f51e3a6`) introduced the BFF cross-tenant surface in full:

- **`apps/bff/src/auth/sp-impersonation.ts`** — `GET /me/sp-tenants`, `POST /api/sp/view-as`
  (step-up gated, 1 h TTL), `DELETE /api/sp/view-as`; audit emit reuses `authz.tenant.switch.*`
  with `details.op: "sp.view_as.*"` (F.4 frozen taxonomy honoured).
- **`apps/bff/src/api/tenant-scoping.ts`** — `sp_admin` can pass `?tenants=all` → BFF aggregates
  across SP-scoped tenants + audit emit per query.
- **`packages/api-mocks/src/handlers/{changes,cmdb}.ts`** — `?tenants=all` returns cross-tenant
  data (sp_admin-only, with 403 leakage check for non-sp_admin probes).
- **FE journeys #12 + #18 → pass**; §4.2 `cross-tenant-view-sp-l14` → pass.
- **`acceptance-coverage.md`**: 18/18 acceptance matrix complete.

The "real backend path" was never the I.5 deliverable — I.5 explicitly scoped to MSW-overlay
(per its `Open questions §4` resolution: "FE + BFF + MSW shipped today exercise full flow
end-to-end"). J.2 would have closed that gap.

## Why J.2 closes as N/A (not deferred)

Three concrete reasons:

1. **Structural impossibility on dev backend**. `?tenants=all` against a zero-tenant CA SDM
   instance has no WC syntax that makes the query "real". You cannot query rows from tenants
   that don't exist. Best-case real-backend behaviour is "return empty array" — which I.5's
   MSW-overlay already emulates correctly for the test fixture path.
2. **No production multi-tenant CA SDM is currently in scope**. `deploy_target.md` host
   (10.11.36.21) doesn't run CA SDM (it runs the legacy SoimcoDesk tarball). The CA SDM at
   10.11.35.35 is the dev/test instance and is single-tenant. There's no third instance to
   target. Adding code for a configuration that doesn't exist would be speculative and would
   bit-rot.
3. **I.5's audit-emit + MSW path is already the production-ready behaviour** on this instance.
   When/if a multi-tenant CA SDM is configured later, the BFF code paths in I.5
   (`tenant-scoping.ts MOD` for `?tenants=all`) are already wired to construct the WC clause
   from `session.spTenants[]` — only the _test fixture path_ is MSW; the _real path_
   pre-exists in I.5 but is currently a no-op against zero-tenant backend.

If a multi-tenant CA SDM ever does come online, the J.2-equivalent work is **verify** (not
"build"): run the existing I.5 BFF code path against the new backend, confirm WC `tenant in
(...)` syntax is accepted, confirm audit emit fires per-tenant correctly. Estimated ~1-day
verification task; not a Phase J chunk.

## Outputs (this closure)

```
docs/plans/J.2.md                                   # NEW: this file (status N/A)
docs/CHANGELOG.md                                   # MOD: Known issues entry re: cross-tenant + real backend
docs/ROADMAP.md                                     # J.2 → ✅ N/A; J.3 → 🔜 NEXT
```

**Direct commit on `main`** — same pattern as J.0 closure. Docs-only, no PR review value.

## Done-when

- [x] Pre-flight tenant collection probe documented.
- [x] J.2 marked N/A in this file.
- [x] CHANGELOG Known issues entry (operator-visible).
- [x] ROADMAP toggle.

## Open questions / risks — recommended resolutions

- **What if user wants J.2 reopened later?** — Trivial. Pre-condition = multi-tenant CA SDM
  reachable; new chunk = "J.x verify cross-tenant against multi-tenant backend" (verification,
  not build, per reason 3 above).
- **Audit + telemetry on `?tenants=all`** — already emitted per I.5; no change needed.
- **`BFF_CA_SDM_USE_MOCKS=false` path** — when BFF is in real-backend mode, `?tenants=all`
  hitting zero-tenant CA SDM degenerates to an empty result (no error). FE journey #12 only
  runs in MSW mode in current CI; no production exposure.

## Notes

This is a docs-only closure. No code touched. Subagent dispatch is **not** applicable.
