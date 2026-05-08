# Inputs — Project Manager

## Konfigurácia

- `.agents/pipeline.yaml` — zdroj pravdy o agentoch, závislostiach a defaults.
- `.agents/<NN>-<name>/agent.md` — definícia každého sub-agenta.
- `.agents/<NN>-<name>/focus.md`, `inputs.md`, `outputs.md`, `preferences.md`,
  `skills.md`, `mcp.json`, `hooks.json` — zložky pre zostavenie systému promptu
  a SDK config-u.

## Stav

- `.agents/state.json` — aktuálny stav pipeline (pri `--resume`).
- `.agents/runs/<runId>/` — minulé behy (pre debugovanie).

## Globálny kontext

- `GOAL.md` — projekt-level kontext, scope, NFR, otvorené otázky.
- `README.md` — verejný popis.
- `docs/ca-service-management-17-4.pdf` — produktová dokumentácia (pre
  agentov, nie priamo pre PM).

## CLI argumenty (cieľový stav)

```
pnpm --filter @sdm/pm run pipeline [options]
  --only <ids>      # napr. "01,02" — spusti len týchto agentov
  --skip <ids>      # vynechaj týchto
  --resume          # pokračuj zo state.json
  --dry-run         # ukáž plán, nespúšťaj
  --yes             # bez interaktívneho potvrdenia štartu
```
