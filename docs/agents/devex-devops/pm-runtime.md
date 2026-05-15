# PM runtime — Claude Agent SDK implementácia

> Project Manager (PM) je **TypeScript CLI** v `apps/pm/`, založený na
> `@anthropic-ai/claude-agent-sdk`. Spúšťa sub-agentov v izolovaných git worktrees,
> validuje výstupy, riadi refinement loop, mergne výsledky a otvára finálny PR.

## Cieľový file-set — `apps/pm/`

```
apps/pm/
├── package.json
├── tsconfig.json
├── tsup.config.ts                      # bundle CLI ako single ESM file
├── bin/
│   └── sdm-pm.mjs                       # shebang shim → dist/cli.js
├── src/
│   ├── cli.ts                          # entry point, argv parsing (commander)
│   ├── orchestrator.ts                 # high-level pipeline state machine
│   ├── agent-runner.ts                 # spustenie 1 agenta cez SDK + hooks
│   ├── revision.ts                     # assembler revision requestu pre round 2..N
│   ├── convergence.ts                  # cross-artifact diff + flag parser + scoring
│   ├── validation.ts                   # validačné checky na outputs.md kontrakty
│   ├── git.ts                          # branch/worktree/commit/merge helpers
│   ├── state.ts                        # .agents/state.json read/write (atomic)
│   ├── flags.ts                        # parser sekcie ## Otvorené závislosti
│   ├── config.ts                       # load pipeline.yaml + .env
│   ├── logger.ts                       # JSONL logger per agent + console pretty
│   ├── types.ts                        # zdielané interfaces
│   └── prompts/
│       ├── revision-request.md.tpl     # template revision promptu
│       └── convergence-diff.md.tpl     # prompt pre cross-artifact diff
├── tests/
│   ├── flags.test.ts
│   ├── revision.test.ts
│   ├── convergence.test.ts
│   ├── state.test.ts
│   └── git.test.ts
└── README.md
```

## `package.json` — kostra

```jsonc
{
  "name": "@sdm/pm",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "bin": {
    "sdm-pm": "./bin/sdm-pm.mjs"
  },
  "scripts": {
    "build":     "tsup",
    "dev":       "tsup --watch",
    "typecheck": "tsc --noEmit",
    "test":      "vitest run",
    "lint":      "eslint src/"
  },
  "dependencies": {
    "@anthropic-ai/claude-agent-sdk": "^0.5.0",
    "commander":                       "^12.1.0",
    "execa":                           "^9.5.2",
    "fs-extra":                        "^11.2.0",
    "p-limit":                         "^6.1.0",
    "picocolors":                      "^1.1.1",
    "yaml":                            "^2.6.1",
    "zod":                             "^3.24.1"
  },
  "devDependencies": {
    "@types/fs-extra": "^11.0.4",
    "@types/node":     "^22.10.0",
    "tsup":            "^8.3.5",
    "typescript":      "^5.7.2",
    "vitest":          "^2.1.8"
  }
}
```

## CLI rozhranie

```
sdm-pm pipeline [options]              # spustí celý pipeline od štartu
sdm-pm pipeline --only 01,04           # len vybraných agentov v round 1
sdm-pm pipeline --resume               # pokračuje z .agents/state.json
sdm-pm pipeline --dry-run              # validuje contracts, nespúšťa agentov
sdm-pm pipeline --max-iterations 5     # override pipeline.yaml hodnoty
sdm-pm status                          # vypíše .agents/state.json prehľadne
sdm-pm validate <agent>                # spustí len validation pre agenta
sdm-pm logs <agent> [--round N]        # vypíše JSONL log konkrétneho agenta
```

## Claude Agent SDK — `agent-runner.ts`

