# CA SDM 17.4 — Katalóg REST endpointov

> Zdroj: PDF `docs/ca-service-management-17-4.pdf`, sekcia *REST HTTP Methods*
> (s. 3436–3472), *API Documentation for RESTful Services* (s. 3766–4012),
> *REST API* (s. 2906–3394).
>
> **Konvencie**:
> - Všetky cesty primárneho REST API začínajú `/caisd-rest`. Cesty BUI/Service
>   Point vrstvy začínajú `/api`, `/bui`, `/gs`, alebo sú root-level.
> - Default port (out-of-the-box) je `8050` (REST) a `8080` (web client). Mapping
>   sa overí v `versions.md`.
> - Auth header pre primárnu vrstvu: `X-AccessKey`. Pre BUI: `X-AccessToken`.
> - V `cURL` ukážkach používame placeholder `$BASE` (`https://sdm.example/caisd-rest`)
>   a `$KEY` (Access Key získaný cez `POST /caisd-rest/rest_access`).

## Štruktúra

Endpointy sú zoskupené per modul (Auth, Common, Incident, Request, Problem,
Change, Knowledge, CMDB, Attachment, Service Catalog). Pre každý endpoint:
HTTP metóda + cesta, modul, auth, parametre, payload schéma, error codes.

Strojovo čitateľný katalóg všetkých endpointov je vo `endpoints.csv`.

---

## Auth (Access Key lifecycle)

### POST /caisd-rest/rest_access
- **Modul**: Auth
- **Auth**: `Authorization: Basic <b64(userid:password)>` *alebo* `X-BOPSID`
  *alebo* `X-ExtAuthArtifact` + `X-UserName`. (PDF s. 3447–3450)
- **Body**: prázdny `<rest_access/>` element (XML) alebo `{}` (JSON).
- **Response 201**: `RestAccessCreateResponse` — `access_key`, `expiration_date`.
- **Errors**: 400 (invalid creds), 401 (failed authentication), 500.
- **Notes**: Basic flow je defaultne enabled. Možno globálne vypnúť option-om
  `NX_REST_WEBSERVICE_DISABLE_BASIC_AUTH=Yes`. Cez SSL.

```bash
curl -X POST "$BASE/rest_access" \
  -u 'ServiceDesk:openSesame' \
  -H 'Content-Type: application/xml' \
  -d '<rest_access/>'
```

### GET /caisd-rest/rest_access/{id}
- **Modul**: Auth
- **Auth**: `X-AccessKey`
- **Path params**: `id` — REST access record ID (vyšlo z POST response).
- **Response 200**: `RestAccessCreateResponse` (bez `secret_key`).
- **Errors**: 401, 404.

### DELETE /caisd-rest/rest_access/{id}
- **Modul**: Auth
- **Auth**: `X-AccessKey`
- **Path params**: `id` — record ID.
- **Response 204**: prázdny.
- **Errors**: 401, 404.
- **Notes**: Po DELETE Access Key zaniká okamžite. (PDF s. 3452)

### POST /caisd-rest/bopsid
- **Modul**: Auth (SSO bridge)
- **Auth**: `X-AccessKey`
- **Body**: `<bopsid/>`
- **Response 201**: `BopsidResponse` — `bopsid_val`.
- **Notes**: Single-use token, expirácia 5 min od vytvorenia. (PDF s. 3453)

---

## Common helpers

### GET /caisd-rest/{factory}
- **Modul**: Common (collection GET, valid pre všetky CA SDM objekty)
- **Auth**: `X-AccessKey`
- **Query**: `WC` (WHERE clause, percent-encoded), `SORT`, `start`, `size`,
  `_type`, `EntryTitle`, `EntrySummary` (atom).
- **Response 200**: `PaginatedResponse<T>` s ATOM-style `next` / `previous`
  / `all` linkami.
- **Errors**: 400 (zlá WC), 401.
- **Notes**: Použiteľné aj na `cnt`, `cr`, `chg`, `attmnt`, `nr`, `KCAT`, atď.
  Default page size = 25 (`rest_webservice_list_page_length`).

