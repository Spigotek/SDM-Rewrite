# I.6 — Release v1.0 dry-run (helm staging + live BFF smoke + rollback test)

> **Status**: 🔜 (blokované na I.0-I.5 — full stack must be validated)
> **Branch**: `chunk/I.6-release-dry-run` > **PR**: TBD
> **Cieľ**: deploy full stack do staging cluster via helm chart, validate **live**
> 18-journey acceptance smoke proti **real CA SDM 17.4** (10.11.35.35:8050),
> validate rollback flow (helm rollback k previous chart version). Pre-flight pre
> I.7 v1.0 cut.

## Pivot vs ROADMAP

Per ROADMAP §Phase I: "I.4 Release v1.0 dry-run — full helm install do staging,
smoke run, rollback test. Inputs: `system-overview.md` §Release." Renumbered to I.6
v expanded Phase I scope.

ROADMAP Phase H exit criteria #1: "Všetky 18 user journeys ... pass v integration
alebo browser-test mode". H.16 closed against MSW; I.6 validates against LIVE BFF.

## Inputs

- **`docs/system-overview.md` §Release** — helm install procedure.
- **`deploy/helm/sdm/`** — helm chart (C bootstrap).
- **`docs/agents/devex-devops/runtime-config.md`** — runtime config for staging environment.
- **`.github/workflows/release.yml`** — existing release workflow (C bootstrap pattern).
- **`tools/browser-test/scenarios/acceptance/journey-*.spec.ts`** — 18 journey specs (H.16 + I.1-I.5 restored).
- **Memory `deploy_target.md`**: on-prem host `10.11.36.21` (soisd user), app port 88.
- **Memory `real_backend.md`**: CA SDM 17.4 at `10.11.35.35:8050` (vueuser).

## Outputs

```
deploy/helm/sdm/                                   # MOD: values-staging.yaml + chart bump 1.0.0-rc
.github/workflows/acceptance-live.yml              # MOD: graduated from manual-trigger to runs on PR labelled "release-dry-run"
scripts/release-dry-run.sh                         # NEW: orchestrates helm install + live smoke + rollback verification
scripts/rollback-test.sh                           # NEW: helm rollback k previous + verify smoke
docs/RELEASE-DRY-RUN.md                            # NEW: post-mortem template + checklist

docs/agents/qa-test-strategy/acceptance-coverage.md  # UPDATE: live BFF smoke results column
docs/ROADMAP.md                                     # I.6 → ✅ DONE
docs/plans/I.6.md                                   # Status DONE
```

## Done-when

- [ ] **Helm install do staging**: `helm install sdm deploy/helm/sdm -f deploy/helm/sdm/values-staging.yaml --namespace sdm-staging --create-namespace` succeeds. All pods Running.
- [ ] **BFF connects k real CA SDM**: BFF logs show successful auth handshake proti `10.11.35.35:8050` (vueuser). `/readyz` returns 200.
- [ ] **Live 18-journey smoke**: `acceptance-live.yml` workflow runs all 18 journeys × Chromium against staging URL. **18/18 pass** OR explicit P1 deviations documented v `docs/RELEASE-DRY-RUN.md`.
- [ ] **Rollback test**: `helm rollback sdm 0` → previous chart version. Re-run subset of journeys (top 5 highest-traffic) → pass. Document recovery time RTO < 5 min.
- [ ] **Performance proti live BFF**: Lighthouse mobile sweep portal `/` against staging → score ≥ 0.9, TTI ≤ 2.5 s (slightly relaxed vs LHCI mock 1.8 s — real BFF round-trip adds latency).
- [ ] **Health monitoring**: Prometheus / Grafana baseline metrics captured (TBD per `system-overview.md`). Sentry receives test errors successfully.
- [ ] **Multi-tenancy live verify**: tenant switch flow proti live BFF; cross-tenant data leak check on real data.
- [ ] **Step-up live test** (per I.1): emergency change approve proti live BFF with real OIDC step-up (if OIDC available v staging; else mock mode acceptable per I.1 §Open).
- [ ] `docs/RELEASE-DRY-RUN.md` filled out (post-mortem template + go/no-go checklist).
- [ ] ROADMAP toggle.

## Stratégia

### Fáza A — Helm staging values + chart bump

