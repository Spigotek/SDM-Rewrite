# PM hook skripty — `tools/pm-hooks/*.js`

> Kontrakt a vzorové telá pre 3 hook skripty, ktoré PM (a každý sub-agent) volá
> cez Claude Agent SDK hooks API. Skripty bežia ako **detached node processes**
> pri každom hook evente.
>
> Hooks JSON kontrakt deklaruje `.agents/00-project-manager/hooks.json` (PM)
> alebo per-agent `hooks.json`. Sub-agenti dnes nedeklarujú vlastné hooky —
> PM-level je dostatočný pre audit.

## Hook udalosti — z `.agents/00-project-manager/hooks.json`

```json
{
  "hooks": {
    "SubagentStart": [
      { "matcher": ".*", "hooks": [{ "type": "command", "command": "node tools/pm-hooks/on-subagent-start.js" }] }
    ],
    "SubagentStop": [
      { "matcher": ".*", "hooks": [{ "type": "command", "command": "node tools/pm-hooks/on-subagent-stop.js" }] }
    ],
    "PostToolUse": [
      { "matcher": "Write|Edit", "hooks": [{ "type": "command", "command": "node tools/pm-hooks/log-write.js" }] }
    ]
  }
}
```

| Hook | Trigger | Skript |
|---|---|---|
| `SubagentStart` | Subagent začal beh | `on-subagent-start.js` |
| `SubagentStop` | Subagent ukončil beh | `on-subagent-stop.js` |
| `PostToolUse` (Write\|Edit) | Subagent zapísal/editoval súbor | `log-write.js` |

## Kontrakt — Claude Agent SDK hooks API

SDK volá hook-skript ako child process. Vstup ide cez **stdin** ako JSON:

```jsonc
{
  "hook_event_name": "PostToolUse" | "SubagentStart" | "SubagentStop",
  "session_id": "<uuid>",
  "transcript_path": "/abs/path/to/transcript.jsonl",
  "cwd": "/abs/path/to/agent-working-dir",
  "tool_name": "Write" | "Edit" | ...,                // len pre PostToolUse
  "tool_input": { ... },                              // len pre PostToolUse, raw tool input
  "tool_response": { ... },                            // len pre PostToolUse, raw tool response
  "agent_id": "01-api-analyst",                       // injektnuté PM-om do env / matchera
  "run_id": "20260508-192438",
  "round": 1
}
```

Hook skript **musí**:

- Bežať < 5 sekúnd (inak SDK timeout — celý beh agenta sa zruší).
- Vrátiť exit code `0` na úspech, akýkoľvek iný kód → blocking error (sub-agent
  bude requested re-prompt SDK-om).
- Zapisovať na stdout JSON s output kontraktom (voliteľné):

```jsonc
{
  "continue": true,
  "stopReason": "<string|null>"
}
```

Pre PM hooky nikdy nechceme block — vždy `continue: true` (alebo žiadny output =
default continue).

## Súbor 1 — `tools/pm-hooks/log-write.js`

**Účel**: pre každý `Write` / `Edit` tool call sub-agenta zaloguj záznam do
`.agents/runs/<runId>/<agentId>.writes.jsonl`. PM neskôr validuje, či agent
zapisoval iba do svojho povoleného output adresára.

