# H.15 — Workspace: KB browse + read (read-only MVP)

> **Status**: 🔜 (blokované na H.6 — KB read flow established)
> **Branch**: `chunk/H.15-workspace-kb` > **Persona**: Jana (`kb_editor` reads articles; **write/editor je v1+**)
> **Cieľ**: route `/kb` (workspace) — browse mode (similar to portal H.6 ale
> agent-focused: viac metadata viditeľne, KB-from-incident shortcut).
> Editor (TipTap) je v1+, NIE MVP.

## Pivot vs ROADMAP

ROADMAP workspace feature `kb-browse, (kb-editor v1)`. H.15 implementuje
browse + read iba. **NO TipTap editor**.

## Inputs

- **`docs/agents/ux-persona-analyst/wireframes/workspace/04-kb-editor.md` §read mode** (editor part deferred).
- **`docs/spec/knowledge-management.md` §workspace browse**.
- **`docs/agents/qa-test-strategy/acceptance-criteria.md` §workspace-kb-from-incident (#14)`** — link KB to ticket flow.

## Outputs

```
apps/workspace/src/routes/{kb,kb-article}.tsx
apps/workspace/src/features/kb/
├── KbBrowseRoute.tsx                           # workspace agent browse (more meta, filter by category, helpfulness sort)
├── KbArticleRoute.tsx                          # workspace article view (similar to portal H.6 + agent actions)
├── components/
│   ├── KbBrowseList.tsx                        # DataTable variant
│   ├── KbFilters.tsx
│   ├── ArticleHeader.tsx                       # title + category + author + last updated
│   ├── ArticleBody.tsx                         # Markdown render (reuse from H.6 pattern)
│   ├── KbAttachIncidentAction.tsx              # "Use this KB on ticket" CTA
│   └── ArticleStats.tsx                        # view count + helpfulness ratio (read-only)
├── api.ts
└── hooks.ts

apps/workspace/lighthouserc.json                # /kb + /kb/article/:id graduate
packages/i18n/catalogs/workspace/{sk,en}.json   # +kb.* (~15)
tools/browser-test/scenarios/h15-workspace-kb.spec.ts
```

## Done-when

- [ ] `/kb` browse: DataTable with category, title, helpfulness ratio, last updated. Filter by category + language.
- [ ] `/kb/article/:id`: header + body (Markdown) + stats (read-only).
- [ ] `<KbAttachIncidentAction>`: when agent on KB article from ticket-detail context (e.g., command palette `Cmd+K` opens KB search inline), CTA "Attach to ticket #INC-X" inserts link to active ticket composer (cross-feature).
- [ ] **NO editor** — clicking "Edit" or "New article" buttons shows tooltip "KB editor je dostupný od v1.x".
- [ ] Browser test: navigate to `/kb` → filter by category → open article → verify renders.
- [ ] LHCI graduate.

## Stratégia

1. **A**: Browse + Article routes (read-only).
2. **B**: AttachIncidentAction (cross-feature, command-palette integration deferred — direct route arg).
3. **C**: Test + PR.

## Open questions

- **Editor surface**: tooltip "v1+ feature" alebo úplne skryť edit buttons. **Recommend**: skryť cez `<Can permission="kb.edit" fallback={null}>` (G.1).
- **AttachIncidentAction**: how does agent on KB article know which ticket is "active"? Recommend: `?attachToTicket=INC-X` URL param.

## Notes pre subagenta

- Read-side iba — žiadny TipTap, žiadne edit forms.
- Reuse Markdown component z G.1.
- Subagent **NESMIE** merge own PR.
