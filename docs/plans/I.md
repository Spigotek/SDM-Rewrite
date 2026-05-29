# Phase I — Acceptance + production hardening + v1.0 cut

> Cieľ fázy: zatvoriť všetky Phase H exit-criteria gaps (LHCI timing graduation +
> 18/18 strict acceptance pass), spraviť security/multi-tenancy hardening,
> dotiahnuť v1+ features potrebné pre 18/18 (KB editor + SP cockpit) a uzavrieť
> v1.0 release (helm staging dry-run + semver tag + OCI publish + release notes).
> **8 chunkov** (I.0 → I.7), sekvenčný dispatch.

## Phase I entry criteria

- ✅ Phase H merged (17/17 chunkov: H.0 routing → H.16 acceptance smoke).
- ✅ ROADMAP Phase H ✅ DONE; `docs/agents/qa-test-strategy/acceptance-coverage.md` matrix existuje.
- ⏳ LHCI timing thresholds všetkých routes ostávajú `warn` — H.0/H.4/H.7/... commenty dokumentujú blocker (`/config` 404 v staticDistDir). I.0 to napraví.
- ⏳ 6 partials + 1 deferred journey z H.16 čaká na uzavretie cez I.1/I.4/I.5.

## Phase I exit criteria (Done-when celá I)

- **LHCI timing thresholds graduated `warn` → `error`** per všetkých H.X routes (TTI/LCP/score per `performance.md §2`). Phase H exit criterion #5 splnený.
- **18/18 acceptance journeys strict pass** v `acceptance.yml` CI workflow. `acceptance-coverage.md` matrix má `pass` pre všetky riadky, žiadne `partial` ani `deferred`. Phase H exit criterion #1 splnený.
- **Security audit clean**: CodeQL + Trufflehog + `pnpm audit --audit-level=high` všetky green; axe sweep no serious/critical violations; multi-browser Playwright matrix (Chrome/Firefox/WebKit) všetky CI gates green.
- **Multi-tenancy edges hardened**: všetky §4.2 security vectors v `acceptance-criteria.md` covered alebo explicitly accepted-risk; cross-tab BroadcastChannel rig functional.
- **Release dry-run validated**: helm install do staging cluster succeeds; smoke 18 journeys proti **live BFF + CA SDM 17.4** green; rollback test successful.
- **v1.0 tagged + published**: semver `v1.0.0` git tag; portal/workspace/BFF images pushed do registry; helm chart published ako OCI artifact; release notes v `CHANGELOG.md`.
- ROADMAP Phase I → ✅ DONE; project status = **v1.0 RELEASED**.

## Cross-chunk decisions

### D1 — Per-chunk PR-flow (per memory `pr-flow`)

Identicky ako G/H: branch z fresh main, jedna PR per chunk, squash --admin
--delete-branch. **Žiadne stacked PR**. Sekvenčný subagent dispatch (proven
v G+H) — general-purpose subagent dostane self-contained brief, parent agent
verify + merge + ROADMAP toggle.

### D2 — Sequencing (I.0 → I.7, blocking arrows)

```
I.0 LHCI graduation (infra unlock)
 ├→ I.1 step-up 2FA + emergency approve + RHF race fix
 ├→ I.2 security audit sweep
 │   └→ I.3 multi-tenancy edge cases
 │       └→ I.5 SP cockpit / cross-tenant view (depends on I.3 BroadcastChannel + tenant scoping)
 ├→ I.4 KB authoring (independent of security/tenancy)
 └→ I.6 release v1.0 dry-run                ← blokuje na všetkých I.0-I.5
     └→ I.7 v1.0 cut                        ← blokuje na I.6
```

Strict sekvenčný dispatch — žiadny paralelný implementation subagent.
**Pre-flight research subagenty** (read-only audit existing infra) môžu byť
dispatched paralelne pred implementation subagentom, ak parent agent toleruje
context bloat — to znižuje implementation subagent token usage.

**Recommended dispatch order**:
I.0 → I.1 → I.2 → I.3 → I.4 → I.5 → I.6 → I.7.

### D3 — Tech stack additions

Phase I **pridáva**:

- **TipTap 2** + `@tiptap/starter-kit` + `@tiptap/extension-link` + `@tiptap/extension-table` + `@tiptap/extension-image` — pre I.4 KB editor (per `library-recommendation.md` r2).
- **DOMPurify 3** — sanitization pre TipTap output (per `owasp-mitigations.md` §XSS).
- **`@playwright/test` browsers** (firefox, webkit) — pre I.2 multi-browser matrix. Existing Playwright config len Desktop Chrome.
- **`@axe-core/playwright`** — pre I.2 axe sweep per route v existing browser-test scenarios.
- **`speakeasy`** alebo native `node:crypto` HOTP/TOTP — pre I.1 step-up 2FA backend. Recommendation: native `node:crypto` (žiadny nový BFF dep).

Phase I **NEPRIDÁVA** nič mimo zoznam vyššie. Žiadny scope kreep.

### D4 — Test infrastructure reuse

- `tools/browser-test/` harness ostáva — Playwright runner, scenarios, helpers per F.x/G.x/H.x.
- `acceptance.yml` workflow (H.16) sa rozširuje per I.2 o multi-browser matrix.
- **Live BFF smoke**: `acceptance-live.yml` workflow (manuálne triggered) bude validovaný v I.6 pred release dry-run.

### D5 — BFF endpoint augmentations allowed

Phase I môže pridať BFF endpoints **iba** ak existujú v `acceptance-criteria.md`
ako deferred (linked-incidents, KB write/publish, SP impersonation, attachments).
Žiadny iný BFF refactor. Žiadny redesign existing endpoints.

### D6 — Audit taxonomy stále frozen