```js
#!/usr/bin/env node
// tools/pm-hooks/log-write.js
//
// SDK hook: PostToolUse pre Write|Edit. Zaloguje 1 JSONL záznam.
// Beží ako detached child process; SDK passne payload cez stdin.

import { mkdir, appendFile } from "node:fs/promises";
import { dirname, join, relative, isAbsolute } from "node:path";

const REPO_ROOT = process.env.SDM_REPO_ROOT ?? process.cwd();
const RUN_ID    = process.env.SDM_RUN_ID    ?? "unknown-run";
const AGENT_ID  = process.env.SDM_AGENT_ID  ?? "unknown-agent";

async function readStdin() {
  let buf = "";
  for await (const chunk of process.stdin) buf += chunk;
  return JSON.parse(buf || "{}");
}

function extractFilePath(payload) {
  return payload.tool_input?.file_path
      ?? payload.tool_input?.path
      ?? null;
}

function classifyPath(filePath, agentId) {
  if (!filePath) return "unknown";
  const agentShortName = agentId.replace(/^\d+-/, "");
  const expectedPrefix = `docs/agents/${agentShortName}/`;
  const relPath = isAbsolute(filePath)
    ? relative(REPO_ROOT, filePath)
    : filePath;
  return {
    relPath,
    inExpectedDir: relPath.startsWith(expectedPrefix),
    expectedPrefix,
  };
}

async function main() {
  const payload = await readStdin();
  const filePath = extractFilePath(payload);
  const classification = classifyPath(filePath, AGENT_ID);

  const record = {
    ts:        new Date().toISOString(),
    runId:     RUN_ID,
    agentId:   AGENT_ID,
    tool:      payload.tool_name,
    sessionId: payload.session_id,
    file:      classification.relPath ?? filePath,
    inExpectedDir: classification.inExpectedDir,
    expectedPrefix: classification.expectedPrefix,
  };

  const logPath = join(REPO_ROOT, ".agents", "runs", RUN_ID, `${AGENT_ID}.writes.jsonl`);
  await mkdir(dirname(logPath), { recursive: true });
  await appendFile(logPath, JSON.stringify(record) + "\n");

  // Žiadny block — necháme agenta pokračovať aj keď píše mimo expected dir.
  // PM validation neskôr výstup odmietne, ak je mimo.
  process.stdout.write(JSON.stringify({ continue: true }));
}

main().catch((err) => {
  process.stderr.write(`log-write hook fail: ${err.message}\n`);
  process.exit(0);   // exit 0 aby SDK neblokoval agenta na hook failure
});
```

Pozn.: ENV premenné `SDM_RUN_ID` / `SDM_AGENT_ID` / `SDM_REPO_ROOT` injektuje PM
do `query()` options.env predtým, než SDK spustí agenta. Bez nich hook stále
loguje, len s `unknown-*` hodnotami.

## Súbor 2 — `tools/pm-hooks/on-subagent-start.js`

**Účel**: zaznamenať začiatok subagent behu. PM rozumie subagent events ako
"agent spustil subagent" (recursive Task tool). V našom design *PM = main
orchestrator*, takže `SubagentStart` reálne triggeruje pri každom novom
`query()` volaní — typicky raz per round per agent.

```js
#!/usr/bin/env node
// tools/pm-hooks/on-subagent-start.js

import { mkdir, appendFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const REPO_ROOT = process.env.SDM_REPO_ROOT ?? process.cwd();
const RUN_ID    = process.env.SDM_RUN_ID    ?? "unknown-run";
const AGENT_ID  = process.env.SDM_AGENT_ID  ?? "unknown-agent";

async function readStdin() {
  let buf = "";
  for await (const chunk of process.stdin) buf += chunk;
  return JSON.parse(buf || "{}");
}

async function main() {
  const payload = await readStdin();
  const record = {
    ts: new Date().toISOString(),
    event: "SubagentStart",
    runId: RUN_ID,
    agentId: AGENT_ID,
    sessionId: payload.session_id,
    cwd: payload.cwd,
  };

  const logPath = join(REPO_ROOT, ".agents", "runs", RUN_ID, `${AGENT_ID}.lifecycle.jsonl`);
  await mkdir(dirname(logPath), { recursive: true });
  await appendFile(logPath, JSON.stringify(record) + "\n");

  process.stdout.write(JSON.stringify({ continue: true }));
}

main().catch((err) => {
  process.stderr.write(`on-subagent-start hook fail: ${err.message}\n`);
  process.exit(0);
});
```

## Súbor 3 — `tools/pm-hooks/on-subagent-stop.js`

