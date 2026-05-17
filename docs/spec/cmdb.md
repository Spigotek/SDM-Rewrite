# CMDB — špecifikácia

> Konsolidovaný spec pre Configuration Management Database. MVP scope:
> **read-only** — CI detail, relationships graph, impact analysis. Write
> operácie sú v1+.

## TOC

1. Cieľ a scope
2. Persony
3. Kľúčové user journeys
4. Doménový model (entita, relationships)
5. REST API
6. UI — obrazovky a komponenty
7. Bezpečnosť a RBAC
8. Testy a akceptačné kritériá
9. Otvorené body
10. Zdroje
11. Otvorené závislosti

## 1. Cieľ a scope

**Cieľ MVP** (per GOAL.md §3 *"CMDB — read CI + zobrazenie vzťahov (bez
editácie)"*):

- Search + browse CI.
- CI detail s úplnými atribútmi, grupovanými do sekcií (Key, Database, Network,
  Compliance, Custom).
- Relationship graph s interaktívnym pan/zoom, filter "depends on me",
  expand/collapse.
- Impact analysis (Marek pred patchom, Robert pred decommission).
- Open incidents / changes / problems pre CI (cross-link do iných modulov).
- Cross-tenant shared CI visibility (read-only, badge "External tenant").

**Mimo MVP**:

- CI editácia (atribúty, relationships).
- CI create / delete.
- CMDB Visualizer integrácia (legacy Java applet).
- Bulk CI operations.

## 2. Persony

| Persona | App | Rola | Vzťah k modulu |
|---|---|---|---|
| `cmdb_owner_robert` | `workspace` | `cmdb_owner` | Vlastník CMDB dát. Pre-patch review, decommission impact, cross-tenant shared CI. |
| `agent_l2_marek` | `workspace` | `agent_l2` | Impact analysis pred Change implementation. Read-only. |
| `change_manager_peter` | `workspace` | `change_manager` | Vidí Change ↔ CI väzby v Change detail Impact tab. |
| `agent_l1_anna` | `workspace` | `agent_l1` | V Incident detail vidí right panel "CI: laptop žiadateľa", klik pre detail (read-only). |

## 3. Kľúčové user journeys

| ID | Persona | Krátky popis |
|---|---|---|
| `workspace-cmdb-impact-analysis` | `agent_l2_marek` | Pred-patch storage server `srv-stg-east-02` — graph 23 závislostí, filter depends-on-me, link do Change. |
| `workspace-cmdb-ci-detail` | `cmdb_owner_robert` | CI `srv-prod-db-01` review — 47 atribútov v sekciách, 23 relationships, 6 open incidents, history filter. |
| `workspace-cmdb-relationship-impact` | `cmdb_owner_robert` | Decommission CI `crm-legacy` — graph, filter, PDF export, share manažmentu. |
| `workspace-cmdb-cross-tenant-shared` | `cmdb_owner_robert` | HQ-vlastnený storage konzumovaný Acme East apps (3) — read-only cross-tenant detail. |

Detail: [`docs/agents/ux-persona-analyst/journeys.md#cmdb_owner_robert`](../agents/ux-persona-analyst/journeys.md).

## 4. Doménový model (entita, relationships)

### 4.1 Entita `Ci` (Configuration Item)

CA SDM tabuľka `nr` (`ca_owned_resource`). Bohatá taxonómia CI typov
(`DatabaseInstance`, `Service`, `NetworkServer`, `OperatingSystem`, ...).
FE doména modeluje **diskriminovaný union**: spoločná hlavička (`CiBase`)
+ class-specific payload.

`CiBase` (úplný list v
[`docs/agents/domain-modeller/entities.md#configurationitem-ci`](../agents/domain-modeller/entities.md)):