```ts
import { query, type SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { readFile } from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";

export interface AgentConfig {
  id: string;                          // "01-api-analyst"
  name: string;
  description: string;
  tools: string[];
  model: string;
  systemPrompt: string;
  mcpServers: Record<string, unknown>;
  hooks: unknown;
  worktreeDir: string;
}

export async function loadAgentConfig(agentDir: string): Promise<AgentConfig> {
  const agentMd  = await readFile(path.join(agentDir, "agent.md"), "utf-8");
  const focusMd  = await readFile(path.join(agentDir, "focus.md"), "utf-8");
  const inputsMd = await readFile(path.join(agentDir, "inputs.md"), "utf-8");
  const outputsMd = await readFile(path.join(agentDir, "outputs.md"), "utf-8");
  const skillsMd  = await readFile(path.join(agentDir, "skills.md"), "utf-8");
  const prefsMd   = await readFile(path.join(agentDir, "preferences.md"), "utf-8");

  const { frontmatter, body } = parseFrontmatter(agentMd);
  const systemPrompt = [body, "", focusMd, "", inputsMd, "", outputsMd, "", prefsMd, "", skillsMd].join("\n");

  const mcp = JSON.parse(await readFile(path.join(agentDir, "mcp.json"), "utf-8"));
  const hooks = JSON.parse(await readFile(path.join(agentDir, "hooks.json"), "utf-8"));

  return {
    id: path.basename(agentDir),
    name: frontmatter.name,
    description: frontmatter.description,
    tools: frontmatter.tools,
    model: frontmatter.model,
    systemPrompt,
    mcpServers: mcp.mcpServers ?? {},
    hooks: hooks.hooks ?? {},
    worktreeDir: "",                   // doplní orchestrator
  };
}

export async function runAgent(
  cfg: AgentConfig,
  userPrompt: string,
  opts: { cwd: string; runId: string; round: number; onEvent?: (e: SDKMessage) => void },
): Promise<{ exitCode: number; messages: SDKMessage[] }> {
  const messages: SDKMessage[] = [];
  for await (const event of query({
    prompt: userPrompt,
    options: {
      systemPrompt: { type: "preset", preset: "claude_code", append: cfg.systemPrompt },
      allowedTools: cfg.tools,
      mcpServers: cfg.mcpServers,
      hooks: cfg.hooks,
      cwd: opts.cwd,
      model: cfg.model,
      maxTurns: 200,
      permissionMode: "acceptEdits",
    },
  })) {
    messages.push(event);
    opts.onEvent?.(event);
  }
  return { exitCode: 0, messages };
}
```

**Prompt caching** je v SDK aktívny by-default pre `systemPrompt` — system prompt
je veľký (sloučenie 6 markdown súborov) a opakuje sa pri každom turn, takže cache
hit rate sa pri správnom použití dostáva nad 80 %.

**Model**: default `claude-opus-4-7` zhodne s `pipeline.yaml` § `defaults.model`.
Override per-agent cez frontmatter `model:` field.

## Orchestrator — `orchestrator.ts`

State machine s týmito stavmi:

```
INIT → ROUND_1_PHASE_A → VALIDATE_A → ROUND_1_PHASE_B → VALIDATE_B
     → REFINEMENT_LOOP (round 2..N) → POST_CONVERGENCE → FINAL_PR → DONE
```

Pseudokód hlavnej slučky:

```ts
export class Orchestrator {
  constructor(private cfg: PipelineConfig, private state: PipelineState) {}

  async run(): Promise<void> {
    await this.preflight();                    // git status clean, .env present
    await this.git.createIntegrationBranch();  // pipeline/<runId>/integration

    // ROUND 1
    await this.runRound1();
    if (await this.checkConvergence(1)) return await this.postConvergence();

    // ROUND 2..N
    for (let round = 2; round <= this.cfg.refinement.maxIterations; round++) {
      const target = this.selectAgentsForRefinement();
      if (target.length === 0) break;
      await this.runRefinementRound(round, target);
      if (await this.checkConvergence(round)) return await this.postConvergence();
      if (this.detectOscillation()) return await this.escalate("oscillation");
    }
    return await this.escalate("max_iterations");
  }

  private async runRound1(): Promise<void> {
    await this.git.createRoundBranch(1);
    await this.runPhase("a", this.cfg.round1.phaseA.agents);
    await this.validatePhase("a");
    await this.runPhase("b", this.cfg.round1.phaseB.agents);
    await this.validatePhase("b");
    await this.git.mergeRoundIntoIntegration(1);
  }

  private async runPhase(phase: "a" | "b", agentIds: string[]): Promise<void> {
    const limit = pLimit(agentIds.length);
    await Promise.all(
      agentIds.map((id) => limit(() => this.runSingleAgent(id, 1, /*revisionMode*/ false))),
    );
  }

  private async runSingleAgent(id: string, round: number, revisionMode: boolean): Promise<void> {
    const branch = await this.git.createAgentBranch(id, round);
    const worktree = await this.git.createWorktree(id, round, branch);
    const cfg = await loadAgentConfig(path.join(".agents", id));
    const userPrompt = revisionMode
      ? this.revisionAssembler.build(id, round, this.state)
      : this.kickoffPrompt(id, round);
    const result = await runAgent(cfg, userPrompt, {
      cwd: worktree,
      runId: this.state.runId,
      round,
      onEvent: (e) => this.logger.append(id, round, e),
    });
    await this.git.commit(worktree, id, round);
    await this.state.markAgentComplete(id, round, result);
  }
}
```

## Revision assembler — `revision.ts`

Pre round 2..N PM zostavuje user prompt z týchto blokov:

```
<previous-output>
   Kompletný obsah predošlej verzie agentových artefaktov.
</previous-output>

<delta-from-others>
   Pre každého agenta z context_hints (pipeline.yaml), ktorého výstup sa
   medzi rundami zmenil — diff blok markdown.
</delta-from-others>

<revision-request>
   PM-vygenerovaná instrukcia:
   - aké flagy uzatvoriť
   - aké konflikty vyriešiť
   - aké sekcie predošlého výstupu prepracovať
</revision-request>

<round-counter>
   Toto je round <N> z max <M>. Žiadne ďalšie info navyše.
</round-counter>
```

Template v `src/prompts/revision-request.md.tpl`. Assembler:

```ts
export class RevisionAssembler {
  build(agentId: string, round: number, state: PipelineState): string {
    const prev = readPreviousOutputs(agentId);
    const deltas = collectDeltas(agentId, state);
    const flags = collectOpenFlagsAddressedTo(agentId, state);
    const conflicts = collectConflictsAffecting(agentId, state);
    return renderTemplate(REVISION_TEMPLATE, {
      agentId, round, maxRounds: state.maxIterations,
      previousOutput: prev,
      deltas,
      itemsToRevise: [...flags.map(formatFlag), ...conflicts.map(formatConflict)],
    });
  }
}
```

## Convergence — `convergence.ts`

3 signály z `pipeline.yaml`:

```ts
export interface ConvergenceCheck {
  noOpenDependencies: boolean;
  noCrossArtifactConflicts: boolean;
  validationPassed: boolean;
  decision: "exit" | "continue" | "escalate";
}

export async function checkConvergence(state: PipelineState): Promise<ConvergenceCheck> {
  const flags = await parseAllOpenDependencies(state);                     // flags.ts
  const conflicts = await runCrossArtifactDiff(state);                     // LLM call
  const validation = await runValidation(state);                           // validation.ts

  const noOpen = flags.unresolved.length === 0;
  const noConflicts = conflicts.length === 0;
  const validPassed = validation.failures.length === 0;

  return {
    noOpenDependencies: noOpen,
    noCrossArtifactConflicts: noConflicts,
    validationPassed: validPassed,
    decision: noOpen && noConflicts && validPassed ? "exit" : "continue",
  };
}
```