### GET /caisd-rest/{factory}/{id}
- **Modul**: Common (single GET)
- **Auth**: `X-AccessKey`
- **Path**: `id` — INTEGER id, `U'...'` UUID literál, `COMMON_NAME-<value>`,
  alebo `REL_ATTR-<value>`.
- **Response 200**: konkrétna entita.
- **Errors**: 400, 401, 404, 409 (multiple matches at COMMON_NAME).

### PUT /caisd-rest/{factory}/{id}
- **Modul**: Common (update)
- **Auth**: `X-AccessKey`
- **Headers**: `X-AttrsToNull` na vynulovanie atribútov.
- **Body**: čiastočná entita (XML alebo JSON podľa Content-Type).
- **Response 200**: aktualizovaná entita.
- **Errors**: 400, 401, 404, 409.

### DELETE /caisd-rest/{factory}/{id}
- **Modul**: Common (delete)
- **Auth**: `X-AccessKey`
- **Response 204**: prázdny.
- **Notes**: **Väčšina objektov DELETE nepodporuje** — namiesto toho sa
  nastavuje `delete_flag` na 1 (Inactive) cez PUT. Default DELETE-povolené
  sú: `rest_access`, `KCAT`, `grpmem`, `wf`. (PDF s. 3439)

### GET /caisd-rest/{factory}/{id}/{attribute}
- **Modul**: Common (sub-resource navigation: SREL/BREL/QREL/BLREL)
- **Auth**: `X-AccessKey`
- **Examples**:
  - `GET /caisd-rest/chg/400001/status` (SREL → chgstat)
  - `GET /caisd-rest/chg/400001/act_log` (BREL → chgalg collection)
  - `GET /caisd-rest/chg/400001/attachments` (BLREL → attmnt collection)
  - `GET /caisd-rest/chg/400001/workflow` (QREL → wf collection)

---

## Incident Management (`in`)

### GET /caisd-rest/in
- **Modul**: Incident
- **Auth**: `X-AccessKey`
- **Query**: `WC=priority%3D1`, `SORT=open_date DESC`, `start`, `size`, `_type`.
- **Response 200**: `PaginatedResponse<Incident>`.
- **Notes**: Bežne kombinovať s `X-Obj-Attrs: ref_num,summary,status,priority,assignee`
  pre úsporu prenosu.

```bash
curl -H "X-AccessKey: $KEY" \
  -H "X-Obj-Attrs: ref_num,summary,status,priority,open_date,assignee" \
  "$BASE/in?WC=active%3D1%20AND%20priority%3D1&SORT=open_date%20DESC&size=50"
```

### GET /caisd-rest/in/{id}
- **Modul**: Incident
- **Auth**: `X-AccessKey`
- **Path**: `id` numeric, alebo `<persid>` ako `cr:400055`.
- **Response 200**: `Incident`.

### POST /caisd-rest/in
- **Modul**: Incident
- **Auth**: `X-AccessKey`
- **Body**: `Incident` partial (REQUIRED: `customer`, `log_agent`, `priority`).
- **Response 201**: vytvorený `Incident` s `Location` headerom.
- **Errors**: 400 (missing required), 401, 409.

### PUT /caisd-rest/in/{id}
- **Modul**: Incident
- **Auth**: `X-AccessKey`
- **Body**: čiastočný `Incident` (partial update).
- **Response 200**: aktualizovaný `Incident`.

### GET /caisd-rest/in/{id}/act_log
- **Modul**: Incident — Activity Log
- **Auth**: `X-AccessKey`
- **Response 200**: `PaginatedResponse<IncidentActivityLog>`.

### POST /caisd-rest/in/{id}/act_log
- **Modul**: Incident — pridať activity log entry
- **Auth**: `X-AccessKey`
- **Body**: `IncidentActivityLog` (REQUIRED: `description`, `type`).
- **Response 201**.
- **Notes**: BREL create cez REST je dvojstupňový — najprv POST priamo na
  `/caisd-rest/alg` s SREL na incident, potom GET na BREL collection. PDF
  s. 3450 popisuje sample. Použitie sub-resource path je convenience.

### GET /caisd-rest/in/{id}/attachments
- **Modul**: Incident — attachments collection
- **Auth**: `X-AccessKey`
- **Response 200**: `PaginatedResponse<Attachment>`.

