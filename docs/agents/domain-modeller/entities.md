# Doménový model — entity a agregáty

> Round 1, fresh — derivované z `docs/ca-service-management-17-4.pdf` (Database
> Views s. 2501–2502, DatabaseInstance reference s. 4013–4030, CACF Roles and
> Multi-Tenancy s. 2520) a `GOAL.md` §3 (Scope), §4 (cieľové skupiny), §5 (NFR),
> §11 (vstupy od používateľa).
>
> Identifikátory atribútov v stĺpci **Backend (CA SDM)** sú citáciou
> dokumentačných tabuliek — `cr.*` = `call_request` tabuľka, `cnt.*` = `Contact`,
> `nr.*` = `ca_owned_resource` (CI), `loc.*` = `Location`, `org.*` =
> `OrganizationEntity`. UI-doména pojmy **nedupluje** — re-exportuje typy z
> `model.ts` a referencuje cez TypeScript.
>
> Konvencia naming: UI typy sú `PascalCase` bez prefixu (`Incident`, `Request`),
> **agregáty čisto-UI** (computed/aggregated views) sú prefixované `Ui*`
> (`UiIncidentSummary`, `UiQueueItem`).

---

## Tenant

| UI atribút | Typ | Backend (CA SDM) | Pôvod | Required | Poznámka |
|---|---|---|---|---|---|
| `id` | `TenantId` (uuid) | `ca_tenant.id` (predpoklad — overiť v API) | API | yes | Persistentný identifikátor. |
| `name` | `string` | `ca_tenant.name` | API | yes | Zobrazuje sa v tenant switcheri. |
| `code` | `string` | `ca_tenant.code` | API | no | Krátky kód (napr. `ACME-CZ`). |
| `superTenantId` | `TenantId \| null` | `ca_tenant.super_tenant` | API | no | Tenant hierarchia (CACF s. 2520 — *"tenants up their hierarchy can view all CACF objects"*). |
| `isActive` | `boolean` | `ca_tenant.delete_flag` | API | yes | Logical delete v CA SDM. |

**Invarianty:**
- Aktívny user **musí** mať aspoň jeden `Tenant` cez `Role`. Bez priradenia tenant
  nevidí žiadne business entity.
- `superTenantId` tvorí strom (žiadne cykly). Príslušnosť k subtenantu **dedí**
  viditeľnosť superobjektov per CACF rules.

**Risks / open:** schému `ca_tenant` PDF priamo nedokumentuje — odvodené z
CACF kapitoly. API analyst musí potvrdiť endpoint `/caisd-rest/tenants` alebo
ekvivalent.

## User

Reprezentuje fyzickú osobu prihlásenú do FE. V CA SDM zodpovedá záznamu
`Contact` (`cnt.*`) — t.j. **každý CA SDM používateľ je Contact**, nie všetky
Contact-y sú users (Contact je všeobecnejší — pokrýva aj affected end users
v ticketoch, ktoré nemajú prihlasovacie konto).

| UI atribút | Typ | Backend (CA SDM) | Required |
|---|---|---|---|
| `id` | `UserId` (= `Contact.id`) | `cnt.id` / `cnt:<uuid>` handle | yes |
| `username` | `string` | `cnt.userid` | yes |
| `firstName` | `string` | `cnt.first_name` | yes |
| `lastName` | `string` | `cnt.last_name` | yes |
| `fullName` | `string` (computed) | `cnt.combo_name` | yes |
| `email` | `string` | `cnt.email_address` | no |
| `phone` | `string` | `cnt.phone_number` | no |
| `jobTitle` | `string` | `cnt.position` | no |
| `isActive` | `boolean` | `cnt.available` | yes |
| `defaultTenantId` | `TenantId` | derived (z `User.roles[0].tenantId` alebo z user profile) | yes |

**Invarianty:**
- `username` je unique v rámci tenant hierarchy.
- Odhlásený / inaktívny user neuvidí žiaden tenant ani business entitu.
- `defaultTenantId` musí byť v `availableTenantIds` (computed z `roles`).

## Role

CACF dokument (s. 2520) menuje 12 default rolí: `Administrator`,
`Configuration Administrator`, `Configuration Analyst`, `Configuration Viewer`,
`Change Manager`, `Service Desk Administrator`, `Service Desk Manager`,
`System Administrator`, `Level 1 Analyst`, `Level 2 Analyst`, `Incident Manager`,
`Problem Manager`. Pre FE zachovávame **rovnaký katalóg** — žiadny mapping
na vlastnú taxonómiu (znížil by traceabilitu medzi UI a backendom).

