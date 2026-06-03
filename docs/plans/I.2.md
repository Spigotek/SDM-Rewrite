# I.2 — Security audit sweep (CodeQL + Trufflehog + axe + multi-browser)

> **Status**: 🚧 in-flight (PR open)
> **Branch**: `chunk/I.2-security-audit` > **PR**: TBD
> **Cieľ**: enable automated security scanning (CodeQL workflow, Trufflehog
> secret scan, pnpm audit hardening), pridať axe browser sweep per route, rozšíriť
> Playwright matrix o Firefox + WebKit, implementovať BroadcastChannel multi-context
> test rig. Closes všetky §4 security test vectors označené `deferred → Phase I.2`.

## Pivot vs ROADMAP

Per ROADMAP §Phase I: "I.2 Security audit — CodeQL + Trufflehog + pnpm audit +
Snyk/Semgrep eval. Inputs: `security/owasp-mitigations.md`." — I.2 implementuje
tooling, NIE post-hoc audit (pen-test je out-of-scope, externý).

H.16 coverage matrix: §4.1-§4.6 majú multiple `deferred → Phase I.2` rows.
C6 (a11y axe sweep), C8 (browser matrix), C9 (silent re-auth — I.1 territory).

## Inputs

- **`docs/agents/security/owasp-mitigations.md`** — autoritatívne security stack.
- **`docs/agents/qa-test-strategy/acceptance-criteria.md` §4** — všetky security test vectors.
- **`docs/agents/qa-test-strategy/a11y-tests.md`** — axe sweep spec.
- **`.github/workflows/ci.yml`** — existing CI gates (lint, typecheck, test, build, size, i18n).
- **`tools/browser-test/playwright.config.ts`** — current Desktop Chrome only.
- **`apps/{portal,workspace}/src/main.tsx`** + `shell/session-context.tsx` — BroadcastChannel cross-tab sync infrastructure pre `tenant-changed` event (H.1).

## Outputs

```
.github/workflows/security.yml             # NEW: CodeQL (TS + JS) + Trufflehog secret scan, runs on push + nightly cron
.github/workflows/ci.yml                   # MOD: pnpm audit step graduated `medium` → `high` (was `high`, verify); axe sweep step
tools/browser-test/playwright.config.ts    # MOD: projects = [chromium, firefox, webkit]; matrix per env var
tools/browser-test/scenarios/security/     # NEW dir
├── axe-sweep-portal.spec.ts               # axe-core/playwright sweep per portal route
├── axe-sweep-workspace.spec.ts            # axe-core/playwright sweep per workspace route
├── cross-tab-logout.spec.ts               # multi-context: logout in tab A → tab B sees session gone
├── cross-tab-tenant-sync.spec.ts          # multi-context: tenant switch in tab A → tab B refetches
├── csrf-mutation.spec.ts                  # POST without Origin header → 403 (per F.1 CSRF check)
└── session-refresh-silent.spec.ts         # silent re-auth on 401 (I.1 territory verification)

apps/bff/tests/security/                   # NEW dir for security integration tests
├── rbac-server-side.test.ts               # BFF enforces RBAC server-side (not just FE)
├── tenant-isolation-sweep.test.ts         # cross-tenant data leak per endpoint
├── audit-log-emission.test.ts             # every mutation emits audit per F.4 taxonomy
└── token-replay.test.ts                   # session token + step-up token replay protection

apps/{portal,workspace}/package.json       # +devDeps: @axe-core/playwright, playwright firefox/webkit browsers
.github/workflows/acceptance.yml           # MOD: matrix runs all 18 journeys × {chromium, firefox, webkit}

docs/agents/qa-test-strategy/acceptance-coverage.md # UPDATE: §4 vectors covered
docs/ROADMAP.md
docs/plans/I.2.md
```

## Done-when

- [ ] **CodeQL** workflow runs na PR + nightly. Severities `high` + `critical` block PR. Coverage: TypeScript + JavaScript (Node + browser).
- [ ] **Trufflehog** secret scan runs na PR + nightly. Verified findings block merge.
- [ ] **`pnpm audit --audit-level=high`** runs v CI per PR; `--audit-level=critical` v ci.yml fails build.
- [ ] **axe sweep**: per portal + workspace route browser test scenario uses `@axe-core/playwright` → 0 serious/critical violations. Wired ako separate step v `acceptance.yml`.
- [ ] **Playwright matrix**: 18 acceptance journeys + smoke tests run × 3 browsers (chromium, firefox, webkit). Firefox + WebKit failures block PR (matrix strategy v acceptance.yml).
- [ ] **Cross-tab rig**: `cross-tab-logout.spec.ts` + `cross-tab-tenant-sync.spec.ts` use Playwright `browser.newContext()` × 2 → assert sync via BroadcastChannel.
- [ ] **CSRF**: `csrf-mutation.spec.ts` — POST `/api/incidents` bez `Origin` header → 403 per F.1 CSRF check.
- [ ] **BFF security tests**: rbac server-side enforcement matrix, tenant isolation sweep per endpoint, audit emission per mutation, token replay protection (uses I.1 step-up infra).
- [ ] §4 acceptance vectors `deferred → Phase I.2` updated: `auth-state-mismatch`, `auth-nonce-mismatch`, `auth-audience-confusion`, `csrf-mutation`, `cross-tab-logout`, `cross-tab-tenant-sync-l4`, `tenant-error-shape-l5`, `tenant-activity-log-leak-l8`, `tenant-telemetry-l11`, `tenant-race-l12`, `tenant-deep-link-l13`, `tenant-bootstrap-claim-l15`, `tenant-suspension`, `rbac-role-stale`, `rbac-server-side-enforcement`, `rbac-object-level-authorization`, `rbac-bulk-limit-per-role`, audit-log emission vectors → covered.
- [ ] C6 (a11y) `partial` → `pass`; C8 (browser matrix) `deferred` → `pass`.