### GET /caisd-rest/in_trans
- **Modul**: Incident — povolené status transitions
- **Auth**: `X-AccessKey`
- **Query**: `WC=status%3DOP` pre transitions z konkrétneho statusu.
- **Response 200**: `PaginatedResponse<IncidentTransition>`.

---

## Request Management (`cr`)

### GET /caisd-rest/cr
- **Modul**: Request
- **Auth**: `X-AccessKey`
- **Query**: `WC` (často `type%3D'R'` pre čistý request, nie incident).
- **Response 200**: `PaginatedResponse<ServiceRequest>`.
- **Notes**: `cr` factory zdiela `Call_Req` tabuľku s `in` a `pr` — pri
  cross-module operáciách je čistejšie volať `in` / `pr` priamo.

### GET /caisd-rest/cr/{id}
- **Modul**: Request
- **Auth**: `X-AccessKey`
- **Response 200**: `ServiceRequest`.

### POST /caisd-rest/cr
- **Modul**: Request
- **Auth**: `X-AccessKey`
- **Body**: `ServiceRequest` partial (REQUIRED: `customer`, `log_agent`, `priority`).
- **Response 201**.

### PUT /caisd-rest/cr/{id}
- **Modul**: Request
- **Auth**: `X-AccessKey`
- **Body**: partial `ServiceRequest`.
- **Response 200**.

### GET /caisd-rest/cr/{id}/act_log
- **Modul**: Request — Activity log
- **Auth**: `X-AccessKey`
- **Response 200**: `PaginatedResponse<ServiceRequestActivityLog>`.

### GET /caisd-rest/cr/{id}/children
- **Modul**: Request — child requests (QREL)
- **Auth**: `X-AccessKey`
- **Response 200**: `PaginatedResponse<ServiceRequest>`.

### GET /caisd-rest/cr/{id}/attached_slas
- **Modul**: Request — SLA assignments (BREL)
- **Auth**: `X-AccessKey`
- **Response 200**: collection `attached_sla`.

### GET /caisd-rest/crs
- **Modul**: Request — status reference
- **Auth**: `X-AccessKey`
- **Response 200**: `PaginatedResponse<ServiceRequestStatus>`.

### GET /caisd-rest/crs/{code}
- **Modul**: Request — single status
- **Auth**: `X-AccessKey`
- **Path**: `code` napr. `OP`, `WIP`, `RE`.
- **Response 200**: `ServiceRequestStatus`.

---

## Problem Management (`pr`)

### GET /caisd-rest/pr
- **Modul**: Problem
- **Auth**: `X-AccessKey`
- **Response 200**: `PaginatedResponse<Problem>`.

### GET /caisd-rest/pr/{id}
- **Modul**: Problem
- **Auth**: `X-AccessKey`
- **Response 200**: `Problem`.

### POST /caisd-rest/pr
- **Modul**: Problem
- **Auth**: `X-AccessKey`
- **Body**: `Problem` partial (REQUIRED: `customer`, `log_agent`, `priority`).
- **Response 201**.

### PUT /caisd-rest/pr/{id}
- **Modul**: Problem
- **Auth**: `X-AccessKey`
- **Body**: partial.
- **Response 200**.

### GET /caisd-rest/pr/{id}/children
- **Modul**: Problem — linked incidents (cez `parent` SREL)
- **Auth**: `X-AccessKey`
- **Response 200**: collection `cr` filter na `parent eq 'pr:<id>'`.

> ⚠️ "Linkovanie incidentu na problém" sa technicky robí cez PUT na `in`
> s `parent` = `<persid problému>`. Žiadny dedikovaný `/link` endpoint
> v REST nie je; FE musí poslať update PUT.

---

## Change Management (`chg`)

### GET /caisd-rest/chg
- **Modul**: Change
- **Auth**: `X-AccessKey`
- **Response 200**: `PaginatedResponse<ChangeOrder>`.

### GET /caisd-rest/chg/{id}
- **Modul**: Change
- **Auth**: `X-AccessKey`
- **Response 200**: `ChangeOrder`.

### POST /caisd-rest/chg
- **Modul**: Change
- **Auth**: `X-AccessKey`
- **Body**: `ChangeOrder` partial (REQUIRED: `affected_contact`, `requestor`,
  `log_agent`, `priority`).