| UI atribút | Typ | Backend (CA SDM) | Required |
|---|---|---|---|
| `id` | `RoleId` | `usp_role.id` | yes |
| `code` | `RoleCode` (literal union) | `usp_role.role_name` | yes |
| `displayName` | `string` | `usp_role.role_name.sym` | yes |
| `permissions` | `Permission[]` (derived) | derived (CACF Functional Access matrix) | yes |

```
RoleCode =
  | "ADMINISTRATOR"
  | "CONFIG_ADMINISTRATOR"
  | "CONFIG_ANALYST"
  | "CONFIG_VIEWER"
  | "CHANGE_MANAGER"
  | "SERVICE_DESK_ADMINISTRATOR"
  | "SERVICE_DESK_MANAGER"
  | "SYSTEM_ADMINISTRATOR"
  | "LEVEL_1_ANALYST"
  | "LEVEL_2_ANALYST"
  | "INCIDENT_MANAGER"
  | "PROBLEM_MANAGER"
```

**Vzťah `User ↔ Role ↔ Tenant`** je ternárny:

- Jeden `User` má `n` priradení `RoleAssignment{ roleId, tenantId }`.
- Pre jeden tenant môže mať user **viacero rolí** (napr. súčasne `LEVEL_2_ANALYST`
  + `CONFIG_VIEWER`).
- `availableTenants` = `distinct(roleAssignments.map(r => r.tenantId))`.
- `activeTenant` (UI runtime state) — používateľom zvolený jeden tenant zo
  zoznamu; všetky API volania nesú tento kontext.

**Permission** je čisto FE-side enum odvodený z funkčnej matice CACF (s. 2520) —
napr. `INCIDENT_MODIFY`, `CI_VIEW`, `CHANGE_APPROVE`. Mapping `RoleCode →
Permission[]` je v `model.ts` tabuľka.

## RoleAssignment (slabá entita pod `User`)

| UI atribút | Typ | Required |
|---|---|---|
| `userId` | `UserId` | yes |
| `roleId` | `RoleId` | yes |
| `tenantId` | `TenantId` | yes |
| `assignedAt` | `string` (ISO) | no |

---

> **Poznámka — `TicketBase`**: `Incident`, `Request`, `Problem` zdieľajú jednu CA SDM
> tabuľku `call_request` (`cr.*`) — sú rozlíšené atribútom `cr.type`. V FE-doméne
> ich modelujeme ako **tri samostatné agregáty** s vlastnými lifecycles, ale ich
> zdieľaná genéza je premietnutá do typu `TicketBase` v `model.ts`, z ktorého
> všetky tri dedia spoločné polia (`ref`, `summary`, `priority`, `urgency`,
> `assigneeId`, `tenantId`, ...).

## Incident

| UI atribút | Typ | Backend (CA SDM) | Required | Poznámka |
|---|---|---|---|---|
| `id` | `IncidentId` | `cr.persid` | yes | Globálny handle. |
| `ref` | `string` | `cr.ref_num` | yes | Ľudsky čitateľný (napr. `IN12345`). |
| `summary` | `string` | `cr.summary` | yes | Krátky názov. |
| `description` | `string` | `cr.description` | no | Plný popis. |
| `status` | `IncidentStatus` | `cr.status` (`crs` SREL) | yes | Lifecycle, viď `lifecycles/incident.md`. |
| `priority` | `Priority` | `cr.priority` (`pri` SREL) | yes | 1–5. |
| `urgency` | `Urgency` | `cr.urgency` (`urg` SREL) | yes | 1–5. |
| `impact` | `Impact` | `cr.impact` (`imp` SREL) | yes | 1–5. |
| `category` | `IncidentCategory` | `cr.category` (`pcat` SREL) | no | Incident Area. |
| `isMajor` | `boolean` | `cr.major_incident` | yes | Major Incident flag. |
| `affectedEndUserId` | `UserId` (Contact) | `cr.customer` | yes | Affected. |
| `requesterId` | `UserId` | `cr.requestor` | no | Kto nahlásil. |
| `assigneeId` | `UserId \| null` | `cr.assignee` | no | Pridelený analytik. |
| `assignedGroupId` | `GroupId \| null` | `cr.group` | no | Pridelená skupina. |
| `affectedCiId` | `CiId \| null` | `cr.affected_resource` | no | Affected end user resource. |
| `openedAt` | `string` (ISO) | `cr.open_date` | yes |  |
| `targetStartAt` | `string` (ISO) | `cr.target_start` | no | SLA cieľový začiatok. |
| `resolvedAt` | `string` (ISO) | `cr.resolve_date` | no | Resolution timestamp. |
| `closedAt` | `string` (ISO) | `cr.close_date` | no | Closure timestamp. |
| `callBackAt` | `string` (ISO) | `cr.call_back_date` | no | Plánovaný callback. |
| `outageStartAt` | `string` (ISO) | `cr.outage_start_time` | no |  |
| `outageEndAt` | `string` (ISO) | `cr.outage_end_time` | no |  |
| `outageType` | `string` | `cr.outage_type` | no | scheduled \| unplanned. |
| `isReturnedToService` | `boolean` | `cr.return_to_service` | no |  |
| `symptomCode` | `string` | `cr.symptom_code` | no |  |
| `rootCause` | `string` | `cr.rc` | no |  |
| `solutionUrls` | `string[]` (derived) | `soln_log` | no | Linkované KB. |
| `linkedProblemIds` | `ProblemId[]` (derived) | `cr.problem` | no |  |
| `linkedChangeIds` | `ChangeId[]` (derived) | `lrel_supports` | no |  |
| `tenantId` | `TenantId` | `cr.tenant` | yes | **Tenant scope.** |
| `createdAt` | `string` (ISO) | `cr.creation_date` | yes |  |
| `lastModifiedAt` | `string` (ISO) | `cr.last_mod_dt` | yes |  |

