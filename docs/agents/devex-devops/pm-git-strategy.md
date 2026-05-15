# PM git stratégia — branch isolation, worktrees, merge a PR flow

## Changelog (round 2)

r2: žiadna zmena. Konkrétne `git`/`gh` príkazy z r1 sú stable a validované
prebehnutou pipeline `20260508-192438`.

> Implementácia GOAL §7.6 *Izolácia vetiev a merge stratégia* — konkrétne
> `git` a `gh` príkazy, ktoré PM spúšťa cez `execa`. Žiadny pseudokód-only popis.
>
> `main` je **chránená**. Sub-agenti **nikdy** nespúšťajú git príkazy. PM riadi
> všetko.

## Branch hierarchia

```
main                                            ← chránená, iba PR-merge
└── pipeline/<runId>/integration                ← integration vetva pipeline behu
    ├── pipeline/<runId>/round-1                ← round-vetva (Round 1)
    │   ├── agent/<runId>/01-api-analyst
    │   ├── agent/<runId>/02-ux-persona-analyst
    │   └── agent/<runId>/03-domain-modeller     (Phase A)
    │   ├── agent/<runId>/04-architecture        (Phase B)
    │   ├── agent/<runId>/05-security
    │   └── ...
    ├── pipeline/<runId>/round-2                ← refinement round
    │   └── agent/<runId>/<id>-<name>            (len dotknutí)
    └── pipeline/<runId>/post-conv              ← jednorazový post-conv beh (10)
```

`<runId>` formát: ISO timestamp s pomlčkami, napr. `20260508-192438`.
Drží sa zhody s convention z `git log` v repe.

## Worktree layout

```
<repo-root>/                                              ← main checkout
.agents/runs/<runId>/worktrees/
├── 01-api-analyst/                ← worktree na agent/<runId>/01-api-analyst
├── 02-ux-persona-analyst/         ← worktree na agent/<runId>/02-ux-persona-analyst
└── ...
```

Worktree je **out-of-tree** v `.agents/runs/<runId>/worktrees/` — gitignored.
Žiadna kolízia s main checkout, paralelný beh agentov bez interference.

## Lifecycle — konkrétne príkazy

### 1. Štart pipeline behu

```bash
# Bezpečnostné checky pred štartom
git status --porcelain                           # MUSÍ byť prázdne (clean WT)
git fetch origin
git rev-parse --verify origin/main >/dev/null    # main musí existovať

# Vytvorenie integration vetvy
RUN_ID="20260508-192438"
INTEGRATION="pipeline/${RUN_ID}/integration"

git checkout -b "$INTEGRATION" origin/main
git push -u origin "$INTEGRATION"

# Zápis do state.json (cez state.ts v PM)
# state.git.pipelineBranch = "pipeline/20260508-192438/integration"
# state.git.baseRef = "<sha of origin/main at this moment>"
```

### 2. Pre každú rundu — round-vetva

```bash
ROUND=1
ROUND_BRANCH="pipeline/${RUN_ID}/round-${ROUND}"

git checkout "$INTEGRATION"
git checkout -b "$ROUND_BRANCH"
git push -u origin "$ROUND_BRANCH"
```

### 3. Pre každého agenta v rámci rundy — agent-vetva + worktree

```bash
AGENT_ID="01-api-analyst"
AGENT_BRANCH="agent/${RUN_ID}/${AGENT_ID}"
WORKTREE_DIR=".agents/runs/${RUN_ID}/worktrees/${AGENT_ID}"

# Vytvorenie agent-vetvy z round-vetvy
git branch "$AGENT_BRANCH" "$ROUND_BRANCH"

# Worktree pre paralelný beh
mkdir -p "$(dirname "$WORKTREE_DIR")"
git worktree add "$WORKTREE_DIR" "$AGENT_BRANCH"
```

`git worktree add` checkout-ne `$AGENT_BRANCH` do nezávislého filesystem
priestoru. Agent v ňom vidí svoj nezávislý working tree — z jeho pohľadu je to
plnohodnotný repo. `.git` v worktree je symlink/file ukazujúci na hlavný
`.git/worktrees/...`.

### 4. Spustenie agenta v worktree

PM cez Claude Agent SDK passne `cwd: WORKTREE_DIR` do `query()` options
(viď `pm-runtime.md`). Agent píše súbory iba do svojho worktree. Žiadne git
príkazy nevolá — to robí PM.

### 5. Po skončení agenta — commit

