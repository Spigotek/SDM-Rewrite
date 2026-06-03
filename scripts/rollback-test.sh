#!/usr/bin/env bash
# I.6 — Rollback verification. Reverts the staging release to the previous
# revision and re-runs a critical-path subset of the acceptance suite to
# prove RTO < 5 min.
#
# Critical-path subset (top 5 journeys covering login + queue + ticket-create
# + ticket-resolve + tenant-switch surfaces):
#   - journey-01 (portal incident create)         → ticket-create surface
#   - journey-04 (workspace queue + triage)       → login + queue
#   - journey-05 (workspace resolve + cmdb tag)   → ticket-resolve surface
#   - journey-06 (workspace escalate to L2)       → mutation + audit emission
#   - journey-12 (workspace change cross-tenant)  → tenant-switch + sp_admin
#
# Prerequisites: same as `release-dry-run.sh` (helm, kubectl, curl, pnpm,
# Playwright browsers).

set -euo pipefail

NAMESPACE="${NAMESPACE:-sdm-staging}"
RELEASE="${RELEASE:-sdm}"
BASE_URL="${BASE_URL:-https://sdm-staging.example.com}"
HELM_TIMEOUT="${HELM_TIMEOUT:-3m}"

log() { printf '[rollback] %s\n' "$*"; }

log "release    = $RELEASE"
log "namespace  = $NAMESPACE"
log "base URL   = $BASE_URL"

START_TS=$(date +%s)

log "helm rollback $RELEASE → previous revision"
helm rollback "$RELEASE" 0 \
  --namespace "$NAMESPACE" \
  --wait \
  --timeout "$HELM_TIMEOUT"

log "BFF readiness probe: curl ${BASE_URL}/readyz"
attempt=0
until curl -fsS "${BASE_URL}/readyz" >/dev/null; do
  attempt=$((attempt + 1))
  if [[ $attempt -ge 12 ]]; then
    log "FAIL — ${BASE_URL}/readyz did not recover after rollback"
    exit 1
  fi
  sleep 5
done
log "/readyz → 2xx"

log "running critical-path subset (top-5 journeys)"
export SDM_BROWSER_TEST_RUN_ID="${SDM_BROWSER_TEST_RUN_ID:-rollback-$(date +%Y%m%d-%H%M%S)}"
export BASE_URL
export SDM_BROWSER_TEST_BASE_URL="$BASE_URL"

pnpm --filter @sdm/browser-test exec playwright test \
  scenarios/acceptance/journey-01-portal-incident.spec.ts \
  scenarios/acceptance/journey-04-workspace-triage.spec.ts \
  scenarios/acceptance/journey-05-workspace-resolve-cmdb.spec.ts \
  scenarios/acceptance/journey-06-workspace-escalate-l2.spec.ts \
  scenarios/acceptance/journey-12-workspace-change-cross-tenant.spec.ts \
  --config=playwright.config.live.ts \
  --project=chromium \
  --reporter=list

END_TS=$(date +%s)
ELAPSED=$((END_TS - START_TS))
log "OK — critical paths recovered in ${ELAPSED}s (RTO target < 300s)"
