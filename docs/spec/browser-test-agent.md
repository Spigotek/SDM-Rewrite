# Browser Test Agent — Špecifikácia

> Status: **DRAFT** (plan step — čaká na schválenie pred implementáciou).
> Owner: tooling. Konzument: každý hlavný Claude agent + dev pri lokálnom diagnose.

## 1. Cieľ

Definovať **opakovateľne použiteľného sub-agenta**, ktorý vie spustiť Playwright
test v izolovanom anonymnom prehliadači, vrátiť štruktúrovaný výsledok, a byť
**bezpečne spustený N-krát paralelne** bez vzájomnej interferencie (cookie,
storage, MSW state, artefakty).

Use cases:

1. Po implementácii UI feature-y hlavný agent zavolá `browser-test` aby overil
   render + happy path interakciu **bez** otvárania prehliadača rukou.
2. Pri regression hunt: paralelne 4 inštancie agenta drilujú 4 rôzne stránky
   workspace-u, každá so svojím tenant headerom a fixture stavom.
3. Reprodukcia bug-reportu: agent dostane ad-hoc scenár (Playwright snippet)
   a vráti trace + screenshot, ktorý hlavný agent prečíta.

## 2. Mimo scope

- Nie je náhrada za vitest unit/integration vrstvu (`test-strategy.md` § 2).
- Nie je visual regression (Percy / Chromatic — neskôr).
- Nie je cross-browser (MVP iba chromium; webkit + firefox pridáme v Phase I.1).
- **Žiadne performance / load testovanie** — odkladá sa na reálne prostredie
  (staging proti reálnemu CA SDM); LHCI a budgety sa tejto špecifikácie netýkajú.
- Agent **netvorí ani neupravuje source kód** — iba spúšťa scenáre a reportuje.

## 3. Architektúra

```
caller (hlavný agent / user)
   │  Task tool, subagent_type = "browser-test", prompt = scenario contract
   ▼
.claude/agents/browser-test.md       (agent definition — system prompt + tool allowlist)
   │  Bash:
   ▼
tools/browser-test/                  (nový workspace pkg @sdm/browser-test)
   ├ runner.ts                       (CLI entry-point)
   ├ playwright.config.ts            (per-run output, workers=1, reporter list+json)
   ├ fixtures/
   │   └ isolated-context.ts         (custom `test` fixture s anonymnou ctx)
   ├ scenarios/                      (pre-definované Playwright .spec.ts)
   │   ├ smoke-portal.spec.ts
   │   ├ smoke-workspace.spec.ts
   │   ├ tenant-isolation.spec.ts
   │   └ ad-hoc.template.spec.ts
   ├ lib/
   │   ├ run-id.ts                   (krátky hex UUID + path helpery)
   │   ├ artifact-paths.ts           (.playwright/runs/<runId>/...)
   │   └ summary.ts                  (parsuje Playwright JSON report → contract)
   └ package.json
```

**Žiadne nové runtime závislosti** mimo už schválených: `@playwright/test`
(už v root `devDependencies`). Agent definícia je čistý Markdown.

## 4. Izolačný model

### 4.1 Per-invocation izolácia (anonymné okno)

Každé spustenie agenta dostane unikátny **`runId`** (6-hex, napr. `a3f9c1`).
Runner ho propaguje cez env `SDM_BROWSER_TEST_RUN_ID`.

Playwright fixture `isolatedPage`:

```ts
// fixtures/isolated-context.ts (DRAFT)
import { test as base } from "@playwright/test";

export const test = base.extend<{ isolatedPage: Page }>({
  isolatedPage: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: undefined,         // čistá session — žiadne cookie / localStorage
      serviceWorkers: "allow",         // MSW service worker sa musí registrovať
      extraHTTPHeaders: process.env.SDM_BROWSER_TEST_TENANT
        ? { "X-CA-SDM-Tenant": process.env.SDM_BROWSER_TEST_TENANT }
        : undefined,
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});
```

Vlastnosti čerstvého `browser.newContext()`:

- Vlastný cookie jar
- Vlastný localStorage + sessionStorage + IndexedDB
- Vlastná service worker registrácia (= vlastná inštancia MSW + vlastný in-memory
  store `@sdm/api-mocks`, lebo store je singleton **per JS bundle inštanciu**
  v scope SW)
- Vlastný BroadcastChannel scope (`@sdm/api-mocks` ho používa pre cross-tab
  tenant sync per `auth-flow.md` § 4)