```bash
cd "$WORKTREE_DIR"

# Validačné checky (validation.ts) — ak fail, žiadny commit
# ...

git add docs/agents/api-analyst/    # iba cieľový adresár agenta
git status --porcelain               # log, čo sa commituje

SUMMARY="$(extract_summary)"         # PM agreguje z agent reportu (z SDK eventu typu "result")
COMMIT_MSG="[${RUN_ID}][round-${ROUND}][${AGENT_ID}] ${SUMMARY}"

git commit -m "$COMMIT_MSG"
git push origin "$AGENT_BRANCH"
```

Commit message format zhodný s `pipeline.yaml` `git.commit_message_template`.
Príklad z reálneho repa (round 1):

```
[20260508-192438][round-1][03] domain-modeller: entities, lifecycles, model.ts
```

### 6. Po fáze — merge agent-vetiev do round-vetvy

`--no-ff` zachová jeden merge commit per agent → audit trail v `git log --graph`.

```bash
cd <repo-root>                       # späť z worktree do main checkout
git checkout "$ROUND_BRANCH"

# Merge per agent — sekvenčne, fail-fast
for AGENT_BRANCH in $(echo "$AGENT_BRANCHES" | tr ',' ' '); do
  git merge --no-ff -m "Merge ${AGENT_BRANCH} into ${ROUND_BRANCH}" "$AGENT_BRANCH"
  if [ $? -ne 0 ]; then
    echo "FAIL: merge conflict in ${AGENT_BRANCH}" >&2
    # PM eskaluje človeku, neauto-resolvuje
    exit 1
  fi
done

git push origin "$ROUND_BRANCH"
```

Konflikt = eskalácia. Sub-agenti píšu do disjunktných adresárov
(`docs/agents/<NN>-<name>/`), takže konflikty sú **zriedkavé**. Ak nastane —
typicky to znamená že 2 agenti zmenili rovnaký zdielaný súbor (napr. spoločný
schémový JSON), čo signalizuje design problem.

### 7. Po runde — merge round-vetvy do integration

```bash
git checkout "$INTEGRATION"
git merge --no-ff -m "Merge ${ROUND_BRANCH} into integration" "$ROUND_BRANCH"
git push origin "$INTEGRATION"
```

### 8. Post-konvergencia — beh agenta 10

```bash
POSTCONV_BRANCH="pipeline/${RUN_ID}/post-conv"
git checkout "$INTEGRATION"
git checkout -b "$POSTCONV_BRANCH"

# Vytvorenie worktree pre 10-documentation-author analogicky bodu 3
git worktree add ".agents/runs/${RUN_ID}/worktrees/10-documentation-author" "$POSTCONV_BRANCH"

# ... beh agenta ...

# Commit + push v worktree:
cd ".agents/runs/${RUN_ID}/worktrees/10-documentation-author"
git add docs/spec/ docs/system-overview.md docs/dev-handbook.md docs/onboarding.md
git commit -m "[${RUN_ID}][post-conv][10] documentation-author: consolidation"
git push origin "$POSTCONV_BRANCH"

# Merge späť do integration
cd <repo-root>
git checkout "$INTEGRATION"
git merge --no-ff -m "Merge post-conv into integration" "$POSTCONV_BRANCH"
git push origin "$INTEGRATION"
```

### 9. Finálny PR — `gh pr create`

```bash
TOTAL_ROUNDS=$(jq '.rounds | length' .agents/state.json)
AGENTS_RUN=$(jq '[.agents | to_entries[] | select(.value.totalRuns > 0)] | length' .agents/state.json)
ESCALATIONS=$(jq '.escalations | length' .agents/state.json)

PR_TITLE="Pipeline ${RUN_ID} — konvergencia po ${TOTAL_ROUNDS} rundách"

PR_BODY=$(cat <<EOF
Auto-vytvorené PM po dosiahnutí konvergencie.

- runId: ${RUN_ID}
- rounds: ${TOTAL_ROUNDS}
- agents run: ${AGENTS_RUN}
- escalations: ${ESCALATIONS}

Súhrn rúnd a artefaktov: \`.agents/runs/${RUN_ID}/summary.md\`.

## Konvergenčné signály (všetky zelené)

- [x] no_open_dependencies
- [x] no_cross_artifact_conflicts
- [x] validation_passed

## Štruktúra zmien

- \`docs/agents/<agent>/\` — výstupy 9 analytických agentov.
- \`docs/spec/<modul>.md\` — konsolidované per-modul špecifikácie (agent 10).
- \`docs/system-overview.md\`, \`docs/dev-handbook.md\`, \`docs/onboarding.md\` — agent 10.

## Audit trail

- Git: \`git log --graph --oneline pipeline/${RUN_ID}/integration\`
- Run state: \`.agents/state.json\`
- Events: \`.agents/runs/${RUN_ID}/*.jsonl\`

**Human review required pre merge do main.**
EOF
)

gh pr create \
  --base main \
  --head "$INTEGRATION" \
  --title "$PR_TITLE" \
  --body "$PR_BODY" \
  --label "auto-pipeline" \
  --label "convergence:reached"

# URL PR-u zapíše PM do state.json.git.finalPrUrl:
PR_URL=$(gh pr view "$INTEGRATION" --json url --jq '.url')
```

