{{AGENT_FILES_CONCAT}}

────────────────────────────────────────────────────────────

## Task pre tento beh

- **Round**: {{ROUND}}
- **Mode**: fresh (round-1 broadcast — žiaden predošlý výstup)
- **Run ID**: {{RUN_ID}}
- **Working directory**: tvoj worktree (Agent tool isolation)
- **Cieľ**: produkuj **všetky** artefakty deklarované v tvojom `outputs.md`
  v cieľovom adresári `docs/agents/{{SHORT_NAME}}/`. Vytvor adresár, ak neexistuje.
- **Povinné**: každý markdown artefakt musí končiť sekciou
  `## Otvorené závislosti` podľa kontraktu v `.agents/README.md`.
  Ak nemáš žiadne flagy: napíš `Žiadne. Artefakt je samonosný.`.

## Po skončení

Tvoj worktree obsahuje hotové artefakty. Vetvu/path vráti Agent tool harness PM-u —
ten merge spraví sám.

**Nepúšťaj git príkazy.** **Nemodifikuj nič mimo `docs/agents/{{SHORT_NAME}}/`.**

Začni teraz.
