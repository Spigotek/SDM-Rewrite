# Wireframe — Workspace · CMDB CI detail (atribúty + vzťahy + impact)

**Persona:** `cmdb_owner_robert`, sekundárne `agent_l2_marek`
**App:** `workspace`
**URL:** `/cmdb/ci/:id`
**Priorita:** P1 (read v MVP, write/visualizer v1)

## Účel

CI detail s **úplným prehľadom**: atribúty (až 80+), vzťahy (graph), open
incidents/problems/changes, history. Cross-tenant CI zreteľne odlíšené.

## Low-fi wireframe

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ [LOGO] Acme HQ ▾  ❘ CMDB                                  [⌘K] [🔔] [👤Robert]          │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  ← CMDB search                                                                         │
│                                                                                        │
│   srv-prod-db-01                                            ● Active   🟢 Critical     │
│   Class: Server / Database     Owner: Robert (you)     Tenant: Acme HQ                 │
│   IP: 10.20.30.40              Location: DC-Praha-R3   Last patch: 12 May 2026         │
│                                                                                        │
│  ──────────────────────────────────────────────────────────────────────────────       │
│  TABS:  [Attributes][Relationships][Incidents (4)][Changes (1)][History][Audit]        │
│  ──────────────────────────────────────────────────────────────────────────────       │
│                                                                                        │
│  ATTRIBUTES (1 tab active)                                                             │
│                                                                                        │
│  ▾ KEY ATTRIBUTES                                                                      │
│  ┌────────────────────────────────────────────────────────────────────────┐           │
│  │ Hostname:           srv-prod-db-01                                      │           │
│  │ FQDN:               srv-prod-db-01.acme.local                           │           │
│  │ IP address:         10.20.30.40                                          │           │
│  │ Operating System:   Ubuntu 22.04 LTS                                    │           │
│  │ Vendor:             Dell PowerEdge R750                                 │           │
│  │ Serial number:      D8K9X2L                                              │           │
│  └────────────────────────────────────────────────────────────────────────┘           │
│                                                                                        │
│  ▾ DATABASE                                                                            │
│  ┌────────────────────────────────────────────────────────────────────────┐           │
│  │ DB engine:          PostgreSQL 15.3                                     │           │
│  │ Listening port:     5432                                                 │           │
│  │ Replica role:       Primary                                             │           │
│  │ Backup schedule:    Daily 02:00 + WAL                                   │           │
│  └────────────────────────────────────────────────────────────────────────┘           │
│                                                                                        │
│  ▶ NETWORK (collapsed)                                                                 │
│  ▶ COMPLIANCE (collapsed)                                                              │
│  ▶ CUSTOM ATTRIBUTES (32 fields, collapsed by default)                                 │
│                                                                                        │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

## Tab 2 — Relationships (graph)

```text
┌────────────────────────────────────────────────────────────────────────────────┐
│  RELATIONSHIPS                                                                  │
│  ──────────                                                                     │
│  FILTER: [All ▾]  GROUPING: [Auto-cluster ▾]  DIRECTION: [Both ▾]              │
│  [ List view ] [ Graph view ★ ] [ Tree view ]                                  │
│                                                                                 │
│  ┌──────────────────────────────────────────────────────────────────────────┐ │
│  │                                                                          │ │
│  │              ┌────────────────────┐                                      │ │
│  │              │  app-customer-portal│                                      │ │
│  │              └─────────┬──────────┘                                      │ │
│  │                        │ depends on                                       │ │
│  │                        ▼                                                  │ │
│  │              ┌────────────────────┐                                      │ │
│  │              │  srv-prod-db-01     │  ◄── you are here                   │ │
│  │              │  (this CI)          │                                      │ │
│  │              └─────────┬──────────┘                                      │ │
│  │            ┌───────────┼───────────┬─────────────┐                       │ │
│  │            │           │           │             │                       │ │
│  │            ▼           ▼           ▼             ▼                       │ │
│  │     ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐                │ │
│  │     │ stg-shr-1 │ │ net-sw-3 │ │ ups-dc-2 │ │ mon-prom │                │ │
│  │     └──────────┘ └──────────┘ └──────────┘ └──────────┘                │ │
│  │                                                                          │ │
│  │     [+ Expand to layer 2]                                                │ │
│  └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                                 │
│  Legend:                                                                        │
│   ▲ depends-on (upstream)    ▼ depends-on-me (downstream)                      │
│   ─── strong relation        ⋯ weak / inferred                                  │
│   ⬛ this tenant              ⬜ external tenant (with badge)                    │
│                                                                                 │
│  Selected node detail (right side panel)                                       │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  app-customer-portal                                                    │ │
│  │  Class: Application                                                      │ │
│  │  Status: Active                                                          │ │
│  │  Open incidents: 2                                                       │ │
│  │  Owner: business-team@acme.sk                                            │ │
│  │  → Open this CI                                                          │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────────┘
```

## Tab 3 — Incidents (linked)

```text
┌────────────────────────────────────────────────────────────────────────────────┐
│  RELATED INCIDENTS (4 open, 23 resolved last 90 days)                          │
│  ──────────                                                                     │
│  FILTER: [Open ▾]   SORT: [Priority desc ▾]                                    │
│                                                                                 │
│  #INC-2104  🔴 High   New      Outlook crash on this server                    │
│  #INC-2089  🟠 Med    Open     Slow query response                             │
│  #INC-2056  🟡 Low    Open     Backup verification failed                      │
│  #INC-2043  🟡 Low    Hold     Disk usage warning                              │
│                                                                                 │
│  ─────────────────────────────────────────────────────                         │
│  RESOLVED (last 90 days, 23)            [ Show all → ]                         │
└────────────────────────────────────────────────────────────────────────────────┘
```

