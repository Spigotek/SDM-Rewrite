#!/usr/bin/env bash
# I.6 — Release v1.0 dry-run orchestrator.
#
# Sequence:
#   1. helm install (or upgrade) chart against the configured namespace.
#   2. Wait for every pod to reach Ready.
#   3. 30 s warm-up so the BFF can establish its CA SDM connection pool.
#   4. Hit /readyz on the public ingress — fails fast if the chain is broken.
#   5. Run the full 18-journey Playwright acceptance suite in live mode.
#
# Run from the repo root. Prerequisites: `helm`, `kubectl`, `curl`, `pnpm`,
# Playwright browsers installed (`pnpm --filter @sdm/browser-test exec playwright install chromium`).
#
# Cluster credentials and CA SDM secrets must already be present in the
# environment (kubeconfig + values file with real refs). This script never
# commits credentials.

set -euo pipefail

NAMESPACE="${NAMESPACE:-sdm-staging}"
RELEASE="${RELEASE:-sdm}"
VALUES="${VALUES:-deploy/helm/sdm/values-staging.yaml}"
BASE_URL="${BASE_URL:-https://sdm-staging.example.com}"
HELM_TIMEOUT="${HELM_TIMEOUT:-5m}"
POD_WAIT_TIMEOUT="${POD_WAIT_TIMEOUT:-300s}"
WARMUP_SECONDS="${WARMUP_SECONDS:-30}"

log() { printf '[dry-run] %s\n' "$*"; }

if [[ ! -f "$VALUES" ]]; then
  log "values file not found: $VALUES"
  exit 1
fi

log "release      = $RELEASE"
log "namespace    = $NAMESPACE"
log "values       = $VALUES"
log "base URL     = $BASE_URL"

log "helm upgrade --install $RELEASE → namespace $NAMESPACE"
helm upgrade --install "$RELEASE" deploy/helm/sdm \
  -f "$VALUES" \
  --namespace "$NAMESPACE" \
  --create-namespace \
  --wait \
  --timeout "$HELM_TIMEOUT"

log "waiting up to $POD_WAIT_TIMEOUT for all pods to become Ready"
kubectl wait --for=condition=ready pod --all -n "$NAMESPACE" --timeout="$POD_WAIT_TIMEOUT"

log "warm-up sleep ${WARMUP_SECONDS}s (BFF establishes CA SDM connection pool)"
sleep "$WARMUP_SECONDS"

log "BFF readiness probe: curl ${BASE_URL}/readyz"
attempt=0
until curl -fsS "${BASE_URL}/readyz" >/dev/null; do
  attempt=$((attempt + 1))
  if [[ $attempt -ge 12 ]]; then
    log "FAIL — ${BASE_URL}/readyz did not return 2xx after 60 s"
    exit 1
  fi
  sleep 5
done
log "/readyz → 2xx"

log "running 18-journey acceptance suite against live BFF"
export SDM_BROWSER_TEST_RUN_ID="${SDM_BROWSER_TEST_RUN_ID:-live-$(date +%Y%m%d-%H%M%S)}"
export BASE_URL
export SDM_BROWSER_TEST_BASE_URL="$BASE_URL"

pnpm --filter @sdm/browser-test exec playwright test \
  scenarios/acceptance/ \
  --config=playwright.config.live.ts \
  --project=chromium \
  --reporter=list

log "OK — all checks passed"