| Atribút | Typ | Zdroj | Required |
|---|---|---|---|
| `id` | `CiId` | `nr.persid` | yes |
| `name` | `string` | `nr.name` | yes |
| `class` | `CiClass` (literal union) | `nr.class` | yes (diskriminátor) |
| `family` | `string` | `nr.family` | no |
| `systemName` | `string \| null` (hostname) | `nr.system_name` | no |
| `serialNumber` | `string \| null` | `nr.serial_number` | no |
| `status` | `CiStatus` (Active / Inactive / Retired / Inventory) | `nr.status` | yes |
| `vendor`, `model`, `dnsName`, `macAddress`, `ipAddress` | `string \| null` | `nr.*` | no |
| `locationId`, `organizationId`, `primaryContactId` | refs | `nr.*` | no |
| `description` | `string` | `nr.description` | no |
| `tenantId` | `TenantId` | `nr.tenant` | yes |

**`CiClass`** literal union:

```
"DatabaseInstance" | "DiskPartition" | "EnvironmentalSensor" | "ESXHypervisor"
| "File" | "GenericIPDevice" | "HyperVHypervisorManager" | "InterfaceCard"
| "Location" | "MediaDrive" | "Memory" | "NetworkServer" | "OperatingSystem"
| "Port" | "PortfolioApplication" | "Printer" | "Processor"
| "ProvisionedSoftware" | "ResourceServer" | "Router" | "RunningHardware"
| "Service" | "StoragePool" | "StorageVolume"
```

Class-specific payload v `model.ts` (napr. `Memory.sizeInMB`,
`Processor.speedInGHz`, `OperatingSystem.version`, `Service.businessImpact`,
`DatabaseInstance.dbInstanceName`).

### 4.2 Entita `CIRelationship`

| Atribút | Typ | Zdroj |
|---|---|---|
| `id` | `RelationshipId` | `lrel_asset_chgnr.id` |
| `sourceCiId` | `CiId` | `lrel_asset_chgnr.from_resource` |
| `targetCiId` | `CiId` | `lrel_asset_chgnr.to_resource` |
| `type` | `RelationshipType` | `lrel_asset_chgnr.type` |

`RelationshipType`:
`"DEPENDS_ON" | "SUPPORTS" | "RUNS_ON" | "INSTALLED_ON" | "CONNECTED_TO" | "PARENT_OF" | "USES_SERVICE" | "PROVIDES_SERVICE"`.

Plný katalóg potvrdí 01 (`[01-api-analyst]` flag v entities.md).

### 4.3 UI agregát `UiCiNeighborhood`

N-hop graf vzťahov okolo CI. UI-only computed view; default depth = 2.

## 5. REST API

| Metóda | Cesta | Účel |
|---|---|---|
| `GET` | `/caisd-rest/nr` | List CI (WC filter, class filter). |
| `GET` | `/caisd-rest/nr/{id}` | CI detail. |
| `GET` | `/caisd-rest/nr/{id}/all_open_creq` | Všetky open requests pre CI (QREL). |
| `GET` | `/caisd-rest/nr/{id}/asset_log` | Log zmien CI (BREL → `nr_com`). |
| `GET` | `/caisd-rest/nr/{id}/child_hier` | CI children v hierarchii. |
| `GET` | `/caisd-rest/nr/{id}/parent_hier` | CI parents v hierarchii. |
| `GET` | `/caisd-rest/nrf` | Resource families (lookup). |
| `GET` | `/caisd-rest/loc` | Locations (lookup). |

Write operácie (POST, PUT) sú dostupné v REST, ale v MVP **nepoužívané**.

**Cross-tenant CI**: BFF endpoint `/api/cmdb/cross-tenant/:ciId` validuje
`ci.read.cross-tenant` permission (cmdb_owner so shared marker alebo sp_admin)
predtým než vráti detail.

Detail: [`docs/agents/api-analyst/endpoints.md#cmdb-nr--named-resources--cis`](../agents/api-analyst/endpoints.md).

## 6. UI — obrazovky a komponenty

### 6.1 Obrazovky

| # | Screen | Route | App |
|---|---|---|---|
| 21 | CMDB CI list | `/cmdb` | workspace |
| 22 | CI detail | `/cmdb/:id` | workspace |
| 23 | CI impact graph | `/cmdb/:id/impact` | workspace |

