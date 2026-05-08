# Stage {{STAGE_LABEL}} — Round {{ROUND}} {{PHASE_LABEL}}

> **Run ID**: `{{RUN_ID}}`
> **Branch**: `{{BRANCH}}`
> **Agenti v tejto fáze**: {{AGENT_LIST}}
> **Predchádzajúci stage**: {{PREV_STAGE}}
> **Stage adresár**: `{{STAGE_DIR}}`

---

## Si Project Manager (PM-proxy)

Tvoja system prompt: pravidlá z `.agents/00-project-manager/{agent,focus,outputs,preferences,skills}.md` + tieto inštrukcie. **Tu robíš jednu konkrétnu fázu**, nič viac.

## Pre-flight (povinné)

```bash
bash tools/preflight.sh
git rev-parse --abbrev-ref HEAD     # malo by byť: {{BRANCH}}
ls -la {{STAGE_DIR}}/prompts/        # malo by obsahovať {{AGENT_COUNT}} súborov
```

Ak preflight zlyhá → **eskalácia**.

## Postup

### 1. Spusti agentov paralelne (jednou správou s viacerými Agent volaniami)

Pre každého z agentov nižšie: prečítaj prompt súbor a spusti cez Agent tool s `isolation: "worktree"`.

```
{{AGENT_INVOCATIONS}}
```

**Čakaj na vrátenie všetkých {{AGENT_COUNT}} agentov.** Každý vráti `branch_name` a `worktree_path`.

### 2. Validácia per agent

Pre každého:

a) Validuj výstupy podľa `.agents/<NN>-<name>/outputs.md`:
   - existencia všetkých deklarovaných ciest,
   - veľkosť > 1024 B,
   - markdown má H1 + H2,
   - **`## Otvorené závislosti` sekcia na konci** každého markdown artefaktu.

b) Ak validácia OK:
   ```bash
   git -C "<worktree_path>" branch -m "agent/{{RUN_ID}}/<NN>-<name>"
   git checkout "{{BRANCH}}"
   git merge --no-ff "agent/{{RUN_ID}}/<NN>-<name>" \
     -m "[{{RUN_ID}}][round-{{ROUND}}][<NN>] <stručný-súhrn>"
   git worktree remove "<worktree_path>"
   ```

c) Ak validácia zlyhá → 1 retry (re-invokuj agenta s odkazom na chybu). Pri opakovanom zlyhaní → **eskalácia**.

### 3. Záznam outcome

Zapíš do `{{STAGE_DIR}}/log.md`:

```markdown
# Stage {{STAGE_LABEL}} — log

- Run ID: {{RUN_ID}}
- Branch: {{BRANCH}}
- Štart: <iso-timestamp>
- Koniec: <iso-timestamp>

## Per-agent výsledky

| Agent | Status | Branch | Flagov v artefaktoch | Trvanie |
|---|---|---|---|---|
| 01-api-analyst | ✓ completed | agent/{{RUN_ID}}/01-api-analyst | 4 | 18m |
| ... | ... | ... | ... | ... |

## Konflikty / poznámky

(žiadne | popis)
```

### 4. Pripravi ďalší stage

{{NEXT_STAGE_INSTRUCTIONS}}

### 5. Označ stage hotovú

```bash
touch "{{STAGE_DIR}}/done.txt"
```

### 6. Hand-off — vypíš user-ovi

Vypíš **presne** tento blok (s reálnymi cestami):

```
✓ Stage {{STAGE_LABEL}} hotová.

Otvor nový Claude Code chat v rovnakom adresári a paste-ni:

> Si PM pre SDM-Rewrite. Tvoja inštrukcia je v
> `<NEXT_STAGE_DIR>/instructions.md`. Vykonaj ju.
```

## Eskalácia

Pri zlyhaní validácie po 1 retry, oscilácii alebo neriešiteľnom konflikte:

1. Zapíš detail do `{{STAGE_DIR}}/escalation.md`:
   - dôvod, dotknutí agenti, paths,
   - aspoň 2 navrhnuté možnosti riešenia pre user-a.
2. **Nepokračuj** — čakaj na user input.
3. Vypíš user-ovi krátky súhrn + presný odkaz na escalation.md.