- **Response 201**.

```bash
curl -X POST "$BASE/chg" \
  -H "X-AccessKey: $KEY" \
  -H 'Content-Type: application/json' \
  -d '{"summary":"DB upgrade","requestor":{"REL_ATTR":"U'\''793E...'\''"},"priority":3}'
```

### PUT /caisd-rest/chg/{id}
- **Modul**: Change
- **Auth**: `X-AccessKey`
- **Body**: partial.
- **Response 200**.

### GET /caisd-rest/chg/{id}/workflow
- **Modul**: Change — workflow tasks (QREL)
- **Auth**: `X-AccessKey`
- **Response 200**: `PaginatedResponse<WorkflowTask>`.

### GET /caisd-rest/chg/{id}/act_log
- **Modul**: Change — activity log (BREL)
- **Auth**: `X-AccessKey`
- **Response 200**: `PaginatedResponse<ChangeActivityLog>`.

### GET /caisd-rest/chg/{id}/attachments
- **Modul**: Change — attachments (BLREL)
- **Auth**: `X-AccessKey`
- **Response 200**: `PaginatedResponse<Attachment>`.

### GET /caisd-rest/chgcat
- **Modul**: Change — change categories
- **Auth**: `X-AccessKey`
- **Response 200**: `PaginatedResponse<ChangeCategory>`.

### GET /caisd-rest/chgstat
- **Modul**: Change — change statuses
- **Auth**: `X-AccessKey`
- **Response 200**: collection `ChangeStatus`.

### GET /caisd-rest/chg_trans
- **Modul**: Change — povolené status transitions
- **Auth**: `X-AccessKey`
- **Response 200**: zoznam povolených prechodov (`status` → `new_status`).

### POST /caisd-rest/wf
- **Modul**: Change — vytvor workflow task
- **Auth**: `X-AccessKey`
- **Body**: `WorkflowTask` (REQUIRED: `chg`, `task`, `sequence`, `object_type`).
- **Response 201**.
- **Notes**: `wf` je jeden z mála objektov s permitted DELETE (REST_OPERATIONS:
  `CREATE READ UPDATE DELETE`).

### PUT /caisd-rest/wf/{id}
- **Modul**: Change — update workflow task (typ. zmena `status` na "Approved" atď.)
- **Auth**: `X-AccessKey`
- **Body**: partial `WorkflowTask`.
- **Response 200**.

---

## Knowledge Management

### GET /caisd-rest/KCAT
- **Modul**: KB — list categories
- **Auth**: `X-AccessKey`
- **Response 200**: `PaginatedResponse<KnowledgeCategory>`.

### GET /caisd-rest/KCAT/{id}
- **Modul**: KB — single category
- **Auth**: `X-AccessKey`
- **Response 200**: `KnowledgeCategory`.

### GET /caisd-rest/SKELETONS
- **Modul**: KB — list KB documents
- **Auth**: `X-AccessKey`
- **Response 200**: `PaginatedResponse<KnowledgeDocument>`.
- **Notes**: `SKELETONS` je interný factory pre KB články — externe sa
  nazýva *Knowledge Document*. Pre full-text vyhľadávanie REST API
  poskytuje iba WC clause; pokročilé fulltext vyhľadávanie je v BUI vrstve
  (`/bui/getDocument`) alebo v `searchKnowledgeBase` SOAP.

### GET /caisd-rest/SKELETONS/{id}
- **Modul**: KB — single document
- **Auth**: `X-AccessKey`
- **Response 200**: `KnowledgeDocument`.

### GET /caisd-rest/O_COMMENTS?WC=DOC_ID%3D{id}
- **Modul**: KB — komentáre dokumentu
- **Auth**: `X-AccessKey`
- **Response 200**: `PaginatedResponse<KnowledgeComment>`.

### GET /caisd-rest/kdlinks?WC=kd%3D{id}
- **Modul**: KB — väzby dokumentu na tickety
- **Auth**: `X-AccessKey`
- **Response 200**: `PaginatedResponse<KnowledgeLink>`.

