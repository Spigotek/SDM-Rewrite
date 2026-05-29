# H.12 — Workspace: problems list + problem-detail + link-to-incident

> **Status**: ✅ DONE (2026-05-29)
> **Branch**: `chunk/H.12-workspace-problems` (merged, deleted)
> **PR**: #36 — merged squash via `--admin --delete-branch` > **Bundle outcome**: workspace 175.97 KB / 350 KB (+0.08 KB vs H.10); ProblemsRoute lazy 2.18 KB + ProblemDetailRoute lazy 3.01 KB.
> **Deviations**: BFF linked-incidents integration deferred to Phase I.x (CA SDM WC-query + cr.rootcause_id manipulation outside F.2 entity proxy ~200+ LOC). FE + MSW ship end-to-end flow; empty state surfaces "feature dostupný po B-E customization" hint. Audit emit `data.problem.write` to be wired with BFF endpoint Phase I.x.
> **Persona**: Marek (`agent_l2`)
> **Cieľ**: route `/problems` (list) + `/problems/:id` (detail with linked
> incidents) + action "Link incident to this problem" (per RCA workflow).

## Pivot vs ROADMAP

ROADMAP workspace feature `problems list, problem-detail, link-to-incident`.
H.12 zaviazať read flow + link mutation.

## Inputs

- **`docs/spec/problem-management.md`** — autoritatívny.
- **`docs/agents/qa-test-strategy/acceptance-criteria.md` §workspace-problem-rca (#7), workspace-incident-deep-dive (#9)`**.
- **`apps/bff/src/api/endpoints/problems.ts`** — F.2 entity proxy.
- **`apps/bff/src/aggregator/ticket-detail.ts`** — F.6 covers `pr` factory (linked: `_unsupported: true` per §24 verdict).
- **`docs/agents/ux-persona-analyst/wireframes/`** — žiadny dedicated workspace problem wireframe (uses generic ticket-detail pattern).

## Outputs

```
apps/workspace/src/routes/{problems,problem-detail}.tsx
apps/workspace/src/features/problems/
├── ProblemsRoute.tsx                           # list (DataTable + filter bar)
├── ProblemDetailRoute.tsx                      # full detail with linked incidents section
├── components/
│   ├── ProblemsTable.tsx
│   ├── ProblemHeader.tsx
│   ├── ProblemBody.tsx                         # description + root cause analysis fields
│   ├── LinkedIncidentsList.tsx                 # `<ListRow>` of linked incidents
│   ├── LinkIncidentModal.tsx                   # search + multi-select to link
│   └── ActivityTimeline.tsx                    # reuse pattern from H.8
├── api.ts                                      # problemsQuery, problemDetailQuery, postLink, postUnlink
└── hooks.ts

apps/workspace/lighthouserc.json                # /problems + /problems/:id graduates
packages/i18n/catalogs/workspace/{sk,en}.json   # +problems.* (~15)
tools/browser-test/scenarios/h12-workspace-problems.spec.ts
```

## Done-when

- [ ] `/problems` list: status, ref, summary, root cause (truncated), assigned, open date.
- [ ] `/problems/:id` detail: full ProblemBody + LinkedIncidentsList + ActivityTimeline.
- [ ] `LinkedIncidentsList`: per `_unsupported: true` v F.6 §24, **MVP**: show empty state with hint "Link tickets feature dostupný po B-E customization." Future: when BFF wires linked-via-WC-query (Phase I or v1+), this list populates.
- [ ] `Link incident` action button → opens `<LinkIncidentModal>`: search incidents (Combobox async load), multi-select, submit → `POST /api/problems/:id/linked-incidents { incidentIds }`. **Note**: BFF endpoint to be added; per F.6 §24 linked tickets verdict, this is a custom mutation rather than BREL nav.
- [ ] On link success: refetch linked list → UI updates.
- [ ] Convert incident → problem flow: from incident detail (H.8) action bar "Convert to problem" — open modal → `POST /api/problems { from_incident_id }`. **Scope**: include or defer? **Recommend**: include in H.12 (closes #9 acceptance journey).
- [ ] Browser test: search problem → open detail → link incident → verify list updates.
- [ ] LHCI graduate.
- [ ] i18n + audit emit per F.4.

## Stratégia

1. **A**: List + detail routes (read-only).
2. **B**: LinkedIncidents UI + Link modal.
3. **C**: Convert-from-incident flow + tests + PR.

## Open questions

- **Linked incidents BFF endpoint**: per F.6 §24, no BREL works on this CA SDM instance. H.12 needs custom BFF mutation that updates `cr.rootcause_id` SREL or similar. **Scope addition**: small BFF additions (`POST /api/problems/:id/linked-incidents`, `GET /api/problems/:id/linked-incidents`). Use WC query in BFF to derive linked.
- **Convert-from-incident**: BFF endpoint `POST /api/problems { from_incident_id }` creates problem + sets backlink. Verify CA SDM supports; if not, manual two-step (create problem + update incident).

## Notes pre subagenta

- Reuse G.1 `<DataTable>`, `<Combobox>`, `<Modal>`.
- BFF additions are non-trivial; scope time accordingly. If WC-query approach v F.x rejected, defer linked-incidents to feature follow-up.
- Subagent **NESMIE** merge own PR.
