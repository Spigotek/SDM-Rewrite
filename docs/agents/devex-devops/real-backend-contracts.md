# CA SDM 17.4 — Real B-E contracts (10.11.35.35:8050)

> captured 2026-05-18 against test instance; vueuser credentials

Empirically probed via curl. All bash snippets assume:

```bash
BASE="http://10.11.35.35:8050/caisd-rest"
VUEUSER_PASS='***'   # never commit
```

## 1. rest_access bootstrap — happy path

- **Auth**: HTTP Basic on `POST /rest_access`.
- **Content-Type**: `application/xml` is **mandatory**. JSON bodies (`Content-Type: application/json`) → HTTP 400 with empty body. Empty body (`--data ''`) also → HTTP 400. Minimal valid body: `<rest_access/>`.
- **Accept**: `application/xml` works for the bootstrap response. `application/json` rejected for bootstrap.

Request:

```bash
curl -i -X POST -u "vueuser:$VUEUSER_PASS" \
  -H "Accept: application/xml" -H "Content-Type: application/xml" \
  --data '<rest_access/>' "$BASE/rest_access"
```

Response (`201 Created`, `Location: .../rest_access/402020`):

```xml
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<rest_access id="402020" REL_ATTR="402020" COMMON_NAME="51299815...">
  <link href="http://10.11.35.35:8050/caisd-rest/rest_access/402020" rel="self"/>
  <access_key>51299815...</access_key>
  <expiration_date>1779696034</expiration_date>
</rest_access>
```

Field map for the BFF auth module:

| Field | XPath / location | Type | Notes |
|---|---|---|---|
| access key | `/rest_access/access_key` (text) | string (numeric 9-10 digits) | also mirrored in `COMMON_NAME` XML attribute |
| numeric id (for DELETE) | `/rest_access/@id` | string | also returned in `Location` header |
| expiration | `/rest_access/expiration_date` (text) | **epoch seconds**, 10-digit | not epoch-ms, not ISO. 1779696034 = 2026-05-25 08:00:34 UTC (~7-day TTL on this instance) |

## 2. rest_access bootstrap — 401 invalid credentials

Wrong password against `POST /rest_access`:

```
HTTP/1.1 401
WWW-Authenticate: SDM Realm="Service Desk"
WWW-Authenticate: Basic Realm="Service Desk"
Content-Type: application/xml

<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<error>
    <message>The user name or password you entered is not correct. Please try again.</message>
    <status>401</status>
</error>
```

Missing `Authorization` header entirely on `POST /rest_access` → also 401, but message `Invalid Authorization message header.` (same shape).

**BFF mapping**: 401 from `/rest_access` → `AUTH_INVALID_CREDENTIALS`. Body is XML even when Accept negotiation is requested otherwise.

## 3. rest_access DELETE (logout)

```bash
curl -i -X DELETE -H "X-AccessKey: $KEY" -H "Accept: application/xml" \
  "$BASE/rest_access/402020"
```

Response: **`HTTP/1.1 204 No Content`**, no body. Idempotent in practice but second call against same id is not retested here.

After DELETE the key is immediately invalid — see §8.

## 4. cnt (contact lookup)

After bootstrap, JSON Accept is supported for **read** endpoints (only the bootstrap requires XML in/out).

**Field projection is mandatory**: without `X-Obj-Attrs`, list and detail responses only carry `id`, `REL_ATTR`, `COMMON_NAME`, and the `link rel="self"`. The query-string variant `?attributes=…` is **silently ignored** on this instance — the BFF must use the header.

Filter by userid (CA "WC" = where-clause; single-quoted string literal, URL-encoded):

```bash
curl -H "X-AccessKey: $KEY" \
     -H "X-Obj-Attrs: userid,email_address,last_name,first_name,tenant,access_type" \
     -H "Accept: application/xml" \
     "$BASE/cnt?WC=userid%3D%27vueuser%27"
```

Response:

```xml
<collection_cnt COUNT="1" START="1" TOTAL_COUNT="1">
  <cnt id="U'BDE1683C44FCCB4DAE50BA4DDB5DCBE6'" REL_ATTR="U'BDE...'" COMMON_NAME="User, Vue ">
    <link href=".../cnt/U'BDE1683C44FCCB4DAE50BA4DDB5DCBE6'" rel="self"/>
    <access_type id="10002" REL_ATTR="10002" COMMON_NAME="Administration">
      <link href=".../acctyp/10002" rel="self"/>
    </access_type>
    <email_address>uservue@camp.com</email_address>
    <first_name>Vue</first_name>
    <last_name>User</last_name>
    <userid>vueuser</userid>
  </cnt>
</collection_cnt>
```