### GET /bui/getDocument({id})
- **Modul**: KB — Service Point document fetch (rich text)
- **Auth**: `X-AccessToken`
- **Path**: `id` — KD numeric ID.
- **Query**: `$updateHits` — `true|false`.
- **Response 200**: KD content rendered for Service Point UI.
- **Notes**: Vrstva BUI; používame ak chceme HTML prepared content namiesto
  raw `CONTENT` poľa.

### POST /bui/addKDComment({id})
- **Modul**: KB — pridaj komentár cez Service Point flow
- **Auth**: `X-AccessToken`
- **Body**: `{ comment, commenttype, useruuid }`
- **Response 201**.

### POST /bui/rateDocument({id})
- **Modul**: KB — rate document
- **Auth**: `X-AccessToken`
- **Body**: `{ rating: 1..5 }`
- **Response 200**.

---

## CMDB (`nr` — named resources / CIs)

### GET /caisd-rest/nr
- **Modul**: CMDB
- **Auth**: `X-AccessKey`
- **Query**: `WC=class%3D<id>` na filter per class, `WC=resource_status%3D1`
  na aktívne CI.
- **Response 200**: `PaginatedResponse<ConfigurationItem>`.

### GET /caisd-rest/nr/{id}
- **Modul**: CMDB
- **Auth**: `X-AccessKey`
- **Path**: `id` — UUID literál (`U'...'`).
- **Response 200**: `ConfigurationItem`.

### POST /caisd-rest/nr
- **Modul**: CMDB — create CI
- **Auth**: `X-AccessKey`
- **Body**: `ConfigurationItem` partial.
- **Response 201**.
- **Notes**: V scope MVP CMDB read-only — mimo MVP.

### PUT /caisd-rest/nr/{id}
- **Modul**: CMDB
- **Auth**: `X-AccessKey`
- **Body**: partial.
- **Response 200**.

### GET /caisd-rest/nr/{id}/all_open_creq
- **Modul**: CMDB — všetky open requests pre CI (QREL)
- **Auth**: `X-AccessKey`
- **Response 200**: `PaginatedResponse<ServiceRequest>`.

### GET /caisd-rest/nr/{id}/asset_log
- **Modul**: CMDB — log zmien CI (BREL → nr_com)
- **Auth**: `X-AccessKey`
- **Response 200**: `PaginatedResponse<ConfigurationItemLog>`.

### GET /caisd-rest/nr/{id}/child_hier
- **Modul**: CMDB — CI children v hierarchii
- **Auth**: `X-AccessKey`
- **Response 200**: collection `hier`.

### GET /caisd-rest/nr/{id}/parent_hier
- **Modul**: CMDB — CI parents v hierarchii
- **Auth**: `X-AccessKey`

### GET /caisd-rest/nrf
- **Modul**: CMDB — resource families (lookup)
- **Auth**: `X-AccessKey`
- **Response 200**: `PaginatedResponse<ResourceFamily>`.

### GET /caisd-rest/loc
- **Modul**: Common — lokácie
- **Auth**: `X-AccessKey`
- **Response 200**: `PaginatedResponse<Location>`.

---

## Attachments

### GET /caisd-rest/attmnt
- **Modul**: Attachments — collection
- **Auth**: `X-AccessKey`
- **Response 200**: `PaginatedResponse<Attachment>`.

### GET /caisd-rest/attmnt/{id}
- **Modul**: Attachments — metadata
- **Auth**: `X-AccessKey`
- **Response 200**: `Attachment`.

### GET /caisd-rest/attmnt/{id}/file-resource
- **Modul**: Attachments — download file (binary)
- **Auth**: `X-AccessKey`
- **Response 200**: `application/octet-stream`. (PDF s. 3450)

### POST /caisd-rest/attmnt
- **Modul**: Attachments — upload (multipart)
- **Auth**: `X-AccessKey`
- **Body**: `multipart/form-data`:
  - `attmnt` — XML/JSON metadata payload (`Attachment`)
  - `<filename>` — binary file content
- **Query**: `repositoryId`, `AttachmentId`, `serverName`, `mimeType`,
  `description`.
- **Response 201**: `Attachment`.

```bash
curl -X POST "$BASE/attmnt?repositoryId=1002&mimeType=image/png" \
  -H "X-AccessKey: $KEY" \
  -F 'attmnt=<screenshot.xml;type=application/xml' \
  -F 'screenshot.png=@./screenshot.png;type=image/png'
```