**Invarianty:**
- `priority = f(impact, urgency)` (CA SDM ho dopočítava, FE ho **neprepisuje** —
  bere ho ako read-only computed po každom uložení).
- `closedAt` smie byť non-null **iba ak** `status` je v terminálnom stave (`CL`,
  `CD`).
- `resolvedAt ≤ closedAt` ak obe existujú.
- `affectedEndUserId.tenantId == incident.tenantId`.
- Major Incident (`isMajor=true`) vyžaduje, aby `assignedGroupId !== null` pred
  presunom mimo `OP` (Open) stavu.

**PDF citácia** — Incident attribute mapping (s. 4017): `AssignedID`, `Urgency`,
`Impact`, `CalculatedPriority`, `Open Timestamp`, `CallbackTimestamp`,
`Resolution Timestamp`, `Closure Timestamp`, `RootCause`, `SolutionUrls`,
`IncidentCategory`, `IsMajor`, `IncidentStatus`, `OutageStartTimestamp`,
`OutageEndTimestamp`, `OutageType`, `IsReturnedToService`, `SymptomCodes`.

## Request (Service Request)

Z DB pohľadu identický kontajner ako Incident (`cr.*`), ale `cr.type = "R"`.
Sémantika je odlišná — Request je **objednávka služby z katalógu** (Service
Catalog), nie incident. PDF s. 4026 dokumentuje:

| UI atribút | Typ | Backend (CA SDM) | Required | Poznámka |
|---|---|---|---|---|
| `id` | `RequestId` | `cr.persid` | yes |  |
| `ref` | `string` | `cr.ref_num` | yes | Napr. `R12345`. |
| `summary` | `string` | `cr.summary` | yes |  |
| `description` | `string` | `cr.description` | no |  |
| `status` | `RequestStatus` | `cr.status` | yes | Viď `lifecycles/request.md`. |
| `urgency` | `Urgency` | `cr.urgency` | yes |  |
| `priority` | `Priority` | `cr.priority` | yes |  |
| `severity` | `Severity \| null` | `cr.severity` | no |  |
| `category` | `RequestCategory` | `cr.category` (Request Area) | yes |  |
| `requesterId` | `UserId` | `cr.customer` | yes | Žiadateľ. |
| `assigneeId` | `UserId \| null` | `cr.assignee` | no |  |
| `assignedGroupId` | `GroupId \| null` | `cr.group` | no |  |
| `serviceCatalogItemId` | `CatalogItemId \| null` | derived | no | Ak Request vznikol z položky katalógu. |
| `formData` | `RequestFormData` | derived (Service Catalog form values) | no | UI-only. JSON payload formulárových polí špecifických pre danú položku katalógu. |
| `openedAt` | `string` (ISO) | `cr.open_date` | yes |  |
| `targetStartAt` | `string` (ISO) | `cr.target_start` | no |  |
| `resolvedAt` | `string` (ISO) | `cr.resolve_date` | no |  |
| `closedAt` | `string` (ISO) | `cr.close_date` | no |  |
| `isReturnedToService` | `boolean` | `cr.return_to_service` | no |  |
| `tenantId` | `TenantId` | `cr.tenant` | yes |  |

**Invarianty:**
- Request created z katalógu má `serviceCatalogItemId !== null` a `formData`
  validovaný proti katalogovej schéme.
- `requesterId.tenantId == request.tenantId`.

