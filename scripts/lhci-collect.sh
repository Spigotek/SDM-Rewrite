#!/usr/bin/env bash
# Lighthouse CI runner — builds the requested app, serves `dist/` via the
# LHCI `staticDistDir` mechanism, runs 3 audits per asserted URL, then
# evaluates assertions from `apps/<app>/lighthouserc.json`.
#
# Scopes:
#   portal-critical    — portal `/` only (per-PR fast gate, ~2-3 min)
#   workspace-critical — workspace `/` only
#   portal-all         — full portal route sweep (nightly, post-Phase H)
#   workspace-all      — full workspace route sweep (nightly, post-Phase H)
#
# Usage:
#   ./scripts/lhci-collect.sh portal-critical
#   ./scripts/lhci-collect.sh workspace-critical

set -euo pipefail

SCOPE="${1:-portal-critical}"
APP="${SCOPE%%-*}"

if [[ "$APP" != "portal" && "$APP" != "workspace" ]]; then
  echo "lhci-collect: unknown scope '$SCOPE' — expected portal-* or workspace-*" >&2
  exit 2
fi

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONFIG="$REPO_ROOT/apps/$APP/lighthouserc.json"

if [[ ! -f "$CONFIG" ]]; then
  echo "lhci-collect: missing config $CONFIG" >&2
  exit 2
fi

echo "lhci-collect: scope=$SCOPE app=$APP config=$CONFIG"

# Build the app — the LHCI config points `staticDistDir` at `./dist`, so
# the build artifacts are what gets audited.
pnpm --filter "@sdm/$APP" build

cd "$REPO_ROOT/apps/$APP"

echo "lhci-collect: collecting 3 runs per URL…"
npx --no-install lhci collect --config="./lighthouserc.json"

echo "lhci-collect: asserting thresholds…"
npx --no-install lhci assert --config="./lighthouserc.json"

echo "lhci-collect: ✓ all assertions passed"