Cross-artifact diff je **LLM-driven** — PM spustí jednorazovo `query({...})`
s promptom „nájdi rozpory medzi týmito artefaktmi", input = concat všetkých H1
sekcií, output = JSON `{conflicts: [...]}`. Použitý model: rovnaký `claude-opus-4-7`,
ale ako single-turn extraction call (žiadne tools, žiadne hooks).

## Validation — `validation.ts`

Validačný kontrakt z `00-project-manager/outputs.md`:

1. Existencia každej cesty deklarovanej v `outputs.md`.
2. Markdown veľkosť > 1024 B.
3. Aspoň 1× H1 + 1× H2 per markdown.
4. JSON syntaktická validnosť.
5. **Prítomnosť `## Otvorené závislosti`** v každom markdown artefakte.

```ts
export async function validateAgentOutputs(agentId: string): Promise<ValidationResult> {
  const outputs = await parseExpectedOutputs(`.agents/${agentId}/outputs.md`);
  const failures: ValidationFailure[] = [];
  for (const expected of outputs.paths) {
    const exists = await pathExists(expected);
    if (!exists) {
      failures.push({ path: expected, kind: "missing" });
      continue;
    }
    if (expected.endsWith(".md")) {
      const content = await readFile(expected, "utf-8");
      if (content.length < 1024) failures.push({ path: expected, kind: "too_small" });
      if (!/^#\s/m.test(content)) failures.push({ path: expected, kind: "no_h1" });
      if (!/^##\s/m.test(content)) failures.push({ path: expected, kind: "no_h2" });
      if (!/^##\s+Otvorené\s+závislosti/m.test(content)) {
        failures.push({ path: expected, kind: "no_open_deps_section" });
      }
    } else if (expected.endsWith(".json")) {
      try { JSON.parse(await readFile(expected, "utf-8")); }
      catch { failures.push({ path: expected, kind: "invalid_json" }); }
    }
  }
  return { agentId, failures };
}
```

## State management — `state.ts`

Atomické zápisy `.agents/state.json` (write-temp + rename), žiadne lock-súbory
(PM je single-process, žiadny concurrent writer).

```ts
import { writeFile, rename, readFile } from "node:fs/promises";

export async function writeStateAtomic(state: PipelineState): Promise<void> {
  const tmp = ".agents/state.json.tmp";
  await writeFile(tmp, JSON.stringify(state, null, 2));
  await rename(tmp, ".agents/state.json");
}
```

Schéma `state.json` — viď `.agents/00-project-manager/outputs.md`. Zod schema
v `src/state.ts` validuje pri každom čítaní.

## Logging — `logger.ts`

JSONL per agent per round, plus pretty console output:

```ts
import { appendFile } from "node:fs/promises";
import path from "node:path";

export class AgentLogger {
  constructor(private runId: string, private logRoot = ".agents/runs") {}

  async append(agentId: string, round: number, event: SDKMessage): Promise<void> {
    const dir = path.join(this.logRoot, this.runId);
    await fs.ensureDir(dir);
    const file = path.join(dir, `${agentId}.jsonl`);
    await appendFile(file, JSON.stringify({ ts: new Date().toISOString(), round, ...event }) + "\n");
    this.prettyConsole(agentId, event);
  }
}
```

## Hooks — odkaz

PM nepíše hooks priamo do agent configu — agent-folder `hooks.json` ich
deklaruje. PM ich len načíta a passne do SDK. Implementácia samotných hook
skriptov (`tools/pm-hooks/*.js`) — viď `pm-hooks.md`.

## Git operácie — odkaz

Branch/worktree management, merge stratégia, PR vytvorenie — viď
`pm-git-strategy.md`. PM volá `git`/`gh` cez `execa` so striktnou error
propagáciou.

## tsup config — bundle CLI

