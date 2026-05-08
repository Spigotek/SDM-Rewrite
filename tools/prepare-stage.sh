#!/usr/bin/env bash
# Pripraví adresár pre ďalší stage pipeline-u: vytvorí prompts/ s assembled
# system promptami a instructions.md s krok-za-krokom inštrukciami pre
# PM-proxy v novom Claude Code chate.
#
# Použitie:
#   tools/prepare-stage.sh <runId> <stage-name> [extra args]
#
#   <stage-name>:
#     01-phase-a            — round 1 phase A (01, 02, 03 paralelne)
#     02-phase-b            — round 1 phase B (04..09 paralelne)
#     NN-refinement-rN      — refinement runda (PM-proxy doplní obsah)
#     99-post-conv          — post-konvergenčný agent 10
#     final-pr              — finálny push + PR

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

run_id="${1:?usage: prepare-stage.sh <runId> <stage-name>}"
stage_name="${2:?missing stage-name}"

run_dir=".agents/runs/$run_id"
stage_dir="$run_dir/stage-$stage_name"

[ -d "$run_dir" ] || { echo "run dir not found: $run_dir" >&2; exit 2; }
mkdir -p "$stage_dir/prompts"

# ─── helper: render template s key=value (single-line) + multi-line cez @file ─
# Použitie: render <template> <output> <KEY1=value1> ... <KEY_FILE@/tmp/file>
# - "KEY=value"      → single-line gsub
# - "KEY@/tmp/file"  → multi-line, súbor sa includne na riadok s {{KEY}}
render() {
  local tpl="$1"; shift
  local out="$1"; shift

  # Postupné uplatnenie substitúcií
  cp "$tpl" "$out.tmp"
  for kv in "$@"; do
    if [[ "$kv" == *"@"* ]]; then
      local k="${kv%%@*}"
      local f="${kv#*@}"
      [ -f "$f" ] || { echo "render: file not found for $k: $f" >&2; exit 2; }
      awk -v key="$k" -v file="$f" '
        index($0, "{{" key "}}") > 0 {
          while ((getline line < file) > 0) print line
          close(file)
          next
        }
        { print }
      ' "$out.tmp" > "$out.tmp2"
      mv "$out.tmp2" "$out.tmp"
    elif [[ "$kv" == *"="* ]]; then
      local k="${kv%%=*}"
      local v="${kv#*=}"
      awk -v key="$k" -v val="$v" '
        { gsub("\\{\\{" key "\\}\\}", val); print }
      ' "$out.tmp" > "$out.tmp2"
      mv "$out.tmp2" "$out.tmp"
    fi
  done
  mv "$out.tmp" "$out"
}

# ─── helpers ─────────────────────────────────────────────────────────────
agent_invocations_file() {
  local stage_dir_rel="$1"; shift
  local out_file="$1"; shift
  : > "$out_file"
  for a in "$@"; do
    cat >> "$out_file" <<EOF
   Agent({
     description: "Run $a",
     subagent_type: "general-purpose",
     isolation: "worktree",
     prompt: <obsah $stage_dir_rel/prompts/$a.md>
   })
EOF
  done
}

agent_list_csv() { local IFS=', '; echo "$*"; }

next_stage_block_file() {
  local current="$1"; shift
  local out_file="$1"
  case "$current" in
    01-phase-a)
      cat > "$out_file" <<EOF
