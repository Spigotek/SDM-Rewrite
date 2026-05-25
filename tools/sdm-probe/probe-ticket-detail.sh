#!/usr/bin/env bash
# F.6 — Probe CA SDM 17.4 BREL/BLREL navigation for ticket-detail aggregator:
#   activity log (act_log → alg / chgalg)
#   attachments (BLREL → attmnt)
#   linked tickets (per-factory candidates)
#
# Usage:
#   VUEUSER_PASS='...' bash tools/sdm-probe/probe-ticket-detail.sh
#
# Output:
#   /tmp/sdm-probe-F.6/<factory>-<id>/<rel>.{json,status}
#   stdout: summary per (factory, rel) — HTTP status + element count.
#
# Re-runnable: idempotent except for the bootstrap access_key acquisition
# (each run mints a fresh key). Re-runs DO NOT cleanup /tmp output —
# inspect with `ls -la /tmp/sdm-probe-F.6/`.

set -euo pipefail

BASE="${SDM_BASE:-http://10.11.35.35:8050/caisd-rest}"
USER="${SDM_USER:-vueuser}"
: "${VUEUSER_PASS:?set VUEUSER_PASS in env (memory: real-backend.md)}"

OUT_DIR="${PROBE_OUT_DIR:-/tmp/sdm-probe-F.6}"
mkdir -p "$OUT_DIR"

echo "== bootstrap access_key =="
RESP=$(curl -sS -X POST -u "$USER:$VUEUSER_PASS" \
  -H "Accept: application/xml" -H "Content-Type: application/xml" \
  --data '<rest_access/>' "$BASE/rest_access")
KEY=$(printf '%s' "$RESP" | sed -n 's:.*<access_key>\([^<]*\)</access_key>.*:\1:p')
ID=$(printf  '%s' "$RESP" | sed -n 's:.*<rest_access id="\([^"]*\)".*:\1:p')
if [[ -z "$KEY" ]]; then
  echo "ERROR: bootstrap failed" >&2; printf '%s\n' "$RESP" >&2; exit 1
fi
echo "  key_len=${#KEY} id=$ID"

cleanup() {
  curl -sS -o /dev/null -w 'logout=%{http_code}\n' \
    -X DELETE -H "X-AccessKey: $KEY" -H "Accept: application/xml" \
    "$BASE/rest_access/$ID" || true
}
trap cleanup EXIT

# Probe one BREL/BLREL navigation. Captures status + body + Content-Type.
# Stores:
#   $OUT_DIR/<scope>/<rel-slug>.json
#   $OUT_DIR/<scope>/<rel-slug>.status
probe() {
  local scope="$1"   # e.g. "in-2800"
  local rel="$2"     # e.g. "act_log"  (BREL nav path, NOT a URL)
  local path="$3"    # full URL path from $BASE
  local dir="$OUT_DIR/$scope"
  mkdir -p "$dir"
  local out_body="$dir/${rel}.json"
  local out_status="$dir/${rel}.status"
  local status content_type
  status=$(curl -sS -o "$out_body" -w '%{http_code}' \
    -H "X-AccessKey: $KEY" -H "Accept: application/json" \
    "$BASE$path" || echo "000")
  printf '%s' "$status" > "$out_status"
  # Light summary line — counts top-level array elements in collection_* wrappers if JSON.
  local count="?"
  if [[ "$status" == "200" ]]; then
    count=$(python3 - <<PY 2>/dev/null || echo "?"
import json, sys
with open("$out_body") as f:
    d = json.load(f)
# Try several collection key patterns CA SDM uses.
if isinstance(d, dict):
    # Single FK or scalar
    if "collection_alg" in d:
        coll = d["collection_alg"]
        print(coll.get("@TOTAL_COUNT", len(coll.get("alg", []))))
    elif "collection_chgalg" in d:
        coll = d["collection_chgalg"]
        print(coll.get("@TOTAL_COUNT", len(coll.get("chgalg", []))))
    elif "collection_attmnt" in d:
        coll = d["collection_attmnt"]
        print(coll.get("@TOTAL_COUNT", len(coll.get("attmnt", []))))
    elif any(k.startswith("collection_") for k in d.keys()):
        ck = next(k for k in d.keys() if k.startswith("collection_"))
        coll = d[ck]
        # Inner array key matches collection's data attribute name.
        items = [v for k, v in coll.items() if isinstance(v, list)]
        inner = items[0] if items else []
        print(f"{ck}={coll.get('@TOTAL_COUNT', len(inner))}")
    else:
        print(f"{len(d)} top-keys")
else:
    print("non-object")
PY
)
  fi
  printf '  %-22s status=%-3s count=%s\n' "$rel" "$status" "$count"
}

