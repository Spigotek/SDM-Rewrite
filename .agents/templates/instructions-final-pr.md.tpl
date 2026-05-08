# Stage final-pr — Finálny Pull Request

> **Run ID**: `{{RUN_ID}}`
> **Branch**: `pipeline/{{RUN_ID}}/integration` (integrácia všetkých rúnd + post-konvergencie)

---

## Si Project Manager (PM-proxy)

Pipeline konvergovala, dokumentácia konsolidovaná. **Posledný krok**: push pipeline-vetvy a otvorenie PR proti `main`. Človek robí review a finálny merge.

## Pre-flight

```bash
bash tools/preflight.sh
git rev-parse --abbrev-ref HEAD       # malo by byť: pipeline/{{RUN_ID}}/integration
git log --oneline main..HEAD | head   # zoznam commitov, ktoré sa idú PR-nuť
```

Over že:
- všetky stage-* adresáre v `.agents/runs/{{RUN_ID}}/` majú `done.txt`,
- žiadny `escalation.md` neostal otvorený,
- `docs/spec/` a `docs/{system-overview,dev-handbook,onboarding}.md` existujú.

## Postup

### 1. Push pipeline-vetvy

```bash
git push -u origin "pipeline/{{RUN_ID}}/integration"
```

### 2. Vyrob finálny súhrn

Zapíš `.agents/runs/{{RUN_ID}}/summary.md` — krátky súhrn behu:

```markdown
# Pipeline {{RUN_ID}} — súhrn

- Štart: <iso>
- Koniec: <iso>
- Celkové trvanie: ...
- Počet rúnd: <N>
- Počet eskalácií: <count>
- Počet zmien per agent (round 1 → final):
  - 01-api-analyst: <total runs>
  - ...
- Linky na artefakty: docs/agents/* a docs/spec/*

## Highlights

(2–3 vety o najdôležitejších rozhodnutiach z behu)

## Otvorené body pre review

(zoznam neuzavretých kozmetických flagov, ak nejaké)
```

### 3. Otvor PR

```bash
gh pr create \
  --base main \
  --head "pipeline/{{RUN_ID}}/integration" \
  --title "Pipeline {{RUN_ID}} — analytická dokumentácia (konvergencia po {{TOTAL_ROUNDS}} rundách)" \
  --body "$(cat <<'EOF'
## Summary

Auto-vytvorené Project Managerom po dosiahnutí konvergencie analytického pipeline-u.

- **Run ID**: {{RUN_ID}}
- **Rounds**: {{TOTAL_ROUNDS}}
- **Agents run**: 10 (01–09 + post-konvergenčný 10)
- **Eskalácií**: {{ESCALATIONS}}

## Výstupy

### Analytické artefakty (zdroj pravdy per doména)
- \`docs/agents/api-analyst/\` — REST/SOAP katalóg, schémy, auth, multi-tenancy
- \`docs/agents/ux/\` — persony, journeys, wireframy
- \`docs/agents/domain/\` — entity, lifecycles, glosár
- \`docs/agents/architecture/\` — C4, ADRs, monorepo layout
- \`docs/agents/security/\` — auth flow, RBAC, threat model, OWASP
- \`docs/agents/stack/\` — porovnávacia matica, decision, libraries
- \`docs/agents/design-system/\` — tokens, komponenty, a11y
- \`docs/agents/devops/\` — bootstrap, CI/CD, mock, PM runtime
- \`docs/agents/qa/\` — test strategy, mock, coverage, acceptance

### Konsolidované dokumenty (pre vývoj a ľudské oko)
- \`docs/spec/\` — per-modul špecifikácie (Incident, Request, Problem, Change, KB, CMDB, multi-tenancy)
- \`docs/system-overview.md\`
- \`docs/dev-handbook.md\`
- \`docs/onboarding.md\`

### Súhrn behu
- \`.agents/runs/{{RUN_ID}}/summary.md\`

## Test plan

- [ ] Review per-modul špecifikácií — overiť konzistenciu s \`docs/agents/*\`
- [ ] Review konsolidovaných dokumentov — system-overview, dev-handbook, onboarding
- [ ] Spot-check ADRs v \`docs/agents/architecture/decision-records/\`
- [ ] Spot-check threat-model + RBAC mapping
- [ ] Voliteľne: lokálne spustiť bootstrap (\`docs/agents/devops/repo-bootstrap.md\`)

🤖 Pipeline orchestrated by PM via Claude Agent SDK / PM-proxy.
EOF
)"
```

### 4. Záznam URL PR

```bash
PR_URL="<vrátený-url>"
echo "$PR_URL" > .agents/runs/{{RUN_ID}}/pr-url.txt
touch ".agents/runs/{{RUN_ID}}/stage-final-pr/done.txt"
```

### 5. Hand-off (final)

```
✓ Pipeline {{RUN_ID}} dokončený.

PR: <PR_URL>

Človek robí review v PR a finálny merge cez UI alebo `gh pr merge --squash <PR_NUM>`.

Branch protection vynúti, že merge prejde iba cez approved PR.
```

## Cleanup (po merge, voliteľné)

Po úspešnom merge PR-u môžeš lokálne:

```bash
git checkout main
git pull
# rotate run-id pointer
echo "" > .agents/.current-run-id
```

Worktrees boli postupne uvoľňované; staré agent vetvy ostávajú lokálne pre auditovateľnosť (per `pipeline.yaml` cleanup).
