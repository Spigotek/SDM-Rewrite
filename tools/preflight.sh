#!/usr/bin/env bash
# Preflight check pred spustením analytickej pipeline (PM-proxy mód).
# Volaj pred kickoff-om alebo ako prvý krok PM-proxy v novom chate.
# Exit 0 = OK, !=0 = blocker.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT" || exit 2

errors=0
log() { printf "  %s\n" "$*"; }
ok()  { printf "✓ %s\n" "$*"; }
err() { printf "✗ %s\n" "$*"; errors=$((errors + 1)); }

printf "Preflight check pre SDM-Rewrite analytickú pipeline\n"
printf "%s\n" "──────────────────────────────────────────────────"

# 1. cwd je repo root
if [ -d .git ] && [ -f .agents/pipeline.yaml ]; then
  ok "cwd je repo root: $REPO_ROOT"
else
  err "nie si v repo root (chýba .git alebo .agents/pipeline.yaml)"
  exit 2
fi

# 2. branch = main, working tree clean
current_branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?')"
if [ "$current_branch" = "main" ]; then
  ok "branch: main"
else
  err "aktuálny branch je '$current_branch', očakávaný 'main'"
  log "    spusti: git checkout main"
fi

if [ -z "$(git status --porcelain 2>/dev/null)" ]; then
  ok "working tree čistý"
else
  err "working tree má nestaged/unstaged zmeny — commit-ni alebo stash"
fi

# 3. lokálny main sync s origin/main
git fetch origin main --quiet 2>/dev/null || err "git fetch origin main zlyhal"
local_sha="$(git rev-parse main 2>/dev/null || echo '')"
remote_sha="$(git rev-parse origin/main 2>/dev/null || echo '')"
if [ -n "$local_sha" ] && [ "$local_sha" = "$remote_sha" ]; then
  ok "main sync s origin/main"
else
  err "lokálny main NIE JE sync s origin/main (local=${local_sha:0:7}, remote=${remote_sha:0:7})"
fi

# 4. .agents/ štruktúra
required_agents=(
  "00-project-manager"
  "01-api-analyst"
  "02-ux-persona-analyst"
  "03-domain-modeller"
  "04-architecture"
  "05-security"
  "06-tech-stack-selector"
  "07-design-system"
  "08-devex-devops"
  "09-qa-test-strategy"
  "10-documentation-author"
)
required_files=(agent.md focus.md inputs.md outputs.md preferences.md skills.md mcp.json hooks.json)
missing_agents=0
for a in "${required_agents[@]}"; do
  for f in "${required_files[@]}"; do
    if [ ! -f ".agents/$a/$f" ]; then
      err "chýba .agents/$a/$f"
      missing_agents=$((missing_agents + 1))
    fi
  done
done
if [ "$missing_agents" -eq 0 ]; then
  ok "všetkých 11 agent-folderov má 8/8 súborov"
fi

# 5. pipeline.yaml + kickoff.md + revision contract
[ -f .agents/pipeline.yaml ] && ok ".agents/pipeline.yaml existuje" \
                              || err ".agents/pipeline.yaml chýba"
[ -f .agents/kickoff.md ]    && ok ".agents/kickoff.md existuje (runbook)" \
                              || err ".agents/kickoff.md chýba"
[ -f .agents/README.md ]     && ok ".agents/README.md existuje (revision contract)" \
                              || err ".agents/README.md chýba"

# Templates pre staged orchestráciu
required_templates=(
  ".agents/templates/instructions-broadcast.md.tpl"
  ".agents/templates/instructions-refinement.md.tpl"
  ".agents/templates/instructions-post-conv.md.tpl"
  ".agents/templates/instructions-final-pr.md.tpl"
  ".agents/templates/prompt-fresh.md.tpl"
  ".agents/templates/prompt-revision.md.tpl"
)
missing_tpl=0
for t in "${required_templates[@]}"; do
  [ -f "$t" ] || { err "chýba template: $t"; missing_tpl=$((missing_tpl + 1)); }
done
[ "$missing_tpl" -eq 0 ] && ok "všetkých 6 templates v .agents/templates/"

# Helper skripty
required_scripts=(tools/init-pipeline.sh tools/prepare-stage.sh tools/assemble-prompt.sh)
missing_sc=0
for s in "${required_scripts[@]}"; do
  if [ ! -x "$s" ]; then
    err "$s chýba alebo nie je executable (chmod +x)"
    missing_sc=$((missing_sc + 1))
  fi
done
[ "$missing_sc" -eq 0 ] && ok "všetky 3 helper skripty executable"

# 6. zdrojové dokumenty
[ -f docs/ca-service-management-17-4.pdf ] \
  && ok "CA SDM 17.4 PDF prítomné" \
  || err "docs/ca-service-management-17-4.pdf chýba"

# 7. gh CLI + auth (pre finálny PR)
if command -v gh >/dev/null 2>&1; then
  ok "gh CLI nainštalované ($(gh --version | head -1))"
  if gh auth status >/dev/null 2>&1; then
    ok "gh auth OK"
  else
    err "gh auth zlyhal — spusti 'gh auth login'"
  fi
else
  err "gh CLI nie je nainštalované — 'brew install gh'"
fi

# 8. pdftotext (potrebné pre 01-api-analyst)
if command -v pdftotext >/dev/null 2>&1; then
  ok "pdftotext k dispozícii"
else
  err "pdftotext nie je nainštalovaný — 'brew install poppler'"
fi

# 9. predošlý beh (informačné, nie blocker)
if [ -f .agents/.current-run-id ]; then
  prev="$(cat .agents/.current-run-id)"
  log "ℹ predošlý runId: $prev (resume-uj cez --resume alebo zmaž súbor pre fresh)"
fi

printf "%s\n" "──────────────────────────────────────────────────"
if [ "$errors" -eq 0 ]; then
  printf "✓ Preflight OK — pipeline pripravená na štart.\n"
  exit 0
else
  printf "✗ Preflight FAILED s %d chybami — vyrieš pred kickoff-om.\n" "$errors"
  exit 1
fi