Toto stačí na sémantiku "anonymné okno". Žiadne paralelné spustenie agenta
nemôže narušiť stav druhého.

### 4.2 Artefaktová izolácia

| Artefakt | Path |
|---|---|
| Playwright JSON report | `.playwright/runs/<runId>/report.json` |
| Trace zip (per scenár) | `.playwright/runs/<runId>/trace.zip` |
| Screenshoty (on-failure) | `.playwright/runs/<runId>/screenshots/*.png` |
| Video (on-failure) | `.playwright/runs/<runId>/video/*.webm` |
| Browser console log | `.playwright/runs/<runId>/console.log` |
| Network log (HAR) | `.playwright/runs/<runId>/network.har` |
| Ad-hoc spec (ak relevantné) | `.playwright/runs/<runId>/ad-hoc.spec.ts` |
| Súhrn pre caller | `.playwright/runs/<runId>/summary.md` |

`.playwright/` je v `.gitignore` (pridáme — momentálne tam nie je).

Stale runs > 7 dní auto-prune cez `pnpm -F @sdm/browser-test clean` (idempotent
script, NEVER `rm -rf` mimo `.playwright/runs/`). Caller za stale-up nezodpovedá.

### 4.3 Zdielané singletony (vedome)

- **Dev server (Vite portal + workspace)** — JEDEN per port (`5173`, `5175`),
  `strictPort: true`. Agent ho **nereštartuje**, len overí cez `curl -fsI`
  v step `verify-prereqs` (§ 6.1). Ak server neexistuje, agent fail-fast-uje
  s explicit message **"start `pnpm dev` first"** — necháva to userovi /
  hlavnému agentovi.
- **BFF** — voliteľný; ak agent dostane `baseUrl` smerujúci na BFF, predpokladá
  jeho beh. Defaultne SPA + MSW (`VITE_USE_MOCKS=true`), BFF sa nepotrebuje.
- **MSW worker script** — `apps/{portal,workspace}/public/mockServiceWorker.js`
  je sharednutý file (commit-nutý v repo). Žiadny per-run zápis sem.

## 5. Konkurenčný model

| Aspekt | Riešenie |
|---|---|
| N paralelných agent invokácií | OK — každý vlastný `browser.newContext()` ≡ izolovaný |
| Zdielaný Vite dev server | OK — Vite HMR + statické súbory unlimited reads |
| Zdielaný MSW worker file (`/mockServiceWorker.js`) | OK — same file, žiadny mutuje |
| MSW state (in-memory store) | Izolovaný per browser context (service worker scope) |
| Disk: artefakt directory | Per-runId, žiadne race condition (mkdir -p idempotent) |
| Recommended max paralelizmus | **4** (heuristika: ~600 MB RAM / chromium ctx, M-class laptop) |
| Beyond 4 | Caller-side queue. Agent **nezavádza** internal queue / mutex. |

**Žiadne port binding** zo strany agenta — agent nepočúva žiadne porty, len
otvára outbound spojenia (fetch v scenároch + Playwright control protokol
nad lokálnym browser-om).

## 6. Agent kontrakt

### 6.1 Pre-conditions (overí agent pred spustením)

1. `curl -fsI <baseUrl>/` vracia 2xx — dev server beží.
2. `curl -fsI <baseUrl>/mockServiceWorker.js` vracia 200 — MSW worker dostupný.
3. Ak `tenantId` špecifikovaný: musí byť one of `acme-corp`, `globex` (per
   `docs/agents/devex-devops/mock-strategy.md` § Tenants fixture).

Akékoľvek zlyhanie → agent exit 1 + clear remediation message. **Nikdy
neštartuje dev server sám**.

### 6.2 Vstup (prompt formát od caller-a)

Caller pošle prompt v tomto tvare (free text, agent ho parsuje):

```
scenario:        <pre-defined name | "ad-hoc">
baseUrl:         http://localhost:5173 | http://localhost:5175  (default 5173)
tenantId:        acme-corp | globex                              (optional)
expectations:    <free-text — čo by malo prejsť/zlyhať>
adHocSnippet:    |
  ```ts
  test("...", async ({ isolatedPage }) => { ... });
  ```
                 (povinné iba ak scenario === "ad-hoc")
maxDurationMs:   60000                                           (optional, default 60s)
```

Pre-definované `scenario` mená (počiatočný set, rastie):

