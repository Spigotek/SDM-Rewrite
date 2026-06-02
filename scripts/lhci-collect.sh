#!/usr/bin/env bash
# Lighthouse CI runner — builds the requested app with `VITE_USE_MOCKS=true`
# (MSW intercepts `/config`, `/me`, `/me/tenants`, etc. so the bootstrap can
# complete), serves the build via `vite preview` on the app's canonical port,
# and runs `lhci collect --url=...` against the live HTTP server. This is the
# I.0 replacement for the older `staticDistDir` flow, which failed because
# `/config` returned a static-asset 404 → bootstrap error fallback → LCP/TTI
# measuring the fallback DOM rather than the actual route.
#
# Scopes:
#   portal-critical    — portal `/` only (per-PR fast gate, ~2-3 min)
#   workspace-critical — workspace `/queue` only (per-PR fast gate)
#   portal-all         — full portal route sweep (nightly / Phase I gate)
#   workspace-all      — full workspace route sweep (nightly / Phase I gate)
#
# Usage:
#   ./scripts/lhci-collect.sh portal-critical
#   ./scripts/lhci-collect.sh workspace-all

set -euo pipefail

SCOPE="${1:-portal-critical}"
APP="${SCOPE%%-*}"
VARIANT="${SCOPE#*-}"

case "$APP" in
  portal) PORT=5173 ;;
  workspace) PORT=5175 ;;
  *)
    echo "lhci-collect: unknown scope '$SCOPE' — expected portal-* or workspace-*" >&2
    exit 2
    ;;
esac

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONFIG="$REPO_ROOT/apps/$APP/lighthouserc.json"

if [[ ! -f "$CONFIG" ]]; then
  echo "lhci-collect: missing config $CONFIG" >&2
  exit 2
fi

# `critical` scope picks the single most-important URL (per `performance.md`):
# portal `/` (Lucia mobile home), workspace `/queue` (Anna default landing).
# `all` audits every URL declared in lighthouserc.json.
case "$APP/$VARIANT" in
  portal/critical) LHCI_URLS=("http://localhost:5173/") ;;
  workspace/critical) LHCI_URLS=("http://localhost:5175/queue") ;;
  portal/all | workspace/all) LHCI_URLS=() ;;
  *)
    echo "lhci-collect: unknown scope variant '$SCOPE'" >&2
    exit 2
    ;;
esac

echo "lhci-collect: scope=$SCOPE app=$APP port=$PORT config=$CONFIG"

# Build with MSW bootstrap baked in. `import.meta.env.VITE_USE_MOCKS` is
# replaced at build time, so the flag MUST be set here, not at preview.
echo "lhci-collect: building @sdm/$APP with VITE_USE_MOCKS=true..."
VITE_USE_MOCKS=true pnpm --filter "@sdm/$APP" build

# Start `vite preview` in the background; trap kills it on exit (clean + on
# error). `--strictPort` makes the script fail fast if the port is occupied.
echo "lhci-collect: starting vite preview on :$PORT..."
pnpm --filter "@sdm/$APP" preview --port "$PORT" --strictPort >"/tmp/lhci-preview-$APP.log" 2>&1 &
PREVIEW_PID=$!
cleanup() {
  if kill -0 "$PREVIEW_PID" 2>/dev/null; then
    kill "$PREVIEW_PID" 2>/dev/null || true
    wait "$PREVIEW_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

# Poll the preview server until it answers `/` with HTTP 200 — bounded by a
# 30 s ceiling so the script fails fast if vite preview never comes up.
echo "lhci-collect: waiting for preview server..."
for i in $(seq 1 30); do
  if curl -fsI "http://localhost:$PORT/" >/dev/null 2>&1; then
    echo "lhci-collect: preview ready (took ${i}s)"
    break
  fi
  if [[ "$i" == "30" ]]; then
    echo "lhci-collect: preview server never became ready on :$PORT" >&2
    echo "--- preview log ---" >&2
    cat "/tmp/lhci-preview-$APP.log" >&2 || true
    exit 1
  fi
  sleep 1
done

# Verify MSW worker is reachable — if this 404s, the bootstrap will fail
# inside Lighthouse's headless Chrome and the audit will measure the error
# fallback again. Better to fail loudly here than to chase a confusing LCP
# regression downstream.
if ! curl -fsI "http://localhost:$PORT/mockServiceWorker.js" >/dev/null 2>&1; then
  echo "lhci-collect: mockServiceWorker.js not served from :$PORT — MSW build is broken" >&2
  exit 1
fi

cd "$REPO_ROOT/apps/$APP"

if [[ ${#LHCI_URLS[@]} -gt 0 ]]; then
  echo "lhci-collect: collecting ${#LHCI_URLS[@]} URL(s) × 3 runs (critical scope)..."
  # Critical scope: override the multi-URL list in lighthouserc.json with a
  # single hot URL so the per-PR gate stays fast. `lhci collect --url` is
  # additive on top of the config, so we pass --url for each entry and also
  # disable the config's `url[]` via the env override that LHCI honours.
  npx --no-install lhci collect \
    --config="./lighthouserc.json" \
    $(printf -- '--url=%s ' "${LHCI_URLS[@]}")
else
  echo "lhci-collect: collecting all URLs from lighthouserc.json × 3 runs (full scope)..."
  npx --no-install lhci collect --config="./lighthouserc.json"
fi

echo "lhci-collect: asserting thresholds..."
npx --no-install lhci assert --config="./lighthouserc.json"

echo "lhci-collect: ✓ all assertions passed"
