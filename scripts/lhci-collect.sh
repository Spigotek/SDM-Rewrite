#!/usr/bin/env bash
# Lighthouse CI runner — builds the requested app WITHOUT `VITE_USE_MOCKS`
# (so the production bundle is what gets measured — no MSW client runtime
# in the SPA), then serves the resulting `dist/` via `@sdm/stub-bff`, which
# replays `@sdm/api-mocks` handlers as plain node HTTP responses. The
# previous I.0 iteration used `VITE_USE_MOCKS=true` + `vite preview` which
# loaded the 260 KB MSW client into the runtime and inflated portal mobile
# TTI past the `performance.md §2` budget. The stub BFF keeps the fixture
# parity but moves the mock layer off the SPA's critical path.
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
  portal) PORT=5180 ;;
  workspace) PORT=5181 ;;
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
  portal/critical) LHCI_URLS=("http://localhost:$PORT/") ;;
  workspace/critical) LHCI_URLS=("http://localhost:$PORT/queue") ;;
  portal/all | workspace/all) LHCI_URLS=() ;;
  *)
    echo "lhci-collect: unknown scope variant '$SCOPE'" >&2
    exit 2
    ;;
esac

echo "lhci-collect: scope=$SCOPE app=$APP port=$PORT config=$CONFIG"

# Build the production SPA bundle. `VITE_USE_MOCKS` is deliberately UNSET so
# the conditional `await import("./mocks/browser")` branch is dead-code-
# eliminated by Vite (verify: `dist/assets/` should contain no `msw` chunk).
echo "lhci-collect: building @sdm/$APP (production bundle, no VITE_USE_MOCKS)..."
unset VITE_USE_MOCKS
pnpm --filter "@sdm/$APP" build

# Start the stub BFF in the background; trap kills it on exit (clean + on
# error). `DIST_DIR` is absolute so cwd-changes inside `lhci collect` can't
# break asset resolution.
DIST_ABS="$REPO_ROOT/apps/$APP/dist"
echo "lhci-collect: starting stub BFF on :$PORT (dist=$DIST_ABS)..."
DIST_DIR="$DIST_ABS" PORT="$PORT" \
  pnpm --filter "@sdm/stub-bff" run start \
  >"/tmp/lhci-stub-bff-$APP.log" 2>&1 &
STUB_PID=$!
cleanup() {
  if kill -0 "$STUB_PID" 2>/dev/null; then
    kill "$STUB_PID" 2>/dev/null || true
    wait "$STUB_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

# Poll `/config` until the stub BFF answers. `/config` exercises both the
# HTTP layer and a real `@sdm/api-mocks` handler, so a 200 here proves the
# fixture wiring works end-to-end. Bounded 30 s ceiling so the script fails
# fast if the stub never comes up.
echo "lhci-collect: waiting for stub BFF /config..."
for i in $(seq 1 30); do
  if curl -fs "http://localhost:$PORT/config" >/dev/null 2>&1; then
    echo "lhci-collect: stub BFF ready (took ${i}s)"
    break
  fi
  if [[ "$i" == "30" ]]; then
    echo "lhci-collect: stub BFF never became ready on :$PORT" >&2
    echo "--- stub-bff log ---" >&2
    cat "/tmp/lhci-stub-bff-$APP.log" >&2 || true
    exit 1
  fi
  sleep 1
done

cd "$REPO_ROOT/apps/$APP"

if [[ ${#LHCI_URLS[@]} -gt 0 ]]; then
  echo "lhci-collect: collecting ${#LHCI_URLS[@]} URL(s) × 3 runs (critical scope)..."
  # Critical scope: override the multi-URL list in lighthouserc.json with a
  # single hot URL so the per-PR gate stays fast.
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
