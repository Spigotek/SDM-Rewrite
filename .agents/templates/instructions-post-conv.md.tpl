# Stage {{STAGE_LABEL}} — Post-konvergencia (Documentation Author)

> **Run ID**: `{{RUN_ID}}`
> **Branch**: `{{BRANCH}}` (= `pipeline/{{RUN_ID}}/round-{{ROUND}}` po konvergencii)
> **Agent**: `10-documentation-author` (jediný)
> **Predchádzajúci stage**: {{PREV_STAGE}}

---

## Si Project Manager (PM-proxy)

Konvergencia refinement loopu bola dosiahnutá. Tvoja úloha je spustiť agenta 10, ktorý zoberie konvergované výstupy 01–09 a vyrobí konsolidované dokumenty (`docs/spec/<modul>.md`, `docs/system-overview.md`, `docs/dev-handbook.md`, `docs/onboarding.md`).

## Pre-flight

```bash
bash tools/preflight.sh
git rev-parse --abbrev-ref HEAD                     # malo by byť: {{BRANCH}}
ls docs/agents/{api-analyst,ux,domain,architecture,security,stack,design-system,devops,qa}/
ls {{STAGE_DIR}}/prompts/10-documentation-author.md  # musí existovať
```

## Postup

### 1. Spusti agenta 10

```
Agent({
  description: "Run 10-documentation-author",
  subagent_type: "general-purpose",
  isolation: "worktree",
  prompt: <obsah {{STAGE_DIR}}/prompts/10-documentation-author.md>
})
```

### 2. Validácia výstupov

Podľa `.agents/10-documentation-author/outputs.md`:

- `docs/spec/incident-management.md`
- `docs/spec/request-management.md`
- `docs/spec/problem-management.md`
- `docs/spec/change-management.md`
- `docs/spec/knowledge-management.md`
- `docs/spec/cmdb.md`
- `docs/spec/multi-tenancy.md`
- `docs/system-overview.md`
- `docs/dev-handbook.md`
- `docs/onboarding.md`

Každý: > 1024 B, H1 + TOC, `## Otvorené závislosti` na konci.

### 3. Špeciálna logika kritických flagov

Prečítaj `## Otvorené závislosti` zo všetkých výstupov agenta 10:

- **Žiadne flagy / iba kozmetické / iba `[?]`** → pokračuj na bod 4 (merge + final PR).
- **Kritický flag adresovaný 01–09** (cross-artifact inkonzistencia objavená pri konsolidácii) → **re-otvor refinement loop**:
  - Vytvor `pipeline/{{RUN_ID}}/round-{{NEXT_ROUND}}` z `{{BRANCH}}`.
  - Sám napíš prompty pre dotknutých 01–09 do `.agents/runs/{{RUN_ID}}/stage-{{REOPEN_STAGE}}/prompts/`.
  - Zapíš `instructions.md` z template `.agents/templates/instructions-refinement.md.tpl`.
  - Hand-off na nový chat.
  - **Po novej konvergencii sa agent 10 spúšťa znova** (nový post-conv stage).

### 4. Merge

```bash
git -C "<worktree>" branch -m "agent/{{RUN_ID}}/10-documentation-author"
git checkout "{{BRANCH}}"
git merge --no-ff "agent/{{RUN_ID}}/10-documentation-author" \
  -m "[{{RUN_ID}}][round-{{ROUND}}][10] post-konvergenčná konsolidácia"
git worktree remove "<worktree>"
```

### 5. Finalizuj round-vetvu do pipeline-vetvy

```bash
git checkout "pipeline/{{RUN_ID}}"
git merge --no-ff "{{BRANCH}}" \
  -m "[{{RUN_ID}}] integrácia round-{{ROUND}} (konvergencia + dokumentácia)"
```

### 6. Pripravi finálny PR stage

```bash
bash tools/prepare-stage.sh {{RUN_ID}} final-pr
```

### 7. Záznam + hand-off

```bash
# log.md s výsledkami agenta 10
touch "{{STAGE_DIR}}/done.txt"
```

Hand-off:

```
✓ Stage {{STAGE_LABEL}} hotová. Konvergencia + dokumentácia done.

Otvor nový Claude Code chat a paste-ni:

> Si PM pre SDM-Rewrite. Tvoja inštrukcia je v
> `.agents/runs/{{RUN_ID}}/stage-final-pr/instructions.md`. Vykonaj ju.
```
