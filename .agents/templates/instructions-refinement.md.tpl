# Stage {{STAGE_LABEL}} — Refinement Round {{ROUND}}

> **Run ID**: `{{RUN_ID}}`
> **Branch**: `{{BRANCH}}` (vytvorená z `pipeline/{{RUN_ID}}/round-{{PREV_ROUND}}`)
> **Predchádzajúci stage**: {{PREV_STAGE}}

---

## Si Project Manager (PM-proxy)

Toto je refinement runda. **Predošlá fáza identifikovala otvorené flagy a/alebo cross-artifact konflikty**, ktoré treba vyriešiť.

## Cieľoví agenti tejto rundy

Predchádzajúci stage (PM-proxy v predošlom chate) zostavil **revision requesty** a uložil ich do `{{STAGE_DIR}}/prompts/`. Každý prompt obsahuje:

- system prompt agenta (z `.agents/<NN>-<name>/`),
- konkrétny revision request (čo prepracovať, čo nemeniť),
- delta výstupov ostatných (linky filtrované cez `context_hints`),
- round counter ({{ROUND}} z max 5).

Zoznam:

{{AGENT_LIST_DETAIL}}

## Pre-flight

```bash
bash tools/preflight.sh
git rev-parse --abbrev-ref HEAD      # musí byť: {{BRANCH}}
ls -la {{STAGE_DIR}}/prompts/
cat {{STAGE_DIR}}/revision-context.md  # prehľad, prečo je táto runda
```

## Postup

### 1. Spusti dotknutých agentov paralelne (jednou správou)

```
{{AGENT_INVOCATIONS}}
```

### 2. Validácia + merge (ako pri broadcast fáze)

Per agent: validuj `outputs.md` kontrakt + `## Otvorené závislosti`. Premenuj branch na `agent/{{RUN_ID}}/<NN>-<name>-r{{ROUND}}` (pridaj suffix `-r<round>` ak existuje predošlá vetva s rovnakým menom). Mergni `--no-ff` do `{{BRANCH}}`.

### 3. Konvergenčný check

Po merge všetkých agentov:

a) Parsuj `## Otvorené závislosti` zo **všetkých** markdown artefaktov v `docs/agents/**`.
b) LLM-driven cross-artifact konfliktný scan (porovnaj tvrdenia medzi artefaktmi 01–09).
c) Oscillation check: porovnaj stav každého agenta s predošlými 2 rundami; ak osciluje medzi 2 stavmi v 3 rundách → eskalácia.

**Konvergencia** = všetky 3 splnené:
- `no_open_dependencies` (všetky flagy uzavreté alebo `[resolved-...]`),
- `no_cross_artifact_conflicts` (LLM scan = 0),
- `validation_passed`.

### 4. Záznam outcome

`{{STAGE_DIR}}/log.md` (per-agent výsledky + konvergenčný súhrn).

### 5. Pripravi ďalší stage

**Ak konvergencia dosiahnutá**:

```bash
bash tools/prepare-stage.sh {{RUN_ID}} 99-post-conv
```

**Ak NIE konvergencia, a `currentRound < max_iterations` (5)**:

PM-proxy: identifikuj agentov, ktorí potrebujú ďalšiu rundu, a sám napíš ich revision prompty:

```bash
mkdir -p .agents/runs/{{RUN_ID}}/stage-{{NEXT_STAGE_LABEL}}/prompts
# ako PM-proxy: pre každého dotknutého agenta:
#   1. cat .agents/<NN>-<name>/{agent,focus,inputs,outputs,preferences,skills}.md
#   2. append revision request body (delta + body to revise + round counter)
#   3. ulož ako .agents/runs/{{RUN_ID}}/stage-{{NEXT_STAGE_LABEL}}/prompts/<NN>-<name>.md
# napíš tiež revision-context.md (prečo je táto runda potrebná)
```

Inštrukcie do `instructions.md` použi ako template tento súbor (`.agents/templates/instructions-refinement.md.tpl`) so substitúciou `{{STAGE_LABEL}}`, `{{ROUND}}`, `{{BRANCH}}` atď.

**Ak `currentRound >= max_iterations`** → **eskalácia** (zapíš `escalation.md`, nepokračuj, hand-off s detailami pre user-a).

### 6. Hand-off

```bash
touch "{{STAGE_DIR}}/done.txt"
```

Vypíš user-ovi: `✓ Stage {{STAGE_LABEL}} hotová. Otvor nový chat a paste-ni: ...`
