# J.0 — v1.0 staging deploy + live BFF smoke + rollback test

> **Status**: 🔁 DEFERRED until cluster/runtime provisioned on deploy host.
> **Branch**: TBD (no branch yet — deferred chunk; docs-only commit on `main` capture defer reason).
> **Outcome**: not started — read-only host probe on 2026-06-04 revealed the deploy target lacks any
> container runtime, so the v1.0 helm chart + GHCR images shipped in I.7 cannot be exercised against
> a live cluster yet. Unblock criteria documented below; chunk re-opens when criteria are met.

## Cieľ

Validate the v1.0 release against a real cluster + real CA SDM 17.4 backend:

- helm install of `oci://ghcr.io/spigotek/charts/sdm:1.0.0` against on-prem staging cluster.
- Live 18-journey acceptance smoke (chromium) via `playwright.config.live.ts`.
- Rollback test (RTO < 5 min) per `scripts/rollback-test.sh`.
- Fill `docs/RELEASE-DRY-RUN.md` with live numbers + GO/NO-GO verdict.
- Update `docs/agents/qa-test-strategy/acceptance-coverage.md` "Live BFF" column per row.

## Pivot vs ROADMAP

`J.md` lists J.0 as P0 HARD BLOCKER prerequisite for J.1+. **This chunk does not block J.1-J.8**
(feature work) when the blocker is purely infrastructure provisioning. J.1-J.8 ship MSW + unit +
multi-browser coverage and remain reversible; J.9 (v1.1 cut) **does** require J.0 GO before tag —
release of v1.1 without ever exercising v1.0 deploy would compound un-validated layers.

