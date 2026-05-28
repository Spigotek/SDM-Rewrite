# /clear-ready prompt — Phase H execution

> Paste this into a fresh chat session (`/clear` predtým) keď štartuješ Phase H.

---

Pokračujeme SDM-Rewrite. Phase G ✅ DONE (5/5), Phase H plánovanie hotové
— 17 chunk plánov v `docs/plans/H.{md,0..16}.md`. Najbližšia úloha:
**orchestrovať Phase H execution cez sekvenčný subagent dispatch**
(rovnaký pattern ako Phase G, kde fungoval).

Phase H overview + cross-chunk decisions:
→ docs/plans/H.md

Per-chunk plány (každý self-contained, autoritatívny pre svoj scope):
→ docs/plans/H.0.md Routing infrastructure (React Router 6 + RouteGuard)
→ docs/plans/H.1.md Tenant switcher activation + cache invalidation
→ docs/plans/H.2.md Portal home dashboard (Lucia)
→ docs/plans/H.3.md Portal new-incident form
→ docs/plans/H.4.md Portal ticket-detail (requester view)
→ docs/plans/H.5.md Portal service catalog + new-request (DynamicForm)
→ docs/plans/H.6.md Portal KB search + article
→ docs/plans/H.7.md Workspace queue (Anna — agent centerpiece)
→ docs/plans/H.8.md Workspace ticket-detail (split-view, 3-tab Composer)
→ docs/plans/H.9.md Workspace changes list + detail
→ docs/plans/H.10.md Change calendar (FullCalendar 6 lazy)
→ docs/plans/H.11.md CAB approval flow
→ docs/plans/H.12.md Workspace problems + link-to-incident
→ docs/plans/H.13.md Workspace CMDB CI list + detail
→ docs/plans/H.14.md CMDB relationships graph (Cytoscape 3 lazy)
→ docs/plans/H.15.md Workspace KB browse + read (read-only MVP)
→ docs/plans/H.16.md Acceptance criteria smoke (18 journeys, close Phase H)

Phase G merged PR-y (kontextová baseline pre H):

- PR #19 G.1 Design system tokens + 12 base komponentov
- PR #20 G.5 Self-host Inter + JetBrains Mono woff2
- PR #21 G.2 i18n provider + 88 sk/en keys + i18n:check CI gate
- PR #22 G.3 Sentry + ULID correlation ID + ErrorBoundary
- PR #23 G.4 LHCI + size-limit + manualChunks (portal 166/180 KB)

Status + PR-flow + creds: auto-loaduje sa z MEMORY.md (per-project,
mimo repo). Memory `feedback_pr_flow.md` = PR-per-chunk + squash --admin
--delete-branch. Memory `real_backend.md` = CA SDM 17.4 creds. NIKDY heslo
do repo / commit / PR body.

## Orchestračný postup (parent agent = ty, subagent = general-purpose)

Pre **každý chunk H.X**, opakuj:

1. **Pre-flight**: `git checkout main && git pull --ff-only`. Skontroluj
   že chunk H.(X-1) je merged (s výnimkou H.0 ktorý je first).
2. **Verify plán**: prečítaj `docs/plans/H.X.md` end-to-end. Identifikuj
   open questions ktoré treba riešiť pred dispatch-om (typically scope
   decisions o BFF endpoint augmentations). Ak je ambiguity, opýtaj sa
   ma cez AskUserQuestion **pred** dispatch.
3. **Dispatch subagent** (`subagent_type: "general-purpose"`) s self-
   contained briefom. Template briefu obsahuje:
   - "READ FIRST: /Users/spigot/Desktop/CC_Projekty/SDM-Rewrite/docs/plans/H.X.md"
   - "Branch: chunk/H.X-<slug> from fresh main"
   - "Workflow: implement per H.X.md Stratégia → verify gates green
     (typecheck/lint/test/build/size + i18n:check) → push → gh pr create.
     DO NOT MERGE — parent agent merges."
   - PR title + body template
   - Conventions (Slovak commit body, English code, co-authored-by trailer
     `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`)
   - Memory pointers (auto-loaded via user CLAUDE.md)
   - Hard constraints (žiadny merge, žiadny --no-verify, žiadne nové deps
     mimo r2 stack)
4. **Verify subagent výstup**:
   - `gh pr view <num>` — confirms PR created
   - `gh pr checks <num>` — wait for CI green
   - `git diff main..origin/chunk/H.X-... --stat` — spot-check change list
   - Optional: `git show` na 1-2 critical files