\`\`\`bash
bash tools/prepare-stage.sh $run_id 02-phase-b
\`\`\`
EOF
      ;;
    02-phase-b)
      cat > "$out_file" <<EOF
**Po validácii konvergenčných signálov** rozhodni o ďalšej runde:

- ak \`no_open_dependencies\` ∧ \`no_cross_artifact_conflicts\` ∧ \`validation_passed\`:
  \`\`\`bash
  bash tools/prepare-stage.sh $run_id 99-post-conv
  \`\`\`
- inak (potrebná refinement runda):
  - identifikuj dotknutých agentov (čítaj flagy a konflikty),
  - pre každého napíš revision prompt cez:
    \`tools/assemble-prompt.sh <id> $run_id revision 2 <body-file> <delta-file>\`
    a ulož do \`.agents/runs/$run_id/stage-03-refinement-r2/prompts/\`,
  - vytvor \`.agents/runs/$run_id/stage-03-refinement-r2/instructions.md\`
    z templátu \`.agents/templates/instructions-refinement.md.tpl\`.
EOF
      ;;
    *)
      echo "(custom — PM-proxy doplní)" > "$out_file"
      ;;
  esac
}

# ─── stage handlers ─────────────────────────────────────────────────────

case "$stage_name" in
  01-phase-a)
    branch="pipeline/$run_id/round-1"
    agents=("01-api-analyst" "02-ux-persona-analyst" "03-domain-modeller")
    round=1
    phase_label="Phase A (paralelne)"
    prev_stage="(none — init)"

    for a in "${agents[@]}"; do
      bash tools/assemble-prompt.sh "$a" "$run_id" fresh "$round" \
        > "$stage_dir/prompts/$a.md"
    done

    inv_file="$(mktemp -t inv.XXXXXX)"
    next_file="$(mktemp -t next.XXXXXX)"
    trap 'rm -f "$inv_file" "$next_file"' EXIT

    agent_invocations_file "$stage_dir" "$inv_file" "${agents[@]}"
    next_stage_block_file "$stage_name" "$next_file"

    render ".agents/templates/instructions-broadcast.md.tpl" \
      "$stage_dir/instructions.md" \
      "STAGE_LABEL=$stage_name" \
      "ROUND=$round" \
      "PHASE_LABEL=$phase_label" \
      "RUN_ID=$run_id" \
      "BRANCH=$branch" \
      "AGENT_LIST=$(agent_list_csv "${agents[@]}")" \
      "AGENT_COUNT=${#agents[@]}" \
      "PREV_STAGE=$prev_stage" \
      "STAGE_DIR=$stage_dir" \
      "AGENT_INVOCATIONS@$inv_file" \
      "NEXT_STAGE_INSTRUCTIONS@$next_file"
    ;;

  02-phase-b)
    branch="pipeline/$run_id/round-1"
    agents=("04-architecture" "05-security" "06-tech-stack-selector"
            "07-design-system" "08-devex-devops" "09-qa-test-strategy")
    round=1
    phase_label="Phase B (paralelne)"
    prev_stage="stage-01-phase-a"

    for a in "${agents[@]}"; do
      bash tools/assemble-prompt.sh "$a" "$run_id" fresh "$round" \
        > "$stage_dir/prompts/$a.md"
    done

    inv_file="$(mktemp -t inv.XXXXXX)"
    next_file="$(mktemp -t next.XXXXXX)"
    trap 'rm -f "$inv_file" "$next_file"' EXIT

    agent_invocations_file "$stage_dir" "$inv_file" "${agents[@]}"
    next_stage_block_file "$stage_name" "$next_file"

    render ".agents/templates/instructions-broadcast.md.tpl" \
      "$stage_dir/instructions.md" \
      "STAGE_LABEL=$stage_name" \
      "ROUND=$round" \
      "PHASE_LABEL=$phase_label" \
      "RUN_ID=$run_id" \
      "BRANCH=$branch" \
      "AGENT_LIST=$(agent_list_csv "${agents[@]}")" \
      "AGENT_COUNT=${#agents[@]}" \
      "PREV_STAGE=$prev_stage" \
      "STAGE_DIR=$stage_dir" \
      "AGENT_INVOCATIONS@$inv_file" \
      "NEXT_STAGE_INSTRUCTIONS@$next_file"
    ;;

  99-post-conv)
    round="${3:-1}"
    branch="pipeline/$run_id/round-$round"
    prev_stage="${4:-stage-02-phase-b (alebo posledná refinement)}"

    bash tools/assemble-prompt.sh "10-documentation-author" "$run_id" fresh "$round" \
      > "$stage_dir/prompts/10-documentation-author.md"

    next_round=$((round + 1))
    reopen_stage_label="$((round + 2))-refinement-r$next_round"

    render ".agents/templates/instructions-post-conv.md.tpl" \
      "$stage_dir/instructions.md" \
      "STAGE_LABEL=$stage_name" \
      "ROUND=$round" \
      "RUN_ID=$run_id" \
      "BRANCH=$branch" \
      "PREV_STAGE=$prev_stage" \
      "STAGE_DIR=$stage_dir" \
      "NEXT_ROUND=$next_round" \
      "REOPEN_STAGE=$reopen_stage_label"
    ;;

  final-pr)
    total_rounds="${3:-?}"
    escalations="${4:-0}"

    render ".agents/templates/instructions-final-pr.md.tpl" \
      "$stage_dir/instructions.md" \
      "RUN_ID=$run_id" \
      "TOTAL_ROUNDS=$total_rounds" \
      "ESCALATIONS=$escalations"
    ;;

  *refinement-r*)
    round="${stage_name##*-r}"
    cat > "$stage_dir/SKELETON.md" <<EOF
# Refinement skeletón pre stage-$stage_name

Tento adresár je len skeletón. PM-proxy v predošlom chate musí doplniť:

1. \`prompts/<NN>-<name>.md\` per dotknutý agent. Pre každého:
   \`\`\`bash
   # napíš ./tmp/revision-body-<NN>.md (čo prepracovať)
   # napíš ./tmp/delta-<NN>.md (linky na delta výstupov ostatných)
   bash tools/assemble-prompt.sh <NN>-<name> $run_id revision $round \\
     ./tmp/revision-body-<NN>.md ./tmp/delta-<NN>.md \\
     > $stage_dir/prompts/<NN>-<name>.md
   \`\`\`
2. \`revision-context.md\` — prečo táto runda (zoznam neuzavretých flagov + konflikty).
3. \`instructions.md\` — substituuj
   \`.agents/templates/instructions-refinement.md.tpl\` so správnym
   RUN_ID, BRANCH, ROUND, AGENT_LIST_DETAIL, AGENT_INVOCATIONS atď.
   (\`tools/prepare-stage.sh\` sám refinement neumie — vyžaduje analýzu PM-proxy.)

Po doplnení zmaž tento SKELETON.md.
EOF
    ;;

  *)
    echo "unknown stage-name: $stage_name" >&2
    exit 2
    ;;
esac

# Zaznam pripravenia
{
  echo "Stage prepared: $stage_name"
  echo "Run ID: $run_id"
  echo "Generated at: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "Files in $stage_dir:"
  ls "$stage_dir"
} > "$stage_dir/.prepared"

echo "✓ Stage $stage_name pripravená v $stage_dir"
echo ""
echo "Otvor nový Claude Code chat a paste-ni:"
echo ""
echo "  Si PM pre SDM-Rewrite. Tvoja inštrukcia je v"
echo "  \`$stage_dir/instructions.md\`. Vykonaj ju."