## Stratégia

### Fáza A — Static analysis workflows

1. `.github/workflows/security.yml`:
   ```yaml
   name: security
   on: { pull_request: {}, push: { branches: [main] }, schedule: [{ cron: "0 3 * * *" }] }
   jobs:
     codeql:
       runs-on: ubuntu-latest
       permissions: { security-events: write, contents: read }
       steps:
         - uses: actions/checkout@v4
         - uses: github/codeql-action/init@v3
           with: { languages: javascript, typescript }
         - uses: github/codeql-action/analyze@v3
     trufflehog:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
           with: { fetch-depth: 0 }
         - uses: trufflesecurity/trufflehog@main
           with: { extra_args: --only-verified }
   ```
2. `ci.yml` pnpm audit step verification — graduate ak nutné.

### Fáza B — axe + multi-browser

1. `pnpm add -D @axe-core/playwright -F @sdm/portal -F @sdm/workspace`. Workspace + portal browser tests harness shared (`tools/browser-test/`).
2. `tools/browser-test/playwright.config.ts`:
   ```ts
   export default defineConfig({
     projects: [
       { name: "chromium", use: { ...devices["Desktop Chrome"] } },
       { name: "firefox", use: { ...devices["Desktop Firefox"] } },
       { name: "webkit", use: { ...devices["Desktop Safari"] } },
     ],
     // ... rest
   });
   ```
3. `axe-sweep-{portal,workspace}.spec.ts`:
   ```ts
   import AxeBuilder from "@axe-core/playwright";
   test("portal / no a11y violations", async ({ page }) => {
     await page.goto("/");
     const results = await new AxeBuilder({ page }).analyze();
     const serious = results.violations.filter(
       (v) => v.impact === "serious" || v.impact === "critical",
     );
     expect(serious).toEqual([]);
   });
   ```
   Repeat per route (8 portal + 10 workspace).
4. `acceptance.yml` matrix strategy:
   ```yaml
   strategy:
     fail-fast: false
     matrix:
       browser: [chromium, firefox, webkit]
   ```

### Fáza C — BroadcastChannel rig + BFF security + PR

1. `cross-tab-logout.spec.ts` uses `browser.newContext()` × 2:
   ```ts
   test("logout in tab A → tab B sees session gone", async ({ browser }) => {
     const ctxA = await browser.newContext();
     const ctxB = await browser.newContext();
     const pageA = await ctxA.newPage();
     const pageB = await ctxB.newPage();
     // login both, navigate
     // logout in A → assert B redirected to /login within 2s
   });
   ```
2. `cross-tab-tenant-sync.spec.ts` analogically — tenant switch in A reflects in B per H.1 BroadcastChannel.
3. BFF security integration tests pod `apps/bff/tests/security/`:
   - `rbac-server-side.test.ts`: per persona × per endpoint matrix — does BFF reject if FE bypassed?
   - `tenant-isolation-sweep.test.ts`: per endpoint, fetch s tenant A session, query resource owned by tenant B → assert 404 (not 403, per security best practice).
   - `audit-log-emission.test.ts`: every mutation in F.4 taxonomy emits exactly one event with correct shape.
   - `token-replay.test.ts`: step-up token used twice → second call 401; session token after logout → 401.
4. CI must run all new workflows + tests; matrix CI duration ~15 min acceptable.
5. Update coverage matrix.

## Open questions / risks — recommended resolutions

- **WebKit / Firefox compatibility breakage**: post-graduation niektoré tests môžu failnúť na non-Chromium. **Recommendation**: subagent inspects failures, fixes if FE bug (likely vendor-prefix CSS or unsupported API); ak je to test-only issue, fix test. Žiadny FE workaround ktorý degraduje Chromium UX.
- **CodeQL false positives**: typical TS/JS lint findings (sql-injection na string concat etc.). Triage — comment-out s `// codeql[js/...]: justified` ak truly false positive. Real findings = blocker.
- **Trufflehog historical commits**: full-history scan môže nájsť deleted secrets v `pnpm-lock.yaml` or test fixtures. `--only-verified` flag obmedzí na verified (live) secrets. Repo má test seeds (e.g. `JBSWY3DPEHPK3PXP` TOTP) ktoré nie sú prod — ensure not flagged. Whitelist v `.trufflehogignore` if needed.
- **axe-core regressions**: existing UI passed unit-level a11y tests (G.1); per-route sweep môže odhaliť integration bugs (focus traps, ARIA roles). Fix per finding.
- **Multi-browser CI time**: 18 × 3 = 54 Playwright runs. Acceptable do ~20 min.

## Notes pre subagenta

- CodeQL + Trufflehog sú GitHub-native (žiadne external services). Snyk / Semgrep evaluated v G.4 a rejected per budget — NIE re-evaluating.
- Playwright multi-browser browser install: `pnpm exec playwright install firefox webkit` v CI.
- Subagent **NESMIE**:
  - Spustiť externý pen-test (out of scope — owasp-mitigations.md §13 footnote).
  - Pridať Snyk/Semgrep paid tier.
  - Mergovať vlastný PR.