## Problem

| UI atribút | Typ | Backend (CA SDM) | Required | Poznámka |
|---|---|---|---|---|
| `id` | `ProblemId` | `cr.persid` | yes |  |
| `ref` | `string` | `cr.ref_num` | yes | Napr. `P00045`. |
| `summary` | `string` | `cr.summary` | yes |  |
| `description` | `string` | `cr.description` | no |  |
| `status` | `ProblemStatus` | `cr.status` | yes | Viď `lifecycles/problem.md`. |
| `urgency` | `Urgency` | `cr.urgency` | yes |  |
| `priority` | `Priority` | `cr.priority` | yes |  |
| `impact` | `Impact` | `cr.impact` | yes |  |
| `category` | `ProblemCategory` | `cr.category` (Problem Area) | no |  |
| `rootCause` | `string` | `cr.rc` | no | Root Cause Enum (PDF s. 4024). |
| `assigneeId` | `UserId \| null` | `cr.assignee` | no |  |
| `assignedGroupId` | `GroupId \| null` | `cr.group` | no |  |
| `linkedIncidentIds` | `IncidentId[]` (derived) | `lrel` | yes | Aspoň 1 podľa best-practice ITIL. |
| `linkedChangeIds` | `ChangeId[]` (derived) | `lrel` | no | Cesta k vyriešeniu. |
| `linkedKbArticleIds` | `KbArticleId[]` (derived) | `soln_log` | no | Workaround / known error. |
| `openedAt` | `string` (ISO) | `cr.target_start_last` | yes |  |
| `resolvedAt` | `string` (ISO) | `cr.resolve_date` | no |  |
| `closedAt` | `string` (ISO) | `cr.close_date` | no |  |
| `tenantId` | `TenantId` | `cr.tenant` | yes |  |

**Invarianty:**
- Problem **musí** mať aspoň jeden linkovaný `Incident` aby mohol opustiť stav
  `IDENTIFIED` (best-practice; vynucuje FE, BE to neforsuje).
- Stav `KNOWN_ERROR` vyžaduje aspoň jeden `linkedKbArticleId` s typom `Workaround`.

## Change (Change Order)

| UI atribút | Typ | Backend (CA SDM) | Required | Poznámka |
|---|---|---|---|---|
| `id` | `ChangeId` | `chg.persid` | yes |  |
| `ref` | `string` | `chg.chg_ref_num` | yes | Napr. `C12345`. |
| `summary` | `string` | `chg.summary` | yes |  |
| `description` | `string` | `chg.description` | no |  |
| `status` | `ChangeStatus` | `chg.status` | yes | Viď `lifecycles/change.md`. |
| `category` | `ChangeCategory` | `chg.category` | no | standard \| normal \| emergency. |
| `risk` | `RiskLevel` | `chg.risk` | yes | low \| medium \| high. |
| `requesterId` | `UserId` | `chg.requestor` | yes |  |
| `assigneeId` | `UserId \| null` | `chg.assignee` | no |  |
| `assignedGroupId` | `GroupId \| null` | `chg.group` | no |  |
| `affectedCiIds` | `CiId[]` (derived) | `lrel_chg_ci` | no | Targets. |
| `linkedProblemIds` | `ProblemId[]` (derived) | `lrel` | no |  |
| `linkedIncidentIds` | `IncidentId[]` (derived) | `lrel` | no |  |
| `scheduledStartAt` | `string` (ISO) | `chg.schedule_start_date` | no |  |
| `scheduledEndAt` | `string` (ISO) | `chg.schedule_end_date` | no |  |
| `actualStartAt` | `string` (ISO) | `chg.actual_start_date` | no |  |
| `actualEndAt` | `string` (ISO) | `chg.actual_end_date` | no |  |
| `approvalState` | `ApprovalState` | derived (CAB workflow) | yes | UI-computed agregát stavov approval krokov. |
| `cabApprovers` | `CabApproval[]` | derived | no | Per-approver decision (slabá entita). |
| `openedAt` | `string` (ISO) | `chg.open_date` | yes |  |
| `closedAt` | `string` (ISO) | `chg.close_date` | no |  |
| `tenantId` | `TenantId` | `chg.tenant` | yes |  |

**Invarianty:**
- `scheduledStartAt < scheduledEndAt`.
- `actualStartAt` musí existovať pred prechodom do stavu `IN_PROGRESS`.
- Emergency change (`category=emergency`) **smie obísť** plný CAB approval —
  vyžaduje retrospective approval (zachytené v `lifecycles/change.md`).
