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

---

> **F.2 addendum (captured 2026-05-18, vueuser)** — §12-21 extend the F.1 capture with mutating-shape contracts for entity factories (`in`, `cr`, `pr`, `chg`, `KD`, `nr`), reference-factory digest, pagination, filter conventions, and an entity-specific error taxonomy. F.2's `rest-proxy.ts` should treat §21 as the authoritative checklist.

## 12. `in` (incident) — mutating shapes

§7 covers the read shape. The contracts below are for `POST`, `PUT`, and the (denied) `DELETE`. **The `in` factory is a logical view over the underlying `cr` (call-request) table** — every probe returned `REL_ATTR="cr:<id>"`. `/cr/<id>` and `/in/<id>` resolve to the same record; the distinction is made via the `type` FK (`I`=Incident, `R`=Request, `P`=Problem on factory `crt`).

### 12.1 POST `/in` — create incident

**Foreign keys MUST be sent as empty elements with the `REL_ATTR` XML attribute carrying the FK's `REL_ATTR` value** (not the `id`, not as element text). The naïve shape `<customer>U'…'</customer>` is rejected:

```
HTTP/1.1 400
{"status":"400","message":"com.ca.sdm.dal.sql.DALException: Found no valid identifiers (id, REL_ATTR, COMMON_NAME) for attribute 'customer'."}
```

Working minimal body:

```bash
curl -X POST -H "X-AccessKey: $KEY" \
     -H "Accept: application/json" -H "Content-Type: application/xml" \
     --data "<in><summary>F.2 probe</summary><description>…</description><customer REL_ATTR=\"U'BDE1683C44FCCB4DAE50BA4DDB5DCBE6'\"/></in>" \
     "$BASE/in"
```

Response (`201 Created`, `Location: …/in/407804`):

```json
{"in":{"@id":407804,"@REL_ATTR":"cr:407804","@COMMON_NAME":5721,
       "link":{"@href":".../in/407804","@rel":"self"}}}
```

| Field | Type | Required? | Notes |
|---|---|---|---|
| `summary` | element text | yes | "Affected End User" / `customer` is also required — error message uses the human-readable attribute label |
| `description` | element text | no | |
| `customer` | empty element + `REL_ATTR="U'…'"` | **yes** | "Affected End User" in the error wording; the FK value is the contact `id` (= GUID `U'…'`) |
| `type` | empty element + `REL_ATTR="I"` | optional on `/in` | implicit for `/in`; required `R` for `/cr` requests |
| `priority` | empty element + `REL_ATTR=<digit>` | no | `REL_ATTR` is the numeric priority code (1-5), not the `id` |
| `status` | empty element + `REL_ATTR="OP"` | no | defaults to `OP` (`Vytvorený`) for new records |

**JSON request body also works** (despite §9 suggesting XML is canonical):

```bash
curl -X POST -H "Content-Type: application/json" \
     --data '{"in":{"summary":"…","customer":{"@REL_ATTR":"U'\''BDE…'\''"}}}' "$BASE/in"
```

→ also returns `201`. JSON `Content-Type` is rejected **only** on `POST /rest_access` (bootstrap). All entity factories accept either format on input.

`POST` without `Content-Type` → **`HTTP 415`** (empty body) — the BFF proxy must always set `Content-Type` explicitly.

### 12.2 PUT `/in/<id>` — partial update

Body carries only the fields to change. `200 OK` on success:

```bash
curl -X PUT -H "X-AccessKey: $KEY" \
     -H "Content-Type: application/xml" -H "Accept: application/json" \
     --data '<in><summary>updated</summary></in>' "$BASE/in/407804"
```

Response body mirrors the POST shape (only `@id`/`@REL_ATTR`/`@COMMON_NAME` + self link — no echoed attributes). The BFF must re-fetch with `X-Obj-Attrs` if the FE needs the post-update body.

**PUT on a non-existent id returns `409`, not `404`**:

```
HTTP/1.1 409
{"status":"409","message":"Invalid number of rows (0) affected by the operation. Expecting (1)."}
```

Status transitions: `<status REL_ATTR="CL"/>` closes the ticket. The server sets `active=NO` and stamps `close_date` automatically — clients do not send these fields.