### 6.2 Komponenty

| Komponent | Použitie |
|---|---|
| `DataTable` | CMDB CI list (search + filter by class / status). |
| `Tabs` (`default`) | CI detail: Attributes / Relationships / Open Tickets / Change History / Activity. |
| `CIAttributeGroup` | Collapsible groups per kategória (Key / Database / Network / Compliance / Custom). Per-user persistence v localStorage. |
| `CMDBGraph` (alias `RelationshipGraph`) | Cytoscape 3 canvas mode + `react-cytoscapejs`. Lazy-loaded ~110 kB. Defaults: `cose-bilkent` layout, `directionFilter=both`, `maxNodes=200`. |
| `Badge variant=warning` "External tenant" | Cross-tenant shared CI v graph + relationship list. |
| `Modal` + `Drawer` | CI detail pop-out na hover/click v graph. |
| `EmptyState` | "Žiadne relationships" pri izolovanom CI. |

`CMDBGraph` **povinný alternatívny list view** pre screen readers (Cytoscape
canvas je SR-unfriendly). Keyboard navigation: `Tab` cycle nodes
(breadth-first od center), `Enter` drill-in, arrow keys pan canvas.
Pri `maxNodes` > 200: prompt "Zobraziť viac" (auto-cluster po typoch CI).

Detail: [`docs/agents/design-system/components.md`](../agents/design-system/components.md) — `CMDBGraph`, `CIAttributeGroup`.

### 6.3 Cross-tenant visibility UX

- Cross-tenant CI v graph: `Badge variant=warning` "External tenant" + distinct
  border color.
- Cross-tenant relationship list: `ListRow` s tenant column.
- Cross-tenant detail: read-only (Robert nemá write rolu v Acme East). UI
  zobrazí "Owner contact: <name>" CTA "Send email".
- Ak `cmdb_owner` nemá vôbec rolu v cudzom tenante (no `shared` marker):
  UI ukáže **agregát** ("3 CIs consumed by Acme East") **bez detailu**.

## 7. Bezpečnosť a RBAC

| Akcia | Permission key | agent_l1 | agent_l2 | change_mgr | cmdb_owner | sp_admin |
|---|---|---|---|---|---|---|
| Read CI | `ci.read` | read-only | read-only | read-only | yes | yes |
| Read relationships | `ci.read.relationships` | read-only | read-only | read-only | yes | yes |
| Search | `ci.search` | yes | yes | yes | yes | yes |
| Impact analysis | `ci.impact` | read-only | yes | yes | yes | yes |
| Create CI (post-MVP) | `ci.create` | – | – | – | yes | yes |
| Edit CI attrs (post-MVP) | `ci.update` | – | – | – | yes | yes |
| Cross-tenant CI view | `ci.read.cross-tenant` | – | – | – | own shared | yes |

Detail: [`docs/agents/security/rbac.md`](../agents/security/rbac.md) §6.6.

### 7.1 Cross-tenant boundary

- `cmdb_owner` so `shared` marker (CI je explicitne shared cross-tenant)
  smie read-only view CI v cudzom tenante.
- `sp_admin` vidí všetky managed tenanty (cross-tenant view toggle).
- Žiadny user mimo `sp_admin` nesmie **cross-tenant aggregate read** detail —
  iba count agregát.
- Každý cross-tenant access generuje audit event s `cross_tenant=true`.

### 7.2 Data leakage scenáre (z 05 STRIDE)

| # | Scenár | Mitigácia |
|---|---|---|
| L9 | CMDB CI relationship cross-tenant — graf v T1 ukáže shared CI z T2 bez explicit permission | BFF filter: ak nie SP a nie shared marker, hide. UI zobrazí cross-tenant CI s distinct badge. |
| L13 | URL bookmark/share — user v T2 share-ne CI URL kolegovi v T1 | Server: CI endpoint vracia `tenantId`, UI navádza switch ak je iný ako active. |

