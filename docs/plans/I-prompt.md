# Phase I prompt — orchestrate I.0 → I.7 (sekvenčný subagent dispatch)

> Skopíruj všetko od ďalšieho oddielu **`──── COPY FROM HERE ────`** dole
> a vlož ako nový prompt po `/clear`.

──── COPY FROM HERE ────

Pokračujeme SDM-Rewrite. **Phase H ✅ DONE (17/17)** — všetkých 17 chunkov merged
(PR-y #24 H.0 → #40 H.16). Phase H exit criteria však majú **2 nesplnené body**
(LHCI timing thresholds zostali `warn`; 18 acceptance journeys = 11 pass / 6 partial
/ 1 deferred, nie 18/18 strict pass). Phase I plánovanie hotové — 8 chunk plánov
v `docs/plans/I.{md,0..7}.md`. Najbližšia úloha: **orchestrovať Phase I execution
cez sekvenčný subagent dispatch** (rovnaký pattern ako Phase G/H, kde fungoval).

Phase I overview + cross-chunk decisions:
→ docs/plans/I.md

Per-chunk plány (každý self-contained, autoritatívny pre svoj scope):
→ docs/plans/I.0.md LHCI graduation (MSW-in-LHCI) ← Phase H exit #5 closure
→ docs/plans/I.1.md Step-up 2FA + emergency approve + RHF Controller race fix
← closes journeys #2, #9, #11
→ docs/plans/I.2.md Security audit sweep (CodeQL + Trufflehog + axe + multi-browser)
← closes §4 deferred vectors + C6 + C8
→ docs/plans/I.3.md Multi-tenancy edge cases (RLS + suspension + cross-tenant sweep)
← closes §4.2 deferred vectors
→ docs/plans/I.4.md KB authoring (TipTap + DOMPurify + publish + analytics)
← closes journeys #13, #14, #15
→ docs/plans/I.5.md SP cockpit / cross-tenant view ← closes journeys #12, #18
→ docs/plans/I.6.md Release v1.0 dry-run (helm staging + live BFF smoke + rollback)
→ docs/plans/I.7.md v1.0 cut (semver tag + image push + OCI helm + release notes)

Phase H merged PR-y (kontextová baseline pre I, recent first):

- PR #40 H.16 — Acceptance smoke (18 journeys) + Phase H closure
- PR #39 H.15 — Workspace KB browse + read (read-only)
- PR #38 H.14 — CMDB Cytoscape graph (lazy 164 KB)
- PR #37 H.13 — CMDB CI list + detail (attribute groups registry)
- PR #36 H.12 — Problems + link-to-incident (BFF linked deferred)
- PR #35 H.10 — Change calendar (FullCalendar lazy 75 KB)
- PR #34 H.11 — CAB approval flow (step-up degraded)
- PR #33 H.9 — Changes list + 4-tab detail
- PR #32 H.6 — Portal KB (vendor-markdown lazy 49 KB)
- PR #31 H.5 — Service catalog + DynamicForm
- PR #30 H.3 — Portal new-incident (attachments deferred)
- PR #29 H.4 — Portal ticket-detail
- PR #28 H.2 — Portal home dashboard
- PR #27 H.8 — Workspace ticket-detail (TipTap deferred)
- PR #26 H.7 — Workspace queue (Anna centerpiece)
- PR #25 H.1 — Tenant switcher activation
- PR #24 H.0 — Routing infrastructure

Status + PR-flow + creds: auto-loaduje sa z MEMORY.md (per-project, mimo repo).
Memory `feedback_pr_flow.md` = PR-per-chunk + squash --admin --delete-branch.
Memory `real_backend.md` = CA SDM 17.4 creds. Memory `deploy_target.md` = on-prem
host 10.11.36.21 (soisd) + app port 88 + registry endpoint. NIKDY heslo do repo
/ commit / PR body.

## Orchestračný postup (parent agent = ty, subagent = general-purpose)

Pre **každý chunk I.X**, opakuj:

1. **Pre-flight**: `git checkout main && git pull --ff-only`. Skontroluj, že
   I.(X-1) je merged (s výnimkou I.0 = first).
2. **Verify plán**: prečítaj `docs/plans/I.X.md` end-to-end. Identifikuj open
   questions, ktoré treba riešiť pred dispatch-om. Väčšina I.X plánov má
   `recommended resolutions` v §Open questions — **použiť defaults**.
   Eskalácia (AskUserQuestion) iba ak narazíš na nejasnosť mimo dokumentovaný
   default.
3. **(Voliteľné) Pre-flight research subagent paralelne**: ak chunk dotyká
   existing infra (I.2 security workflows; I.6 helm chart), pred implementation
   subagentom môžeš dispatchnúť **read-only research subagent** (general-purpose,
   ale s mandate "READ-ONLY: audit + report, NO file writes, NO branches, NO
   PRs"). Beží paralelne, nevytvára konflikt. Výstup = compact context summary
   pre implementation subagent brief.
4. **Dispatch implementation subagent** (`subagent_type: "general-purpose"`)
   s self-contained briefom. Template obsahuje:
   - "READ FIRST: /Users/spigot/Desktop/CC_Projekty/SDM-Rewrite/docs/plans/I.X.md"
   - "Branch: chunk/I.X-<slug> from fresh main"
   - "Workflow: implement per I.X.md Stratégia → verify gates green
     (typecheck/lint/test/build/size + i18n:check) → push → gh pr create.
     DO NOT MERGE — parent agent merges."
   - PR title + body template (zo plánu)
   - Conventions (Slovak commit body, English code, co-authored-by trailer
     `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`)
   - Memory pointers (auto-loaded via user CLAUDE.md)
   - Hard constraints per chunk plan §Notes pre subagenta + cross-cutting:
     žiadny merge, žiadny --no-verify, žiadne nové runtime deps mimo I.md §D3
5. **Verify subagent výstup**:
   - `gh pr view <num>` — confirms PR created
   - `gh pr checks <num>` — wait for CI green (use `--watch --interval 30`)
   - `git diff main..origin/chunk/I.X-... --stat` — spot-check change list
   - Optional: `git show` na 1-2 critical files
6. **Merge**: `gh pr merge <num> --admin --squash --delete-branch`
7. **Refresh local main**: `git checkout main && git pull --ff-only`
8. **ROADMAP + plán toggle**: update `docs/ROADMAP.md` "Aktuálny stav"
   - chunk bullet → ✅ DONE, update `docs/plans/I.X.md` Status + PR #.
     Commit + push (`docs(I.X): refresh PR # + status after merge`).
9. **Acceptance coverage matrix update** (pre I.1, I.2, I.3, I.4, I.5):
   update `docs/agents/qa-test-strategy/acceptance-coverage.md` matrix —
   posunúť relevantné rows z `partial`/`deferred` na `pass`. Commit ako
   súčasť kroku 8 alebo separate `docs(I.X): close acceptance rows`.
10. **Continue**: `I.X+1`.

## Recommended dispatch order

Strict sekvenčný per `I.md §D2` (dependencies are not negotiable):

```
I.0 → I.1 → I.2 → I.3 → I.4 → I.5 → I.6 → I.7
```

Žiadny paralelný implementation dispatch — PR-flow discipline (memory
`feedback_pr_flow.md`: stacked-PR gotcha = CI doesn't fire + auto-close on base
delete). **Pre-flight research subagenty** (krok 3) môžu bežať paralelne, ak
parent toleruje krátkodobý context bloat.

## Phase I expanded scope vs original ROADMAP

Pôvodný ROADMAP §Phase I mal 5 chunks (e2e + security + multi-tenancy + release
dry-run + v1.0 cut). Phase I plán **rozšíril** scope na 8 chunkov:

- **I.0 LHCI graduation** pridaný — Phase H exit criterion #5 closure
- **I.4 KB authoring** + **I.5 SP cockpit** pulled-in z v1+ scope —
  potrebné pre 18/18 acceptance journey closure (#13, #14, #15 cez I.4;
  #12, #18 cez I.5)
- Pôvodný "I.4 release dry-run" → I.6; pôvodný "I.5 v1.0 cut" → I.7

Po Phase I = **v1.0 RELEASED**, žiadna Phase J. Post-release scope je separate
sequencing dokument (mobile PWA, advanced calendar, KB widgets, bulk-ops).

## Konkrétne open questions ktoré pravdepodobne príde riešiť

Všetky majú recommended resolutions v príslušnom I.X.md §Open questions —
prosím **použiť defaults** without escalation:

- **I.0**: MSW + `vite preview` combo (reuse z `acceptance.yml` H.16); žiadna
  threshold relaxation; per-route `performance.md §2` thresholds graduated
  `warn` → `error`.
- **I.1**: TOTP cez `node:crypto` (žiadny `speakeasy` dep); dev seed
  `JBSWY3DPEHPK3PXP`; single-use step-up token; real OIDC step-up overený až
  v I.6 staging.
- **I.2**: CodeQL + Trufflehog (GitHub-native, žiadny paid Snyk/Semgrep);
  Playwright multi-browser matrix (chromium + firefox + webkit); axe sweep
  per route bez whitelisting (real bugs treba fix).
- **I.3**: Tenant suspension cez `tenantStatus` field; in-memory token store
  rovnaký pattern ako F.1 (multi-instance Redis = v1+); 404 (nie 403) pre
  foreign-tenant deep links per OWASP.
- **I.4**: TipTap markdown bridge (persist markdown, render TipTap JSON);
  `isomorphic-dompurify` v oboch end-points; žiadny image upload (per H.3
  attachments deferral); analytics cez MSW fixtures (real analytics ingest
  je v1+).
- **I.5**: `sp_admin` permissions už existujú v E.2 — verify; CA SDM real
  cross-tenant query unsupported per `real-backend-contracts.md §6` — MSW
  mock multi-tenant sufficient pre journey pass, real impl deferred v1+.
- **I.6**: cluster access = parent agent runs `helm install` manually; CI len
  prepares scripts + workflows. Tag signing optional.
- **I.7**: Git tag creation = parent's responsibility (sensitive op);
  registry endpoint per `deploy_target.md`; helm OCI publish — ak on-prem
  registry nesupportuje OCI, fallback `ghcr.io`.

## Postup keď začneš (prvé akcie)

1. Prečítaj `docs/plans/I.md` + `docs/plans/I.0.md` end-to-end.
2. Skontroluj `git status` (čistý main) + `git log --oneline -5` (verify
   posledný merged je H.16 commit `ce52895` "docs(H.16): finalize status DONE
   - PR # after merge" alebo neskorší).
3. Skontroluj `gh pr list` — žiadne otvorené chunk/\* branches z Phase H.
4. Dispatchni I.0 subagent (general-purpose) s self-contained briefom per
   krok 4 vyššie. I.0 nemá significant open questions — `performance.md §2`
   je autoritatívny.
5. Po I.0 merge: dispatch I.1, atď. — pokračuj per recommended order.

## Hard rules naprieč Phase I

- **NIKDY nemerguj vlastný PR** — subagent vždy reportuje, parent merguje.
- **Žiadne stacked PR** — vždy fresh main pred novým chunk-om.
- **Žiadny paralelný implementation dispatch** — PR-flow strict.
- **Žiadne nové runtime deps** mimo `I.md §D3` whitelist (TipTap + DOMPurify
  pre I.4; Playwright browsers + @axe-core/playwright pre I.2). Ak chunk
  vyžaduje niečo nové, eskaluj cez AskUserQuestion **pred** dispatch.
- **Žiadne nové audit event names** — F.4 taxonomy je frozen pre Phase I rovnako
  ako Phase H (`data.<entity>.{write,delete}` + `authn.*` + `authz.*` + nové
  ops cez `details.op` discriminator).
- **i18n strings** vždy cez `useTranslation()` — žiadne hardcoded SK strings.
  `pnpm i18n:check` musí byť green per PR.
- **Bundle budgets** strict — portal initial JS ≤ 180 KB, workspace ≤ 350 KB.
  TipTap (I.4) + ostatné lazy chunks — žiadny initial cost. Cap relaxation
  iba pre vendor sub-chunks po explicit measurement (per H.7/H.14 precedent).
- **LHCI thresholds** post-I.0 graduated to `error` — žiadny chunk ktorý
  pridáva novú route nesmie nechať threshold `warn` (graduate per same PR).
- **Žiadne secrets do repo** — CA SDM creds, registry creds, OIDC client
  secrets, TOTP seeds (okrem documented test seed) — všetko cez environment
  alebo vault refs.
- **Acceptance coverage matrix** treba update-ovať per relevant chunk
  (I.1/I.2/I.3/I.4/I.5).

Ak narazíš na nejasnosť mimo open questions zoznamu vyššie, povedz pred
dispatch-om, nehádaj.

──── COPY UNTIL HERE ────
