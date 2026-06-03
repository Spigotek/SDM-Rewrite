Pokračujeme SDM-Rewrite. **v1.0 ✅ RELEASED** — tag `v1.0.0` (commit `6978478`)
pushed 2026-06-03, GHCR images + helm OCI chart + GitHub Release publikované.
**Phase I ✅ DONE** (8/8 chunkov, PR-y #41 I.0 → #48 I.7). Najbližšia úloha:
**orchestrovať Phase J execution cez sekvenčný subagent dispatch** (rovnaký
pattern ako Phase G/H/I, kde fungoval).

Phase J overview + cross-chunk decisions:
→ docs/plans/J.md (skeleton; full per-chunk plans sa píšu pre-execution)

Per-chunk plány **AKO PHASE I, písané pre-execution per chunk** (NIE upfront):
→ docs/plans/J.0.md — TBD: v1.0 staging deploy + live BFF smoke (P0 BLOCKER)
→ docs/plans/J.1.md — TBD: Workspace arm64 image (native runner ubuntu-22.04-arm)
→ docs/plans/J.2.md — TBD: Real BFF cross-tenant query (CA SDM 17.4 eval + impl)
→ docs/plans/J.3.md — TBD: Real-time tenant push (WebSocket/SSE)
→ docs/plans/J.4.md — TBD: KB analytics real ingest (replaces I.4 MSW fixture)
→ docs/plans/J.5.md — TBD: KB image upload binary (graduates H.3 attachments)
→ docs/plans/J.6.md — TBD: Calendar drag-resize
→ docs/plans/J.7.md — TBD: Mobile PWA offline mode
→ docs/plans/J.8.md — TBD: Portal LCP fix (SSR alebo copy/UX redesign)
→ docs/plans/J.9.md — TBD: v1.1 cut (semver tag + image push + OCI helm + release notes)

Phase I merged PR-y (kontextová baseline pre J, recent first):

- PR #48 I.7 — v1.0 cut (chart 1.0.0 + release.yml + CHANGELOG + RELEASE-NOTES)
- PR #47 I.6 — Release v1.0 dry-run scaffolding (helm staging + scripts)
- PR #46 I.5 — SP cockpit + cross-tenant view (journeys #12 + #18)
- PR #45 I.4 — KB authoring (TipTap + sanitize-html + journeys #13/#14/#15)
- PR #44 I.3 — Multi-tenancy edges (tenant suspension + cross-tenant sweep + HttpClient race)
- PR #43 I.2 — Security audit sweep (CodeQL + Trufflehog + axe + multi-browser + 7 vuln bumps)
- PR #42 I.1 — Step-up 2FA + emergency approve (journeys #2/#9/#11)
- PR #41 I.0 — LHCI graduation (stub-BFF + 4-iter bundle refactor + R5 calibration)

Status + PR-flow + creds + v1.0 milestone: auto-loaduje sa z MEMORY.md (per-project,
mimo repo). Memory `feedback_pr_flow.md` = PR-per-chunk + squash --admin
--delete-branch. Memory `real_backend.md` = CA SDM 17.4 creds. Memory
`deploy_target.md` = on-prem host 10.11.36.21 (soisd) + app port 88 + registry
endpoint. Memory `v1_0_released.md` = v1.0 artifacts + outstanding pre-validation.
NIKDY heslo do repo / commit / PR body.

## Orchestračný postup (parent agent = ty, subagent = general-purpose)

Pre **každý chunk J.X**, opakuj:

1. **Pre-flight**: `git checkout main && git pull --ff-only`. Skontroluj, že
   J.(X-1) je merged (s výnimkou J.0 = first).
2. **Napíš/refresh per-chunk plán** `docs/plans/J.X.md`:
   - Ak ešte neexistuje (TBD per index vyššie), **písaš ho ty (parent agent)**,
     NIE subagent — same pattern ako Phase I (kde I.{0..7}.md boli written
     pred-execution, ale na opačnej osi: I bola batched upfront vo `019a2c3`;
     J je per-chunk just-in-time aby reagovala na changes z predch. J chunkov).
   - Template: kopíruj štruktúru z `docs/plans/I.X.md` najbližšieho významom
     (perf/security/feature/release per chunk type). Sekcie: Status, Branch,
     Cieľ, Pivot vs ROADMAP, Inputs, Outputs, Done-when, Stratégia (A→B→C
     fáze), Open questions / risks — recommended resolutions, Notes pre
     subagenta.
   - **Open questions resolution policy**: každá nejednoznačnosť dostane
     `recommended resolution` v plane → subagent ich má použiť ako defaults
     bez eskalácie. Eskalácia (AskUserQuestion) iba ak narazíš na unknown mimo
     plan scope.
   - Commit plán pred dispatch-om (`docs(J.X): per-chunk detail plan`).
3. **(Voliteľné) Pre-flight research subagent paralelne**: ak chunk dotyká
   existing infra (J.2 CA SDM cross-tenant capability eval; J.7 PWA service
   worker existence check; J.8 SSR feasibility check), pred implementation
   subagentom dispatchni **read-only research subagent**. Output = compact
   summary do implementation subagent briefu.
4. **Dispatch implementation subagent** (`subagent_type: "general-purpose"`)
   so self-contained briefom (READ FIRST list, branch/PR shape, Stratégia,
   Acceptance gates, PR template, Hard constraints — per Phase I template).
5. **Verify subagent output**:
   - `gh pr view <num>` — confirms PR created
   - `gh pr checks <num>` — wait for CI green
   - `git diff main..origin/chunk/J.X-... --stat` — spot-check change list
   - Optional: `git show` na 1-2 critical files
6. **Merge**: `gh pr merge <num> --admin --squash --delete-branch`
7. **Refresh local main**: `git checkout main && git pull --ff-only`
8. **ROADMAP + plán toggle**: update `docs/ROADMAP.md` "Aktuálny stav" +
   chunk bullet → ✅ DONE, update `docs/plans/J.X.md` Status + PR #.
   Commit + push (`docs(J.X): refresh PR # + status after merge`).
9. **Acceptance matrix update** (kde aplikuje — J.0 Live BFF column, J.2
   cross-tenant rows, J.4 kb-analytics, J.5 kb-image-upload, J.6 calendar
   drag-resize): update `docs/agents/qa-test-strategy/acceptance-coverage.md`
   matrix.
10. **Continue**: `J.X+1`.

## Recommended dispatch order

Strict sekvenčný per `J.md §D2`:

```
J.0 → J.1 → J.2 → J.3 → J.4 → J.5 → J.6 → J.7 → J.8 → J.9
```

Žiadny paralelný implementation dispatch — PR-flow discipline (memory
`feedback_pr_flow.md`). **Pre-flight research subagenty** môžu bežať paralelne
ak parent toleruje context bloat.

## ⚠️ Špeciálny case: J.0 staging deploy (P0 HARD BLOCKER)

**J.0 NIE je app-code chunk** — je to **operator-driven cluster deployment +
live smoke + rollback test + post-mortem fill**. Subagent NEMÔŽE deployovať
do real cluster (žiadny kubeconfig v autonomous session, sensitive op per
global CLAUDE.md "Ask before: server restarts, DB migrations on production").

Postup pre J.0:

1. **Pred dispatch**: Parent (ty) **eskaluj user-ovi** cez AskUserQuestion:
   "J.0 staging deploy vyžaduje cluster access (kubeconfig pre on-prem
   10.11.36.21:88 + real CA SDM 17.4 creds). Pokračovať? Možnosti:
   (a) User/operator beží deploy manuálne, mne pošle live smoke výsledky →
   ja fill-nem RELEASE-DRY-RUN.md + ROADMAP toggle.
   (b) Defer J.0 + skip rovno na J.1 (workspace arm64) + zvyšok Phase J;
   J.0 sa dorobí keď bude cluster access dostupný.
   (c) Cancel Phase J úplne (v1.0 ostáva ako-je, deferred items v1.1+ scope)."

