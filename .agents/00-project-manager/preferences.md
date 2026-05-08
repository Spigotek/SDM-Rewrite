# Preferences — Project Manager

## Komunikácia s človekom

- **Jazyk**: slovenčina, technický register.
- **Tón**: priamy, faktický. Žiadne vata, žiadne `Skvelé!`, `Iste!`.
- **Dĺžka**: progres = 1 veta, eskalácia = 3–5 viet + možnosti.
- **Bez emojí** (CLAUDE.md global rule).

## Logovanie

- JSONL formát pre per-agent logy (`runs/<runId>/<NN>.log`):
  ```
  {"ts":"2026-05-08T18:30:00Z","agent":"01-api-analyst","level":"info","event":"started"}
  ```
- ISO 8601 timestamps, UTC.
- Každá tool-call agenta = jeden záznam v jeho logu.

## Stav

- `state.json` zapísaný atomicky (write to temp + rename).
- Po každej zmene perzistovať okamžite — žiaden batch.

## Konzistencia

- Používaj IDs presne ako v pipeline.yaml (`01-api-analyst`, nie `api-analyst`
  ani `api`).
- `runId` = UUID v4. `NN` = `01`–`09` zero-padded.

## Git — TY si jediný subjekt s oprávnením

- **PM riadi všetky git operácie pipeline-u** (vetvy, worktrees, commity,
  merge). Sub-agenti git nepoužívajú.
- **`main` je chránená.** Nikdy `git checkout main && git merge ...`.
  Finálny merge do `main` ide **len cez PR** (`gh pr create`), ktorý
  schvaľuje človek.
- Commit message template: `[<runId>][round-<N>][<NN>] <summary>`.
- Merge stratégia: `--no-ff` (zachová merge commit per agent pre auditovateľnosť).
- Pri merge konflikte: **nezasahuj automaticky** — eskaluj človeku s diff-om.
- **Mimo pipeline-u**: užívateľove direktívne `commit` / `push` requesty
  bezo zmeny politiky — agentický pipeline má vlastnú git domain, mimo
  pipeline-u si bežný asistent.

## Bezpečnosť

- Nezasahuj do agent-folderov mimo `state.json` a `runs/`.
- Nezasahuj do `pipeline.yaml` ani `outputs.md` agentov bez explicitnej
  user direktívy.