### POST /caisd-rest/chg/?repositoryId=...
- **Modul**: Change + Attachments — vytvor change a attachment naraz
- **Auth**: `X-AccessKey`
- **Body**: `multipart/form-data` so `chg` XML payloadom + súborom.
- **Response 201**: `ChangeOrder`. (PDF s. 3451)

### DELETE /caisd-rest/attmnt/{id}
- **Modul**: Attachments
- **Auth**: `X-AccessKey`
- **Response 204**.

---

## Service Catalog & Service Point (BUI vrstva)

> Tieto endpointy nemajú `/caisd-rest` prefix. Auth header je `X-AccessToken`,
> nie `X-AccessKey`. Vrstva sa volá *Service Point* a má vlastný swagger
> v PDF (`Leh-17.2 GA`, s. 2906–2980).

### POST /api/getAccess
- **Modul**: Auth (BUI)
- **Auth**: `Authorization: Basic`
- **Response 200**: `X-AccessToken` v hlavičke + `BuiAccessResponse` v body.

### GET /bui/getBUIAllConfig
- **Modul**: Service Point — config
- **Auth**: `X-AccessToken`
- **Response 200**: `BuiConfig` — feature flags, branding, multi-tenant config.

### GET /getOfferings
- **Modul**: Service Catalog — featured offerings
- **Auth**: `X-AccessToken`
- **Query**: `$skip`, `$top`.
- **Response 200**: `GetOfferingsResponse`.
- **Notes**: Lokalizácia cez header `X-Lang`.

### GET /getBrowseOfferings
- **Modul**: Service Catalog — browse cez kategórie
- **Auth**: `X-AccessToken`
- **Response 200**: `GetOfferingsResponse`.

### GET /pcatSearch
- **Modul**: Service Catalog — full-text vyhľadávanie kategórií + offerings
- **Auth**: `X-AccessToken`
- **Query**: `query` (search term), `$skip`, `$top`.
- **Response 200**: `PcatSearchResponse`.

### GET /suggestedSolutions
- **Modul**: Service Point — KB suggested solutions na základe textu
- **Auth**: `X-AccessToken`
- **Query**: `text`, `tenant`, `$top`.
- **Response 200**: list `KnowledgeDocument` summaries.

### GET /getServiceRequest
- **Modul**: Service Catalog — list catalog requests pre logged-in user
- **Auth**: `X-AccessToken`
- **Query**: `$skip`, `$top`.
- **Response 200**: list `ServiceCatalogRequestSummary`.

### GET /gs/mytkt_active
- **Modul**: Service Point — moje aktívne tickety
- **Auth**: `X-AccessToken`
- **Response 200**: list ticketov so summary, status, last_mod.

### GET /gs/mytkt_inactive
- **Modul**: Service Point — moje uzatvorené tickety
- **Auth**: `X-AccessToken`
- **Response 200**: list.

### GET /bui/getMyTicketDetails('{persid}')
- **Modul**: Service Point — detail ticketu vrátane assignee, comments
- **Auth**: `X-AccessToken`
- **Path**: `persid` — `cr:400055` formát.
- **Response 200**: rich ticket detail (BUI shape).

### GET /bui/getAllowedStatus
- **Modul**: Service Point — povolené status transitions pre aktuálneho usera
- **Auth**: `X-AccessToken`
- **Response 200**: `{ count, results: [{ entity, ... }] }`.

### POST /bui/addLogComment
- **Modul**: Service Point — pridaj log comment do ticketu
- **Auth**: `X-AccessToken`
- **Body**: `{ persid, comment, internal }`.
- **Response 201**.

### POST /bui/changeStatus/{factory}('{persid}')
- **Modul**: Service Point — zmena status ticketu cez SP UI flow
- **Auth**: `X-AccessToken`
- **Path**: `factory` (`cr|in|pr|chg|iss`), `persid`.
- **Body**: `{ newStatus, comment }`.
- **Response 200**.

### GET /bui/attmnt('{persid}')/$value
- **Modul**: Service Point — download attachment (BUI variant)
- **Auth**: `X-AccessToken`
- **Path**: `persid` — `attmnt:400015`.
- **Response 200**: binary content.