```ts
// apps/pm/tsup.config.ts
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/cli.ts"],
  outDir: "dist",
  format: ["esm"],
  target: "node22",
  splitting: false,
  shims: false,
  clean: true,
  dts: false,
  external: ["@anthropic-ai/claude-agent-sdk"],
});
```

`bin/sdm-pm.mjs`:

```js
#!/usr/bin/env node
import("../dist/cli.js");
```

## Prompt caching — best practice

Z `claude-api` skill: prompt caching má 5-min TTL. PM design ho využíva takto:

- **System prompt** každého agenta je v cache 5 min od prvého volania v rámci
  jednej `query()` slučky. To znamená že **každý turn v rámci jedného agent
  behu** je cache hit.
- Medzi behmi rôznych agentov sa system prompt mení (každý agent má vlastný),
  takže cache miss medzi nimi je očakávaný a neoptimizujeme ho.

Žiadne explicitné cache control kontroly v kóde nepotrebujeme — SDK to robí
automaticky pre `systemPrompt`.

## Error handling

| Chyba | Stratégia |
|---|---|
| Anthropic API rate limit | exponential backoff, max 3 retries, potom escalate |
| Agent SDK timeout | `maxTurns: 200` v `query()` options; nad to → escalate |
| Validation fail | PM rebuilds revision request s explicitnou poznámkou „predošlý beh padol na validation" → re-invoke 1× |
| Git merge conflict | escalate human (žiadny auto-resolve) |
| Network error (gh, git remote) | exponential backoff, max 3 retries, potom human escalation |
| `.env` chýba `ANTHROPIC_API_KEY` | preflight fail, žiadny LLM call |

Žiadny error sa nestratí — všetko ide do JSONL logu **a** do `state.json.errors[]`
pre auditovateľnosť.

## Vstupné body — kde sa PM napája na zvyšok ekosystému

| Komponent | Adresár | Účel |
|---|---|---|
| Agent configs | `.agents/<NN>-<name>/` | Per-agent kontrakt |
| Pipeline config | `.agents/pipeline.yaml` | Phase/refinement/git config |
| Run state | `.agents/state.json` | Pretrvávajúci stav medzi runmi |
| Run logs | `.agents/runs/<runId>/` | JSONL events + summary |
| Worktrees | `.agents/runs/<runId>/worktrees/<NN>-<name>/` | Izolované per-agent FS |
| Hook skripty | `tools/pm-hooks/*.js` | Logovanie a validácia z agentov |
| Output adresár agenta | `docs/agents/<short-name>/` | Cieľ pre artefakty |

## Otvorené závislosti

- `[06-tech-stack-selector]` PM CLI je TypeScript (Node 22). Stack rozhodnutie pre frontend (React vs Angular) **nepôsobí** na PM CLI — ten je oddelený `apps/pm/`. Flag len pre potvrdenie, že Node 22 LTS je akceptovaný v 06.
- `[04-architecture]` Architecture rozhoduje, či PM CLI patrí do `apps/` alebo `tools/`. Default predpoklad: `apps/pm/` (zhodne s GOAL §9 layoutom + `pipeline.yaml` `pm pipeline` skript v root `package.json`). Ak Architecture preferuje `tools/pm/`, premiestnenie je trivial (zmena workspace path).
- `[?]` Verzia `@anthropic-ai/claude-agent-sdk` — `^0.5.0` je placeholder. Pri bootstrape DevOps v Phase C zafixuje aktuálnu stable verziu k dátumu nasadenia (2026-05-15+). API SDK je stable post-1.0; pre prípad pre-1.0 breaking changes monitorujeme changelog.
- `[?]` Cross-artifact diff je single-prompt LLM call — môže by nedeterministický. Mitigation: low temperature (default opus + `temperature: 0` ak SDK podporuje), JSON output cez zod validáciu. Ak sa ukáže ako problém v praxi (>5% false positives), prepneme na deterministický string-diff + regex flag scan.
