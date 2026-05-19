#!/usr/bin/env bash
# F.4 live smoke — exercise the BFF platform endpoints (config / readyz)
# against the real CA SDM dev/test backend.
#
# Usage:
#   SDM_USER=vueuser SDM_PASS='…' BFF_BASE=http://localhost:5174 ./scripts/smoke-f4.sh
#
# Expected outcomes (per docs/plans/F.4.md Done-when):
#  - /config returns canonical RuntimeConfig (apiBaseUrl, auth, tenants, features, meta…)
#  - /readyz returns 200 + checks.bootstrap=ok + checks.sdmRead=ok against real B-E
#  - /readyz returns 503 + structured reason when broker creds are invalid
set -euo pipefail

: "${SDM_USER:?set SDM_USER}"
: "${SDM_PASS:?set SDM_PASS}"
BFF_BASE="${BFF_BASE:-http://localhost:5174}"

say() { printf '\n== %s ==\n' "$1"; }

say "/healthz (liveness — must always 200)"
curl -fsS --max-time 2 "$BFF_BASE/healthz" | python3 -m json.tool

say "/config (canonical RuntimeConfig shape)"
curl -fsS --max-time 3 "$BFF_BASE/config" -D /tmp/f4-config.headers -o /tmp/f4-config.json
grep -i 'cache-control:' /tmp/f4-config.headers || true
python3 -m json.tool < /tmp/f4-config.json | head -40
python3 -c '
import json
cfg = json.load(open("/tmp/f4-config.json"))
required = [("apiBaseUrl",), ("apiBasePath",), ("auth", "mode"), ("auth", "bffOrigin"),
            ("tenants", "defaultMode"), ("features",), ("meta", "appVersion"),
            ("meta", "buildId"), ("meta", "deployedAt")]
for path in required:
    cur = cfg
    for k in path: cur = cur[k]
print("config: all required keys present")'

say "/readyz (real B-E — should be ready)"
curl -fsS --max-time 5 "$BFF_BASE/readyz" -o /tmp/f4-readyz.json -w 'status=%{http_code}\n'
python3 -m json.tool < /tmp/f4-readyz.json
python3 -c '
import json
r = json.load(open("/tmp/f4-readyz.json"))
assert r["status"] == "ready" and r["checks"]["bootstrap"] == "ok" and r["checks"]["sdmRead"] == "ok", r
print("readyz: ready")'

echo
echo "OK — F.4 smoke complete. Run with bad CASDM_BASIC_AUTH_PASS to verify the 503 path."