| Scenario | Cieľ | App |
|---|---|---|
| `smoke.portal` | Portal sa rendere, `/me/tenants` intercept-nuté MSW-om, tenant list viditeľný | portal |
| `smoke.workspace` | Workspace sa rendere, `/api/incidents` intercept-nuté, list >=1 ticket | workspace |
| `mocks.tenant-isolation` | Header switch mení dataset (acme ≠ globex) | portal alebo workspace |
| `mocks.mutation-roundtrip` | POST `/api/incidents` → GET zobrazí novo-vytvorený záznam | workspace |
| `auth.session-cookie` | `/auth/login` nastaví `sdm-active-tenant` cookie, `/me` ho čita | portal |

Implementácia každého scenára žije v `tools/browser-test/scenarios/`.

### 6.3 Výstup (návratová správa caller-ovi)

Agent vracia **iba** tento markdown blok (nič pred, nič za):

```
**Run:** <runId>
**Scenario:** <scenario>
**Result:** passed | failed | aborted
**Duration:** <ms>
**Assertions:** <pass>/<total>
**Artifacts:** .playwright/runs/<runId>/
**Console errors:** <count>
  - <truncated msg 1>
  - <truncated msg 2>
**Network errors:** <count>
  - <method> <url> → <status>
**Notes:** <≤100 word free-text — okrem iného: suspected-flake yes/no>
```

Polia `Console errors` / `Network errors` sú prítomné iba ak `count > 0`.
Pri `Result: aborted` agent uvedie príčinu v `Notes` (typicky: dev server
nedostupný, scenario file neexistuje, timeout pred spustením).

### 6.4 Side-effects — povolené

| Action | Detail |
|---|---|
| Read | Kdekoľvek v repo (kód + `docs/`). |
| Write | **Iba** `.playwright/runs/<runId>/**` (+ `ad-hoc.spec.ts` ak relevantný). |
| Bash | `pnpm -F @sdm/browser-test run -- --run-id=<id> --scenario=<name> [--base-url=...] [--tenant-id=...] [--max-duration-ms=...]`. `curl -fsI` pre health check. **Nič iné.** |

### 6.5 Side-effects — zakázané

- ❌ Modify source v `apps/`, `packages/`, `tools/` (mimo vlastného `.playwright/`)
- ❌ Reštart Vite / BFF / iných procesov
- ❌ `git` (commit, push, branch — nič)
- ❌ Inštalácia balíčkov (`pnpm install`, `npm i`, …)
- ❌ Spustenie iného sub-agenta
- ❌ Auto-retry po failure (caller sa rozhoduje sám)
- ❌ Write mimo `.playwright/runs/<runId>/` (vrátane `.playwright/` root)

Tieto pravidlá sú v system prompte hard-coded a žiadny prompt-injection ich
neprehlasuje.

## 7. Run-id generovanie

`runId` formát: `[0-9a-f]{6}` (regex `^[0-9a-f]{6}$`). Generácia:

```ts
import { randomBytes } from "node:crypto";
export const newRunId = () => randomBytes(3).toString("hex");
```

Caller môže passnúť vlastný `runId` (deterministická reprodukcia), ale runner
**zlyhá** ak directory `.playwright/runs/<runId>/` už existuje (no implicit
overwrite — chráni paralelizmus).

## 8. Implementácia — outline (referenčný kód, nie binding)

### 8.1 `tools/browser-test/package.json`

```json
{
  "name": "@sdm/browser-test",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "run": "tsx runner.ts",
    "clean": "tsx lib/prune.ts",
    "typecheck": "tsc --noEmit",
    "lint": "eslint ."
  },
  "devDependencies": {
    "@playwright/test": "1.49.1",
    "tsx": "4.19.2"
  }
}
```

(Pridať do `pnpm-workspace.yaml` ako `tools/browser-test`.)

### 8.2 `playwright.config.ts` (skica)

```ts
import { defineConfig } from "@playwright/test";
import path from "node:path";

const runId = process.env.SDM_BROWSER_TEST_RUN_ID;
if (!runId) throw new Error("SDM_BROWSER_TEST_RUN_ID env var required");

const outDir = path.join(".playwright", "runs", runId);

export default defineConfig({
  testDir: "./scenarios",
  outputDir: path.join(outDir, "output"),
  workers: 1,                      // jeden scenár per invocation
  fullyParallel: false,
  retries: 0,                      // auto-retry odsúhlasujeme zámerne nie
  reporter: [
    ["list"],
    ["json", { outputFile: path.join(outDir, "report.json") }],
  ],
  use: {
    baseURL: process.env.SDM_BROWSER_TEST_BASE_URL ?? "http://localhost:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
});
```

