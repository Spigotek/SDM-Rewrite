# H.16 — Acceptance criteria smoke (close Phase H)

> **Status**: 🔜 (blokované na H.0-H.15 merge — final Phase H chunk)
> **Branch**: `chunk/H.16-acceptance-smoke` > **Persona**: all 6 personas (Lucia, Anna, Marek, Peter, Jana, Robert)
> **Cieľ**: end-of-Phase-H verification — pre všetkých **18 acceptance
> journeys** z `qa-test-strategy/acceptance-criteria.md §2` napísať
> browser-test scenár (alebo verify že existuje z prechádzajúcich chunkov).
> Goal: smoke pass na MVP scope, žiadna feature regression.

## Pivot vs ROADMAP

ROADMAP Phase H exit criteria: _"acceptance kritérium z `qa-test-strategy/acceptance-criteria.md` zelené pre danú feature"_. H.16 zatvára smyčku.

Per `H.md §Phase H exit criteria`: 18 journeys must pass in integration alebo browser-test mode.

## Inputs

- **`docs/agents/qa-test-strategy/acceptance-criteria.md` §2 (18 journeys)**.
- **`docs/agents/qa-test-strategy/acceptance-criteria.md` §3 (cross-cutting AC)**.
- **`docs/agents/qa-test-strategy/acceptance-criteria.md` §4 (security test vectors — read-only here; full security audit je Phase I.2)**.
- **`tools/browser-test/scenarios/`** — existing scenarios z E.3 + F.x + G.x + H.0-H.15.
- All `H.X.md` plans (browser test scenarios z each chunk).

## Outputs

```
tools/browser-test/scenarios/acceptance/
├── journey-01-portal-incident.spec.ts          # Lucia: broken laptop → submit → ticket ID
├── journey-02-portal-request-software.spec.ts  # Lucia: request via catalog
├── journey-03-portal-kb-self-help.spec.ts      # Lucia: search KB → article → no ticket
├── journey-04-workspace-triage.spec.ts         # Anna: queue → open ticket → triage
├── journey-05-workspace-resolve-cmdb.spec.ts   # Anna: resolve with CI context
├── journey-06-workspace-escalate-l2.spec.ts    # Anna → Marek L2 escalation
├── journey-07-workspace-problem-rca.spec.ts    # Marek: problem RCA
├── journey-08-workspace-cmdb-impact.spec.ts    # Robert: CMDB impact analysis
├── journey-09-workspace-incident-deepdive.spec.ts
├── journey-10-workspace-change-cab-prep.spec.ts  # Peter: CAB meeting prep
├── journey-11-workspace-change-emergency.spec.ts # Peter: emergency approve (step-up)
├── journey-12-workspace-change-cross-tenant.spec.ts
├── journey-13-workspace-kb-author-new.spec.ts    # Jana: read existing + plan article (read-only in MVP)
├── journey-14-workspace-kb-from-incident.spec.ts # Marek: link KB to ticket
├── journey-15-workspace-kb-analytics.spec.ts     # Jana: read analytics (read-only)
├── journey-16-workspace-cmdb-ci-detail.spec.ts
├── journey-17-workspace-cmdb-relationships.spec.ts
└── journey-18-workspace-cmdb-cross-tenant.spec.ts

docs/agents/qa-test-strategy/acceptance-coverage.md   # NEW: matrix of journey → spec scenario file → status
docs/ROADMAP.md                                       # Phase H ✅ DONE (16/16 chunks)
docs/plans/H.16.md                                    # tento súbor → Status DONE
```

## Done-when

- [ ] Each of **18 journeys** has a browser-test scenario file. Multiple journeys can reuse a single scenario if they overlap (e.g., #1 + #4 + #5 share parts of incident flow).
- [ ] Each scenario uses MSW mock mode (`VITE_USE_MOCKS=true`) by default; subset can target live BFF + CA SDM (per F.6 smoke patterns).
- [ ] **Pass criteria** per scenario: all `screen` + `interaction` + `expected outcome` steps from `acceptance-criteria.md §2.X` are verified via assertions.
- [ ] **Coverage matrix** v `acceptance-coverage.md`: per journey → scenario file → status (pass/fail/deferred). Deferred journeys (e.g., #11 emergency approve if step-up auth not v MVP) explicitly listed.
- [ ] Cross-cutting AC (§3): authn/authz, idle timeout, tenant scope, audit log emit — verified across journey scenarios (e.g., tenant switch test in journey #12).
- [ ] `pnpm browser-test` runs all scenarios in CI. Single failed scenario blocks merge.
- [ ] **Security vectors §4**: read-only verification — H.16 lists which §4 vectors are tested where; vectors not covered v Phase H deferred to Phase I.2.
- [ ] No new BFF or FE feature code v H.16 — pure test additions + acceptance coverage doc.
- [ ] ROADMAP: H.16 → ✅ DONE; Phase H → ✅ DONE (16/16).

## Stratégia

### Fáza A — Audit existing scenarios

1. List all scenarios z `tools/browser-test/scenarios/` post-H.15 merge.
2. Map každú existing scenario na journey ID(s) v `acceptance-criteria.md §2`.
3. Identify gaps — journeys without matching scenario.

### Fáza B — Write missing scenarios

1. Per gap journey: write `journey-NN-<slug>.spec.ts` following pattern (login → navigate → interact → assert).
2. Reuse common helpers from `tools/browser-test/_helpers/` (likely from F.x + G.x).
3. **Minimize new browser test infra** — reuse existing harness.

### Fáza C — Coverage matrix + CI + PR

1. Write `acceptance-coverage.md` matrix.
2. Verify all scenarios run in CI (`.github/workflows/ci.yml` or `perf-nightly.yml` — recommend dedicated `acceptance.yml` if duration > 10 min).
3. `pnpm -r typecheck/lint/test/build` green + all 18 browser tests pass.
4. ROADMAP + Phase H exit refresh + PR.

## Open questions / risks

- **Live BFF vs MSW mode**: ROADMAP exit criteria says "proti reálnemu BFF + CA SDM". Most browser tests target MSW (CI doesn't have CA SDM access). **Recommend**: MSW for CI gate (block merge), live smoke (subset) as `acceptance-live.yml` workflow run manually pre Phase I.
- **Deferred journeys**: #11 (emergency step-up) si možno nemá MVP impl. Mark deferred explicitly, target Phase I.
- **CI duration**: 18 Playwright scenarios × ~30 s each = 9 min. Add to `perf-nightly.yml` (off main critical path) alebo dedicated workflow.
- **Visual regression**: optional — `library-recommendation.md §Validácia` mentions Chromatic. **Out of H.16 scope**; Phase I covers.

## Notes pre subagenta

- H.16 je **last Phase H chunk** — celá Phase G+H je effectively final post-merge.
- Reuse harness z F.x browser tests (`tools/browser-test/_helpers/`).
- Subagent **NESMIE** merge own PR — parent merguje, refreshne ROADMAP Phase H ✅ DONE, posunie Phase I na 🔜 NEXT.
