# H.14 — Workspace: CMDB relationships graph (Cytoscape lazy)

> **Status**: ✅ DONE (2026-05-29)
> **Branch**: `chunk/H.14-cmdb-graph` (merged, deleted)
> **PR**: #38 — merged squash via `--admin --delete-branch` > **Bundle outcome**: workspace initial JS 176.01 KB / 350 KB (flat vs H.13 — graph fully lazy); vendor-graph chunk 164.11 KB / 200 KB cap (raised 150 → 200 KB — Cytoscape gzipped ~160 KB sám o sebe).
> **Deviations**: dagre plugin dropped (lodash bloat → 197 KB), remapped "tree" na built-in `breadthfirst` + "breadth" na `concentric` (3 layouts preserved, zero-cost plugins). BFF nezmenené (MSW `/api/ci/:id/relationships` returns `{ relationships, neighbours }`; BREL queries deferred per H.13 precedent).
> **Persona**: Robert
> **Cieľ**: aktivovať Relationships tab v `/cmdb/ci/:id` — Cytoscape 3 lazy
> chunk (~110 KB) rendering CI relationships (depends_on / hosts / peers_with
> edges, force-directed layout). Click node → drill-in.

## Pivot vs ROADMAP

ROADMAP workspace feature `relationships`. H.14 zaviazať Cytoscape (NIE
React Flow, per `library-recommendation.md` r2 final).

## Inputs

- **`docs/agents/ux-persona-analyst/wireframes/workspace/05-cmdb-ci-detail.md` §Relationships tab**.
- **`docs/spec/cmdb.md` §relationships`**.
- **`docs/agents/qa-test-strategy/acceptance-criteria.md` §workspace-cmdb-relationship-impact (#17)`**.
- **`docs/agents/design-system/components.md` §RelationshipGraph, CMDBGraph**.

## Outputs

```
apps/workspace/src/features/cmdb/components/
├── RelationshipGraph.tsx                       # MOD: replace H.13 placeholder
├── CmdbGraph.tsx                               # CMDB-specific preset of RelationshipGraph
├── GraphLegend.tsx                             # edge style legend
└── GraphListFallback.tsx                       # a11y alternative (treeview)

apps/workspace/src/lib/cytoscape-config.ts      # Cytoscape plugin config (cose-bilkent, dagre, breadthfirst)
apps/workspace/.size-limit.json                 # +graph chunk rule (~110 KB gzip)
apps/workspace/lighthouserc.json                # /cmdb/ci/:id stays at 3.5 s TTI (already accommodates)
packages/i18n/catalogs/workspace/{sk,en}.json   # +cmdb.graph.* (~10)
tools/browser-test/scenarios/h14-cmdb-graph.spec.ts
```

## Done-when

- [ ] Cytoscape 3 + `react-cytoscapejs` lazy-loaded — only when Relationships tab clicked.
- [ ] Layout default `cose-bilkent` (force-directed). Layouts available: tree (dagre), breadth-first.
- [ ] Edge styles per relationType: `depends_on` solid, `hosts` thick, `peers_with` dashed (per `components.md CMDBGraph defaults`).
- [ ] Node click → drill-in to that CI's detail (URL change `/cmdb/ci/:newId`).
- [ ] Max 200 nodes default (per `RelationshipGraph` performance gate); prompt "Show more" above limit.
- [ ] **A11y alternative** (per `components.md`): toggle "Zobraziť ako zoznam" / "Show as list" → `GraphListFallback` renders treeview.
- [ ] Legend toggle (top-right corner).
- [ ] Browser test: open CI detail → switch to Relationships → verify graph renders → click node → URL change.
- [ ] Graph chunk size-limit: 150 KB gzip per `performance.md §3 heavy chunks`.

## Stratégia

1. **A**: Install `cytoscape@3` + `cytoscape-cose-bilkent` + `react-cytoscapejs`; lazy import structure.
2. **B**: Component + legend + list fallback.
3. **C**: Test + LHCI verify + size-limit + PR.

## Open questions

- **BFF endpoint**: `GET /api/cmdb/ci/:id/relationships` — verify F.x; doplniť if missing.
- **Cross-tenant nodes**: per `rbac.md` sp_admin sees cross-tenant; UI label per `components.md RelationshipGraph A11y`.

## Notes pre subagenta

- Cytoscape MIT — open source build.
- Lazy import critical — initial bundle nesmie obsahovať Cytoscape.
- Subagent **NESMIE** merge own PR.