PM NIKDY nemerguje PR — to robí človek po review. `--auto-merge` flag **sa
nepoužíva**, aj keby všetky checks prešli.

## Eskalácia — escalation flow

### Eskalácia pri max iterations

```bash
gh pr create \
  --base main \
  --head "$INTEGRATION" \
  --title "Pipeline ${RUN_ID} — ESCALATED: max iterations" \
  --body "Pipeline nedosiahla konvergenciu po ${MAX} rundách. Otvorené flagy: ..." \
  --label "escalation" \
  --draft
```

Draft PR pre escalation — človek si pozrie stav a rozhodne.

### Eskalácia pri merge konflikte

PM **neauto-resolvuje**. Vypíše:

```
ESCALATION: merge conflict
  branch: agent/<runId>/04-architecture
  conflicting files:
    - docs/agents/architecture/adrs/ADR-01-bff.md
    - docs/agents/architecture/component-map.md
  cause: 04-architecture and 05-security both modified shared schema file in round 3

Manual steps:
  1. Resolve conflict in your IDE.
  2. Run: ./tools/pm-helper.sh continue
```

(Pozn.: `tools/pm-helper.sh continue` je voliteľný helper — nie je v MVP scope PM CLI.)

### Eskalácia pri oscillation

Detekcia: agent osciluje medzi 2 stavmi v posledných 3 rundách (hash artefaktu
sa strieda). PM:

```
ESCALATION: oscillation detected
  agent: 04-architecture
  rounds: 2, 3, 4
  state hashes: hashA, hashB, hashA
  diagnosis: Agent flip-flops on BFF decision based on competing flags from 05 and 01.

Suggested human action:
  - Decide BFF yes/no explicitly in GOAL.md or via dedicated user-prompt input.
  - Re-run pipeline with `--resume`.
```

## Cleanup

Po úspešnom PR mergu (alebo na vyžiadanie):

```bash
# Odstránenie worktrees (vetvy zostávajú pre audit)
for AGENT_DIR in .agents/runs/${RUN_ID}/worktrees/*/; do
  git worktree remove --force "$AGENT_DIR"
done
rm -rf ".agents/runs/${RUN_ID}/worktrees"

# Branches sa KEEP-ujú 30 dní (pipeline.yaml git.cleanup.branch_retention_days)
# Po expirácii sa zmažú samostatným cleanup skriptom (nie PM CLI):
gh api repos/Spigotek/SDM-Rewrite/branches/agent/<runId>/<id> -X DELETE
```

## Branch protection setup — jednorazové

Beží **mimo PM** (admin only, manuálne):

```bash
gh api -X PUT repos/Spigotek/SDM-Rewrite/branches/main/protection \
  -F required_pull_request_reviews.required_approving_review_count=1 \
  -F enforce_admins=false \
  -F required_status_checks.strict=true \
  -F 'required_status_checks.contexts[]=Lint + Format' \
  -F 'required_status_checks.contexts[]=Typecheck' \
  -F 'required_status_checks.contexts[]=Unit + Component tests' \
  -F 'required_status_checks.contexts[]=Build all' \
  -F 'required_status_checks.contexts[]=Security audit' \
  -F restrictions=null
```

Pridáva sa do `repo-bootstrap.md` ako Step 8 (post-install one-shot).

## Bezpečnostné invariants