Key observations:

- **`cnt.id` is a hex GUID prefixed `U'…'`** (single-quoted) — opaque, not numeric. Treat as string PK. URL-encode the single quotes (`%27`) when using in path segments.
- `tenant` was requested but **omitted from output** — confirms this is a single-tenant instance (see §6).
- `COMMON_NAME` on `<cnt>` is the display name `"Last, First "` (trailing space included). Not a stable identifier.
- `email_address` (not `email`) is the attribute name.
- `access_type` is a foreign-key projection: id + `COMMON_NAME` ("Administration", "Employee", etc.). vueuser is access_type `Administration` (id=10002).

## 5. cnt_role (real role.sym values — CRITICAL for UIRole mapping)

`/cnt_role` is the join table contact ↔ role. **The role list itself lives at `/role`, not `/rol`** (`/rol` → 404 on this instance).

Real role catalogue (`GET /role?size=100`, 33 rows). `role.sym` is delivered as the **`COMMON_NAME` XML attribute** on the `<role>` element — there is no `<sym>` child element. Requesting `X-Obj-Attrs: sym` silently returns nothing extra.

Full list, grouped:

**Out-of-the-box CA SDM roles** (id 10002–13002, 300001–300003):

| id | role.sym (= COMMON_NAME) |
|---:|---|
| 10002 | Administrator |
| 10004 | Customer |
| 10005 | Employee |
| 10008 | Level 1 Analyst |
| 10009 | Level 2 Analyst |
| 10010 | Service Desk Manager |
| 10011 | Service Desk Administrator |
| 10012 | System Administrator |
| 10013 | Knowledge Management Administrator |
| 10014 | Change Manager |
| 10015 | Knowledge Analyst |
| 10016 | Knowledge Manager |
| 10017 | Customer Service Representative |
| 10018 | Customer Service Manager |
| 10019 | Tenant Administrator |
| 10020 | Vendor Analyst |
| 10022 | Support Automation Analyst |
| 10023 | Support Automation Administrator |
| 10024 | Crawler |
| 11001 | TelemetryAdminRole |
| 13001 | Incident Manager |
| 13002 | Problem Manager |
| 300001 | Configuration Administrator |
| 300002 | Configuration Analyst |
| 300003 | Configuration Viewer |

**Customer (Soimco) custom roles** (id 400001–400351, leading `.` is a CA convention to sort first in UI):

| id | role.sym |
|---:|---|
| 400001 | .Pouzivatel_NASES |
| 400051 | .Operator_L1 |
| 400102 | .Pouzivatel_TEST |
| 400151 | .Pouzivatel_CAMP |
| 400201 | .Riesitel_MPL0 |
| 400251 | .Riesitel_NBS |
| 400301 | Admin CAMP |
| 400351 | .Riesitel_SPPD |

`cnt_role` rows (4 rows total in this instance, `TOTAL_COUNT=4`) — none reference vueuser (vueuser relies purely on `access_type=Administration`). Detail/list rows expose `contact` (FK projection with `COMMON_NAME` = full name), but the **`role` FK is not returned in body even when requested via `X-Obj-Attrs: role`** — confirmed via direct probe. The cnt_role `id` happens to equal the linked `role.id` in every row sampled, but that is data coincidence on this instance, not a schema guarantee. **Phase B must not rely on this** — use a separate `/role/{id}` fetch or accept the limitation and source roles from `access_type`.

`tenant` requested on `/cnt_role` and `/role` → not present in output (single-tenant).

## 6. tenant (multi-tenancy status of this instance)

```bash
curl -H "X-AccessKey: $KEY" -H "Accept: application/xml" "$BASE/tenant?size=10"
```

Response: `<collection_tenant COUNT="0" START="0" TOTAL_COUNT="0"/>` — empty collection (no rows, no 404).

**Conclusion**: this instance is **single-tenant**. The `tenant` attribute on `cnt`, `cnt_role`, `role`, and `in` is either absent in output or null. Phase B can drop tenant-scoping for now but should keep the response shape forward-compatible (parser must tolerate optional `<tenant>` child).