echo
echo "== INCIDENT (in/2800, in/2851) =="
for id in 2800 2851; do
  scope="in-$id"
  echo "-- $scope --"
  # BREL: activity log via act_log path -> expect collection_alg
  probe "$scope" "act_log"      "/in/$id/act_log"
  # Alt: alg directly via filter
  probe "$scope" "alg_via_wc"   "/alg?WC=affected_resource%3D'$id'&size=5"
  # BLREL: attachments
  probe "$scope" "attachments"  "/in/$id/attachments"
  # Linked candidates — Incident can link to Problem (problem SREL), Change (rootcause), other incidents (parent_id / children)
  probe "$scope" "problem"      "/in/$id/problem"
  probe "$scope" "rootcause"    "/in/$id/rootcause"
  probe "$scope" "change"       "/in/$id/change"
  probe "$scope" "children"     "/in/$id/children"
  probe "$scope" "parent"       "/in/$id/parent"
done

echo
echo "== REQUEST (cr/2851) =="
scope="cr-2851"
echo "-- $scope --"
probe "$scope" "act_log"        "/cr/2851/act_log"
probe "$scope" "attachments"    "/cr/2851/attachments"
probe "$scope" "problem"        "/cr/2851/problem"
probe "$scope" "rootcause"      "/cr/2851/rootcause"
probe "$scope" "change"         "/cr/2851/change"
probe "$scope" "children"       "/cr/2851/children"

echo
echo "== PROBLEM (pr/406621) =="
scope="pr-406621"
echo "-- $scope --"
probe "$scope" "act_log"        "/pr/406621/act_log"
probe "$scope" "attachments"    "/pr/406621/attachments"
# Problem linked to incidents/changes:
probe "$scope" "children"       "/pr/406621/children"           # PR has children per endpoints.md
probe "$scope" "affected_incidents" "/pr/406621/affected_incidents"
probe "$scope" "affected_changes"   "/pr/406621/affected_changes"
probe "$scope" "incidents"          "/pr/406621/incidents"
probe "$scope" "rootcause_chg"      "/pr/406621/rootcause_chg"

echo
echo "== CHANGE (chg/2781) =="
scope="chg-2781"
echo "-- $scope --"
# chg activity diverges -> chgalg
probe "$scope" "act_log"        "/chg/2781/act_log"
probe "$scope" "chgalg_via_wc"  "/chgalg?WC=change_id%3D'2781'&size=5"
probe "$scope" "attachments"    "/chg/2781/attachments"
probe "$scope" "workflow"       "/chg/2781/workflow"
probe "$scope" "affected_incidents" "/chg/2781/affected_incidents"
probe "$scope" "affected_problems"  "/chg/2781/affected_problems"
probe "$scope" "incidents"          "/chg/2781/incidents"
probe "$scope" "problems"           "/chg/2781/problems"

echo
echo "== summary =="
echo "Output stored at: $OUT_DIR/"
find "$OUT_DIR" -name "*.status" | sort | while read -r f; do
  rel=$(basename "$f" .status)
  scope=$(basename "$(dirname "$f")")
  printf '  %-15s %-22s %s\n' "$scope" "$rel" "$(cat "$f")"
done
