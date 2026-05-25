# H.8 — Workspace: ticket-detail (agent split-view)

> **Status**: 🔜 (blokované na H.7 — uses split-view URL pattern)
> **Branch**: `chunk/H.8-workspace-ticket-detail` > **Persona**: Anna, Marek
> **Cieľ**: route `/tickets/:id` (alebo split-view v `/queue?selected=:id`)
> — full agent view: ticket header + composer (3 tabs: Public reply, Internal
> note, Resolution) + activity timeline (all kinds visible) + right Context
> Panel (requester card, CI card, related records). Action bar (Take, Resolve,
> Escalate, Watch, More).

## Pivot vs ROADMAP

ROADMAP workspace feature `ticket-detail (agent)`. F.3 aggregator
`/api/tickets/:type/:id` + F.6 activity/attachments už hotové.
H.8 = full FE consumption + composer write.

## Inputs

- **`docs/agents/ux-persona-analyst/wireframes/workspace/02-ticket-detail.md`** — autoritatívny.
- **`docs/spec/incident-management.md` §detail-agent**.
- **`docs/agents/qa-test-strategy/acceptance-criteria.md` §workspace-incident-triage (#4), workspace-incident-resolve-with-cmdb (#5), workspace-incident-escalate-to-l2 (#6)`**.
- **`docs/agents/design-system/components.md` §Composer, Timeline, ActionBar, ContextPanel**.
- **`apps/bff/src/aggregator/ticket-detail.ts`** — F.3 + F.6.

## Outputs

```
apps/workspace/src/routes/ticket-detail.tsx
apps/workspace/src/features/tickets/
├── TicketDetailRoute.tsx
├── components/
│   ├── AgentTicketHeader.tsx                   # status (inline edit), priority (Combobox), ref, summary
│   ├── ActionBar.tsx                           # Take, Resolve, Escalate, Watch, More
│   ├── ActivityTimeline.tsx                    # ALL kinds (filter tabs: All / Public / Internal / System)
│   ├── Composer.tsx                            # 3-tab (Public/Internal/Resolution) + TipTap rich text (Phase H minimal — plain textarea acceptable, TipTap deferred)
│   ├── ContextPanel.tsx                        # right rail: Requester, CI, Related
│   └── EscalateModal.tsx                       # confirm + comment input
├── api.ts                                      # ticketDetailQuery, postComment, postTransition (resolve/escalate/take/watch)
├── hooks.ts
└── types.ts

apps/workspace/lighthouserc.json                # /tickets/:id graduates
packages/i18n/catalogs/workspace/{sk,en}.json   # +ticketDetail.* (~30)
tools/browser-test/scenarios/h8-workspace-ticket-detail.spec.ts
```

## Done-when

- [ ] Header inline edit: status Combobox (transitions per spec lifecycle), priority Combobox. Both: optimistic UI + audit emit on success (BFF F.4).
- [ ] ActionBar: Take, Resolve, Escalate, Watch, More dropdown (mark as KB candidate, copy link).
- [ ] Composer 3 tabs: Public reply (visible to customer), Internal note (agent-only, kind=internal), Resolution (closes ticket + Solution field). TipTap rich-text deferred — plain textarea + markdown shorthand acceptable v H.8.
- [ ] Timeline filter tabs (All / Public / Internal / System) — client-side filter cez `activity.items`.
- [ ] ContextPanel:
  - Requester card: name + email + tenant + recent tickets (top 3).
  - CI card: from ticket's `affected_resource`; click → `/cmdb/ci/:id` (H.13).
  - Related records: linked problems / changes (per F.6 `linked` block; if `_unsupported: true` → empty state).
- [ ] Cmd+Enter submits Composer.
- [ ] Browser test: open ticket → take → reply → escalate → verify timeline updates.
- [ ] LHCI `/tickets/:id` desktop TTI ≤ 2.0 s, LCP ≤ 1.7 s, score ≥ 0.85.

## Stratégia

1. **A**: Route + read-only render (header, timeline, context panel).
2. **B**: Composer (3 tabs) + ActionBar (transitions).
3. **C**: Modals (Escalate, Resolve), browser test, LHCI graduate, PR.

## Open questions

- **TipTap deferred**: full TipTap rich-text editor in Composer is heavy (~70 KB lazy chunk). MVP can ship plain Textarea + markdown shorthand auto-render. Phase H v1+ wires TipTap.
- **Transitions per spec lifecycle**: validate status transitions client-side cez `@sdm/domain` state machine, OR rely on BFF 422 rejection. **Recommend**: client-side validate (UX feedback) + BFF authoritative.
- **Resolve flow**: needs Solution input + Category dropdown. Modal opens on Resolve click. Use ConfirmDialog from G.1.

## Notes pre subagenta

- Most plumbing exists from F.3 + F.6 + G.1. H.8 is mostly composition.
- Activity timeline filter tabs operate on already-loaded `activity.items` — no extra BFF call.
- Subagent **NESMIE** merge own PR.