### 12.3 DELETE `/in/<id>` — not supported on this instance

```
HTTP/1.1 405 Method Not Allowed
Allow: DELETE,POST,GET,PUT,OPTIONS,HEAD
```

The `Allow:` header advertises DELETE but the server rejects it. **CA SDM tickets are never hard-deleted — they are soft-closed via `status=CL`** (see §12.2). The 405 + `Allow: DELETE` mismatch is a CA SDM 17.4 quirk; the BFF must not trust `Allow:` to decide whether DELETE is supported for incidents.

`delete_flag` is **not** an attribute of the `in`/`cr` factories (verified — PUT with `<delete_flag/>` is rejected as "Invalid payload"). Use status change for "removal".

### 12.4 List with X-Obj-Attrs + filter

```bash
curl -H "X-AccessKey: $KEY" -H "Accept: application/json" \
     -H "X-Obj-Attrs: ref_num,summary,status,priority,customer,open_date" \
     "$BASE/in?WC=status.code%3D%27OP%27&size=2"
```

Returns `collection_in` with `TOTAL_COUNT=151` (open tickets). Each `in` row carries the full projection (same shape as detail GET).

## 13. `cr` (request — same factory as `in`, type=R)

`/cr` and `/in` index the same underlying records, but the `cr` list is unfiltered (`TOTAL_COUNT=535` vs 207 for `in`) — `/in` is a server-side view restricted to `type='I'`. **The BFF should use `/in/*` for incidents and `/cr/*` only for type-agnostic operations**; mixing them risks accidentally treating a Request as an Incident.

### 13.1 POST `/cr` — type explicit

```bash
curl -X POST -H "X-AccessKey: $KEY" \
     -H "Accept: application/json" -H "Content-Type: application/xml" \
     --data "<cr><summary>F.2 cr probe</summary><customer REL_ATTR=\"U'BDE…'\"/><type REL_ATTR=\"R\"/></cr>" \
     "$BASE/cr"
```

Response (`201`):

```json
{"cr":{"@id":407805,"@REL_ATTR":"cr:407805","@COMMON_NAME":5722,
       "link":{"@href":".../cr/407805","@rel":"self"}}}
```

`type` values (from `/crt`, §18): `R`=Request, `I`=Incident, `P`=Problem. Without `<type/>` the server defaults to whatever `in`/`cr` factory implies. **For `/cr` POST without `type`, the record defaults to Request type on this instance** (vs Incident for `/in`).

### 13.2 Detail GET with attrs

```bash
curl -H "X-AccessKey: $KEY" -H "Accept: application/json" \
     -H "X-Obj-Attrs: ref_num,summary,status,priority,customer,type,open_date,description" \
     "$BASE/cr/2851"
```

Output (excerpt) — note `type` projection:

```json
{"cr":{"@id":2851,"@REL_ATTR":"cr:2851","@COMMON_NAME":"SA:01",
       "type":{"@id":182,"@REL_ATTR":"I","@COMMON_NAME":"Incident",
               "link":{"@href":".../crt/182","@rel":"self"}},
       …}}
```

PUT and DELETE behave identically to `in` (§12.2 / §12.3): PUT 200, DELETE 405, status=CL for soft-close.

## 14. `pr` (problem)

`/pr` total count on this instance: 2. Probes used record `pr/406621`.

### 14.1 Detail shape

```json
{"pr":{"@id":406621,"@REL_ATTR":"cr:406621","@COMMON_NAME":5254,
       "active":{"@COMMON_NAME":"YES",...},
       "assignee":{"@id":"U'BDE…'","@COMMON_NAME":"User, Vue ",
                   "link":{"@href":".../agt/U'BDE…'","@rel":"self"}},
       "customer":{"@id":"U'BDE…'","@COMMON_NAME":"User, Vue ",
                   "link":{"@href":".../cnt/U'BDE…'","@rel":"self"}},
       "impact":{"@id":1602,"@REL_ATTR":3,"@COMMON_NAME":"3-Single Group", ...},
       "open_date":1727771897,
       "priority":{"@id":502,"@REL_ATTR":3,"@COMMON_NAME":3,...},
       "ref_num":5254,
       "status":{"@id":5200,"@REL_ATTR":"OP","@COMMON_NAME":"Vytvorený",
                 "link":{"@href":".../crs/5200","@rel":"self"}},
       "urgency":{"@id":1102,"@REL_ATTR":2,"@COMMON_NAME":"3-Quickly",...}}}
```