### 8.3 `runner.ts` (CLI, skica)

```ts
import { spawnSync } from "node:child_process";
import { mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { newRunId } from "./lib/run-id";
import { writeSummary } from "./lib/summary";

const args = parseArgs();                                  // --run-id, --scenario, ...
const runId = args.runId ?? newRunId();
const runDir = path.join(".playwright", "runs", runId);
if (existsSync(runDir)) bail(`run directory ${runDir} already exists`);
mkdirSync(runDir, { recursive: true });

const env = {
  ...process.env,
  SDM_BROWSER_TEST_RUN_ID: runId,
  SDM_BROWSER_TEST_BASE_URL: args.baseUrl ?? "http://localhost:5173",
  ...(args.tenantId ? { SDM_BROWSER_TEST_TENANT: args.tenantId } : {}),
};

// Pre-flight
if (!healthCheck(env.SDM_BROWSER_TEST_BASE_URL)) bailToSummary("dev server unreachable");

const specFile = resolveSpecFile(args.scenario);            // ad-hoc → write to runDir
const result = spawnSync("npx", ["playwright", "test", specFile], { env, stdio: "inherit" });

writeSummary(runDir, { runId, scenario: args.scenario, exitCode: result.status });
process.exit(result.status ?? 1);
```

### 8.4 `.claude/agents/browser-test.md` (skica — finál po schválení)

```markdown
---
name: browser-test
description: Use proactively to run a browser-level Playwright check against
  the SDM SPA (portal/workspace). Spawns an isolated anonymous browser context
  per invocation, so multiple parallel invocations are safe. Reports a
  structured pass/fail + artifact path. Examples:

  <example>
  user: "verify the workspace incident queue renders after my refactor"
  assistant: "I'll launch the browser-test agent with scenario smoke.workspace"
  <Task subagent_type="browser-test" prompt="scenario: smoke.workspace …">
  </example>

  <example>
  user: "smoke-test both apps in parallel for tenant globex"
  assistant: "Spawning two parallel browser-test agents"
  <Task subagent_type="browser-test" prompt="scenario: smoke.portal, tenantId: globex">
  <Task subagent_type="browser-test" prompt="scenario: smoke.workspace, tenantId: globex">
  </example>

tools: Bash, Read, Glob, Grep
model: sonnet
---

You are a browser-test executor for SDM-Rewrite. Your ONLY job is to run a
Playwright scenario in an isolated anonymous browser context and report the
structured result. You do NOT modify source, restart servers, touch git, or
install packages — see "Side-effects forbidden" in
`docs/spec/browser-test-agent.md` § 6.5 (authoritative).

## Workflow (mandatory, in order)

1. Parse the caller's prompt → extract `scenario`, optional `baseUrl`,
   `tenantId`, `expectations`, `adHocSnippet`, `maxDurationMs`.
2. Generate a 6-hex `runId` unless the caller supplied one.
3. Pre-flight: `curl -fsI <baseUrl>/` and `curl -fsI <baseUrl>/mockServiceWorker.js`.
   On failure, report `Result: aborted` and exit (do NOT try to start the dev
   server).
4. If `scenario === "ad-hoc"`, write the snippet to
   `.playwright/runs/<runId>/ad-hoc.spec.ts` first.
5. Invoke `pnpm -F @sdm/browser-test run -- --run-id=<runId>
   --scenario=<scenario> [--base-url=...] [--tenant-id=...] [--max-duration-ms=...]`.
6. Read `.playwright/runs/<runId>/report.json` + `console.log` + `network.har`.
7. Emit the exact markdown block from § 6.3 of the spec.

## Hard rules

- Never write outside `.playwright/runs/<runId>/`.
- Never restart Vite or BFF; if down, report `aborted` with remediation hint.
- Never auto-retry. If you think a failure is flaky, say so in `Notes` — the
  caller re-invokes (new runId).
- Never spawn another sub-agent.
- Never run `git`, `pnpm install`, `npm i`.
- Output ONLY the report block — no preamble, no closing summary.
```

## 9. Test scope rast

Počiatočný scenario set (§ 6.2 tabuľka) → 5 scenárov pokrývajúcich E.1 MSW
intercept. Po každom feature merge sa scenario set rozširuje per
`acceptance-criteria.md` smoke-suite policy (rieši `qa-test-strategy/test-strategy.md`
§ 3 — 5 smoke scenárov per PR). Browser-test agent je **runtime** týchto
scenárov, nie ich generator.