5. **Merge**: `gh pr merge <num> --admin --squash --delete-branch`
6. **Refresh local main**: `git checkout main && git pull --ff-only`
7. **ROADMAP + plán toggle**: update `docs/ROADMAP.md` "Aktuálny stav"
   - chunk bullet → ✅ DONE, update `docs/plans/H.X.md` Status + PR #.
     Commit + push (`docs(H.X): refresh PR # + status after merge`).
8. **Continue**: `H.X+1`.

## Recommended dispatch order

Per `H.md §D2` — foundation first, then workspace agent journey, potom portal:

```
H.0 → H.1 → H.7 → H.8 → H.2 → H.4 → H.3 → H.5 → H.6
    → H.9 → H.11 → H.10 → H.12 → H.13 → H.14 → H.15 → H.16
```

H.0 + H.1 sú **strict prerequisites** pre všetky ostatné. Po nich:
H.7+H.8 (workspace queue + ticket detail) pokrývajú agent persona —
hlavná value MVP. Portal batch (H.2-H.6) môže ísť paralelne v rámci
sessions ale **jedna PR per chunk**. Workspace batch (H.9-H.15)
podobne. H.16 ako uzáver.

## Konkrétne open questions ktoré pravdepodobne príde riešiť

- **H.0**: bundle budget — portal initial JS 166 KB baseline + ~28 KB
  (react-router-dom + @tanstack/react-query) = 194 KB → over 180 KB
  budget. Mitigácia: lazy Sentry init (per G.4 §Open questions deferred),
  alebo relax budget na 200 KB v `.size-limit.json`. Spýtaj sa pred
  dispatch-om.
- **H.3**: attachments BFF endpoint — F.x deferred binary upload (per
  F.6 §23.6 documentation). Buď doplniť `POST /api/attachments` multipart
  streaming, alebo ship without attachments + log feature follow-up.
- **H.4**: jednoduchá `/tickets/:id` route s type-prefix detection alebo
  typed routes `/incidents/:id` + `/requests/:id`? Recommendation v
  H.4.md: single route s prefix detection.
- **H.7**: bulk-ops — explicitne MIMO MVP per ROADMAP. Žiadne multi-select
  v queue v H.7.
- **H.8**: TipTap deferred — plain Textarea + markdown shorthand acceptable
  pre v MVP composer. Plný TipTap je v1+.
- **H.11**: step-up auth — F.1 to documented but possibly not implemented;
  ak nie, ship without (degraded UX) + log issue pre Phase I.2.
- **H.12**: linked incidents BFF endpoint — per F.6 §24 verdict no BREL
  works; custom mutation needed. Scope addition v BFF; ak refactor large,
  defer linked feature.
- **H.16**: live BFF vs MSW mode pre 18 journeys — recommendation MSW
  v CI gate, live smoke ako manual workflow pred Phase I.

## Postup keď začneš (prvé akcie)

1. Prečítaj `docs/plans/H.md` + `docs/plans/H.0.md` end-to-end.
2. Skontroluj `git status` (čistý main) + `git log --oneline -5` (verify
   posledný merged je G.4 PR #23 → commit 61dc38c "docs(plans): Phase H
   overview...").
3. Spýtaj sa ma na bundle budget Open question pre H.0 (lazy Sentry vs
   relax budget). Toto je jediný decision point ktorý chcem riešiť pred
   dispatch-om H.0.
4. Dispatchni H.0 subagent (general-purpose) s self-contained briefom.
5. Po H.0 merge: dispatch H.1, atď. — pokračuj per recommended order.

## Hard rules naprieč Phase H

- **NIKDY nemerguj vlastný PR** — subagent vždy reportuje, parent merguje.
- **Žiadne stacked PR** — vždy fresh main pred novým chunk-om.
- **Žiadne nové runtime deps** mimo r2 stack (H.md §D3). Ak chunk vyžaduje
  niečo nové, eskaluj cez AskUserQuestion **pred** dispatch.
- **Žiadne nové audit event names** — F.4 taxonomy je frozen pre Phase H
  (data.<entity>.{write,delete} only).
- **i18n strings** vždy cez `useTranslation()` — žiadne hardcoded SK
  strings. `pnpm i18n:check` musí byť green per PR.
- **LHCI thresholds** graduate-uje warn → error per route v subagent PR.

Ak narazíš na nejasnosť mimo open questions zoznamu vyššie, povedz pred
dispatch-om, nehádaj.