2. Pri (a): keď user pošle výsledky → parent fill-ne `docs/RELEASE-DRY-RUN.md`

   - updatne `acceptance-coverage.md` "Live BFF" column per row + ROADMAP
     toggle. Žiadny PR — direct main push s `docs(J.0): live smoke results +
GO/NO-GO`. Ak GO → continue J.1. Ak NO-GO → eskaluj remediation.

3. Pri (b): napíš `docs/plans/J.0.md` s Status `🔁 deferred until cluster
access available`. Skip rovno na J.1.

4. Pri (c): commit `docs(J): Phase J cancelled — v1.0 final`, update
   ROADMAP, end session.

## Open questions naprieč Phase J — recommended resolutions

Tieto sú **placeholder** — finalize per-chunk pri písaní J.X.md plánov.

- **J.0 (live smoke)**: failure modes prioritization — P0 (any /readyz fail
  → STOP + rollback), P1 (any journey fail v MSW-pass scenarios → block deploy
  - Phase I.x patch), P2 (perf regression > 50% → flag + investigate).
- **J.1 (arm64)**: native `ubuntu-22.04-arm` GitHub-hosted runner GA per
  2026-Q1. Verify availability + cost. Fallback: keep workspace amd64-only.
- **J.2 (cross-tenant)**: CA SDM 17.4 multi-tenant capability — eval cez
  `vueuser` test endpoint (per `real-backend-contracts.md §6`). Ak unsupported,
  J.2 reduce na BFF-side aggregation + audit emit (MSW pattern z I.5 zostáva
  primary). Ak supported, prefer real path.