- Change v stave `VERIFICATION_IN_PROGRESS` aktivuje CACF `change verification`
  (PDF s. 2511) — atribútové updaty na `affectedCiIds` sa porovnávajú voči
  `ChangeSpecification` (mimo MVP scope, viď nižšie).

### CabApproval (slabá entita pod `Change`)

| UI atribút | Typ | Required |
|---|---|---|
| `approverId` | `UserId` | yes |
| `decision` | `"PENDING" \| "APPROVED" \| "REJECTED"` | yes |
| `decidedAt` | `string` (ISO) | no |
| `comment` | `string` | no |

### ChangeSpecification (slabá entita pod `Change`, **post-MVP**)

PDF s. 2504–2509 detailne popisuje. **Mimo MVP** podľa GOAL §3 — len read.
Modelujeme len header pre UI display:

| UI atribút | Typ | Backend (CA SDM) |
|---|---|---|
| `id` | `ChangeSpecId` | `chgcs.persid` |
| `ciId` | `CiId \| null` | `chgcs.ci` (blank = applies to all CIs of Change) |
| `attributeName` | `string` | `chgcs.managed_attribute` |
| `plannedValue` | `string` | `chgcs.planned_value` |
| `verifyStatus` | `VerifyStatus` | `chgcs.verify_status` (15 stavov, PDF s. 2507–2508) |
| `originalValue` | `string` | `chgcs.original_value` |
| `lastDiscoveredValue` | `string` | `chgcs.last_discovered_value` |

`VerifyStatus` literal union (PDF s. 2507–2508) — viď `model.ts`.

## KbArticle (Knowledge Document)

PDF s. 3477 dokumentuje `skeleton` table fields. UI-doména:

| UI atribút | Typ | Backend (CA SDM) | Required | Poznámka |
|---|---|---|---|---|
| `id` | `KbArticleId` | `skeleton.id` | yes |  |
| `docTypeId` | `KbDocType` | `skeleton.DOC_TYPE_ID` | yes | FAQ \| HowTo \| KnownError \| Workaround \| Reference. |
| `title` | `string` | `skeleton.title` | yes |  |
| `summary` | `string` | `skeleton.summary` | no |  |
| `body` | `KbArticleBody` | derived (template + content blocks) | yes | Štruktúrovaný — UI-only typ. |
| `status` | `KbStatus` | `skeleton.STATUS_ID` | yes | Viď `lifecycles/kb-article.md`. |
| `priority` | `KbPriority` | `skeleton.PRIORITY_ID` | no |  |
| `authorId` | `UserId` | `skeleton.AUTHOR_ID` | yes |  |
| `ownerId` | `UserId` | `skeleton.OWNER_ID` | yes |  |
| `assigneeId` | `UserId \| null` | `skeleton.ASSIGNEE_ID` | no | Reviewer. |
| `subjectExpertId` | `UserId \| null` | `skeleton.SUBJECT_EXPERT_ID` | no |  |
| `productId` | `string \| null` | `skeleton.PRODUCT_ID` | no |  |
| `relevance` | `number` | `skeleton.RELEVANCE` | no | 0–100. |
| `hits` | `number` | `skeleton.HITS` | no | Read-only counter. |
| `acceptedHits` | `number` | `skeleton.ACCEPTED_HITS` | no |  |
| `buResult` | `number` | `skeleton.BU_RESULT` | no | FAQ rating. |
| `categoryId` | `KbCategoryId` | `o_indexes.id` (kategória) | yes |  |
| `attachments` | `Attachment[]` | derived (Web Services Knowledge Attachment Methods, PDF s. 3465–3471) | no |  |
| `createdAt` | `string` (ISO) | `skeleton.CREATION_DATE` | yes |  |
| `lastModifiedAt` | `string` (ISO) | `skeleton.MODIFY_DATE` | yes |  |
| `effectiveFrom` | `string` (ISO) | `skeleton.START_DATE` | no |  |
| `expiresAt` | `string` (ISO) | `skeleton.EXPIRATION_DATE` | no |  |
| `tenantId` | `TenantId` | `skeleton.tenant` | yes |  |

**Invarianty:**
- KB v stave `PUBLISHED` musí mať `effectiveFrom <= now`.
- `expiresAt` (ak existuje) `> effectiveFrom`.
- `expiresAt < now` ⇒ status sa **nezmení** automaticky, ale UI zobrazí badge
  `expired` a vylúči článok zo search results pre koncových používateľov
  portálu (search filter logic).

## ConfigurationItem (CI)

