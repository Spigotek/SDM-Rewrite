# H.11 — Workspace: CAB approval flow

> **Status**: 🔜 (blokované na H.9 — uses ApprovalsTab)
> **Branch**: `chunk/H.11-cab-approval` > **Persona**: Peter
> **Cieľ**: aktivovať `ApprovalsTab` v change detail — list approvers
>
> - actions (Approve, Reject, Send reminder). Modal confirms with comment
>   field. Step-up auth: emergency approve requires re-auth (per
>   `microcopy.md §13.2 step-up`).

## Pivot vs ROADMAP

ROADMAP workspace feature `CAB approval`. H.11 rozšíri H.9 ApprovalsTab
z read-only na write actions.

## Inputs

- **`docs/agents/ux-persona-analyst/wireframes/workspace/03-change-calendar.md` §Approvals tab**.
- **`docs/spec/change-management.md` §CAB + approval workflow**.
- **`docs/agents/qa-test-strategy/acceptance-criteria.md` §workspace-change-cab-prep (#10), workspace-change-emergency-approve (#11)`**.
- **`docs/agents/security/rbac.md` §change.approve permission**.
- **`docs/agents/design-system/components.md` §ApprovalChecklist, MobileApproveSheet**.

## Outputs

```
apps/workspace/src/features/changes/components/
├── ApprovalsTab.tsx                            # MOD: action buttons
├── ApproveModal.tsx                            # NEW: confirm dialog + comment
├── RejectModal.tsx                             # NEW: required reason field
└── SendReminderModal.tsx                       # NEW

apps/workspace/src/features/changes/api.ts      # +postApprove, postReject, postReminder
apps/bff/src/api/endpoints/changes.ts           # MOD: add /api/changes/:id/{approve,reject,reminder} endpoints if missing
apps/bff/tests/changes-approval.test.ts         # NEW
packages/i18n/catalogs/workspace/{sk,en}.json   # +changes.cab.* (~15)
tools/browser-test/scenarios/h11-cab-approval.spec.ts
```

## Done-when

- [ ] `ApprovalsTab` shows action buttons per approver (Approve, Reject, Send reminder) gated by `<Can permission="change.approve">`.
- [ ] Approve action: `<ApproveModal>` opens; optional comment field; submit → `POST /api/changes/:id/approve { approverId, comment? }` → audit `authz.tenant.switch` ekvivalent for change (`data.change.write`).
- [ ] Reject action: `<RejectModal>` opens; **required** reason field (per `microcopy.md §6 Reject change`); submit → `POST /api/changes/:id/reject { approverId, reason }`.
- [ ] Send reminder: `POST /api/changes/:id/reminder { approverId }` → toast confirm.
- [ ] **Emergency approve step-up**: ak je change `risk_tier=critical` AND env=production, approve modal triggers re-auth via existing F.1 step-up flow (placeholder if F.x defers step-up; mark as `_unsupported: true` v F.x and defer to feature follow-up).
- [ ] On approve/reject success: refetch change detail query → UI updates approver state.
- [ ] Browser test: open change → click Approve → modal → submit → verify approver state changes.
- [ ] LHCI no change (uses existing /changes/:id route).
- [ ] Audit: `data.change.write` per F.4 taxonomy.

## Stratégia

1. **A**: BFF endpoints (approve/reject/reminder) — verify existing or doplniť.
2. **B**: FE modals + API integration.
3. **C**: Step-up flow + audit + browser test + PR.

## Open questions

- **BFF approve/reject endpoints**: verify F.x exposes these; if not, doplniť (small additions; reuse F.4 audit emit).
- **Step-up auth**: F.1 documented step-up but may not implement. If unavailable, ship without (degraded UX) + open issue for Phase I (security audit).
- **Approver permissions**: which roles can approve? Per `rbac.md` — `change_manager` always; `agent_l2` only for low-risk per matrix. Use `<Can>` gating.

## Notes pre subagenta

- Reuse G.1 `<ConfirmDialog>` for modals + i18n for confirm/reject/reminder copy per `microcopy.md §6`.
- Subagent **NESMIE** merge own PR.
