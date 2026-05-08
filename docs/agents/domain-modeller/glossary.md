# Glosár — CA SDM ↔ UI doména ↔ DB

> Stĺpec **CA SDM pojem** je terminológia z PDF `docs/ca-service-management-17-4.pdf`.
> **DB tabuľka / kód** odkazuje na konkrétny majic factory / tabuľku
> (skratky: `cr` = call_request, `cnt` = contact, `nr` = ca_owned_resource,
> `loc` = location, `org` = organization, `chg` = change_request,
> `chgcs` = chg_change_specification, `attmnt` = attachment).
> **UI doména** = pojem v UI a v `model.ts`.

| CA SDM pojem | DB tabuľka / kód | UI doména | Notes |
|---|---|---|---|
| Call Request | `cr` (call_request) | `TicketBase` (abstract); `Incident`/`Request`/`Problem` | Spoločná base table pre tri typy ticket-u, diferencované cez `cr.type`. |
| Incident | `cr.type = "I"` (resp. `iss` factory historicky) | `Incident` | Restoration of service. |
| Request | `cr.type = "R"` | `Request` | Service request, fulfillment. |
| Problem | `cr.type = "P"` (resp. `iss` factory) | `Problem` | Root cause investigation. |
| Issue | `iss` (legacy) | – | Legacy CA SDM term, splynul s Problem v r12+. |
| Change Order | `chg` (change_request) | `Change` | RFC + workflow. |
| Change Specification | `chgcs` | `ChangeSpecification` | CACF managed attribute change, post-MVP read-only. |
| Knowledge Document | `skeleton` | `KbArticle` | KB článok. |
| KD Folder / Category | `o_indexes` | `KbCategory` | Hierarchický kategorizačný strom. |
| Configuration Item (CI) | `nr` (ca_owned_resource) | `Ci` (variant typed) | Asset/CI s class-špecifickou payload. |
| CI Class | `gcl` (general_class) | `CiClass` (literal union) | Diskriminátor pre Ci. |
| Asset | `ca_owned_resource` (alias `nr`) | `Ci` | V r12+ unified Asset = CI. |
| Contact | `cnt` | `Contact` (resp. `User`, `Group` v špec. prípadoch) | Person, Group, Company. |
| User (login) | `cnt.userid != null` | `User` | Subset Contact-u s prihlasovacími údajmi. |
| Group | `cnt.contact_type = "group"` | `Group` | Skupina pre assignment. |
| Organization Entity | `org` | `Organization` | Company. |
| Location | `loc` | `Location` | Fyzická lokácia. |
| Service | `entservx` / `serx` (CI class Service) | `Ci<"Service">` | Service ako CI. |
| Service Catalog Item | n/a (catalog entry) | `CatalogItem` | Položka katalógu (post-MVP detail). |
| Tenant | `ca_tenant` | `Tenant` | Multi-tenancy unit. |
| Super Tenant | `ca_tenant.super_tenant` | `Tenant.superTenantId` | Hierarchia. |
| Role | `usp_role` | `Role` | CACF default + custom. |
| Functional Access | CACF Roles & Functional Access (PDF s. 2520) | `Permission[]` | Modul × access level (Modify/View/None). |
| ref_num | `cr.ref_num` / `chg.chg_ref_num` | `ref` | Ľudsky čitateľný identifikátor. |
| persid | `*.persid` | `id` (typed alias `IncidentId`, ...) | Globálny handle (`<factory>:<uuid>`). |
| Status (ticket) | `cr.status` (`crs` SREL) | `IncidentStatus` / `RequestStatus` / `ProblemStatus` | Lifecycle states. |
| Priority | `cr.priority` (`pri` SREL) | `Priority` | 1–5 (computed z impact × urgency). |
| Urgency | `cr.urgency` (`urg` SREL) | `Urgency` | 1–5. |
| Impact | `cr.impact` (`imp` SREL) | `Impact` | 1–5. |
| Severity | `cr.severity` | `Severity` | 1–5 (Request only). |
| Category | `cr.category` (`pcat` SREL) | `IncidentCategory` / `RequestCategory` / `ProblemCategory` | Per-typ enum. |
| Affected End User | `cr.customer` | `affectedEndUserId` (Incident) / `requesterId` (Request) | Contact handle. |
| Assignee | `cr.assignee` | `assigneeId` | Contact handle. |
| Group (assigned) | `cr.group` | `assignedGroupId` | Group handle. |
| Affected Resource | `cr.affected_resource` | `affectedCiId` | CI handle. |
| Open Date | `cr.open_date` / `cr.target_start` | `openedAt` / `targetStartAt` | ISO timestamp. |
| Resolve Date | `cr.resolve_date` | `resolvedAt` | ISO timestamp. |
| Close Date | `cr.close_date` | `closedAt` | ISO timestamp. |
| Callback Date/Time | `cr.call_back_date` | `callBackAt` | ISO timestamp. |
| Major Incident | `cr.major_incident` | `isMajor` | Boolean. |
| Outage Start/End | `cr.outage_start_time` / `cr.outage_end_time` | `outageStartAt` / `outageEndAt` | Outage tab v CA SDM UI. |
| Symptom Code | `cr.symptom_code` | `symptomCode` | Diagnostika. |
| Root Cause | `cr.rc` | `rootCause` | Free-text (Incident) / SREL (Problem). |
| Solution Log | `soln_log` | `solutionUrls` (resp. `linkedKbArticleIds`) | Linkované KB. |
| Activity Log | `act_log` (View_*_Act_Log, PDF s. 2501) | `ActivityLog` | Audit trail per ticket. |
| Properties (ticket) | `View_Request_to_Properties` | `Ticket.properties` (UI computed) | Custom fields per kategória (post-MVP). |
| Workflow Task | `View_Change_to_Change_WF` | `Change.workflowTasks` (post-MVP) | Per-change tasks. |
| Attachment | `attmnt` | `Attachment` | Súbor alebo URL. |
| Attachment Folder | `attmnt_folder` | `AttachmentFolder` (UI-computed) | Hierarchia repository. |
| Repository | `attmnt_repository` | `AttachmentRepository` | Storage backend. |
| MDR (Management Data Repository) | – | – | Externý zdroj CMDB dát (Spectrum, ADDM, ...). FE ich nepúšťa, len zobrazuje `mdr` field. |
| BOPSID / Object Handle | `<factory>:<uuid>` (napr. `cnt:555A...`) | typed alias (napr. `UserId`) | String forma handle-u v REST API. |
| SREL (foreign key) | reference attribute | `*Id` (typed alias) | Vždy reprezentované ako string ID v UI. |
| LREL (link table many-to-many) | `lrel_*` | denormalizované poľa IDs (`linkedProblemIds`) | UI ich abstrahuje. |
| CACF | – | – | Configuration Audit and Control Facility (PDF s. 2510–2520). Modul, ktorý integruje Change + CMDB + Discovery. V MVP read-only. |
| Verify Status (chgcs) | `chgcs.verify_status` | `VerifyStatus` (15-state union) | PDF s. 2507–2508. |
| Managed Change State | – | post-MVP | CA SDM koncept (PDF s. 2511). FE neexponuje. |
| Web Client (MDR class) | `Web Client` | – | Špeciálna MDR class pre updaty cez web UI (PDF s. 2516). FE bude vystupovať pod ňou. |
| Service Type | `srv_type` | `Ci<"Service">.type` | Service catalog kategorizácia. |
| Asset Type | `asset_type` | – | Legacy term, mapuje na `CiClass`. |
| BU Result | `skeleton.BU_RESULT` | `KbArticle.buResult` | FAQ rating (0..1). |
| Hits / Accepted Hits | `skeleton.HITS` / `ACCEPTED_HITS` | `hits` / `acceptedHits` | View counters. |
| Doc Type | `skeleton.DOC_TYPE_ID` | `KbDocType` | FAQ \| HowTo \| KnownError \| Workaround \| Reference. |
| Subject Expert | `skeleton.SUBJECT_EXPERT_ID` | `subjectExpertId` | KB SME contact. |
| Owner | `skeleton.OWNER_ID` | `ownerId` | KB owner contact. |
| Author | `skeleton.AUTHOR_ID` | `authorId` | KB author contact. |
| Effective Date | `skeleton.START_DATE` | `effectiveFrom` | Publish-from. |
| Expiration Date | `skeleton.EXPIRATION_DATE` | `expiresAt` | Auto EXPIRED transition. |
| Tenant Hierarchy | super-tenant chain (PDF s. 2520) | `Tenant.superTenantId` | Inheritance. |
| Functional Access — Modify/View/None | CACF role matrix | `Permission` enum | Modul-level access. |
| ITIL Issue | – | – | CA SDM dokumentuje aj "Issue" ako business-level pre ITIL — splynul s Problem. UI ho neexponuje. |