**Účel**: zaznamenať koniec subagent behu + spustiť **lightweight per-agent
validation** (existencia output adresára, prítomnosť `## Otvorené závislosti`
v každom markdowne). Hlbšiu validáciu robí PM CLI v `validation.ts` po hook-u.

```js
#!/usr/bin/env node
// tools/pm-hooks/on-subagent-stop.js

import { mkdir, appendFile, readdir, readFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";

const REPO_ROOT = process.env.SDM_REPO_ROOT ?? process.cwd();
const RUN_ID    = process.env.SDM_RUN_ID    ?? "unknown-run";
const AGENT_ID  = process.env.SDM_AGENT_ID  ?? "unknown-agent";

const HAS_OPEN_DEPS_RE = /^##\s+Otvorené\s+závislosti/m;

async function readStdin() {
  let buf = "";
  for await (const chunk of process.stdin) buf += chunk;
  return JSON.parse(buf || "{}");
}

async function findMarkdownsInOutputDir(agentId, repoRoot) {
  const agentShortName = agentId.replace(/^\d+-/, "");
  const outputDir = join(repoRoot, "docs", "agents", agentShortName);
  try {
    return await walk(outputDir, ".md");
  } catch {
    return [];
  }
}

async function walk(dir, ext) {
  const results = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) results.push(...await walk(full, ext));
    else if (entry.isFile() && entry.name.endsWith(ext)) results.push(full);
  }
  return results;
}

async function quickValidate(files) {
  const issues = [];
  for (const file of files) {
    const content = await readFile(file, "utf-8");
    const size = (await stat(file)).size;
    if (size < 1024) issues.push({ file, kind: "too_small", size });
    if (!HAS_OPEN_DEPS_RE.test(content)) issues.push({ file, kind: "no_open_deps_section" });
  }
  return issues;
}

async function main() {
  const payload = await readStdin();
  const files   = await findMarkdownsInOutputDir(AGENT_ID, REPO_ROOT);
  const issues  = await quickValidate(files);

  const record = {
    ts: new Date().toISOString(),
    event: "SubagentStop",
    runId: RUN_ID,
    agentId: AGENT_ID,
    sessionId: payload.session_id,
    outputFilesCount: files.length,
    quickValidationIssuesCount: issues.length,
    quickValidationIssues: issues,
  };

  const logPath = join(REPO_ROOT, ".agents", "runs", RUN_ID, `${AGENT_ID}.lifecycle.jsonl`);
  await mkdir(dirname(logPath), { recursive: true });
  await appendFile(logPath, JSON.stringify(record) + "\n");

  // Žiadny block — PM CLI urobí plnú validáciu v `validation.ts`.
  // Hook output reportuje len pre log.
  process.stdout.write(JSON.stringify({ continue: true }));
}

main().catch((err) => {
  process.stderr.write(`on-subagent-stop hook fail: ${err.message}\n`);
  process.exit(0);
});
```

## Helper modul (voliteľný) — `tools/pm-hooks/_shared.js`

Spoločné utility pre 3 hooky, aby sa neopakoval boilerplate:

```js
// tools/pm-hooks/_shared.js
import { mkdir, appendFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export const REPO_ROOT = process.env.SDM_REPO_ROOT ?? process.cwd();
export const RUN_ID    = process.env.SDM_RUN_ID    ?? "unknown-run";
export const AGENT_ID  = process.env.SDM_AGENT_ID  ?? "unknown-agent";

export async function readStdinJson() {
  let buf = "";
  for await (const chunk of process.stdin) buf += chunk;
  try { return JSON.parse(buf || "{}"); }
  catch { return {}; }
}

export async function appendLog(filename, record) {
  const path = join(REPO_ROOT, ".agents", "runs", RUN_ID, filename);
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, JSON.stringify(record) + "\n");
}

export function exitSafe(err) {
  if (err) process.stderr.write(`hook fail: ${err.message}\n`);
  process.stdout.write(JSON.stringify({ continue: true }));
  process.exit(0);
}
```