### GET /bui/getDefaultCategories
- **Modul**: Service Point — default category tree
- **Auth**: `X-AccessToken`
- **Response 200**: tree of categories.

### GET /bui/attrCtrl
- **Modul**: Service Point — fetch dependent attribute controls
- **Auth**: `X-AccessToken`
- **Query**: `factory`, `attrname`, `attrvalue`.
- **Response 200**: list dependent attributes (pre dynamic forms).

### GET /bui/getMyResources
- **Modul**: Service Point — moje CI (assets)
- **Auth**: `X-AccessToken`
- **Response 200**: list `ConfigurationItem` summaries.

### GET /bui/allFeeds('{persid}')
- **Modul**: Service Point — all activity feed (komenty + zmeny + attachments)
- **Auth**: `X-AccessToken`
- **Path**: `persid` — ticket persistent ID.
- **Response 200**: `{ totalCount, ActivityLogEntry: [...] }`.

---

## Multi-tenancy support

### GET /caisd-rest/tenant
- **Modul**: Tenancy — zoznam tenantov (admin)
- **Auth**: `X-AccessKey` (vyžaduje tenant_admin function group)
- **Response 200**: `PaginatedResponse<Tenant>`.

### GET /caisd-rest/tenant/{id}
- **Modul**: Tenancy
- **Auth**: `X-AccessKey`
- **Response 200**: `Tenant`.

### GET /caisd-rest/tenant_group
- **Modul**: Tenancy — tenant groups
- **Auth**: `X-AccessKey`
- **Response 200**: `PaginatedResponse<TenantGroup>`.

### GET /caisd-rest/tenant_group_member
- **Modul**: Tenancy — N:M tenant ↔ group
- **Auth**: `X-AccessKey`
- **Query**: `WC=tenant_group%3D'<groupId>'` alebo `WC=tenant_id%3D'<tenantId>'`.
- **Response 200**: `PaginatedResponse<TenantGroupMember>`.

### GET /caisd-rest/cnt/{id}/roles
- **Modul**: Tenancy — role aktuálneho používateľa
- **Auth**: `X-AccessKey`
- **Path**: `id` — UUID kontaktu (`U'...'`).
- **Response 200**: list `cnt_role` (každý má `tenant` referenciu).
- **Notes**: Toto je primárny zdroj pre tenant switcher v UI — odvodené
  tenanty z užívateľových rolí. Detail v `multi-tenancy.md`.

---

## Reference data (typicky read-only z FE)

| Endpoint | Účel |
|---|---|
| `GET /caisd-rest/pri` | Priorities (1..5) |
| `GET /caisd-rest/sevrty` | Severities |
| `GET /caisd-rest/imp` | Impacts |
| `GET /caisd-rest/urg` | Urgencies |
| `GET /caisd-rest/pcat` | Problem categories (tree) |
| `GET /caisd-rest/isscat` | Issue categories |
| `GET /caisd-rest/chgcat` | Change categories |
| `GET /caisd-rest/rc` | Root causes |
| `GET /caisd-rest/symptom_code` | Symptom codes |
| `GET /caisd-rest/closure_code` | Closure codes |
| `GET /caisd-rest/act_type` | Activity log types |
| `GET /caisd-rest/aty` | Allowed activity types per status |
| `GET /caisd-rest/crs` | CR statuses |
| `GET /caisd-rest/chgstat` | Change statuses |
| `GET /caisd-rest/issstat` | Issue statuses |
| `GET /caisd-rest/cr_template` | CR templates (quick ticket) |
| `GET /caisd-rest/chg_tpl` | Change templates |
| `GET /caisd-rest/iss_tpl` | Issue templates |
| `GET /caisd-rest/wftpl` | Workflow templates |
| `GET /caisd-rest/grp` | Groups (queues) |
| `GET /caisd-rest/agt` | Analyst contacts (factory of cnt) |
| `GET /caisd-rest/cst` | Customer contacts (factory of cnt) |
| `GET /caisd-rest/dept` | Departments |
| `GET /caisd-rest/org` | Organizations |
| `GET /caisd-rest/cost_cntr` | Cost centers |
| `GET /caisd-rest/country` | Countries |
| `GET /caisd-rest/loc` | Locations |
| `GET /caisd-rest/job_func` | Job functions |
| `GET /caisd-rest/opsys` | Operating systems |
| `GET /caisd-rest/prod` | Products |
| `GET /caisd-rest/options` | System options (admin only) |
| `GET /caisd-rest/intfc` | Interfaces (creation channel) |
| `GET /caisd-rest/role` | Roles |
| `GET /caisd-rest/acctyp` | Access types |
| `GET /caisd-rest/cnt_role` | Contact ↔ role assignments |
| `GET /caisd-rest/grpmem` | Group ↔ contact membership |
| `GET /caisd-rest/in_trans` | Incident transitions |
| `GET /caisd-rest/cr_trans` | CR transitions |
| `GET /caisd-rest/chg_trans` | Change transitions |
| `GET /caisd-rest/pr_trans` | Problem transitions |
| `GET /caisd-rest/iss_trans` | Issue transitions |