## 7. in (sample incident query)

```bash
curl -H "X-AccessKey: $KEY" \
     -H "X-Obj-Attrs: ref_num,summary,status,priority,customer,open_date,close_date,description,active" \
     -H "Accept: application/xml" "$BASE/in/2800"
```

Response:

```xml
<in id="2800" REL_ATTR="cr:2800" COMMON_NAME="SD:01">
  <link href=".../in/2800" rel="self"/>
  <active id="200" REL_ATTR="0" COMMON_NAME="NO"><link href=".../bool/200" rel="self"/></active>
  <close_date>1031839200</close_date>
  <customer id="U'793ED...'" REL_ATTR="U'793ED...'" COMMON_NAME="System_AHD_generated">
    <link href=".../cnt/U'793ED...'" rel="self"/>
  </customer>
  <description>Template Description Service Desk Incident None llll</description>
  <open_date>1031839200</open_date>
  <priority id="505" REL_ATTR="0" COMMON_NAME="None"><link href=".../pri/505" rel="self"/></priority>
  <ref_num>SD:01</ref_num>
  <status id="5201" REL_ATTR="CL" COMMON_NAME="Uzatvorený"><link href=".../crs/5201" rel="self"/></status>
  <summary>Summary Service Desk Incident None</summary>
</in>
```

Key facts:

- `in.id` is **numeric** (`2800`), not a GUID. `REL_ATTR` carries a `cr:` prefix.
- `ref_num` is the user-facing ticket id (`SD:01`).
- Date fields (`open_date`, `close_date`) are **epoch seconds** (same encoding as `expiration_date`).
- Foreign keys (`customer`, `status`, `priority`) come back as nested elements with `id` + `REL_ATTR` + `COMMON_NAME` + a `link rel="self"`. The `COMMON_NAME` carries the human-readable label localised to the instance language (status `5201` here is the Slovak "Uzatvorený" = Closed).
- `TOTAL_COUNT=207` on `GET /in?size=1` — confirms queue-style pagination works (`?start=N&size=M` + `link rel="next"`).

## 8. Error response taxonomy: AUTH_EXPIRED vs AUTH_FORBIDDEN

This is the **most important contract surprise** for Phase B.

| Trigger | HTTP status | WWW-Authenticate | Body |
|---|---|---|---|
| Wrong Basic password on `POST /rest_access` | **401** | SDM Realm + Basic Realm | `<error><message>The user name or password you entered is not correct. Please try again.</message><status>401</status></error>` |
| Missing Basic header on `POST /rest_access` | **401** | SDM Realm + Basic Realm | `<error><message>Invalid Authorization message header.</message><status>401</status></error>` |
| Unknown / fake X-AccessKey on any read | **400** (sic — *not* 401) | *(none)* | `<error><message>Invalid REST Access Key (FAKEKEY123) provided via X-AccessKey header.</message><status>400</status></error>` |
| Expired / deleted X-AccessKey on any read | **400** | *(none)* | `<error><message>Invalid REST Access Key (51299815...) provided via X-AccessKey header.</message><status>400</status></error>` |

**Critical implications for the BFF SDM broker**:

1. The "session expired" condition surfaces as **HTTP 400 with an XML error**, not 401. Naïve `if (status === 401) reauth()` will miss it. Phase B must:
   - On HTTP 400 from CA SDM, parse the XML body, and if `/error/message` contains the literal substring `Invalid REST Access Key`, classify as `AUTH_EXPIRED` and trigger re-bootstrap.
   - Defence in depth: also pre-check `expiration_date` against `Date.now()/1000` per `bff.md` §2.3 (this is the "timestamp comparison" guard) so the BFF re-bootstraps proactively before the 7-day TTL elapses.

2. **`AUTH_FORBIDDEN` (insufficient privilege) was not empirically reproduced** — vueuser has `Administration` access_type and there is no lower-privilege test account on this instance. Per CA SDM 17.4 documentation, role/ACL denials are returned as **HTTP 401 with an `<error>` body whose message starts with "Permission denied"** (or "Operation not authorized"), distinct from the credential-failure 401 in §2. **Flag: not empirically verified.** Phase B should:
   - Treat HTTP 401 from a *non-bootstrap* endpoint (i.e. one with a valid X-AccessKey set) as `AUTH_FORBIDDEN` (because invalid keys give 400, not 401, per the table above).
   - Treat HTTP 401 from `POST /rest_access` as `AUTH_INVALID_CREDENTIALS`.
   - Guard via the timestamp comparison described in `bff.md` §2.3 to prevent ambiguity when the cached key is still server-side-valid but the user lost permission to a resource.