- **J.3 (real-time push)**: WebSocket vs SSE eval — Hono má native SSE support
  cez `c.stream()` API. **Recommendation**: SSE first (simpler, half-duplex
  sufficient pre status push, žiadny new dep), WebSocket fallback ak SSE
  insufficient.
- **J.4 (KB analytics)**: data source — CA SDM nemá native KB analytics. Voľba
  medzi (a) audit log derivation (`data.kb.read`/`data.kb.search` events from
  F.4) + aggregation v BFF, (b) custom CA SDM attribute on KD entity. **Rec**:
  (a) — F.4 audit infra už exists, žiadne CA SDM schema changes.
- **J.5 (image upload)**: max file size + format — H.3 deferred attachments
  per `runtime-config.md`. **Rec**: 5 MB max, PNG/JPG/SVG/GIF whitelist,
  EXIF strip on upload, MIME-sniffing validation server-side.
- **J.6 (calendar drag-resize)**: `@fullcalendar/interaction` plugin already
  in H.10 bundle? Verify. Conflict resolution: drag onto another change →
  ask conflict (per H.10 plan).
- **J.7 (PWA)**: service worker scope + cache strategy. **Rec**: Workbox
  precache shell + runtime cache stale-while-revalidate na /api/\* + network-first
  na /me + /config. IndexedDB pre offline ticket queue.
- **J.8 (LCP)**: SSR vs copy/UX redesign. **Rec**: copy/UX first (low risk —
  enlarge HeroGreeting subtitle to multi-line paragraph, becomes LCP target,
  paint-uje at FCP). Ak insufficient, SSR cez Vite SSR plugin. Document
  decision v J.8.md.
- **J.9 (v1.1 cut)**: workspace arm64 included? Depends on J.1 result.
  Release notes aggregate J.0-J.8 outcomes.

## Hard rules naprieč Phase J

- **NIKDY nemerguj vlastný PR** — subagent vždy reportuje, parent merguje.
- **Žiadne stacked PR** — vždy fresh main pred novým chunk-om.
- **Žiadny paralelný implementation dispatch** — PR-flow strict.
- **Backward compat** — v1.1 nesmie breakknúť v1.0 deployments. Helm chart
  v1.1.0 zpätne-kompat installable. CA SDM contract changes verzionované.
- **Žiadne nové runtime deps** mimo J.md §D3 whitelist (Workbox, ws/SSE,
  Vite SSR plugin, @fullcalendar/interaction ak nie je už included). Ak chunk
  vyžaduje niečo nové, eskaluj cez AskUserQuestion **pred** dispatch.
- **Žiadne nové audit event names** — F.4 taxonomy frozen aj v Phase J
  (`data.<entity>.{write,delete}` + `authn.*` + `authz.*` + `details.op`
  discriminator).
- **i18n strings** vždy cez `useTranslation()`. `pnpm i18n:check` green per PR.
- **Bundle budgets** strict — portal initial JS ≤ 180 KB, workspace ≤ 350 KB.
  Service worker (J.7) + SSR runtime (J.8) lazy/conditional. Žiadne regression.
- **LHCI thresholds** post-I.0 calibrated (per `performance.md §2`). Žiadne
  threshold relaxation bez evidence-based update + user approval.
- **Žiadne secrets do repo** — cluster creds, registry creds, OIDC client
  secrets — všetko cez environment alebo vault refs.
- **Acceptance coverage matrix** update per relevant chunk.
- **J.0 cluster deploy** = operator manuálne, NIE autonomous. Eskaluj **pred**
  J.0 začatím per špeciálny case vyššie.

## Postup keď začneš (prvé akcie)

1. Prečítaj `docs/plans/J.md` + `docs/CHANGELOG.md` + `docs/RELEASE-NOTES-v1.0.md`
   end-to-end (kontextová baseline).
2. Skontroluj `git status` (čistý main) + `git log --oneline -8` (verify
   posledný merged je `4d9aa1b docs(J): Phase J post-v1.0 plan skeleton`
   alebo neskorší).
3. Skontroluj `gh pr list` — žiadne otvorené chunk/\* branches z Phase I.
4. Skontroluj `gh release view v1.0.0` — verify GitHub Release exists +
   chart .tgz attached.
5. **Eskaluj J.0 decision** cez AskUserQuestion (per špeciálny case vyššie).
6. Per user decision:
   - (a) Wait for live smoke results, then fill docs + continue J.1.
   - (b) Write J.0.md as `🔁 deferred` + skip to J.1 (write J.1.md + dispatch).
   - (c) Cancel Phase J, commit closure.

Ak narazíš na nejasnosť mimo open questions zoznamu vyššie, povedz pred
dispatch-om, nehádaj.