1. `deploy/helm/sdm/Chart.yaml`: bump version `0.x.y` → `1.0.0-rc.1`. App version pinned.
2. `deploy/helm/sdm/values-staging.yaml`:
   ```yaml
   image:
     repository: <registry>/sdm
     tag: "1.0.0-rc.1"
   bff:
     env:
       CA_SDM_BASE_URL: "http://10.11.35.35:8050"
       CA_SDM_USER: "vueuser"
       CA_SDM_PASSWORD: <vault-ref>
       SESSION_SECRET: <vault-ref>
       SENTRY_DSN: <vault-ref>
   ingress:
     host: sdm-staging.example.com
   ```
3. Verify chart lint + template + dry-run install (`helm install ... --dry-run`).

### Fáza B — `acceptance-live.yml` graduation + scripts

1. `acceptance-live.yml` workflow:
   - Trigger: on PR labelled `release-dry-run` + on merge to main if commit message starts s `chore(release):`.
   - Pre-step: deploy chart (or assert chart already deployed v staging cluster).
   - Steps: install playwright browsers; run journey specs s `BASE_URL=https://sdm-staging.example.com`; collect failures.
   - Artefact: HTML report.
2. `scripts/release-dry-run.sh` orchestrates:
   ```bash
   #!/usr/bin/env bash
   set -e
   helm install sdm deploy/helm/sdm -f deploy/helm/sdm/values-staging.yaml --namespace sdm-staging --wait --timeout 5m
   kubectl wait --for=condition=ready pod --all -n sdm-staging --timeout=300s
   sleep 30  # warm-up
   curl -fs https://sdm-staging.example.com/readyz  # BFF health
   pnpm exec playwright test --config=tools/browser-test/playwright.config.live.ts --grep "@acceptance"
   ```
3. `scripts/rollback-test.sh`:
   ```bash
   #!/usr/bin/env bash
   set -e
   helm rollback sdm 0 --namespace sdm-staging --wait --timeout 3m
   curl -fs https://sdm-staging.example.com/readyz
   pnpm exec playwright test --grep "@critical-path"  # top 5 journeys
   ```

### Fáza C — Execute + post-mortem + PR

1. Manual: deploy to staging cluster (requires ops access — per `deploy_target.md` memory `soisd@10.11.36.21`).
2. Execute scripts. Capture results.
3. Document v `docs/RELEASE-DRY-RUN.md`:
   - Helm install timing (target < 3 min)
   - 18 journey results (pass/fail with deviation notes)
   - Rollback timing (RTO target < 5 min)
   - Performance baseline (LHCI live numbers)
   - Sentry error capture verification
4. Open PR with documentation updates.
5. Go/no-go decision pre I.7 v1.0 cut.

## Open questions / risks — recommended resolutions

- **Cluster access**: per `deploy_target.md` on-prem `10.11.36.21:88` — kubeconfig must be available pre subagent OR parent agent runs deployment manually. **Recommendation**: parent runs `helm install` manually, subagent prepares scripts + values + workflow. Hybrid approach.
- **CA SDM credentials in CI**: NEVER commit. Vault-ref or GitHub Secrets per `deploy_target.md` + `real_backend.md` memory pointers.
- **Live test flakiness**: real BFF + CA SDM has latency variance. Some journey specs may need timeout tuning. **Recommendation**: increase Playwright `expect.timeout` to 10s for live mode. Mock mode keeps 5s.
- **Failed journey response**: if 1-2 journeys fail in live mode that pass in MSW, identify gap (likely BFF endpoint shape divergence). Fix in same PR OR explicit deviation note + Phase I.x patch.
- **Rollback verification scope**: top-5 critical paths (login, queue, ticket-create, ticket-resolve, tenant-switch) sufficient — full 18 not necessary post-rollback.
- **Sentry test errors**: deliberate test crash route OR trigger via dev tools console. Verify event arrives v Sentry dashboard.

## Notes pre subagenta

- **I.6 je infra-heavy**, NIE app code chunk. Subagent prepares scripts + workflows + values + post-mortem template. Actual cluster deployment je parent's responsibility (cluster access).
- All credentials externalised — žiadne secrets do repo.
- Subagent **NESMIE**:
  - Commit secrets, kubeconfigs, environment values containing creds.
  - Trigger production deployment.
  - Mergovať vlastný PR.