CMDB read-only v MVP. CA SDM má bohatú taxonómiu CI typov (PDF s. 4013–4030
dokumentuje `DatabaseInstance`, `DiskPartition`, `EnvironmentalSensor`,
`ESXHypervisor`, `File`, `GenericIPDevice`, `HyperVHypervisorManager`,
`InterfaceCard`, `Location`, `MediaDrive`, `Memory`, `NetworkServer`,
`OperatingSystem`, `Port`, `PortfolioApplication`, `Printer`, `Processor`,
`ProvisionedSoftware`, `ResourceServer`, `Router`, `RunningHardware`, `Service`,
`StoragePool`, `StorageVolume`). FE-doména modeluje **diskriminovaný union** —
spoločná hlavička + class-špecifická payload.

### CiBase (spoločná hlavička)

| UI atribút | Typ | Backend (CA SDM) | Required | Poznámka |
|---|---|---|---|---|
| `id` | `CiId` | `nr.persid` | yes |  |
| `name` | `string` | `nr.name` | yes |  |
| `class` | `CiClass` | `nr.class` (`gcl` SREL) | yes | Diskriminátor. |
| `family` | `string` | `nr.family` | no | `Hardware.Memory`, `Software.NetworkServer`, ... |
| `systemName` | `string \| null` | `nr.system_name` | no | Hostname. |
| `assetNumber` | `string \| null` | `nr.asset_num` | no | Alternate CI ID. |
| `serialNumber` | `string \| null` | `nr.serial_number` | no |  |
| `status` | `CiStatus` | `nr.status` | yes | Viď nižšie. |
| `vendor` | `string \| null` | `nr.manufacturer` | no |  |
| `model` | `string \| null` | `nr.model` | no |  |
| `dnsName` | `string \| null` | `nr.dns_name` | no |  |
| `macAddress` | `string \| null` | `nr.mac_address` | no |  |
| `ipAddress` | `string \| null` | `nr.alarm_id` | no | IP v4 alebo v6 podľa formátu. |
| `locationId` | `LocationId \| null` | `nr.location` | no |  |
| `organizationId` | `OrganizationId \| null` | `nr.organization` | no |  |
| `primaryContactId` | `UserId \| null` | `nr.primary_contact` | no |  |
| `description` | `string` | `nr.description` | no |  |
| `createdAt` | `string` (ISO) | `nr.creation_date` | yes |  |
| `lastModifiedAt` | `string` (ISO) | `nr.last_mod` | yes |  |
| `tenantId` | `TenantId` | `nr.tenant` | yes |  |

`CiClass` je literal union odvodený z PDF kapitoly DatabaseInstance reference:

```
"DatabaseInstance" | "DiskPartition" | "EnvironmentalSensor" | "ESXHypervisor"
| "File" | "GenericIPDevice" | "HyperVHypervisorManager" | "InterfaceCard"
| "Location" | "MediaDrive" | "Memory" | "NetworkServer" | "OperatingSystem"
| "Port" | "PortfolioApplication" | "Printer" | "Processor"
| "ProvisionedSoftware" | "ResourceServer" | "Router" | "RunningHardware"
| "Service" | "StoragePool" | "StorageVolume"
```

`CiStatus` enum (CMDB lifecycle) — *Active* | *Inactive* | *Retired* | *Inventory*.

### Class-špecifická payload

V `model.ts` sú **diskriminované varianty** typu `Ci = CiBase & { class, props }`
kde `props` je class-specific record. Príklady atribútov per class
(z PDF s. 4013–4030, plnú tabuľku má `model.ts`):

- `Memory`: `sizeInMB`, `memoryType`.
- `Processor`: `speedInGHz`, `processorType`, `osNumeric`.
- `OperatingSystem`: `version`, `majorVersion`, `minorVersion`, `osType`.
- `Service`: `serviceVersion`, `businessRisk`, `businessImpact`,
  `availabilityStart`, `availabilityEnd`, `serviceManager`,
  `serviceLifecycleState`.
- `DatabaseInstance`: `dbInstanceName`, `productName`, `dbServerType`,
  `processDistinguishingId`.
- ... (ďalších 19 variantov v `model.ts`).

## CIRelationship (slabá entita pod `Ci`)

CA SDM má bohatý katalóg relationship typov (CMDB Visualizer). MVP modeluje
generický:

| UI atribút | Typ | Backend (CA SDM) |
|---|---|---|
| `id` | `RelationshipId` | `lrel_asset_chgnr.id` |
| `sourceCiId` | `CiId` | `lrel_asset_chgnr.from_resource` |
| `targetCiId` | `CiId` | `lrel_asset_chgnr.to_resource` |
| `type` | `RelationshipType` | `lrel_asset_chgnr.type` |

