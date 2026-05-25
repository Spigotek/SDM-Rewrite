# H.4 — Portal: ticket-detail (requester view)

> **Status**: 🔜 (blokované na H.0)
> **Branch**: `chunk/H.4-portal-ticket-detail` > **Persona**: Lucia
> **Cieľ**: route `/tickets/:id` v portal — read-only ticket parent
>
> - activity timeline (public-only filtered) + comment composer (single tab
>   "Public reply"). Žiadne internal notes, žiadne resolution composer
>   (workspace-only per H.8).

## Pivot vs ROADMAP

ROADMAP portal feature `ticket-detail`. H.4 = consume F.3 aggregator
`GET /api/tickets/:type/:id` (parent + activity + attachments + linked z F.6).

## Inputs

- **`docs/agents/ux-persona-analyst/wireframes/portal/04-ticket-detail.md`**.
- **`docs/spec/incident-management.md` §detail-view**.
- **`docs/agents/qa-test-strategy/acceptance-criteria.md` §portal-incident-broken-laptop (#1)`** — comment + close interactions.
- **`apps/bff/src/aggregator/ticket-detail.ts`** — F.3 + F.6 aggregator response shape.
- **`packages/api-types/src/`** — `UiTicketDetail`, `UiActivityEntry`, `UiAttachmentMeta`.

## Outputs

```
apps/portal/src/routes/ticket-detail.tsx
apps/portal/src/features/tickets/
├── TicketDetailRoute.tsx                      # { Component, loader }
├── components/
│   ├── TicketHeader.tsx                       # status + priority badge + ref + summary
│   ├── TicketBody.tsx                         # description (Markdown)
│   ├── ActivityTimeline.tsx                   # public+system entries (filter out internal)
│   ├── AttachmentsList.tsx                    # AttachmentChip list, download link
│   └── PublicComposer.tsx                     # single-tab Composer, type=public
├── api.ts                                     # ticketDetailQuery, postComment
├── hooks.ts
└── types.ts

apps/portal/lighthouserc.json                  # /tickets/:id graduates
packages/i18n/catalogs/portal/{sk,en}.json     # +ticketDetail.* keys (~20)
tools/browser-test/scenarios/h4-portal-ticket-detail.spec.ts
```

## Done-when

- [ ] Loader: `queryClient.ensureQueryData(ticketDetailQuery(type, id))`. `:type` resolved from URL pattern (portal používa `/tickets/INC-*` / `/tickets/REQ-*` prefix-based detection, alebo dvojica routes `/incidents/:id` + `/requests/:id` — recommended: single `/tickets/:id` route s type detect z `id` prefixu, fallback BFF resolver).
- [ ] `TicketHeader`: ref + summary + StatusBadge + PriorityBadge + opened-at relative time.
- [ ] `TicketBody`: description rendered cez `<Markdown>` z `@sdm/design-system` (per G.1 + components.md MarkdownRenderer).
- [ ] `ActivityTimeline`: render `activity.items.filter(e => e.kind !== "internal")` cez `<Timeline>` (G.1). System events show icon-only. Public comments show avatar + author + body.
- [ ] `AttachmentsList`: per attachment `<AttachmentChip>`; click triggers download via `GET /caisd-rest/attmnt/{id}/file-resource` (per real-backend-contracts.md §23.6 — **scope decision**: implement BFF binary proxy or defer; if defer, AttachmentChip is read-only metadata).
- [ ] `PublicComposer`: single-tab Composer (no internal/resolution tabs) → submit `POST /api/tickets/:type/:id/comments` (verify BFF endpoint exists; if not, doplniť).
- [ ] On submit success: refetch `ticketDetailQuery` → new comment appears in timeline.
- [ ] 404 ticket → NotFoundElement; 403 → ForbiddenElement per H.0 routing guards.
- [ ] `_unsupported: true` activity/attachments/linked branches → empty state + tooltip "Táto sekcia bude dostupná čoskoro." (graceful, per F.6 design).
- [ ] LHCI `/tickets/:id` mobile: TTI ≤ 1.8 s, LCP ≤ 1.5 s, score ≥ 0.88.
- [ ] i18n + browser test (open ticket, add comment, verify visible).
- [ ] ROADMAP.

## Stratégia

1. **A**: Route + loader + api factories.
2. **B**: Read-only components (Header, Body, Timeline, Attachments).
3. **C**: PublicComposer (write) + verification + PR.

## Open questions

- **Single `/tickets/:id` vs typed routes**: simplest UX = single URL pattern, type detection from `id` prefix (`INC-`, `REQ-`, `PR-`, `CHG-`). BFF aggregator `/api/tickets/:type/:id` requires type — FE resolver picks from prefix. Edge: invalid prefix → 404 redirect.
- **Comment POST endpoint**: verify BFF má `POST /api/tickets/:type/:id/comments`. Ak nie, doplniť (small BFF addition; reuses CA SDM `act_log` POST per real-backend-contracts.md §22).
- **Attachment binary download**: per F.6 §23.6 endpoint je documented, **not implemented v F.x**. Scope decision: implement minimal BFF streaming proxy v H.4 (or earlier), or defer + show "Download not yet supported" tooltip.

## Notes pre subagenta

- Reuse `<Markdown>`, `<Timeline>`, `<CommentItem>`, `<Composer>`, `<AttachmentChip>`, `<StatusBadge>`, `<PriorityBadge>` from G.1.
- BFF aggregator F.3+F.6 should cover most needs — verify shapes match `@sdm/api-types`.
- Subagent **NESMIE** merge own PR.