Key observations:

- `assignee` and `customer` both point to GUID-based PKs but **with different factory paths**: `assignee` → `/agt/U'…'` (analyst view), `customer` → `/cnt/U'…'` (contact view). The same contact GUID resolves in both — `agt` is a role-filtered subset of `cnt`. The BFF reference resolver must accept both prefixes when mapping FK projections back to contacts.
- `status` and `priority` are shared with `in`/`cr` (`crs` and `pri` reference tables — see §18).
- `ref_num` is delivered as a **bare number** for `pr` (5254) and **a string** for `in`/`cr` (`"SD:01"`). The BFF must coerce both shapes to string on egress to keep `@sdm/api-types` consistent.

### 14.2 POST / PUT / DELETE

POST identical shape to §12.1, returns 201. PUT supported, DELETE → 405. Status-based soft-close works the same way (`<status REL_ATTR="CL"/>`).

## 15. `chg` (change order)

Total count on this instance: 71. **Schema diverges from `in`/`cr`/`pr`** in two places:

- The PK column is `chg_ref_num` (not `ref_num`). Asking for `X-Obj-Attrs: ref_num` on `/chg` returns nothing.
- Status uses a **different reference table**: `/chgstat` (not `/crs`). Status `REL_ATTR` codes overlap (`OP`, `CL`) but `id` ranges are 6000-6019 instead of 5200-5234. See §18.
- The "customer" attribute is named **`requestor`** (not `customer`).

### 15.1 Detail shape

```json
{"chg":{"@id":2781,"@REL_ATTR":2781,"@COMMON_NAME":"USD:11",
        "chg_ref_num":"USD:11",
        "requestor":{"@id":"U'FCF…'","@COMMON_NAME":"System_MA_User",
                     "link":{"@href":".../cnt/U'FCF…'","@rel":"self"}},
        "assignee":{"@id":"U'FCF…'","@COMMON_NAME":"System_MA_User",
                    "link":{"@href":".../agt/U'FCF…'","@rel":"self"}},
        "priority":{"@id":501,"@REL_ATTR":2,"@COMMON_NAME":4,
                    "link":{"@href":".../pri/501","@rel":"self"}},
        "status":{"@id":6001,"@REL_ATTR":"CL","@COMMON_NAME":"Closed",
                  "link":{"@href":".../chgstat/6001","@rel":"self"}},
        "open_date":1031839200,
        "close_date":1031839200,
        "description":"…",
        "summary":"ITIL Summary Priority Low"}}
```

`chg.@id` is numeric (like `in`/`cr`); `REL_ATTR` carries no `cr:` prefix (unlike `in`/`cr`).

### 15.2 POST `/chg`

```bash
curl -X POST -H "X-AccessKey: $KEY" \
     -H "Accept: application/json" -H "Content-Type: application/xml" \
     --data "<chg><summary>F.2 chg probe</summary><requestor REL_ATTR=\"U'BDE…'\"/></chg>" \
     "$BASE/chg"
```

→ `201 Created`, `Location: …/chg/400851`. PUT and 405-DELETE same as the call-request factories. Status CL via `<status REL_ATTR="CL"/>` against `chgstat`.

## 16. `KD` (knowledge document)

