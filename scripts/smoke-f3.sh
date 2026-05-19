#!/usr/bin/env bash
# F.3 live smoke — exercise the BFF aggregator endpoints against the real
# CA SDM 17.4 backend (dev/test at 10.11.35.35:8050 by default).
#
# Run after `pnpm --filter @sdm/bff dev` is up locally with network reach to
# the CA SDM host. Creds (`SDM_USER`, `SDM_PASS`) must come from env — never
# commit a populated value.
#
# Usage:
#   SDM_USER=vueuser SDM_PASS='…' BFF_BASE=http://localhost:5174 ./scripts/smoke-f3.sh
#
# Expected outcomes (per docs/plans/F.3.md Done-when):
#  - /me/tenants returns the seeded tenant + role list
#  - /api/queue returns ≥ 1 incident + 1 request + 1 problem (if test data present)
#  - /api/tickets/incident/2800 returns the parent shape + empty _unsupported blocks
set -euo pipefail

: "${SDM_USER:?set SDM_USER (e.g. vueuser)}"
: "${SDM_PASS:?set SDM_PASS}"
BFF_BASE="${BFF_BASE:-http://localhost:5174}"
COOKIE_JAR="$(mktemp)"
trap 'rm -f "$COOKIE_JAR"' EXIT

say() { printf '\n== %s ==\n' "$1"; }

say "login → /auth/login (Basic Auth → access_key broker)"
curl -fsS -c "$COOKIE_JAR" -H 'Content-Type: application/json' \
  -H "Origin: $BFF_BASE" \
  --data "{\"username\":\"$SDM_USER\",\"password\":\"$SDM_PASS\"}" \
  "$BFF_BASE/auth/login" | head -c 400; echo

say "/me/tenants"
curl -fsS -b "$COOKIE_JAR" "$BFF_BASE/me/tenants" | python3 -m json.tool | head -30

say "/api/queue (no filter, default page)"
QUEUE_JSON="$(curl -fsS -b "$COOKIE_JAR" "$BFF_BASE/api/queue")"
echo "$QUEUE_JSON" | python3 -m json.tool | head -40
INC_COUNT=$(echo "$QUEUE_JSON" | python3 -c 'import json,sys;print(sum(1 for x in json.load(sys.stdin)["data"] if x["ticketType"]=="incident"))')
REQ_COUNT=$(echo "$QUEUE_JSON" | python3 -c 'import json,sys;print(sum(1 for x in json.load(sys.stdin)["data"] if x["ticketType"]=="request"))')
PRB_COUNT=$(echo "$QUEUE_JSON" | python3 -c 'import json,sys;print(sum(1 for x in json.load(sys.stdin)["data"] if x["ticketType"]=="problem"))')
printf '  incident=%s request=%s problem=%s\n' "$INC_COUNT" "$REQ_COUNT" "$PRB_COUNT"
if [ "$INC_COUNT" -lt 1 ] || [ "$REQ_COUNT" -lt 1 ] || [ "$PRB_COUNT" -lt 1 ]; then
  echo "WARN: F.3.md Done-when expects ≥1 of each ticketType — verify test data is seeded on the instance."
fi

say "/api/tickets/incident/2800 (known incident from F.1+F.2 captures)"
curl -fsS -b "$COOKIE_JAR" "$BFF_BASE/api/tickets/incident/2800" | python3 -m json.tool | head -40

say "logout"
curl -fsS -b "$COOKIE_JAR" -X POST -H "Origin: $BFF_BASE" "$BFF_BASE/auth/logout" -o /dev/null -w 'logout status=%{http_code}\n'

echo
echo "OK — F.3 smoke complete. If any block returned non-zero or the queue is missing a ticket type, capture the diff in the PR before merging."