Detail: [`docs/agents/security/multi-tenancy-security.md`](../agents/security/multi-tenancy-security.md) §4.

## 8. Testy a akceptačné kritériá

### 8.1 Pyramída

- **Unit** — `Ci` discriminated union type guards, `UiCiNeighborhood`
  computation.
- **Contract** — `cmdb.ctest.ts` (REST `/nr` + sub-resources).
- **App integration** — `apps/workspace/src/features/cmdb/__tests__/detail.itest.tsx`,
  graph render perf test (200+ nodes auto-cluster).
- **E2E** — `workspace-cmdb-impact-analysis` (#8), `workspace-cmdb-ci-detail` (#16),
  `workspace-cmdb-relationship-impact` (#17), `workspace-cmdb-cross-tenant-shared` (#18, **smoke**).
- **a11y** — `CMDBGraph` alternative list view povinný; SR oznámi node count.

### 8.2 Acceptance criteria — `workspace-cmdb-cross-tenant-shared` (#18)

Happy path:

- Robert otvor CI `stg-shared-01` (HQ owned).
- CI detail ukáže relationship "consumed by Acme East apps (3)".
- Klik na cross-tenant relationship → list 3 CI z Acme East s badge "External tenant".
- Klik na app → read-only view, owner contact visible.

Alternate:

- Robert nemá rolu v Acme East → UI ukáže **agregát** "3 CIs consumed by Acme
  East" **bez detailu** + contact na tenant administrátora.
- "Shared ownership" CI → badge "Shared ownership: HQ + Acme East" + disabled
  edit s tooltipom "Vyžaduje súhlas oboch ownerov".

Tags: `@security:cross-tenant-attachment @security:cross-tenant-cmdb`.

Detail: [`docs/agents/qa-test-strategy/acceptance-criteria.md`](../agents/qa-test-strategy/acceptance-criteria.md) #18.

## 9. Otvorené body

- `[01-api-analyst GAP-5]` Shared CI ownership cross-tenant — podporuje CA SDM
  ownership pre 2+ tenantov per CI? Aktuálne MVP: predpoklad **read-only
  visibility na shared CI**, write je `sp_admin` only.
- `[01-api-analyst]` `RelationshipType` literal union — potvrdiť úplný katalóg
  z REST API alebo `View_Change_to_Assets` / `View_Issue_to_Assets`.
- `[01-api-analyst]` `pgroup_type` access control pre CI (1=group, 2=role) —
  FE musí ošetriť `401` pri prístupe nepovolených CI. Treba zaviesť do BFF
  error shape.

## 10. Zdroje

- [`docs/agents/api-analyst/endpoints.md#cmdb-nr--named-resources--cis`](../agents/api-analyst/endpoints.md).
- [`docs/agents/api-analyst/gaps.md`](../agents/api-analyst/gaps.md) §15, §20.
- [`docs/agents/ux-persona-analyst/personas.md#cmdb_owner_robert`](../agents/ux-persona-analyst/personas.md).
- [`docs/agents/ux-persona-analyst/journeys.md`](../agents/ux-persona-analyst/journeys.md) — CMDB journeys.
- [`docs/agents/domain-modeller/entities.md#configurationitem-ci`](../agents/domain-modeller/entities.md).
- [`docs/agents/security/rbac.md`](../agents/security/rbac.md) §6.6.
- [`docs/agents/security/multi-tenancy-security.md`](../agents/security/multi-tenancy-security.md) §4.
- [`docs/agents/design-system/components.md#cmdbgraph`](../agents/design-system/components.md).
- [`docs/agents/tech-stack-selector/libraries.md`](../agents/tech-stack-selector/libraries.md) — Cytoscape 3.
- [`docs/agents/qa-test-strategy/acceptance-criteria.md`](../agents/qa-test-strategy/acceptance-criteria.md) #8, #16, #17, #18.

## Otvorené závislosti

Žiadne. Artefakt je samonosný.