The original I.6 scaffolding (PR #47) assumed kubeconfig + helm + cluster ready at v1.0 release
time. That assumption was not invalidated by Phase I closure — it was simply never exercised. Phase J
opens with the gap visible.

## Inputs (when unblocked)

- **`docs/RELEASE-DRY-RUN.md`** — post-mortem template (I.6). Fill Metadata, Pre-flight,
  Sequence + timings, Rollback, Performance baseline, Sentry, Multi-tenancy, Step-up 2FA, Go/No-Go,
  Sign-off.
- **`scripts/release-dry-run.sh`** — orchestrator (helm install + pod wait + readyz + 18-journey).
- **`scripts/rollback-test.sh`** — rollback + top-5 critical-path smoke (RTO target < 5 min).
- **`deploy/helm/sdm/values-staging.yaml`** — vault-ref placeholders; operator substitutes real
  values (CA_SDM_PASSWORD, SESSION_SECRET, SENTRY_DSN, BFF_REDIS_URL) at deploy time. **Bump
  `tag: "1.0.0-rc.1"` → `tag: "1.0.0"`** before install (template still references rc.1 from I.6).
- **`docs/agents/qa-test-strategy/acceptance-coverage.md`** — "Live BFF" column to fill per row.
- **`docs/agents/devex-devops/real-backend-contracts.md`** — CA SDM 17.4 contract expectations.
- **Memory `deploy_target.md`** — on-prem host 10.11.36.21 (soisd / port 88).
- **Memory `real_backend.md`** — CA SDM creds (vueuser).

## Outputs (when unblocked)

```
docs/RELEASE-DRY-RUN.md                             # FILLED (Metadata, timings, journey table, RTO, Sentry, GO/NO-GO)
docs/agents/qa-test-strategy/acceptance-coverage.md # "Live BFF" column per row
docs/ROADMAP.md                                     # J.0 ⏸ → ✅ DONE (or 🔴 NO-GO + remediation pointer)
docs/plans/J.0.md                                   # Status DEFERRED → DONE
```

**Direct commit on `main`** — no PR. Docs-only changes from operator-confirmed live results; PR
review adds no value for post-mortem fill, and gating J.1 dispatch on review round-trip would block
follow-up chunks unnecessarily. Commit message: `docs(J.0): live smoke results + GO/NO-GO`.

## Done-when (unblock criteria)

J.0 stays deferred until **all** of:

- [ ] Container runtime + orchestrator on deploy target (one of: k3s, microk8s, docker + compose
      plugin, or pre-existing k8s cluster with kubeconfig accessible to operator).
- [ ] DNS resolution for staging hostname (e.g. `sdm-staging.<host>` resolves to ingress IP).
- [ ] TLS cert provisioned (cert-manager + Let's Encrypt, self-signed, or pre-issued cert in
      `sdm-staging-tls` secret).
- [ ] Sentry project provisioned for `staging` environment, DSN available.
- [ ] Vault / sealed-secrets / inline-values strategy chosen for CA SDM creds + SESSION_SECRET +
      SENTRY_DSN + BFF_REDIS_URL (operator decision — not gated on tool choice).
- [ ] Operator can run `kubectl get nodes` / `helm ls` against the target cluster.

Once unblocked, J.0 completes when:

- [ ] `scripts/release-dry-run.sh` exits 0 against staging.
- [ ] 18/18 journeys pass (or explicit deviation + Phase I.x patch tracked).
- [ ] `scripts/rollback-test.sh` exits 0 + RTO < 5 min.
- [ ] Sentry receives staging events with `release: 1.0.0` tag + scrubbed payload.
- [ ] `docs/RELEASE-DRY-RUN.md` filled + GO box checked.
- [ ] `acceptance-coverage.md` "Live BFF" column updated per row.
- [ ] `docs/ROADMAP.md` J.0 → ✅ DONE.

## Stratégia (when unblocked)

### Fáza A — Pre-flight checklist

1. Operator confirms kubeconfig context, helm + kubectl versions, ingress class, TLS path.
2. Substitute `values-staging.local.yaml` (mode 600, never commit) with real secrets.
3. Verify GHCR pull works from cluster (image pull secret or anonymous pull for public packages).

### Fáza B — Deploy + smoke

1. `BASE_URL=https://<host> VALUES=/tmp/values-staging.local.yaml bash scripts/release-dry-run.sh`
2. Watch helm install timings, pod ready, /readyz first 2xx.
3. 18-journey live run; collect per-journey result table.

### Fáza C — Rollback test

1. `BASE_URL=https://<host> bash scripts/rollback-test.sh`
2. Measure rollback start → /readyz green → critical-5 green; target < 5 min.

### Fáza D — Out-of-band checks

1. Sentry crash + verify event arrives with release + scrub.
2. Multi-tenancy: tenant switch flushes BFF cache (X-Response-Tenant header validation).
3. Cross-tenant deep link → 404 (not 403) per I.3 contract.
4. Step-up 2FA: EMERGENCY change approve without `X-Step-Up-Token` → 403.
5. Lighthouse mobile against `${BASE_URL}/` — record numbers per RELEASE-DRY-RUN.md §5.

### Fáza E — Fill docs + commit

1. Parent agent (claude) fills `docs/RELEASE-DRY-RUN.md` from operator-supplied results.
2. Update `acceptance-coverage.md` Live BFF column per row.
3. Toggle `docs/ROADMAP.md` J.0 ⏸ → ✅ DONE.
4. `git commit -m "docs(J.0): live smoke results + GO/NO-GO"` on `main`.

### Fáza F — Branch decision

- **GO** → proceed to J.9 (v1.1 cut) with confidence; intermediate J.1-J.8 stayed reversible until
  this point.
- **NO-GO** → escalate via AskUserQuestion. Likely remediation = Phase I.x patch chunk (e.g. tenant
  WC sweep gap, BFF /readyz instability, audit emit divergence) before J.9.

## Open questions / risks — recommended resolutions

- **k3s vs docker-compose vs existing cluster** — depends on operator constraint. **Recommendation**:
  if SDM is the only workload on `10.11.36.21`, install k3s (single-node, lightweight, helm-native).
  If SoimcoDesk legacy must coexist on same host with current 80/443 nginx, consider docker-compose
  (re-package v1.0 deploy to plain compose stack and treat helm as v2.0 multi-node target). Decision
  out of J.0 scope — operator/sysadmin call.
- **values-staging.yaml `tag: "1.0.0-rc.1"`** — I.6 template stale. Bump to `"1.0.0"` before install
  (or pass `--set image.tag=1.0.0` + per-service overrides). Update template in repo if v1.1 reuses
  same path.
- **Workspace amd64-only** (per I.7 release.yml comment) — if target cluster is arm64, J.0 blocks
  on J.1 (workspace arm64 image) first. **Recommendation**: J.1 first regardless — small chunk,
  removes the dependency, gives the v1.1 cut full multi-arch parity.
- **Sentry staging project** — if not provisioned, set `SENTRY_DSN: null` in values and skip §6
  verification with explicit deviation note. Production cut requires real DSN.
- **18-journey live divergence** — journey-15 (kb-analytics) uses MSW fixture per I.4; real CA SDM
  has no KB analytics surface. Live result for #15 = N/A (deferred to J.4 real ingest). Document as
  deviation, do not mark NO-GO solely for #15 fail.

## Notes pre subagenta

**No subagent dispatch for J.0** — chunk is operator-driven (cluster provisioning + helm install +
secrets substitution). Parent agent (claude) only fills docs from operator-supplied results. If a
subagent is ever spawned for this chunk, it would be limited to read-only post-mortem document
authoring — never destructive cluster ops.

## Host probe summary (2026-06-04, parent agent)

Read-only SSH probe of `soisd@10.11.36.21` produced this inventory:

- Ubuntu 24.04.4 LTS, services: nginx (80/443), postgresql@17, redis, soimcodesk-api, soimcodesk-worker.
- **No container runtime installed** (docker, podman, k3s, microk8s, nerdctl, crictl, ctr — all
  missing). No snap packages.
- Port 88 (per `deploy_target.md`) not in listen list — SDM not yet deployed.
- `/opt`, `/srv` empty. `/home/soisd/` holds legacy SoimcoDesk `be_app.tar.gz` + `fe_dist.tar.gz`
  (tarball-style deploy, not container-based).

Autonomous claude declined to install k3s/docker via sudo — shared host running production legacy
SoimcoDesk + Postgres + Redis, blast radius too high for an autonomous session per global CLAUDE.md
"Ask before: server restarts / prod migrations" rule.