## 9. Content-Type negotiation (JSON support? XML required?)

| Endpoint | JSON Accept supported? | JSON Content-Type supported? | Notes |
|---|---|---|---|
| `POST /rest_access` | No — 400 if Accept includes only JSON variants in some setups; response is always XML | **No** — `Content-Type: application/json` → 400. Must send `Content-Type: application/xml` with body `<rest_access/>` | Bootstrap is XML-only on input. |
| `DELETE /rest_access/{id}` | n/a (204 No Content) | n/a | |
| `GET /cnt`, `/cnt_role`, `/role`, `/tenant`, `/in` (list + detail) | **Yes** — `Accept: application/json` returns valid JSON with `@`-prefixed XML attributes (`@id`, `@COMMON_NAME`, `@REL_ATTR`) and unwrapped element text | n/a | XML and JSON are both fully supported for reads. JSON is preferred for the BFF (less parsing). |
| Error responses | Always XML (`Content-Type: application/xml`) regardless of Accept | n/a | The BFF error mapper must parse XML even when JSON was negotiated for the happy path. |

JSON sample (`GET /cnt_role/400102`):

```json
{
  "cnt_role": {
    "@id": 400102,
    "@REL_ATTR": 400102,
    "@COMMON_NAME": 400102,
    "link": { "@href": ".../cnt_role/400102", "@rel": "self" },
    "contact": {
      "@id": "U'C3188B3B20669E48BC0724627D6E056C'",
      "@REL_ATTR": "U'C3188B3B20669E48BC0724627D6E056C'",
      "@COMMON_NAME": "Lago, Dušan ",
      "link": { "@href": ".../cnt/U'C3188B3B20669E48BC0724627D6E056C'", "@rel": "self" }
    }
  }
}
```

## 10. Conclusions / open questions for Phase B

**Confirmed for Phase B implementation**:

1. SDM broker must use `application/xml` for bootstrap; can use `application/json` for everything else.
2. `expiration_date` is **epoch seconds**, not ms. Compare with `Math.floor(Date.now()/1000)`.
3. Field projection on reads requires the **`X-Obj-Attrs` header** (not `?attributes=`).
4. Role symbols (`role.sym`) are surfaced as **`COMMON_NAME` XML attribute / `@COMMON_NAME` JSON key** on `<role>` elements — there is no `<sym>` child element. The BFF role mapper (`UI_ROLE_MAPPING_JSON`) must key on `COMMON_NAME` strings exactly as listed in §5.
5. Real role names for `UI_ROLE_MAPPING_JSON` env (Soimco custom set): `.Pouzivatel_NASES`, `.Operator_L1`, `.Pouzivatel_TEST`, `.Pouzivatel_CAMP`, `.Riesitel_MPL0`, `.Riesitel_NBS`, `Admin CAMP`, `.Riesitel_SPPD`. Plus standard CA roles (esp. `Administrator`, `Level 1 Analyst`, `Level 2 Analyst`, `Service Desk Manager`, `Employee`, `Customer`) — 33 in total.
6. Single-tenant instance — drop tenant-scoping for F.1; keep parser forward-compatible.
7. `cnt.id` is a hex-GUID string `U'…'` with embedded single quotes. URL-encode `%27` in path segments. `in.id` is numeric; `ref_num` is the user-facing ticket key.
8. Auth-expired surfaces as **HTTP 400** with body containing `Invalid REST Access Key`. Treat as `AUTH_EXPIRED` (not 401). Combine with proactive `expiration_date` check per `bff.md` §2.3.

**Open questions / non-empirical**:

- `AUTH_FORBIDDEN` (permission-denied) shape on a privileged resource — **not verified**. Falling back to "any non-bootstrap 401" = forbidden, plus the timestamp guard. Re-verify when a lower-privilege test account becomes available.
- `cnt_role.role` FK is not returned in body even when listed in `X-Obj-Attrs` — schema attribute name is not `role`. Phase B will either (a) accept that vueuser-style users authenticate via `access_type` only (sufficient for vueuser today since cnt_role is empty for them), or (b) reverse-engineer the correct attribute name (possible candidates: `role_id`, `prole`, `cnt_role_role`). Recommend: defer until a real cnt_role record needs to be resolved.
- DELETE on a re-DELETE of the same access-key id was not retested for idempotency.
- Bootstrap rate limits (lockout after N bad password attempts) — not probed.

## 11. Live smoke script (bash snippet Phase B can re-run manually)

```bash
#!/usr/bin/env bash
# Smoke-test the CA SDM 17.4 REST contracts that the BFF auth module depends on.
# Requires: VUEUSER_PASS in env. Never commit a populated value.
set -euo pipefail

BASE="${SDM_BASE:-http://10.11.35.35:8050/caisd-rest}"
USER="${SDM_USER:-vueuser}"
: "${VUEUSER_PASS:?set VUEUSER_PASS in env}"

echo "== 1. bootstrap =="
RESP=$(curl -sS -X POST -u "$USER:$VUEUSER_PASS" \
  -H "Accept: application/xml" -H "Content-Type: application/xml" \
  --data '<rest_access/>' "$BASE/rest_access")
echo "$RESP"
KEY=$(printf '%s' "$RESP" | sed -n 's:.*<access_key>\([^<]*\)</access_key>.*:\1:p')
ID=$(printf  '%s' "$RESP" | sed -n 's:.*<rest_access id="\([^"]*\)".*:\1:p')
EXP=$(printf '%s' "$RESP" | sed -n 's:.*<expiration_date>\([^<]*\)</expiration_date>.*:\1:p')
echo "  key=${KEY:0:8}...  id=$ID  exp=$EXP ($(date -r "$EXP" -u 2>/dev/null || true))"

echo "== 2. wrong-password 401 shape =="
curl -sS -o /tmp/sdm-401.xml -w 'status=%{http_code}\n' \
  -X POST -u "$USER:WRONG" \
  -H "Accept: application/xml" -H "Content-Type: application/xml" \
  --data '<rest_access/>' "$BASE/rest_access" || true
cat /tmp/sdm-401.xml; echo

echo "== 4. cnt vueuser =="
curl -sS -H "X-AccessKey: $KEY" \
  -H "X-Obj-Attrs: userid,email_address,last_name,first_name,access_type,tenant" \
  -H "Accept: application/json" \
  "$BASE/cnt?WC=userid%3D%27vueuser%27" | head -c 600; echo

echo "== 5. role catalogue size=100 =="
curl -sS -H "X-AccessKey: $KEY" -H "Accept: application/json" "$BASE/role?size=100" \
  | python3 -c 'import json,sys; d=json.load(sys.stdin)["collection_role"]; print("TOTAL_COUNT=", d["@TOTAL_COUNT"]); [print(r["@id"], "=", r["@COMMON_NAME"]) for r in d["role"]]'

echo "== 6. tenant collection =="
curl -sS -H "X-AccessKey: $KEY" -H "Accept: application/xml" "$BASE/tenant?size=10"; echo

echo "== 7. one incident =="
curl -sS -H "X-AccessKey: $KEY" \
  -H "X-Obj-Attrs: ref_num,summary,status,priority,customer,open_date,description" \
  -H "Accept: application/json" "$BASE/in/2800" | head -c 800; echo

echo "== 8. fake X-AccessKey -> expect HTTP 400 with 'Invalid REST Access Key' =="
curl -sS -o /tmp/sdm-fake.xml -w 'status=%{http_code}\n' \
  -H "X-AccessKey: FAKEKEY123" -H "Accept: application/xml" "$BASE/cnt?size=1"
cat /tmp/sdm-fake.xml; echo

echo "== 3. logout DELETE =="
curl -sS -o /dev/null -w 'status=%{http_code}\n' \
  -X DELETE -H "X-AccessKey: $KEY" -H "Accept: application/xml" \
  "$BASE/rest_access/$ID"
```

Run with:

```bash
VUEUSER_PASS='…' bash docs/agents/devex-devops/smoke-real-be.sh
```

(Script body lives only in this doc; copy-paste into a local file outside the repo if you want to commit it as `.gitignored` local tooling.)