Pre každú referenčnú entitu fungujú aj single-GET (`{id}`), CREATE (POST),
UPDATE (PUT), avšak pre nový FE ich budeme volať **iba ako read** (admin
operácie sú mimo MVP).

---

## Read-model — Database Views (mimo scope, informačne)

CA SDM 17.4 navyše exponuje SQL views v MDB databáze (PDF s. 2501–2904).
Tieto **nie sú dostupné cez REST API** — používajú sa pre BI/reporting.
Mimo MVP scope, ale stojí za zmienku, že prípadné off-line reportovanie
si nebude vyžadovať ďalší REST endpoint.

---

## Output formáty

REST API podporuje XML (default), JSON a Atom feed:

| Spôsob | Príklad |
|---|---|
| Cez Accept header | `Accept: application/json` |
| Cez file-extension v URL | `GET /caisd-rest/chg/400001.json` |
| Cez `_type` query param | `GET /caisd-rest/chg/400001?_type=json` |
| Atom feed | `GET /caisd-rest/chg.feed` |

Precedencia: URL extension → `_type` → Accept header. (PDF s. 3446)

---

## Otvorené závislosti

| # | Flag | Smer | Popis |
|---|---|---|---|
| 1 | `endpoint-coverage-vs-features` | → 03-domain-modeller | Domain Modeller potvrdí, či pre každú user-facing operáciu existuje REST endpoint, alebo treba SOAP fallback (viď `gaps.md` § Bulk Operations, Approval Flow, Notifications). |
| 2 | `pagination-strategy` | → 04-architecture, 09-qa | API limity stránok (default 25, max v option `rest_webservice_list_max_length`) ovplyvnia UI virtualizáciu. Aktuálne info v PDF nepostačuje pre presný max. **Overiť na inštancii.** |
| 3 | `bui-vs-rest-overlap` | → 04-architecture | Niektoré BUI endpointy duplikujú primárny REST (napr. `/bui/getMyTicketDetails` ↔ `/caisd-rest/cr/{id}`). Architektúra rozhodne, či pre Portal používame BUI vrstvu (lepšia UX, ale token diferenciácia) alebo primárnu REST. |
| 4 | `chg_trans-allowed-list` | → 03-domain-modeller | Či `GET /caisd-rest/chg_trans` skutočne vráti zoznam povolených prechodov pre konkrétny ticket (s ohľadom na role) alebo len global table. PDF popisuje tabuľku, nie filter. **Overiť.** |
| 5 | `service-catalog-config-source` | → 02-ux-persona, 03-domain-modeller | Service Catalog form rendering vyžaduje schému catalog options. Endpoint `/getOfferings` vracia len summary. Detail rendovania formulára (option types, validation) potrebné cez ďalší BUI endpoint — v PDF nie je explicitne dokumentovaný (`/bui/getDefaultCategories` je len kategorický strom). **Otvorené, vyžaduje DOM modeller verdikt.** |
| 6 | `attachment-permissions` | → 05-security | `pgroup_type` (1=group, 2=role) kontroluje prístup k attachmentu. FE musí ošetriť 401 pri prístupe nepovolených súborov. Security agent to zlúči s threat modelom. |
