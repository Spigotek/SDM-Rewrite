#!/usr/bin/env bash
# Assembluje system prompt + task pre konkrétneho sub-agenta.
# Vstup:  agent-id (napr. 01-api-analyst), runId, mode (fresh|revision)
# Výstup: vypisuje na stdout kompletný prompt (system + task), ktorý sa
#         následne uloží do .agents/runs/<runId>/stage-*/prompts/<agent-id>.md
#
# Použitie:
#   tools/assemble-prompt.sh <agent-id> <runId> fresh [<round>]
#   tools/assemble-prompt.sh <agent-id> <runId> revision <round> <revision-body-file> <delta-links-file>

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

agent_id="${1:?usage: assemble-prompt.sh <agent-id> <runId> <mode> [<round>] [<revision-body-file>] [<delta-links-file>]}"
run_id="${2:?missing runId}"
mode="${3:?missing mode (fresh|revision)}"
round="${4:-1}"

agent_dir=".agents/$agent_id"
[ -d "$agent_dir" ] || { echo "agent dir not found: $agent_dir" >&2; exit 2; }

# Konkatenácia 6 kontraktných súborov do temp file
tmp_concat="$(mktemp -t agent-concat.XXXXXX)"
trap 'rm -f "$tmp_concat" "${tmp_revbody:-}" "${tmp_delta:-}"' EXIT

files=(agent.md focus.md inputs.md outputs.md preferences.md skills.md)
for f in "${files[@]}"; do
  if [ -f "$agent_dir/$f" ]; then
    cat "$agent_dir/$f" >> "$tmp_concat"
    printf '\n\n' >> "$tmp_concat"
  fi
done

short_name="${agent_id#*-}"

# Substitúcia: multi-line cez getline z temp file, single-line cez gsub
case "$mode" in
  fresh)
    tpl=".agents/templates/prompt-fresh.md.tpl"
    [ -f "$tpl" ] || { echo "missing template: $tpl" >&2; exit 2; }
    awk -v concat_file="$tmp_concat" \
        -v round="$round" \
        -v run_id="$run_id" \
        -v short_name="$short_name" '
      /\{\{AGENT_FILES_CONCAT\}\}/ {
        while ((getline line < concat_file) > 0) print line
        close(concat_file)
        next
      }
      {
        gsub(/\{\{ROUND\}\}/, round)
        gsub(/\{\{RUN_ID\}\}/, run_id)
        gsub(/\{\{SHORT_NAME\}\}/, short_name)
        print
      }
    ' "$tpl"
    ;;
  revision)
    revision_body_file="${5:?revision mode requires <revision-body-file>}"
    delta_links_file="${6:-}"
    [ -f "$revision_body_file" ] || { echo "missing $revision_body_file" >&2; exit 2; }
    if [ -z "$delta_links_file" ] || [ ! -f "$delta_links_file" ]; then
      tmp_delta="$(mktemp -t delta.XXXXXX)"
      echo "(žiadne — všetci ostatní nezmenení)" > "$tmp_delta"
      delta_links_file="$tmp_delta"
    fi

    tpl=".agents/templates/prompt-revision.md.tpl"
    [ -f "$tpl" ] || { echo "missing template: $tpl" >&2; exit 2; }
    awk -v concat_file="$tmp_concat" \
        -v rev_file="$revision_body_file" \
        -v delta_file="$delta_links_file" \
        -v round="$round" \
        -v run_id="$run_id" \
        -v short_name="$short_name" '
      /\{\{AGENT_FILES_CONCAT\}\}/ {
        while ((getline line < concat_file) > 0) print line
        close(concat_file)
        next
      }
      /\{\{REVISION_REQUEST_BODY\}\}/ {
        while ((getline line < rev_file) > 0) print line
        close(rev_file)
        next
      }
      /\{\{DELTA_LINKS\}\}/ {
        while ((getline line < delta_file) > 0) print line
        close(delta_file)
        next
      }
      {
        gsub(/\{\{ROUND\}\}/, round)
        gsub(/\{\{RUN_ID\}\}/, run_id)
        gsub(/\{\{SHORT_NAME\}\}/, short_name)
        print
      }
    ' "$tpl"
    ;;
  *)
    echo "unknown mode: $mode (use fresh|revision)" >&2
    exit 2
    ;;
esac