Ad-hoc scenár je vždy dostupný cez `adHocSnippet` — hlavný agent ho použije
na bug-report reprodukciu bez modifikácie `scenarios/` adresára.

## 10. Failure modes & recovery

| Mode | Detekcia | Akcia agenta | Recovery (caller) |
|---|---|---|---|
| Dev server down | health-check fail | `Result: aborted`, hint `start pnpm dev` | spustí dev server, re-invoke |
| Worker file 404 | health-check fail | `Result: aborted`, hint `msw init` | re-vygeneruje worker, re-invoke |
| Scenario file missing | scenario resolver | `Result: aborted`, list dostupných scenárov | opraví prompt |
| Playwright timeout | Playwright runner | `Result: failed`, trace.zip kompletný | analyzuje trace, prípadne re-invoke s vyšším `maxDurationMs` |
| Service worker registration fail | console error captured | `Result: failed`, console.log obsahuje SW error | overí `apps/<app>/public/mockServiceWorker.js`, re-invoke |
| Disk full | mkdir/write throws | `Result: aborted`, hint pre `pnpm -F @sdm/browser-test clean` | uvoľní disk, re-invoke |
| Concurrent runId collision | runner pre-check | exit 1 + clear message | generuje nový runId |
| Flake suspected | agent heuristics (e.g. timeout < 5 % of max + network 0) | `Result: failed`, `Notes: suspected-flake` | re-invoke max 1× (caller policy, agent **neretries**) |

## 11. Otvorené závislosti

| # | Flag | Smer | Popis |
|---|---|---|---|
| 1 | `gitignore-playwright` | → 08-devex | Pridať `.playwright/` do root `.gitignore` pred prvým runom. |
| 2 | `testid-coverage` | → 02-ux + apps | Scenáre používajú `data-testid`; veľká vlna testidov príde s E.3 App Shell. MVP scenáre pre E.1 pokrývajú len existujúce testid-y. |
| 3 | `windows-paths` | → 08-devex | Path joining v `runner.ts` musí byť cross-platform. Win-style separators OK (Node `path` to rieši). Overiť pri CI rozšírení. |
| 4 | `ci-integration` | → 08-devex | Agent samotný v CI neviem dať — CI volá `playwright test` priamo. Agent je **dev-time** nástroj. Spec na CI run smoke suite je v `qa-test-strategy/test-strategy.md` § 4. |
| 5 | `axe-core-integration` | → 09-qa | `@axe-core/playwright` zatiaľ neaktivovaný — pridá sa pri prvom a11y scenári, nie v MVP browser-test pluginu. |
| 6 | `parallel-cap` | → user / docs | Doporučenie max 4 paralelných agentov ako soft limit. Hard limit by zaviedol queueing, ktorý do MVP nepatrí. |

## 12. Akceptačné kritériá pre tento spec

- [ ] User schváli architektúru (§ 3) a izolačný model (§ 4).
- [ ] User potvrdí kontrakt (§ 6) — input/output tvar.
- [ ] User potvrdí side-effect allowlist + denylist (§ 6.4, 6.5).
- [ ] Implementácia bude rozdelená na (a) `tools/browser-test/` pkg, (b)
      `.claude/agents/browser-test.md`. Každé osobitným commitom.
- [ ] Po implementácii: smoke run cez `Task subagent_type="browser-test"` proti
      bežiacemu `pnpm dev` — passes scenario `smoke.portal`.
- [ ] Paralelný smoke run × 2 (`smoke.portal` + `smoke.workspace`) — obidva
      vrátia `passed` bez race condition v artefaktoch.

## 13. Cross-references

- `docs/agents/qa-test-strategy/test-strategy.md` § 2 (E2E vrstva)
- `docs/agents/qa-test-strategy/acceptance-criteria.md` § 1 (18 journeys)
- `docs/agents/qa-test-strategy/mock-strategy.md` § 8 (MSW route fixture)
- `docs/agents/devex-devops/mock-strategy.md` § 4 (browser worker bootstrap)
- `.claude/CLAUDE.md` Step 4c (existujúci `electron-chrome` MCP — paralelná
  cesta pre Electron, nie SPA; nie konflikt)

Perf-related dokumenty (`qa-test-strategy/performance.md`, LHCI config) sú
zámerne nepripojené — odkladané do reálneho prostredia.