Hooky potom redukujú na ~20 riadkov each.

## Lokálne testovanie hookov

Bez SDK — manuálne piping JSON do skriptu:

```bash
# Mimic Write payload
echo '{
  "hook_event_name": "PostToolUse",
  "tool_name": "Write",
  "tool_input": { "file_path": "docs/agents/api-analyst/endpoints.md" },
  "session_id": "test-session"
}' | SDM_RUN_ID=test-001 SDM_AGENT_ID=01-api-analyst node tools/pm-hooks/log-write.js

# Verify log
cat .agents/runs/test-001/01-api-analyst.writes.jsonl
```

Vitest test (`apps/pm/tests/hooks.test.ts` — voliteľné, ak DevOps chce coverage):

```ts
import { describe, it, expect } from "vitest";
import { execaCommand } from "execa";
import { readFile, rm } from "node:fs/promises";

describe("log-write hook", () => {
  it("logs Write payload to JSONL", async () => {
    await rm(".agents/runs/test-001", { recursive: true, force: true });
    const payload = JSON.stringify({
      hook_event_name: "PostToolUse",
      tool_name: "Write",
      tool_input: { file_path: "docs/agents/api-analyst/endpoints.md" },
      session_id: "test-session",
    });
    await execaCommand("node tools/pm-hooks/log-write.js", {
      input: payload,
      env: { SDM_RUN_ID: "test-001", SDM_AGENT_ID: "01-api-analyst" },
    });
    const log = await readFile(".agents/runs/test-001/01-api-analyst.writes.jsonl", "utf-8");
    expect(log).toContain("docs/agents/api-analyst/endpoints.md");
    expect(JSON.parse(log.trim()).inExpectedDir).toBe(true);
  });
});
```

## Performance considerations

| Aspekt | Limit | Mitigation |
|---|---|---|
| Hook latency | < 5 s (SDK timeout) | Hooky robia len append do JSONL, žiadne sync API volania |
| `walk()` pre quickValidate | Záleží od počtu .md v output dire | Cap 50 files — output adresáre majú typicky 5–10 markdownov |
| File descriptor exhaustion | Concurrent agents = paralelné writes do rôznych súborov | OS limit 256+ default, vystačí pre N ≤ 10 agentov |

## Bezpečnostné poznámky

- Hook skripty `process.exit(0)` aj pri chybe — **nikdy** neblokujú agent flow.
  Audit logging je best-effort.
- Hooky **nečítajú** žiadne secrets. Žiadne ENV expansion v file_path bez sanitization.
- Hook output musí byť **valid JSON** alebo prázdny — inak SDK vyhodnotí ako protocol error.

## Otvorené závislosti

- `[?]` Hooky momentálne **neblokujú** agenta pri quickValidate fail. Alternatíva: ak `quickValidationIssuesCount > 0`, hook by mohol vrátiť `{"continue": false, "stopReason": "missing ## Otvorené závislosti"}` a SDK by sub-agenta re-promptol. Default: necháme plnú validáciu PM CLI (`validation.ts`), aby sme nepristupovali do agent flow z hook-u. Re-vyhodnotiť po prvom behu.
- `[?]` ENV propagation `SDM_RUN_ID` / `SDM_AGENT_ID` — Agent SDK passne `env` cez `query({ env: ... })` options. Konkrétny SDK API tvar pre to overiť pri implementácii (v `0.x` to bolo cez `env` field, v `1.x` cez `processEnv`). Tomu sa prispôsobí PM `orchestrator.ts`.
- `[04-architecture]` Adresár `tools/pm-hooks/` je momentálne na root úrovni (zhodne s `.agents/00-project-manager/hooks.json`). Ak Architecture reštrukturalizuje (`apps/pm/hooks/`), aktualizujeme aj `hooks.json` path.
- `[09-qa-test-strategy]` Vitest test pre hooky (vyššie) je voliteľný. Flag → 09 ak chce vyžadovať coverage hookov.
