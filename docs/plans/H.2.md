# H.2 — Portal: home dashboard

> **Status**: 🔜 (blokované na H.1 merge)
> **Branch**: `chunk/H.2-portal-home` > **Persona**: Lucia (`requester`)
> **Cieľ**: nahradiť H.0 placeholder na route `/` Lucia greeting + "Nahlásiť
> problém" / "Požiadať o niečo" CTAs + recent my-tickets list + KB suggestions
> (top 3 articles per current tenant). Mobile-first (Lucia 30% mobile per `GOAL.md §11`).

## Pivot vs ROADMAP

ROADMAP: portal `new-incident, my-tickets, ticket-detail` + KB. H.2 implementuje
**home dashboard** ktorý linkuje na ostatné portal features (H.3-H.6).

## Inputs

- **`docs/agents/ux-persona-analyst/wireframes/portal/01-home-dashboard.md`** — autoritatívny wireframe.
- **`docs/spec/incident-management.md` §portal** — Lucia journey + happy path.
- **`docs/agents/qa-test-strategy/acceptance-criteria.md` §portal-incident-broken-laptop` (#1)** — primary acceptance journey.
- **`apps/portal/src/routes/placeholders/home.tsx`** — H.0 stub.
- **`apps/bff/src/api/endpoints/incidents.ts`** + **`requests.ts`** — `GET /api/incidents?customer=me` shape.
- **`apps/bff/src/api/endpoints/kb.ts`** — `GET /api/kb/search?q=...` shape.

## Outputs

```
apps/portal/src/routes/home.tsx                # ZMENA z placeholder na real component
apps/portal/src/features/home/
├── HomeRoute.tsx                              # { Component, loader }
├── components/
│   ├── HeroGreeting.tsx                       # "Ahoj, Lucia 👋"
│   ├── ActionCards.tsx                        # "Nahlásiť problém" / "Požiadať o niečo" big CTAs
│   ├── MyRecentTickets.tsx                    # last 3-5 tickets ListRow
│   └── KbSuggestions.tsx                      # top 3 articles
├── api.ts                                     # myTicketsQuery(), kbSuggestionsQuery()
├── hooks.ts                                   # useMyTickets, useKbSuggestions
└── types.ts

apps/portal/lighthouserc.json                  # Portal `/` mobile assertions graduate warn → error
packages/i18n/catalogs/portal/{sk,en}.json     # +home.* keys (greeting, ctaIncident, ctaRequest, recentTickets, kbSuggestions, ...)
tools/browser-test/scenarios/h2-portal-home.spec.ts  # E2E: render greeting + click CTA + verify recent tickets visible

docs/ROADMAP.md
docs/plans/H.2.md
```

## Done-when

- [ ] `HeroGreeting` renders `t("home.greeting", { name: user.firstName })` ("Ahoj, Lucia 👋" SK / "Hi, Lucia 👋" EN).
- [ ] Two big action `<Card variant="interactive">` (per `components.md` Card) cards: "Nahlásiť problém" → `/new-incident`, "Požiadať o niečo" → `/catalog`.
- [ ] `MyRecentTickets`: TanStack Query `GET /api/incidents?customer=me&status!=closed&size=5&sort=open_date DESC`. Render 5 `<ListRow>` cards; each clicks to `/tickets/:id`. Empty state per `microcopy.md §4` ("Zatiaľ žiadne tickety…").
- [ ] `KbSuggestions`: `GET /api/kb/search?context=home&size=3`. Render 3 `<Card>` with KB excerpt; click → `/kb/article/:id`. Skip section if 0 results.
- [ ] Loader: `loader` pre-fetches both queries via `queryClient.ensureQueryData(...)` — no waterfall.
- [ ] Mobile-first: < 640 px single column; ≥ 640 px 2-col action cards.
- [ ] LHCI assertion: portal `/` mobile TTI ≤ 1.8 s, LCP ≤ 1.5 s, CLS ≤ 0.05, score ≥ 0.9 (graduates from `warn` in H.0).
- [ ] i18n `pnpm i18n:check` green; +12-15 keys per locale.
- [ ] Browser test: navigate to `/` → assert greeting visible → click "Nahlásiť problém" → URL changes to `/new-incident`.
- [ ] `pnpm -r typecheck/lint/test/build/size` green.
- [ ] ROADMAP: H.2 → ✅ DONE.

## Stratégia

### Fáza A — Routes + API hooks

1. Replace `routes/placeholders/home.tsx` import with `features/home/HomeRoute.tsx` (default export `{ Component: HomeRoute, loader: homeLoader }`).
2. `features/home/api.ts` — queryFactories `myTicketsQuery(tenantId)`, `kbSuggestionsQuery(tenantId, context)`. Use `queryKey: ["tickets", tenantId, "my-recent"]` (tenant-scoped per H.1 invalidation strategy).
3. `homeLoader`: `Promise.all([queryClient.ensureQueryData(myTicketsQuery(...)), queryClient.ensureQueryData(kbSuggestionsQuery(...))])`.

### Fáza B — Components

1. `HeroGreeting` — uses `useSession()` + `useTranslation("portal")`. Avatar `@sdm/design-system Avatar` (per `components.md`).
2. `ActionCards` — 2 cards stacked mobile / side-by-side desktop. Use `<Card variant="interactive" as="a" href="/new-incident">`.
3. `MyRecentTickets` — list of `<ListRow variant="compact">`. Each row: `<StatusBadge status={t.status}>` + ref + summary + relative time (uses G.2 `formatRelative`).
4. `KbSuggestions` — 3 `<Card variant="surface">` with title + excerpt + read time. Empty: skip section silently.

### Fáza C — Verification + PR

1. LHCI graduate per `apps/portal/lighthouserc.json` — portal `/` moves from `_url_todo_phase_h` to active URL with full assertions.
2. Browser test scenario.
3. `pnpm -r typecheck/lint/test/build/size`; PR.

## Open questions / risks

- **My-tickets endpoint shape**: `GET /api/incidents?customer=me` — verify BFF resolves "me" via session, NIE client-side. Ak nie podporované, doplniť BFF query param resolver (small server change).
- **KB suggestions context**: BFF endpoint může vyžadovať `context=home` query param pre tenant-specific top-N selection. Ak chýba, fallback `?sort=helpfulness DESC&size=3` (per `spec/knowledge-management.md`).
- **Empty states**: 0 tickets + 0 KB → render empty hero only ("Zatiaľ tu nič nemáš..."). No broken UI.

## Notes pre subagenta

- Lazy-load Sentry recommended (per H.0 / G.4 deferred) ak bundle delta tlačí portal initial JS nad 180 KB.
- Re-use existing F.5 `useSession()` z `apps/portal/src/shell/session-context.tsx`.
- Subagent **NESMIE** merge own PR.