| Invariant | Vymáhanie |
|---|---|
| Sub-agent nikdy nespúšťa `git` | Allowed tools v agent frontmatter neobsahujú `Bash` git príkazy explicitne; aj keby Bash bol, agent system prompt to zakazuje |
| `main` len cez PR | GitHub branch protection (server-side) + PM nikdy nepíše do `main` (client-side) |
| Push do origin len PM | Sub-agenti push neumožní — nemajú git tools |
| Žiadny force push | PM nikdy nepoužije `--force` / `--force-with-lease` |
| Žiadny `git reset --hard` | PM nikdy nepoužije; pri rollback PM len vytvorí novú vetvu |
| Lockfile integrity | `pnpm install --frozen-lockfile` v každom CI jobe |

## Helper TS modul — `src/git.ts` v `apps/pm/`

```ts
import { execa } from "execa";
import path from "node:path";

export class GitManager {
  constructor(private repoRoot: string) {}

  async createIntegrationBranch(runId: string): Promise<string> {
    const branch = `pipeline/${runId}/integration`;
    await this.exec(["fetch", "origin"]);
    await this.exec(["checkout", "-b", branch, "origin/main"]);
    await this.exec(["push", "-u", "origin", branch]);
    return branch;
  }

  async createRoundBranch(runId: string, round: number, fromBranch: string): Promise<string> {
    const branch = `pipeline/${runId}/round-${round}`;
    await this.exec(["checkout", fromBranch]);
    await this.exec(["checkout", "-b", branch]);
    await this.exec(["push", "-u", "origin", branch]);
    return branch;
  }

  async createAgentWorktree(runId: string, agentId: string, fromBranch: string): Promise<{ branch: string; worktreePath: string }> {
    const branch = `agent/${runId}/${agentId}`;
    const worktreePath = path.join(this.repoRoot, ".agents/runs", runId, "worktrees", agentId);
    await this.exec(["branch", branch, fromBranch]);
    await this.exec(["worktree", "add", worktreePath, branch]);
    return { branch, worktreePath };
  }

  async commitInWorktree(worktreePath: string, message: string, paths: string[]): Promise<string> {
    await this.exec(["add", ...paths], worktreePath);
    await this.exec(["commit", "-m", message], worktreePath);
    const sha = (await this.exec(["rev-parse", "HEAD"], worktreePath)).stdout.trim();
    return sha;
  }

  async pushWorktreeBranch(worktreePath: string, branch: string): Promise<void> {
    await this.exec(["push", "origin", branch], worktreePath);
  }

  async mergeIntoRound(roundBranch: string, agentBranch: string): Promise<void> {
    await this.exec(["checkout", roundBranch]);
    await this.exec(["merge", "--no-ff", "-m", `Merge ${agentBranch} into ${roundBranch}`, agentBranch]);
  }

  async removeWorktree(worktreePath: string): Promise<void> {
    await this.exec(["worktree", "remove", "--force", worktreePath]);
  }

  async openFinalPR(integrationBranch: string, title: string, body: string): Promise<string> {
    const { stdout } = await execa("gh", [
      "pr", "create",
      "--base", "main",
      "--head", integrationBranch,
      "--title", title,
      "--body", body,
      "--label", "auto-pipeline",
      "--label", "convergence:reached",
    ], { cwd: this.repoRoot });
    const url = stdout.split("\n").find((l) => l.startsWith("https://"))!;
    return url;
  }

  private exec(args: string[], cwd: string = this.repoRoot) {
    return execa("git", args, { cwd, stdio: "pipe" });
  }
}
```

## Otvorené závislosti

- `[04-architecture]` Branch naming + worktree dir z `pipeline.yaml` — Architecture by mohla preferovať iný path layout (napr. `tools/runs/` namiesto `.agents/runs/`). Default: zhodne s GOAL §7.6 a aktuálnym `pipeline.yaml`. Bez flagu na 04 — len keď 04 explicit zmení layout, prepíšeme.
- `[?]` Branch retention — 30 dní default. Ak compliance requirement vyžaduje dlhšie (auditovateľnosť), zvýšiť. Flag pre človeka.
- `[?]` Hosting CI runner: GitHub Actions má built-in `GITHUB_TOKEN` pre `gh pr create`. Lokálny beh PM CLI vyžaduje `gh auth login` predtým, alebo `GH_TOKEN` env var. Zdokumentované v `repo-bootstrap.md` Step 6.
- `[?]` Strict status checks v branch protection — zoznam (`Lint + Format`, `Typecheck`, `Unit + Component tests`, `Build all`, `Security audit`) je sentence-case (vyžaduje `gh api`). E2E job zámerne nie je v required checks (môže byť flaky pri Playwright timeoutoch); záväzné len pre release tagy.
