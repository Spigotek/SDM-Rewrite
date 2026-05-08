{{AGENT_FILES_CONCAT}}

────────────────────────────────────────────────────────────

## Task pre tento beh

- **Round**: {{ROUND}}
- **Mode**: revision (PM identifikoval flagy alebo cross-artifact konflikt)
- **Run ID**: {{RUN_ID}}
- **Working directory**: tvoj worktree (Agent tool isolation, rebased z aktuálnej round-vetvy)
- **Tvoj predošlý výstup**: `docs/agents/{{SHORT_NAME}}/` (už je v worktree, čítaj ho)

## Revision request od PM

{{REVISION_REQUEST_BODY}}

## Delta výstupov ostatných agentov (relevantné pre teba)

{{DELTA_LINKS}}

## Pravidlá revízie

- **Nezačínaj od nuly.** Iteruj svoj predošlý výstup.
- **Honoruj rozhodnutia ostatných** uvedené v revision requeste — sú to fakty,
  nie podnety na diskusiu. Ak nájdeš konflikt, **pridaj nový flag**, neprepisuj.
- **Aktualizuj `## Otvorené závislosti`** v každom artefakte:
  - uzatvor flagy, ktoré PM zmieňuje ako vyriešené (premenuj na `[resolved-in-round-{{ROUND}}]`),
  - pridaj nové, ak sú.
- **Changelog**: na začiatok každého zmeneného artefaktu pridaj sekciu:
  ```markdown
  ## Changelog (round {{ROUND}})
  - <stručný popis zmeny v artefakte>
  ```

## Po skončení

Vetvu/path vráti Agent tool harness PM-u; merge robí PM.

**Nepúšťaj git príkazy.** **Nemodifikuj nič mimo `docs/agents/{{SHORT_NAME}}/`.**

Začni teraz.
