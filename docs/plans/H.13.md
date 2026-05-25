# H.13 — Workspace: CMDB CI list + CI detail (no graph)

> **Status**: 🔜 (blokované na H.7 — uses table pattern)
> **Branch**: `chunk/H.13-workspace-cmdb` > **Persona**: Robert (`cmdb_owner`)
> **Cieľ**: route `/cmdb` (CI list — search + filter + table) + `/cmdb/ci/:id`
> (CI detail — collapsible attribute groups, tabs: Detail / Attributes /
> Relationships / History). Relationships tab placeholder; real graph v H.14.

## Pivot vs ROADMAP

ROADMAP workspace feature `cmdb (read), ci-detail`. H.13 read-only CMDB
view (write mode is v1+). H.14 doplní graph view.

## Inputs

- **`docs/agents/ux-persona-analyst/wireframes/workspace/05-cmdb-ci-detail.md`** — autoritatívny.
- **`docs/spec/cmdb.md`**.
- **`docs/agents/qa-test-strategy/acceptance-criteria.md` §workspace-cmdb-ci-detail (#16)`**.
- **`docs/agents/design-system/components.md` §CIAttributeGroup, Tabs, DataTable**.
- **`apps/bff/src/api/endpoints/cmdb.ts`** — F.2 entity proxy.

## Outputs

```
apps/workspace/src/routes/{cmdb,cmdb-ci}.tsx
apps/workspace/src/features/cmdb/
├── CmdbRoute.tsx                               # list (search + DataTable)
├── CmdbCiRoute.tsx                             # detail with tabs
├── components/
│   ├── CmdbTable.tsx
│   ├── CiHeader.tsx                            # CI name + class + status
│   ├── CiTabs.tsx                              # Detail/Attributes/Relationships/History
│   ├── AttributeGroups.tsx                     # CIAttributeGroup repeater (Key/DB/Network/Compliance/Custom)
│   ├── RelationshipsPlaceholder.tsx            # H.14 will replace with graph
│   └── HistoryTab.tsx                          # change log of CI mutations
├── api.ts
└── hooks.ts

apps/workspace/lighthouserc.json                # /cmdb + /cmdb/ci/:id graduates
packages/i18n/catalogs/workspace/{sk,en}.json   # +cmdb.* (~20)
tools/browser-test/scenarios/h13-workspace-cmdb.spec.ts
```

## Done-when

- [ ] `/cmdb` list: search box + DataTable (CI ID, name, class, status, owner, last sync).
- [ ] `/cmdb/ci/:id`: header + 4 tabs (Detail, Attributes, Relationships, History).
- [ ] AttributeGroups (Detail tab): per class definition, collapsible groups (Key, Database, Network, Compliance, Custom). Per-user persistence (localStorage).
- [ ] Relationships tab: placeholder (`Tu bude graf vzťahov, sleduj v ďalšej verzii`); H.14 doplní real graph.
- [ ] History tab: per `spec/cmdb.md §audit-trail` — read-only list of CI changes.
- [ ] Browser test: search CI → open detail → switch tabs → verify attributes render.
- [ ] LHCI graduate (CI detail TTI ≤ 3.5 s per `performance.md §2` — heavy due to many attrs).

## Stratégia

1. **A**: List route + table.
2. **B**: Detail route + tabs + AttributeGroups.
3. **C**: History tab + test + PR.

## Open questions

- **CI class schema**: CMDB has many CI classes (Server, Database, Network, App). Attribute groups vary per class. MVP: cover top 3 classes per `cmdb.md §classes`; rest fallback to generic "All attributes" view.
- **Per-user collapse persistence**: `localStorage.cmdbCiCollapse:{ciClass}.{group}` — simple key-value.

## Notes pre subagenta

- Reuse `<DataTable>`, `<Tabs>`, `<CIAttributeGroup>`, `<Accordion>` from G.1.
- Relationships graph je H.14 — placeholder card.
- Subagent **NESMIE** merge own PR.