## Tab 4 — Changes

```text
┌────────────────────────────────────────────────────────────────────────────────┐
│  RELATED CHANGES                                                                │
│  ──────────                                                                     │
│                                                                                 │
│  #CHG-503  🟥 Emergency  Approved   Apache Log4j patch (Sat 17 May 02:00)      │
│            Window affects this CI: 30 min downtime                             │
│                                                                                 │
│  RECENT (last 30 days)                                                          │
│  #CHG-491  🟨 Standard   Implemented  Quarterly security patch (3 May)         │
│  #CHG-485  🟩 Low        Implemented  DB minor version upgrade (28 Apr)        │
└────────────────────────────────────────────────────────────────────────────────┘
```

## Cross-tenant CI variant

Pre `cmdb_owner_robert` scenár 3 (CI vlastnené HQ, používané dcérkou):

```text
┌────────────────────────────────────────────────────────────────────────────────┐
│   stg-shared-01                              ● Active   🟢 Critical            │
│   Class: Storage Array      Owner: Robert (HQ)                                  │
│                                                                                 │
│   ┌────────────────────────────────────────────────────────────────────┐      │
│   │  🌐 SHARED OWNERSHIP                                                │      │
│   │  This CI is consumed by external tenants:                            │      │
│   │  • Acme East (3 dependent CIs — read-only details)                   │      │
│   │  • Acme West (1 dependent CI — read-only details)                    │      │
│   │                                                                      │      │
│   │  → View shared dependency map                                        │      │
│   │  → Contact tenant administrators                                     │      │
│   └────────────────────────────────────────────────────────────────────┘      │
└────────────────────────────────────────────────────────────────────────────────┘
```

## UI prvky

| Prvok | Typ | Popis |
|---|---|---|
| Sticky header | Layout | name, class, status, key meta — viditeľný pri scroll. |
| Tab bar | Tab group | Attributes, Relationships, Incidents, Changes, History, Audit. |
| Attribute groups | Collapsible sections | Predefined groupings (Key, Database, Network, Compliance, Custom). |
| Graph viewer | Canvas / SVG | Interactive, pan/zoom, click select, expand. |
| Right side panel | Inspector | Detail vybraného grafového uzla. |
| Cross-tenant badge | Visual indicator | Pre CI z external tenant — border color + ikona. |

## Interakcie

- **Section collapse / expand** — per-user persistence (Robert nechce vidieť
  Custom attributes by default, Marek áno).
- **Graph interactions** — pan, zoom (Cmd+scroll), click node = right panel,
  double-click = drill-in to that CI's detail (preserves history, back works).
- **Auto-cluster** — pri > 50 nodes UI automaticky group-uje podľa CI class
  (servers, apps, network, monitoring) a ukáže ako collapsed cluster.
- **Filter `depends on me`** — len downstream (čo na mne závisí). Klúčové
  pre impact analysis pred změnou.
- **Export to PDF** — pre Robert-ov use case (manažment review). PDF obsahuje
  graph snapshot + zoznam dependent CIs.

## Edit mode (v1, mimo MVP)

V MVP je view read-only. V1 sa pridá:

- Inline edit pri atribútoch (Robert klikne na hodnotu → input).
- Add / remove relationships.
- Audit log pre všetky zmeny.

## Edge cases

- **CI bez vzťahov** — graph ukáže iba single node + tip „Pridaj vzťah:
  pre impact analysis je to dôležité."
- **CI v cudzom tenante** (Robert klikol na link, nemá rolu) — celá obrazovka
  je read-only s aggregate informáciou (`name`, `class`, `owner team`),
  detaily sú schované, contact link na tenant admin.
- **Veľký graph (200+ nodes)** — auto-cluster + warning toast „Veľký graph,
  použi filter pre clarity".
- **Stale data** (CI history má časovú stopu „last sync 14 hodín pred tým")
  — banner „Toto CI sa naposledy synchronizovalo s discovery 14 h pred tým.
  Dáta môžu byť zastarané."

## A11y

- Tab bar: `role="tablist"`, klávesy `←/→` na prepnutie.
- Graph: keyboard navigácia (Tab cez nody, Enter na drill-in).
  Alternatívna **List view** je primárna pre screen readers.
- Cross-tenant badge: `aria-label="External tenant: Acme East"`.

## Otvorené závislosti

- `[01-api-analyst]` CI detail endpoint — vystavuje CA SDM CMDB cez
  `/caisd-rest/cmdb_ci/...`? Schema atribútov per CI class?
- `[01-api-analyst]` Relationships endpoint — graph traversal API
  (depth, direction)? Performance pri 200+ nodes?
- `[01-api-analyst]` `[GAP-5]` Cross-tenant CI ownership — opätovne:
  podporuje CA SDM shared ownership?
- `[03-domain-modeller]` CI class hierarchy a atribúty — predefined
  groups (Key, Database, Network, ...) musia byť stable.
- `[06-tech-stack-selector]` Graph viz knižnica — Cytoscape, vis.js,
  React Flow, D3? Záleží od Tech Stack rozhodnutia.
- `[07-design-system]` Color tokens pre CI status (active / inactive /
  retired) a kritickosť (critical / high / medium / low).
