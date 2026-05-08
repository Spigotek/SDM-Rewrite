#!/usr/bin/env bash
# Bootstrap analytickej pipeline. Bežíš RAZ na začiatku každého nového behu.
# Nevyžaduje Claude Code chat — je to čistá Bash bootstrap.
#
# Vytvorí:
#   1. <runId> (timestamp YYYYMMDD-HHMMSS)
#   2. pipeline/<runId>/integration branch z origin/main
#   3. pipeline/<runId>/round-1 branch z pipeline/<runId>/integration
#   4. .agents/runs/<runId>/ s prvým stage-om (01-phase-a)
#
# Po skončení vypíše inštrukciu na otvorenie nového CC chatu so správnym
# stage-instructions promptom.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

# 1. Pre-flight check
echo "→ Pre-flight check ..."
if ! bash tools/preflight.sh > /dev/null; then
  echo "✗ Pre-flight zlyhal. Spusti 'bash tools/preflight.sh' samostatne pre detail."
  exit 1
fi
echo "  ✓ pre-flight OK"

# 2. RunId
run_id="$(date -u +%Y%m%d-%H%M%S)"
echo "→ Run ID: $run_id"

# 3. Branches (predpoklad: si na main, sync s origin)
echo "→ Vytváram pipeline branches ..."
git checkout main >/dev/null 2>&1
git pull --quiet origin main
git checkout -b "pipeline/$run_id/integration" main
git checkout -b "pipeline/$run_id/round-1" "pipeline/$run_id/integration"
echo "  ✓ pipeline/$run_id/integration"
echo "  ✓ pipeline/$run_id/round-1 (aktívna)"

# 4. Run dir + manifest
run_dir=".agents/runs/$run_id"
mkdir -p "$run_dir"
cat > "$run_dir/manifest.json" <<EOF
{
  "runId": "$run_id",
  "startedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "status": "round1-phase-a",
  "currentRound": 1,
  "maxIterations": 5,
  "git": {
    "pipelineBranch": "pipeline/$run_id/integration",
    "baseRef": "$(git rev-parse main)",
    "finalPrUrl": null
  },
  "stages": [],
  "agents": {}
}
EOF
echo "$run_id" > .agents/.current-run-id
echo "  ✓ $run_dir/manifest.json"

# 5. Pripravi stage-01-phase-a
echo "→ Generujem stage-01-phase-a (prompts + instructions) ..."
bash tools/prepare-stage.sh "$run_id" "01-phase-a" >/dev/null
echo "  ✓ $run_dir/stage-01-phase-a/"

# 6. Hand-off
cat <<EOF

══════════════════════════════════════════════════════════════════════
✓ Pipeline inicializovaná. Run ID: $run_id

Ďalší krok — otvor **nový Claude Code chat** v adresári:
  $REPO_ROOT

A paste-ni do neho **presne tento prompt**:

──────────────────────────────────────────────────────────────────────
Si Project Manager (PM-proxy) pre SDM-Rewrite. Tvoja inštrukcia pre
túto fázu je v \`.agents/runs/$run_id/stage-01-phase-a/instructions.md\`.
Prečítaj si ju a vykonaj. Pravidlá PM máš v \`.agents/00-project-manager/\`.
──────────────────────────────────────────────────────────────────────

Súbory tohto stage-u:
  $run_dir/stage-01-phase-a/instructions.md     # paste-ni prečítanie tohto
  $run_dir/stage-01-phase-a/prompts/*.md        # 3 prompty pre agentov 01–03
  $run_dir/stage-01-phase-a/done.txt            # CC vytvorí po dokončení
  $run_dir/stage-01-phase-a/log.md              # CC zapíše outcome

Po dokončení každej fázy CC ti povie, čo paste-núť do ďalšieho chatu.

══════════════════════════════════════════════════════════════════════
EOF