F.4 taxonomy (`data.<entity>.{write,delete}` + `authz.tenant.switch.*` +
`authn.login.*`) ostáva frozen. Nové operations používajú existing event names
s `details.op` discriminator (per H.11 precedent: `cab.approve`/`cab.reject`).

### D7 — Bundle budget discipline

Phase I additions **nesmú** prekročiť initial JS budgets:

- Portal **180 KB** initial JS (po I.x updates). KB editor (TipTap ~70 KB) **MUSÍ byť lazy chunk** per H.6 markdown precedent.
- Workspace **350 KB** initial JS. TipTap + DOMPurify ako `vendor-editor` lazy chunk.
- Žiadny cap relaxation initial JS — vendor caps môžu byť tuned per chunk (per H.7/H.14 precedent).

### D8 — i18n string scope per chunk

Per G.2 plán: feature module strings idú per chunk. Každý I.X chunk pridá
do `packages/i18n/catalogs/{portal,workspace,shared}/{sk,en}.json` len strings
ktoré jeho feature renderuje. `pnpm i18n:check` gate-uje parity per PR.

### D9 — LHCI thresholds final graduation

Po I.0 musia byť **všetky** H.X routes v `lighthouserc.json` `assertions` ako
`error` (nie `warn`). I.0 commitne graduation; I.1-I.5 chunky ktoré pridajú
nové routes (napr. I.4 `/kb/editor`) graduate-ujú **per same PR** (rovnaký
pattern ako G.4 zaviedol).

### D10 — Release artefakty

- **Registry**: existing private registry (per `deploy_target.md` memory — 10.11.36.21, port 88).
- **Helm OCI**: chart `deploy/helm/sdm/` published ako OCI artifact do existing registry alebo public chart repo (TBD per I.7 open question).
- **Image tags**: `v1.0.0` + `v1.0` + `latest` per `release.yml` workflow existing pattern.
- **Release notes**: `CHANGELOG.md` aggregates per-phase summaries (E + F + G + H + I).

## Outputs Phase I (high-level)

```
apps/bff/src/auth/step-up.ts                              # I.1
apps/workspace/src/features/changes/components/StepUpModal.tsx   # I.1
apps/portal/src/features/catalog/                         # I.1 RHF fix (existing)
apps/workspace/src/features/kb/editor/                    # I.4 (new feature dir)
apps/workspace/src/features/cmdb/sp-cockpit/              # I.5 (new feature dir)
apps/bff/src/api/endpoints/kb-write.ts                    # I.4
apps/bff/src/auth/sp-impersonation.ts                     # I.5
apps/bff/tests/security/*.test.ts                         # I.2
tools/browser-test/scenarios/security/*.spec.ts           # I.2-I.3
tools/browser-test/playwright.config.ts                   # I.2 (multi-browser)
.github/workflows/{security.yml,acceptance-live.yml}      # I.2 + I.6
deploy/helm/sdm/                                          # I.6/I.7 (helm OCI publish)
docs/CHANGELOG.md                                         # I.7 (NEW)
docs/RELEASE-NOTES-v1.0.md                                # I.7 (NEW)
docs/plans/I.{0..7}.md                                    # detail plans (this dir)
docs/ROADMAP.md                                           # toggle per chunk + Phase I → DONE
```

## Per-chunk index

| Chunk   | Title                                         | Spec / Inputs                                                          | Persona / Scope        |
| ------- | --------------------------------------------- | ---------------------------------------------------------------------- | ---------------------- |
| **I.0** | LHCI graduation (MSW-in-LHCI)                 | `performance.md §2`, H.0 LHCI commentary                               | DevEx / Perf gate      |
| **I.1** | Step-up 2FA + emergency approve + RHF fix     | `security/auth-flow.md` §step-up, F.1 doc, H.11/H.16 follow-ups        | Security + UX          |
| **I.2** | Security audit sweep                          | `security/owasp-mitigations.md`, `acceptance-criteria.md §4`           | Security audit         |
| **I.3** | Multi-tenancy edge cases                      | `spec/multi-tenancy.md` §edges, `acceptance-criteria.md §4.2`          | Multi-tenancy + BFF    |
| **I.4** | KB authoring (TipTap + DOMPurify + publish)   | `spec/knowledge-management.md`, `wireframes/workspace/04-kb-editor.md` | Jana (kb_editor)       |
| **I.5** | SP cockpit / cross-tenant view                | `spec/multi-tenancy.md` §SP_ADMIN, `wireframes/shared/sp-cockpit.md`   | Service Provider admin |
| **I.6** | Release v1.0 dry-run (helm staging)           | `system-overview.md` §Release, `deploy/helm/sdm/`                      | DevOps                 |
| **I.7** | v1.0 cut (semver tag + image push + OCI helm) | `release.yml` workflow, `CHANGELOG.md`                                 | Release                |

## Notes

- **Detail plány I.0-I.7** sa píšu spolu s týmto overview-om (same-session writing).
- **Subagent pattern** (proven Phase G+H): parent agent merguje, subagent NIKDY.
- **Phase I rozšírený scope** vs pôvodný ROADMAP I.1-I.5: pridané I.0 (LHCI) + I.4 (KB editor — v1+ pulled in pre journey #13 closure) + I.5 (SP cockpit — v1+ pulled in pre journey #12+#18 closure). Pôvodný I.4 (release dry-run) → I.6; pôvodný I.5 (v1.0 cut) → I.7.
- **Post-Phase I**: project = **v1.0 released**. Žiadna Phase J plánovaná. v1+ scope features mimo pulled-in (mobile PWA offline, advanced calendar drag-resize, KB analytics widgets, bulk-ops) sa plánujú **post-release** v separate sequencing dokumente.
