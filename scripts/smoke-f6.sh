#!/usr/bin/env bash
# F.6 live smoke — exercise the ticket-detail aggregator's activity/attachments
# fan-out against the real CA SDM 17.4 backend (via the BFF).
#
# Requires the BFF to be running locally with CASDM_BASE_URL pointing at a real
# instance (or one reachable through VPN). Creds (SDM_USER, SDM_PASS) come from
# env — never commit a populated value.
#
# Usage:
#   pnpm --filter @sdm/bff dev &  # in another shell, with CASDM_* env set
#   SDM_USER=vueuser SDM_PASS='…' BFF_BASE=http://localhost:5174 ./scripts/smoke-f6.sh
#
# Expected outcomes (per docs/plans/F.6.md Done-when):
#   - All 4 ticket types return 200 with activity._unsupported=false
#   - Tickets known to have activity entries (pr/406621, chg/2781) populate items
#   - linked._unsupported stays true (§24 — no BREL on this instance)
#   - Cache hit returns in <10ms

set -euo pipefail

: "${SDM_USER:?set SDM_USER (e.g. vueuser)}"
: "${SDM_PASS:?set SDM_PASS}"
BFF_BASE="${BFF_BASE:-http://localhost:5174}"
COOKIE_JAR="$(mktemp)"
trap 'rm -f "$COOKIE_JAR"' EXIT

say() { printf '\n== %s ==\n' "$1"; }

say "login"
curl -fsS -c "$COOKIE_JAR" -H 'Content-Type: application/json' \
  -H "Origin: $BFF_BASE" \
  --data "{\"username\":\"$SDM_USER\",\"password\":\"$SDM_PASS\"}" \
  "$BFF_BASE/auth/login" -o /tmp/f6-login.json -w 'login=%{http_code}\n'

# Helper: fetch one ticket detail and print a compact line.
fetch_detail() {
  local type="$1" id="$2"
  local out="/tmp/f6-td-${type}-${id}.json"
  curl -fsS -b "$COOKIE_JAR" "$BFF_BASE/api/tickets/$type/$id" -o "$out" \
    -w "$type/$id: http=%{http_code} time=%{time_total}s\n"
  python3 <<PY
import json
d = json.load(open("$out"))
print(f"  ref={d.get('ref')!r}")
a = d.get("activity", {})
print(f"  activity: _unsupported={a.get('_unsupported')} items={len(a.get('items', []))} hasMore={a.get('hasMore')}")
att = d.get("attachments", {})
print(f"  attachments: _unsupported={att.get('_unsupported')} items={len(att.get('items', []))}")
lnk = d.get("linked", {})
print(f"  linked: _unsupported={lnk.get('_unsupported')}")
PY
}

say "incident in/2800"
fetch_detail incident 2800

say "request cr/2851"
fetch_detail request 2851

say "problem pr/406621 (expect ≥2 activity entries)"
fetch_detail problem 406621

say "change chg/2781 (expect ≥4 chgalg activity entries)"
fetch_detail change 2781

say "cache hit (incident/2800 — expect <10ms)"
curl -fsS -b "$COOKIE_JAR" "$BFF_BASE/api/tickets/incident/2800" -o /dev/null \
  -w "  http=%{http_code} time=%{time_total}s\n"

say "logout"
curl -fsS -b "$COOKIE_JAR" -X POST -H "Origin: $BFF_BASE" \
  "$BFF_BASE/auth/logout" -o /dev/null -w 'logout=%{http_code}\n'

echo
echo "OK — F.6 smoke complete. If activity is empty for pr/406621 or chg/2781, verify"
echo "that the X-Obj-Attrs projection survived the upstream proxy (compare against"
echo "tools/sdm-probe/probe-ticket-detail.sh output)."
