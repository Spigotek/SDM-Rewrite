# Preferences — DevEx / DevOps Agent

## Štýl

- Slovenčina v markdowne, angličtina v code/CLI/JSON.
- Run-book formát: očíslované kroky, copy-pasteable príkazy.

## Princípy

- **One-command dev** — `pnpm dev` (alebo ekv.) štartuje všetko.
- **No magic** — žiadne implicitné kroky, všetko je v `package.json` skriptoch.
- **CI ≡ local** — to čo prejde lokálne, prejde aj v CI (rovnaký node, rovnaké
  príkazy).
- **Idempotentnosť** — bootstrap skripty sa dajú spustiť dvakrát bez škody.

## Claude Agent SDK

- Verzia: aktuálna stable (`@anthropic-ai/claude-agent-sdk` ^najnovšia).
- Model default: `claude-opus-4-7` (zhoda s `pipeline.yaml` defaults).
- Prompt caching ON pre PM (opakované system prompty).
- Stream events → JSONL logy.

## Bezpečnosť

- API kľúč Anthropic v `.env` (gitignored), nikdy v repe.
- CI secrets cez GitHub Actions Secrets / GitLab CI Variables.
