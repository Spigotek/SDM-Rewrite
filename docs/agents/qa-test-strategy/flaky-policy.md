# Flaky Test Policy — SDM-Rewrite

## Changelog (round 2)

- r2: žiadna zmena v retry rules ani quarantine workflow.
- Závislosti na 08 r2 vyriešené: flaky detection bot, `flaky-quarantine.txt`
  file format, lint pravidlo pre povinný `beforeEach`/`afterEach` reset —
  všetko `[resolved-in-round-2]` per 08 r2 `ci-cd.md` + `pm-hooks.md`.
- Self-flag (module owner mapping) ostáva — kalibrácia po prvých 4 týždňoch
  implementačnej fázy.

> Flaky test = test, ktorý prejde alebo padne **na rovnakom kóde** s
> nenulovou pravdepodobnosťou. **Žiadny test nesmie byť tolerovaný ako
> flaky bez akcie** — buď sa rieši, alebo karanténuje, alebo maže.

## 1. Definícia flaky a detekcia

Test je označený "flaky" ak v posledných **20 behov** failne **2 alebo
viackrát** bez zmeny kódu produktu / testu. (Dôvod: 1 fail z 20 = 5 % flake
rate — borderline; 2 z 20 = 10 % = jasný signál.)

**Detekcia**: CI ukladá per-test history (test name + commit SHA + result).
Reporter bot vyhodnocuje rolling 20-run window per branch (`main` + last 50
PR branches).

## 2. Retry pravidlá per layer

| Layer | Max retries v rámci behu | Retry strategy |
|---|---:|---|
| Unit | **0** | Žiadny retry. Flaky unit = bug v teste alebo v kóde. |
| Contract | **0** | Žiadny retry. Determinizmus garantovaný (MSW). |
| Component | **0** | Žiadny retry. Real DOM, ale deterministic data + LATENCY = 0. |
| Integration (per-app) | **1** | Jediný retry pre rare async timing edge cases. Po retry: ak ešte failne, real fail. |
| Integration (BFF) | **1** | Rovnaký retry policy ako per-app integration. BFF session in-memory store môže mať race conditions s rapid test seriovania — retry povolený. |
| Contract (BFF vs. CA SDM) | **0** | Determinizmus garantovaný (MSW + Zod schema validation). |
| **E2E** | **2** | Real browser → real timing variability. Max 2 retries per test per beh. |
| Lighthouse | **3 runs (median)** | Štandard LHCI — median sa použije. |
| BFF perf smoke | **3 runs (median per percentile)** | Per-test variabilita; median p50/p95 sa použije. |
| a11y axe | **0** | Determinic check, žiaden retry. |

**Reportovanie**: každý retry generuje warning v CI log + zápis v
`flaky-watch.jsonl`. Bot v PR komentári hovorí "test X retry-ovaný — známka flaky".

## 3. Quarantine workflow

Ak test prekročí flake threshold (§1):

```mermaid
graph TD
    DETECT[Detekcia: 2+ fails z 20 behov] --> ISSUE[Auto-create issue<br/>"flaky-test:<test-name>"]
    ISSUE --> SKIP{test pridaný<br/>do quarantine listu?}
    SKIP -->|no| BLOCK[Block merge<br/>kým niekto rozhodne]
    SKIP -->|yes — owner ack| QUARANTINE[Test beží v 'quarantine' suite,<br/>nepočíta sa do pass/fail]
    QUARANTINE --> SLA[SLA: 7 dní na fix]
    SLA -->|fix| RESTORE[Restore do main suite]
    SLA -->|7 dní vypršalo| DELETE[Test musí byť zmazaný<br/>alebo prepracovaný — block merge]
```

**Quarantine policy**:

- Max **5 testov** v karanténe naraz na celom repe.
- Quarantine list je súbor `tools/flaky-quarantine.txt` (per-test name + ticket ID + ack-er + ack-date).
- Test v karanténe **stále beží** v CI (nightly), ale jeho výsledok **neblokuje** merge.
- Bot reportuje quarantine state v PR komentári (transparentnosť).

## 4. Príčiny flakiness — diagnostic playbook

Postupné kontrolovanie pri vyšetrovaní flaky testu:

| # | Otázka | Ako overiť | Riešenie |
|---|---|---|---|
| 1 | Asynchrónny race? | `await` chýba, `setTimeout` v teste | Použiť `findBy*` / `waitFor` namiesto `getBy*` |
| 2 | Time-dependent assertion? | Test používa `Date.now()` / `new Date()` | Mock cez `vi.useFakeTimers()` / fixed clock |
| 3 | Animation timing? | GSAP / CSS animation prebieha | Disable animations v test env (CSS `@media (prefers-reduced-motion: reduce)` alebo `transition: none` global override) |
| 4 | Random data? | `Math.random()`, neseeded UUIDs | Use seeded RNG faktóriu (`@faker-js/faker` so `seed(42)` — viď `test-data.md` §3) |
| 5 | DOM cleanup? | Test polluje DOM medzi run-mi | `afterEach(cleanup)` |
| 6 | MSW handler order? | Handler nainštalovaný cez race | `server.use()` v `beforeEach`, nie inline v teste |
| 7 | Network latency? | E2E test používa skutočný network | Použiť MSW v Playwright route fixture |
| 8 | Viewport / resize? | Test predpokladá konkrétnu šírku | Set viewport explicitne v `test.use({ viewport })` |
| 9 | localStorage / cookie polution? | Test depend na cleanup | `test.beforeEach(({ context }) => context.clearCookies())` |
| 10 | Parallel test interaction? | Testy zdieľajú DB / fixture súbor | Per-test isolation, žiadne mutating shared state |
| 11 | BFF session store race? | BFF integration test má rapid login/logout cycle | Per-test fresh session store (`createInMemorySessionStore()` per test) |

## 5. Anti-patterns — ako sa flaky testy vyrábajú (a NEROBIŤ)

- **`waitForTimeout(500)`** — len arbitrary sleep. Použiť explicit wait (selector / network response).
- **`expect(value).toBe("loading")` followed by `expect(value).toBe("done")`** bez await medzi.
- **`page.click("button"); page.click("button2")`** bez await — Playwright sync API stačí, ale assertion potom musí počkať.
- **Spoliehanie na poradie testov** — každý test musí byť spustiteľný samostatne.
- **Time zone-dependent assertion** — vždy fix timezone v CI (`TZ=UTC`).
- **`Math.random()` na výber test scenára** — non-deterministic.
- **Polled assertion bez timeout** — môže visieť navždy.

## 6. Per-test lifecycle hygiene (povinný kontrakt)

Každý test layer musí:

| Hook | Ack |
|---|---|
| `beforeAll` | Žiadny global mutating side-effect okrem MSW server start. |
| `beforeEach` | Reset MSW handlers (`server.resetHandlers()`), reset localStorage, reset fake timers, **clear audit log sink** (`clearAuditLog()` z `@sdm/api-mocks/audit`). |
| `afterEach` | DOM cleanup (`cleanup()` z RTL), close any modal/drawer left open. |
| `afterAll` | MSW server close. |

CI overuje cez **lint pravidlo** `eslint-plugin-test-hygiene` (custom rule
implementovaná v 08 r2 `repo-bootstrap.md`), že každý `*.test.ts` má aspoň
`beforeEach` + `afterEach` resetting.

## 7. CI reporting

Bot komentár v PR:

```
QA Bot — Flaky check
─────────────────────
PR #123 → Affected tests:

✓ 1842 tests passed
⚠ 1 test retried but eventually passed:
   - workspace-incident-triage.spec.ts → "Anna prepne tenant mid-flow"
     (passed on retry 1)
   → Watch list: 1/2 failures in last 20 runs. If 2/20 reached → auto-quarantine.

🔴 0 tests in quarantine
```

**Pri 2/20 failures** bot otvorí issue `flaky-test: <name>` a označí
príslušného owner-a (last committer + designated module owner).

## 8. Eskalácia

| Trigger | Eskalácia |
|---|---|
| 3+ testov v karanténe naraz | Module owner musí zaintegrovať fix do najbližšieho sprintu |
| 5+ testov v karanténe naraz | **Block všetkých nových PR** v module kým sa nezníži pod 3 |
| Quarantine SLA prekročený | Test zmazaný + nahradený lepším — bez výnimky |
| `main` failne 3× za týždeň kvôli rovnakému testu | Test okamžite quarantined cez emergency commit; owner riešenie do 24h |

## Otvorené závislosti

- `[08-devex-devops]` Flaky detection bot — `[resolved-in-round-2]` per 08 r2
  `ci-cd.md` (GitHub Actions workflow + JSON history file v artifact storage).
- `[08-devex-devops]` `flaky-quarantine.txt` file format + lint rule pre
  povinné `beforeEach`/`afterEach` — `[resolved-in-round-2]` per 08 r2
  `repo-bootstrap.md` (`eslint-plugin-test-hygiene` config).
- `[09-qa]` Owner mapovanie (kto je "module owner" pre flaky test
  responsibility) — Závisí od finálnej team structure. Default: last committer.
  Self-flag, kalibrácia po prvých 4 týždňoch implementačnej fázy.