`RelationshipType` literal union (najčastejšie hodnoty z CMDB best practices):
`"DEPENDS_ON" | "SUPPORTS" | "RUNS_ON" | "INSTALLED_ON" | "CONNECTED_TO" |
"PARENT_OF" | "USES_SERVICE" | "PROVIDES_SERVICE"`. Plný katalóg potvrdí API
analyst — flag nižšie.

---

## Contact

Generálnejší ako `User` — pokrýva aj non-login Contact-y (affected end users).
Atribúty: viď `User` vyššie + `cnt.organization`, `cnt.location`, `cnt.contact_type`
(employee | customer | vendor | group).

## Group (organizačná skupina)

CA SDM `cnt.contact_type = "group"`. Členom je `Contact`. Manažér je `Contact`.
Skupiny sa používajú ako `assignedGroupId` pre tickety.

| UI atribút | Typ | Backend (CA SDM) |
|---|---|---|
| `id` | `GroupId` | `cnt.id` (kde `contact_type=group`) |
| `name` | `string` | `cnt.combo_name` |
| `managerId` | `UserId \| null` | `cnt.target_manager` |
| `memberIds` | `UserId[]` (derived) | `View_Group_To_Contact` (PDF s. 2501) |
| `tenantId` | `TenantId` | `cnt.tenant` |

## Organization

Z PDF s. 4021 (`OrganizationEntity`):

| UI atribút | Typ | Backend (CA SDM) |
|---|---|---|
| `id` | `OrganizationId` | `org.id` |
| `name` | `string` | `org.name` (resp. `cnt.combo_name` ak je company) |
| `phone` | `string \| null` | `org.phone_number` |
| `email` | `string \| null` | `org.email_addr` |
| `parentId` | `OrganizationId \| null` | `org.parent` |
| `tenantId` | `TenantId` | `org.tenant` |

## Location

Z PDF s. 4018:

| UI atribút | Typ | Backend (CA SDM) |
|---|---|---|
| `id` | `LocationId` | `loc.id` |
| `name` | `string` | `loc.name` |
| `country` | `string \| null` | `loc.country` |
| `state` | `string \| null` | `loc.state` |
| `city` | `string \| null` | `loc.city` |
| `postalCode` | `string \| null` | `loc.zip` |
| `addressLine1` | `string \| null` | `loc.address1` |
| `addressLine2` | `string \| null` | `loc.address2` |
| `addressLine3` | `string \| null` | `loc.address3` |
| `floor` | `string \| null` | `nr.loc_floor` |
| `room` | `string \| null` | `nr.loc_room` |
| `description` | `string` | `loc.description` |
| `tenantId` | `TenantId` | `loc.tenant` |

## Attachment

Univerzálne pre tickety aj KB články (PDF s. 3465–3471):

| UI atribút | Typ | Backend (CA SDM) |
|---|---|---|
| `id` | `AttachmentId` | `attmnt.id` |
| `name` | `string` | `attmnt.attmnt_name` |
| `fileName` | `string` | `attmnt.file_name` |
| `description` | `string` | `attmnt.description` |
| `folderId` | `string` | `attmnt.folder_id` |
| `repositoryId` | `string` | `attmnt.repository` |
| `linkedTo` | `IncidentId \| ProblemId \| ChangeId \| RequestId \| KbArticleId` | derived |
| `kind` | `"FILE" \| "URL"` | derived (URL link via `attachURLLinkToTicket`) |
| `url` | `string \| null` | – (only for URL kind) |
| `uploadedById` | `UserId` | derived |
| `uploadedAt` | `string` (ISO) | derived |

## ActivityLog

Per-ticket / per-CI / per-KB feed (View_*_Act_Log z PDF s. 2501).

| UI atribút | Typ | Backend (CA SDM) |
|---|---|---|
| `id` | `ActivityLogId` | `act_log.id` |
| `parentRef` | `string` | `act_log.call_req_id` (resp. `change_id`, `issue_id`) |
| `analystId` | `UserId` | `act_log.analyst` |
| `type` | `ActivityType` | `act_log.type` (status_change \| comment \| assignment \| escalation \| ...) |
| `description` | `string` | `act_log.description` |
| `timestamp` | `string` (ISO) | `act_log.time_stamp` |
| `internalOnly` | `boolean` | `act_log.internal` |
| `tenantId` | `TenantId` | – (inherited z parent) |

---

## Tenant scope — invariant pre **všetky** business agregáty

Bez výnimky (`Incident`, `Request`, `Problem`, `Change`, `KbArticle`, `Ci`,
`Contact`, `Group`, `Organization`, `Location`, `ActivityLog`, `Attachment`):

