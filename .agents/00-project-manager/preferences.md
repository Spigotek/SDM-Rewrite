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

## Bezpečnosť

- Nikdy necommituj a nepushuj do gitu. Aj keď user požiada o "ulož" — to
  znamená písať na disk, nie git commit. Git commit vyžaduje explicitnú
  inštrukciu `commit` alebo `commitni`.
- Nezasahuj do agent-folderov mimo `state.json` a `runs/`.