## Skratky používané v CA SDM kódoch

| Skratka | Plný význam | UI pojem |
|---|---|---|
| `cr` | call_request | TicketBase / Incident / Request / Problem |
| `cnt` | contact | Contact / User / Group |
| `nr` | ca_owned_resource | Ci |
| `chg` | change_request | Change |
| `chgcs` | chg_change_specification | ChangeSpecification |
| `loc` | location | Location |
| `org` | organization | Organization |
| `iss` | issue (legacy) | – |
| `co` | configuration_object (alias of `nr`) | Ci |
| `ci` | configuration_item (alias of `nr`) | Ci |
| `attmnt` | attachment | Attachment |
| `act_log` | activity_log | ActivityLog |
| `lrel` | link relation table | – (UI abstrahuje) |
| `srel` | single-foreign-key relation | – (UI = string ID) |
| `pri` | priority lookup | Priority |
| `urg` | urgency lookup | Urgency |
| `imp` | impact lookup | Impact |
| `crs` | call_request_status | IncidentStatus / RequestStatus / ProblemStatus |
| `pcat` | problem_category lookup | *Category |
| `gcl` | general_class | CiClass |
| `mdr` | management_data_repository | – |
| `usp` | user_security_permission | Role / Permission |
| `bopsid` | back-office persistent session id | session token |

## Otvorené závislosti

- `[01-api-analyst]` Skratky `cr.type`, `cnt.contact_type`, `chg.status` — overiť
  v REST API, či sú vystavené ako enum codes alebo localized strings.
- `[10-documentation-author]` Tento glosár je primárny zdroj terminológie pre
  konsolidované dokumenty. V round-2 prosím doplň o termíny, ktoré ostatní
  agenti zaviedli (napr. `BFF` z 04, `tenant token` z 05).
- `[?]` Slovenské preklady — GOAL §5 deklaruje SK + EN. Tabuľka má anglické UI
  pojmy ako canonical (zhoda s `model.ts` identifiers), slovenské UI labely
  patria do i18n súborov, nie do tohto glosára.
