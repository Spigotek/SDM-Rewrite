# H.6 — Portal: KB search + article read

> **Status**: 🔜 (blokované na H.0)
> **Branch**: `chunk/H.6-portal-kb` > **Persona**: Lucia
> **Cieľ**: route `/kb` (search list) + `/kb/article/:id` (article read mode)
> — read-side iba (KB editor je v1+, NIE MVP).

## Pivot vs ROADMAP

ROADMAP portal feature `kb-search, kb-article`. H.6 implementuje read flow.

## Inputs

- **`docs/agents/ux-persona-analyst/wireframes/portal/05-kb-search.md`**.
- **`docs/spec/knowledge-management.md` §portal read flow**.
- **`docs/agents/qa-test-strategy/acceptance-criteria.md` §portal-kb-self-help (#3)`**.
- **`docs/agents/design-system/components.md` §MarkdownRenderer (Markdown), HelpfulnessVote, KbArticleHeader**.
- **`apps/bff/src/api/endpoints/kb.ts`** — KB search + article shape.

## Outputs

```
apps/portal/src/routes/{kb,kb-article}.tsx
apps/portal/src/features/kb/
├── KbRoute.tsx                                # search list
├── KbArticleRoute.tsx                         # article detail
├── components/
│   ├── SearchInput.tsx                        # use design-system SearchInput
│   ├── SearchResultItem.tsx                   # ListRow detailed variant
│   ├── ArticleHeader.tsx                      # title + meta
│   ├── ArticleBody.tsx                        # Markdown render
│   ├── HelpfulnessVote.tsx                    # 👍/👎 + comment
│   └── RelatedArticles.tsx                    # bottom of article
├── api.ts                                     # searchQuery, articleQuery, postHelpfulness
└── hooks.ts

apps/portal/lighthouserc.json                  # /kb + /kb/article/:id graduates
packages/i18n/catalogs/portal/{sk,en}.json     # +kb.* (~15)
tools/browser-test/scenarios/h6-portal-kb.spec.ts
```

## Done-when

- [ ] `/kb` renders `<SearchInput>` (debounce 300 ms per `components.md` SearchInput) + results list.
- [ ] Empty: "Nič som nenašiel. Skús inú formuláciu, alebo [otvor ticket s týmto popisom →]" (per `microcopy.md §4`).
- [ ] Each result clicks to `/kb/article/:id`.
- [ ] `/kb/article/:id` renders header + body (Markdown via G.1 `<Markdown variant="article">`) + helpfulness vote + related articles.
- [ ] Helpfulness vote submit → `POST /api/kb/articles/:id/helpfulness { vote, comment? }`.
- [ ] Related articles: server-side `kb.related[]` field, 3-5 items.
- [ ] LHCI `/kb/article/:id` mobile TTI ≤ 1.6 s, LCP ≤ 1.3 s, score ≥ 0.92.
- [ ] Browser test: search → click result → vote → verify recorded.

## Stratégia

1. **A**: Search route + api.
2. **B**: Article route + components + Markdown render.
3. **C**: Helpfulness + related + test + PR.

## Open questions

- **Markdown sanitization**: G.1 `<Markdown>` uses react-markdown + rehype-sanitize allowlist per `owasp-mitigations.md`. KB articles from BFF — trust level: medium (auth'd KB editors authored). Sanitize anyway.
- **Search context**: BFF query string conventions (full-text via CA SDM `SKELETONS` per `endpoints.md §kb`). Verify.
- **Multi-language KB articles**: per `knowledge-management.md`, articles tagged language (sk/en). Filter by user locale; show "EN only" badge if no SK version.

## Notes pre subagenta

- Reuse `<SearchInput>`, `<Markdown>`, `<ListRow>`, `<Card>` z G.1.
- KB editor je v1+ — NIE TipTap v H.6 (only read).
- Subagent **NESMIE** merge own PR.