**The factory name is uppercase `KD`, not lowercase `kd`** — `GET /caisd-rest/kd` returns **`HTTP 404`** (empty body, no JSON). The BFF endpoint mapping for `/api/kb/*` must use `/caisd-rest/KD/*`. (Probable cause: the underlying Knowledge Management table is named with an uppercase symbol; CA SDM's URL routing is case-sensitive for factory names. `cnt`, `in`, `cr`, etc. happen to be lowercase by convention.)

### 16.1 Detail shape (`KD/400101`)

```json
{"KD":{"@id":400101,"@REL_ATTR":400101,"@COMMON_NAME":"Testovaci dokument",
       "link":{"@href":".../KD/400101","@rel":"self"},
       "CREATION_DATE":1619009439,
       "RESOLUTION":"riesenie\n1.\n2.\n3.",
       "SUMMARY":"bla bla",
       "TITLE":"Testovaci dokument"}}
```

**Attribute names on `KD` are UPPERCASE** (`TITLE`, `SUMMARY`, `RESOLUTION`, `CREATION_DATE`, `KEYWORDS`, `ARTICLE_DOCUMENT`, etc.) — not the snake_case used by `in`/`cr`/`pr`/`chg`. The `X-Obj-Attrs` header must match the case exactly. Requesting `title` returns nothing.

### 16.2 POST `/KD`

```bash
curl -X POST -H "X-AccessKey: $KEY" \
     -H "Accept: application/json" -H "Content-Type: application/xml" \
     --data '<KD><TITLE>F.2 KD probe</TITLE><SUMMARY>probe</SUMMARY></KD>' \
     "$BASE/KD"
```

→ `201 Created`, `Location: …/KD/401701`. Minimal required field on this instance is **`TITLE`**. PUT works (200). DELETE → 405. `delete_flag` is **not** an attribute on `KD` either:

```
HTTP/1.1 400
{"status":"400","message":"Invalid payload.  The provided request body does not contain any valid attributes."}
```

→ There is no documented way to delete or hide a KD via REST for vueuser on this instance. The BFF must treat `KD` as append + edit only; if the FE needs deletion, the only path is the CA SDM web UI (out of F.2 scope).

## 17. `nr` (configuration item / CMDB)

GUID-based PK (`U'…'`) like `cnt`. Total count: 210 on this instance.

### 17.1 Detail shape

```json
{"nr":{"@id":"U'02D…0100'","@REL_ATTR":"U'02D…0100'","@COMMON_NAME":"backend",
       "link":[{"@href":".../nr/U'02D…'","@rel":"self"},
               {"@href":".../entservx/U'02D…'","@rel":"extension"}],
       "class":{"@id":300173,"@REL_ATTR":300173,"@COMMON_NAME":"Infrastructure Service",
                "link":{"@href":".../grc/300173","@rel":"self"}},
       "description":8080,
       "family":{"@id":300049,"@REL_ATTR":300049,"@COMMON_NAME":"Enterprise Service",
                 "link":{"@href":".../nrf/300049","@rel":"self"}},
       "name":"backend",
       "serial_number":"2148eb4c-…"}}
```

Notable: `link` is an **array** on `nr` (self + extension to `entservx` — the typed-extension factory for CI subtypes). The XML→JSON adapter must handle `link` as either a single object or an array depending on factory. `description` came back as a bare number in this row (CA SDM did not type-coerce — the value `8080` is the underlying port).

### 17.2 POST `/nr`

**`class` is required**:

```
HTTP/1.1 400
{"status":"400","message":"Required attribute class is missing from object Configuration Item"}
```

Working minimal body:

```bash
curl -X POST -H "X-AccessKey: $KEY" \
     -H "Accept: application/json" -H "Content-Type: application/xml" \
     --data '<nr><name>probe</name><class REL_ATTR="300173"/></nr>' "$BASE/nr"
```

→ `201`, `Location: …/nr/U'4BC…BB'`. PUT works. **DELETE → 405**, but `<delete_flag REL_ATTR="1"/>` via PUT marks the CI **Inactive**:

```json
{"nr":{"@id":"U'4BC…BB'",
       "delete_flag":{"@id":4552,"@REL_ATTR":1,"@COMMON_NAME":"Inactive",
                      "link":{"@href":".../actbool/4552","@rel":"self"}},
       "name":"F.2-nr-probe-DELETEME"}}
```

`delete_flag` is **the documented soft-delete mechanism for CMDB CIs** (factory `actbool`, values 0=Active / 1=Inactive). It does **not** apply to `in`/`cr`/`pr`/`chg` (where soft-close is via `status=CL`) and does **not** apply to `KD` (no soft-delete at all).

## 18. Reference-factory digest

All probed with `GET /<factory>?size=5` after bootstrap. JSON Accept supported on every factory. **Pure read; cache TTL 15 min per F.2 plan.**

| Factory | TOTAL_COUNT | `@id` shape | `@REL_ATTR` shape | `@COMMON_NAME` shape | Purpose |
|---|--:|---|---|---|---|
| `pri` | 6 | numeric 500-505 | numeric 1-5 + 0 for "None" | numeric label 1-5 + "None" | priority |
| `crs` | 35 | numeric 5200-5234 | short code `OP`/`CL`/`RSCH`/… | localised string (Slovak: "Vytvorený", "Uzatvorený") | call-request status (`in`/`cr`/`pr`) |
| `chgstat` | 20 | numeric 6000-6019 | short code `OP`/`CL`/`APP`/`IMPL`/`VRFY` | English string ("Open", "Closed", "Approval in progress") | change-order status |
| `imp` | 6 | numeric 1600-1605 | numeric 1-6 | label `5-One person` … `1-Entire organization` | impact |
| `urg` | 5 | numeric 1100-1104 | numeric 0-4 | label `1-When Possible` … `5-Immediate` | urgency |
| `crt` | 3 | 180-182 | letter `R`/`P`/`I` | "Request"/"Problem"/"Incident" | call-request type |
| `bool` | 2 | 200-201 | numeric 0/1 | "NO"/"YES" | generic boolean FK (e.g. `active`) |
| `actbool` | 2 | 4551-4552 | numeric 0/1 | "Active"/"Inactive" | soft-delete FK (used on `nr.delete_flag`) |
| `acctyp` | 20 | numeric 10002-10024+ | echoes `id` | English label ("Administration", "Customer", "Employee", "Service Desk Staff", "IT Staff", …) | contact access type |
| `nrf` | 86 | numeric 600-602+ | echoes `id` | English label ("Hardware", "Software", "Enterprise Service") | CI family |
| `grc` | 306 | numeric | echoes `id` | English label ("Discovered Hardware", "License", "Infrastructure Service") | CI class |
| `pcat` | 176 | numeric 5100+ | string `pcat:<id>` (carries colon) | hierarchical label | request/incident category |
| `role` | 33 | 10002-13002 + 300001-300003 + 400001-400351 | echoes `id` | English/Slovak custom labels — see §5 | role catalogue |

**Cross-factory observations**:

- `pri.@COMMON_NAME` is a **number** (1-5), not a string like other refs. JSON parser must accept both string and numeric `@COMMON_NAME` (this is also visible on `chg.@COMMON_NAME` = sequence number, `pr.@COMMON_NAME` = ref_num int).
- `crs` labels are **Slovak** (instance language). `chgstat` labels are **English** — translation coverage on `chgstat` is incomplete on this instance. The BFF must treat `@COMMON_NAME` as opaque localised display text, **never** match against it for business logic — use `REL_ATTR` (the stable short code) instead.
- The `REL_ATTR` values on `crs` and `chgstat` partially overlap (`OP`, `CL`) but the **`@id` ranges differ**, so the BFF reference cache must key by `(factory, REL_ATTR)` not by `REL_ATTR` alone.
- `pcat.REL_ATTR` carries a `pcat:` prefix (unlike all other reference factories). When used in WC filters, the prefix is part of the literal value.

## 19. Pagination + filter conventions

### 19.1 Pagination

Query params: `start=<1-based int>&size=<int>`. Default `start=1`, `size` capped at the server's `webservice_array_max_length` (default 250, not probed for the cap).

Response collection (e.g. `collection_in`) carries:

- `@COUNT` — actual number of rows returned in this page
- `@START` — 1-based start index
- `@TOTAL_COUNT` — total matching rows
- `link rel="next"` — only present when `@START + @COUNT <= @TOTAL_COUNT`
- `link rel="previous"` — only present when `@START > 1`
- `link rel="all"` — always present except when collection is empty (link to a single-page view: `?start=1&size=@TOTAL_COUNT`)

Edge cases:

- `start > TOTAL_COUNT` → `@COUNT=0`, only `link rel="previous"` + `link rel="all"`, the entity-array key (`in`, `cr`, …) is **omitted** from the JSON (not present as empty array). Parser must treat missing key as empty list.
- Empty collection at `start=1` → `<collection_<f> COUNT="0" START="0" TOTAL_COUNT="0"/>` (see §6 tenant for the wire shape) — no `link` elements at all.

The BFF translates FE `page=N&size=M` (0-based pages) → CA SDM `start=N*M+1&size=M` (1-based offsets).

### 19.2 Filter (`WC` where-clause)

CA SDM filter syntax is **CA SDM WC** (a SQL-like predicate string), URL-encoded into the `WC` query parameter:

| FE filter intent | WC clause (unescaped) | WC clause (URL-encoded) |
|---|---|---|
| `status=OP` (open) | `status.code='OP'` | `WC=status.code%3D%27OP%27` |
| `customer=<guid>` | `customer=U'BDE…CBE6'` | `WC=customer%3DU%27BDE…CBE6%27` |
| `active=true` | `active=1` | `WC=active%3D1` |
| `priority>=3` | `priority.enum>=3` | `WC=priority.enum%3E%3D3` |

**Key rules**:

- **String literals are wrapped in single quotes**, URL-encoded as `%27`.
- **GUID literals carry the `U'…'` prefix and embedded single quotes** — encode as `U%27…%27`. The BFF must not double-quote.
- **FK comparisons use a dot-attribute path** (`status.code`, `priority.enum`, `customer.userid`) to compare against attributes of the referenced object. Comparing the FK id directly (`status=5200`) returns:

  ```
  HTTP/1.1 400
  {"status":"400","message":"An unexpected Database error occurred. Contact your administrator."}
  ```

  (DB-level error, not a clean 400. The BFF should validate FE filter values against a whitelist of `status.code`/`status.enum`/`status` styles and translate accordingly.)

- Composite predicates use `AND`/`OR` (CA SDM SQL flavour), encoded with `%20AND%20`. Not probed but documented in CA SDM 17.4 REST API guide.

## 20. Entity-level error shapes (extends §8)

Captured from the entity probes (§12-17). All bodies are **JSON when Accept negotiation includes JSON**, **XML otherwise**. The structural shape is `{"status":"<code>","message":"<text>"}` (JSON) or `<error><status/><message/></error>` (XML).

| Trigger | HTTP | Body shape | BFF mapping |
|---|---|---|---|
| POST missing required attribute (e.g. `<in/>`, `<in><summary>x</summary></in>`) | 400 | `{"status":"400","message":"Required attribute <ATTR_LABEL> is missing"}` (label is the human-readable attribute name from CA SDM dictionary, e.g. "Affected End User" for `customer` on `in`) | `VALIDATION_ERROR`, surface `message` to FE |
| POST with malformed FK (`<customer>U'…'</customer>` as text) | 400 | `{"status":"400","message":"com.ca.sdm.dal.sql.DALException: Found no valid identifiers (id, REL_ATTR, COMMON_NAME) for attribute '<attr>'."}` | `VALIDATION_ERROR`; the DAL-prefix indicates an internal exception class — the BFF should strip the `com.ca.sdm.…:` prefix before surfacing |
| POST with required FK missing (`<nr><name>x</name></nr>`) | 400 | `{"status":"400","message":"Required attribute class is missing from object Configuration Item"}` | `VALIDATION_ERROR` |
| POST without `Content-Type` | 415 | empty body | `VALIDATION_ERROR`, generic message — the BFF proxy must always set `Content-Type` so this should never reach FE |
| PUT on unknown id | **409** (sic — *not* 404) | `{"status":"409","message":"Invalid number of rows (0) affected by the operation. Expecting (1)."}` | **NOT_FOUND** — surface as 404 to FE despite upstream 409 |
| PUT with no valid attributes (`<in><delete_flag/></in>` where `delete_flag` isn't an attr of `in`) | 400 | `{"status":"400","message":"Invalid payload.  The provided request body does not contain any valid attributes."}` (note the double-space after the period — preserve as-is, don't normalise) | `VALIDATION_ERROR` |
| GET unknown numeric id | 404 | `{"status":"404","message":"No records found."}` | `NOT_FOUND` |
| GET non-numeric id (e.g. `/in/abc`) | 404 | **empty body**, `Allow: DELETE,POST,GET,PUT,OPTIONS,HEAD` header | `NOT_FOUND`; the BFF must accept empty 404 bodies and synthesise the message |
| DELETE any entity | 405 | empty body, `Allow: DELETE,POST,GET,PUT,OPTIONS,HEAD` header (the header lies — DELETE *is* listed) | `METHOD_NOT_SUPPORTED`; the BFF should not expose DELETE on incident/request/problem/change/KD endpoints (use status=CL for soft-close, `delete_flag` for `nr`) |
| WC filter with bad attribute / type-mismatch (`WC=status=5200` instead of `status.code='OP'`) | 400 | `{"status":"400","message":"An unexpected Database error occurred. Contact your administrator."}` | `VALIDATION_ERROR`, masked DB error; the BFF should pre-validate FE filter shape and never forward a likely-bad WC clause |

**JSON vs XML error shape choice**: every entity-factory error response captured above came back as JSON because the request had `Accept: application/json`. The §8 error shapes (`<error><message/><status/></error>`) come back as XML because those probes used `Accept: application/xml`. **CA SDM honours `Accept` for error bodies on `/cnt`, `/in`, `/cr`, `/pr`, `/chg`, `/KD`, `/nr`** (unlike bootstrap, where errors are always XML — §9). The BFF error shaper must parse both formats based on the `Content-Type` header of the upstream response.

## 21. Conclusions for F.2 implementation

Numbered checklist mirroring §10, scoped to the REST-proxy and entity endpoints.

1. **Factory name case sensitivity**: `KD` is uppercase. Map `/api/kb/*` → `/caisd-rest/KD/*` (not `/kd`). All other entity factories (`in`, `cr`, `pr`, `chg`, `nr`) are lowercase. Tests must include a case-sanity check.

2. **`KD` attribute names are UPPERCASE** (`TITLE`, `SUMMARY`, `RESOLUTION`, `KEYWORDS`, `CREATION_DATE`). All other factories use snake_case (`ref_num`, `open_date`, `chg_ref_num`). The BFF endpoint adapter must per-factory know which case the attribute projection is in.

3. **Schema divergence for `chg`**: PK column is `chg_ref_num` (not `ref_num`); customer attribute is `requestor` (not `customer`); status reference is `chgstat` (not `crs`). All other entity factories (`in`/`cr`/`pr`) share the `ref_num` / `customer` / `crs` model.

4. **Foreign-key encoding on POST/PUT**: FKs MUST be `<attr REL_ATTR="<value>"/>` (empty element + `REL_ATTR` attribute). Text-content form (`<customer>U'…'</customer>`) is rejected with a DAL exception. The XML serializer in `rest-proxy.ts` must encode FE-supplied FK objects in this exact shape.

5. **DELETE is universally disallowed** (HTTP 405) across `in`/`cr`/`pr`/`chg`/`KD`/`nr` despite the misleading `Allow: DELETE,…` header. Soft-close paths:
   - `in`/`cr`/`pr`/`chg` → `PUT <factory>/<id>` with `<status REL_ATTR="CL"/>` (server stamps `close_date` + `active=NO`).
   - `nr` → `PUT /nr/<id>` with `<delete_flag REL_ATTR="1"/>` (sets `delete_flag.@COMMON_NAME="Inactive"`).
   - `KD` → **no soft-delete available** via REST for vueuser. The BFF should not expose a DELETE endpoint for KB articles; the FE deletion UI must be hidden or a server-side error must propagate.

6. **PUT-on-unknown-id returns 409 not 404**. The error shaper must remap CA SDM 409 with body matching `Invalid number of rows (0) affected` → `NOT_FOUND` (FE-facing 404).

7. **Date encoding**: all date fields (`open_date`, `close_date`, `CREATION_DATE`, `LAST_MODIFIED_DATE`, plus the `expiration_date` from §1) are **epoch seconds** (10-digit int). The BFF must convert to ISO-8601 strings on egress to match `@sdm/api-types` (Phase B verify against `@sdm/domain` schemas; if `@sdm/domain` keeps epoch, leave as-is).

8. **PK shape inconsistency**:
   - `in.id`, `cr.id`, `pr.id`, `chg.id`, `KD.id` → numeric.
   - `cnt.id`, `nr.id` → string GUID with `U'…'` prefix and embedded single quotes (URL-encode `%27`).
   - **`in`/`cr` REL_ATTR carries a `cr:` prefix** (e.g. `cr:2800`); `chg` REL_ATTR does not.
   - The BFF routing layer should use the CA SDM `id` for path parameters (since it's the canonical PK), and surface `ref_num`/`chg_ref_num` as a separate `ref` field in the FE response to match `@sdm/domain` naming.

9. **`@COMMON_NAME` is opaque localised display text**. Never match against it in business logic — use `REL_ATTR` (stable short codes like `OP`, `CL`, `I`, `R`, `P`). `crs` labels are Slovak on this instance, `chgstat` labels are English; both label sets may change post-deployment when localisation is reconfigured.

10. **`pri.@COMMON_NAME` is a number** (1-5), not a string. JSON parser must accept both string and numeric `@COMMON_NAME` across all factories; `chg.@COMMON_NAME` and `pr.@COMMON_NAME` also surface as numbers (sequence numbers or `ref_num`).

11. **Reference cache key**: use `(factory, REL_ATTR)` not `REL_ATTR` alone. `crs` and `chgstat` share `OP`/`CL` codes but live in different reference tables; the BFF cache must not collide them.

12. **Filter syntax via FK attribute path**: FE filter params must be translated to `<fk>.<attr>=<value>` form (e.g. `status` → `status.code='OP'`). Comparing an FK directly to its numeric `id` returns a DB-level 400. The BFF filter translator (`tenant-scoping.ts` neighbour module) needs a per-factory FK-attribute whitelist.

13. **GUID filter literals**: WC clause encodes as `customer=U'<guid>'`, URL-encoded `customer%3DU%27<guid>%27`. The `U` prefix is OUTSIDE the single-quote string (`U'…'`, not `'U…'`).

14. **Pagination**: 1-based `start` index, server returns `link rel="next"|"previous"|"all"`. Translate FE `page=N&size=M` (0-based pages) → CA SDM `start=N*M+1&size=M`. Empty-page collections omit the entity-array key entirely (don't expect an empty `[]`).

15. **JSON request bodies work** on every entity factory (POST and PUT). The BFF can choose to use JSON in/out for non-bootstrap calls; only `POST /rest_access` (§1) is XML-only. **`Content-Type` is mandatory** — missing it returns 415 (empty body).

16. **Error bodies honour Accept** on entity factories (JSON or XML) — unlike bootstrap errors which are always XML. The error shaper must parse the body format from the upstream `Content-Type` header, not assume XML.

17. **`pr.assignee` and `pr.customer` resolve through different factory paths** (`/agt/<id>` vs `/cnt/<id>`) for the same underlying GUID. The BFF reference resolver must accept both `agt`-prefixed and `cnt`-prefixed self-links when mapping FK projections back to contacts.

18. **`nr.link` is an array** (self + entservx extension). Other factories return `link` as a single object. The XML→JSON adapter (`fast-xml-parser` config) must normalise both shapes to a consistent array form.

**Cleanup status**: incidents 407804 / 407809, request 407805, problem 407806, change 400851 — all soft-closed (`status=CL`, `active=NO`). CI `U'4BC62E1613E5484998092698DEB664BB'` — soft-deleted (`delete_flag=Inactive`). **KD 401701 ("F.2 KD probe — DELETEME") is orphaned** — DELETE returns 405 and `delete_flag` is not a `KD` attribute. Manual cleanup via CA SDM web UI is the only path; flagged for the dev test admin.

**Non-empirical / could not verify**:

- Composite WC predicates (`status.code='OP' AND priority.enum>=3`) — not probed, syntax documented in CA SDM 17.4 REST API guide but should be smoke-tested before relying on it in `tenant-scoping.ts`.
- `webservice_array_max_length` (the per-request `size` cap) — not probed. Default is 250 per CA SDM docs; the BFF should default to a smaller page size (e.g. 25) and reject FE requests beyond a known safe limit.
- `chg` schema beyond what was projected — change_category, approval workflow, scheduled dates: not probed. F.2 endpoints/changes.ts can stub these as optional fields until specific FE feature demands surface.
- Attachment / multipart endpoints (`/caisd-rest/lrel_attachments_requests`, etc.) — out of scope for F.2 (deferred to F.3 per F.2 plan §Open questions).
