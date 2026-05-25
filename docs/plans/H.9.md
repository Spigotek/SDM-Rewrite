# H.9 — Workspace: changes list + change-detail

> **Status**: 🔜 (blokované na H.7 pattern)
> **Branch**: `chunk/H.9-workspace-changes` > **Persona**: Peter (`change_manager`)
> **Cieľ**: route `/changes` (list — similar to queue but for `chg` factory)
>
> - `/changes/:id` (change detail with tabs: Detail, Impact, Rollback,
>   Approvals, Calendar). NO calendar view yet (H.10), NO CAB approval flow
>   (H.11).

## Pivot vs ROADMAP

ROADMAP workspace feature `changes` + `change-detail`. H.9 zaviazať
read flow; H.10 doplní calendar; H.11 CAB.

## Inputs

- **`docs/agents/ux-persona-analyst/wireframes/workspace/03-change-calendar.md` §detail panel** (per wireframe sekcia).
- **`docs/spec/change-management.md`**.
- **`docs/agents/qa-test-strategy/acceptance-criteria.md` §workspace-change-cab-prep (#10)`** — read part.
- **`docs/agents/design-system/components.md` §Tabs, ImpactList**.
- **`apps/bff/src/api/endpoints/changes.ts`** — F.2 entity proxy.

## Outputs

```
apps/workspace/src/routes/{changes,changes-detail}.tsx
apps/workspace/src/features/changes/
├── ChangesRoute.tsx                            # list (DataTable similar to QueueRoute pattern)
├── ChangeDetailRoute.tsx
├── components/
│   ├── ChangesTable.tsx                        # status, ref, risk, scheduled, approver state
│   ├── ChangeHeader.tsx
│   ├── ChangeTabs.tsx                          # Detail / Impact / Rollback / Approvals
│   ├── DetailTab.tsx                           # change_category, scheduled dates, rollback plan
│   ├── ImpactTab.tsx                           # affected CIs (uses ImpactList G.1)
│   ├── RollbackTab.tsx                         # rollback plan markdown render
│   └── ApprovalsTab.tsx                        # ApprovalChecklist read-only (CAB flow v H.11)
├── api.ts
└── hooks.ts

apps/workspace/lighthouserc.json                # /changes + /changes/:id graduate
packages/i18n/catalogs/workspace/{sk,en}.json   # +changes.* (~25)
tools/browser-test/scenarios/h9-workspace-changes.spec.ts
```

## Done-when

- [ ] `/changes` list: similar to `/queue` but for `chg` factory; columns: ID, Risk tier, Status, Schedule, Type, Approver state.
- [ ] `/changes/:id` detail: header + 4 tabs.
- [ ] DetailTab: read-only fields (per spec — change_category, requestor, scheduled_start/end, business_window).
- [ ] ImpactTab: `<ImpactList>` z G.1 — affected CIs + business services. Click CI → `/cmdb/ci/:id`.
- [ ] RollbackTab: markdown render of `rollback_plan` field. Empty state if missing.
- [ ] ApprovalsTab: read-only `<ApprovalChecklist>` — H.11 doplní action (send reminder, approve, reject).
- [ ] Browser test: load changes list, open detail, verify all 4 tabs render.
- [ ] LHCI graduates.

## Stratégia

1. **A**: ChangesTable list route.
2. **B**: ChangeDetail route + 4 tabs (read-only).
3. **C**: Test + PR. H.10 + H.11 dorobí calendar + CAB respectively.

## Open questions

- **`chg` aggregator endpoint**: F.3 ticket-detail covers chg per F.6 §15 schema divergence. Verify.
- **Approvers list source**: BFF endpoint? `/api/changes/:id/approvals` — verify; if missing, doplniť.

## Notes pre subagenta

- Reuse G.1 `<Tabs>`, `<DataTable>`, `<Card>`, `<Markdown>`, `<ImpactList>`, `<ApprovalChecklist>`.
- F.2 changes.ts handles schema divergence.
- Subagent **NESMIE** merge own PR.