```
∀ entity. entity.tenantId ∈ user.availableTenants ∧ entity.tenantId == ui.activeTenant
```

FE **nikdy** nezobrazí entitu s iným `tenantId` ako práve aktívnym. API
volania nesú `tenant` header (resp. query param — potvrdí API analyst).

**Tenant switch flow** (referencované UX):
1. User klikne tenant switcher → vyberie nový `tenantId` z `availableTenants`.
2. UI cache flush — všetky business entity sa **musia** prefetchnúť odznova.
3. URL aktívneho route ostane (deep link), ale data fetch beží proti novému
   tenantu; ak entita s daným ID v novom tenante neexistuje → fallback na
   queue overview.

---

## UI-only agregáty (computed views)

Identifikované miesta, kde API neposkytuje natívny endpoint a UI musí agregovať
viacero zdrojov. Detailný kontrakt v `ui-views.md`. Tu len enumerácia:

- `UiQueueItem` — tenant-aware queue položka (incident/request/problem)
  s denormalizovaným assignee menom, group, SLA badge, last activity.
- `UiTicketDetail` — kompletný view tiketu vrátane linkovaných objektov a
  activity logu.
- `UiCiNeighborhood` — N-hop graf vzťahov okolo CI (DEPENDS_ON, SUPPORTS).
- `UiKbSearchHit` — KB search výsledok s highlight snippet a relevance score.
- `UiTenantSwitcherEntry` — `{ tenantId, name, roleCount, isDefault, isActive }`.

---

## Otvorené závislosti

- `[01-api-analyst]` Schémy v `docs/agents/api-analyst/schemas/*.ts` ešte
  neexistujú (round-1 paralelný broadcast). `model.ts` zatiaľ definuje typy
  inline ako canonical. **V round-2** prepnúť na `import type { ... } from
  '@sdm/api-types'` a re-export. Predpoklad: API analyst pomenuje typy
  rovnako (`Incident`, `Request`, `Problem`, `Change`, `KbArticle`, `Ci`).
- `[01-api-analyst]` Potvrď endpoint pre **multi-tenancy**: `/caisd-rest/tenants`,
  `/caisd-rest/users/{id}/roles` (resp. ekvivalent). Schéma `Tenant` /
  `RoleAssignment` v `entities.md` je **odvodená** z CACF kapitoly, nie
  priamo z REST API doc.
- `[01-api-analyst]` `crt` (Call Request Type) discriminator — overiť, ako REST
  API rozlišuje `Incident` vs `Request` vs `Problem` v rámci `cr.*`. Predpoklad:
  per-typ endpoint (`/caisd-rest/in`, `/caisd-rest/cr`, `/caisd-rest/pr`)
  alebo query param. Mám tieto typy modelované **ako tri samostatné agregáty
  v UI** bez ohľadu na backendovú reprezentáciu.
- `[01-api-analyst]` `RelationshipType` literal union pre `CIRelationship` —
  potvrď úplný katalóg z REST API alebo `View_Change_to_Assets` /
  `View_Issue_to_Assets`.
- `[01-api-analyst]` Service Catalog endpoint a `RequestFormData` schéma —
  každá katalógová položka má vlastný formulár; potreba dynamického JSON
  schema. Modelujem ako `unknown` payload v `RequestFormData` zatiaľ.
- `[02-ux-persona-analyst]` Prosím potvrď, ktoré agregáty UI naozaj potrebuje
  ako odvodené views (`UiCiNeighborhood` hĺbka grafu, `UiKbSearchHit` snippet
  zobrazenie). Aktuálny zoznam v `ui-views.md` je odvodený z GOAL §3 + §4.
- `[04-architecture]` Tenant switch flow — predpokladám full cache flush
  (žiadny shared state medzi tenantmi). Ak Architecture zvolí BFF s
  per-tenant scoped session, model je kompatibilný; ak direct flow s tokenom
  obsahujúcim viacero tenantov, treba refinovať invariant tenantId-cookie.
- `[05-security]` `Permission` enum (FE-side) je odvodený z CACF Functional
  Access matrix (PDF s. 2520) iba pre 4 oblasti (Administration / CI /
  Incident-Problem-Request / Change Orders). KB Management a Service Catalog
  v matrix nie sú — Security agent musí navrhnúť permission policy.
- `[?]` `ChangeSpecification` plný atributový set (15 verify statuses, planned
  value patterns) je v MVP scope iba na čítanie. Potvrď s biznisom, či má
  byť aspoň list-view súčasťou MVP, alebo až v1 (GOAL §3 hovorí "Change
  Management — read + základný approval flow", nešpecifikuje špecifikácie).
