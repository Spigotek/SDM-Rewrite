# Inputs — Documentation Author

## Predchodcovia (jediný relevantný vstup po konvergencii)

Všetky výstupy z `docs/agents/`:

| Cesta | Zdroj |
|---|---|
| `docs/agents/api-analyst/` | 01 — endpointy, schémy, auth, multi-tenancy, gaps |
| `docs/agents/ux/` | 02 — persony, journeys, wireframy, screen-inventory |
| `docs/agents/domain/` | 03 — entity, vzťahy, lifecycles, glosár, ui-views |
| `docs/agents/architecture/` | 04 — C4, ADRs, monorepo, BFF, data-flows |
| `docs/agents/security/` | 05 — auth, RBAC, threat model, OWASP, multi-tenancy-security |
| `docs/agents/stack/` | 06 — porovnávacia matica, decision, libraries |
| `docs/agents/design-system/` | 07 — tokens, komponenty, a11y, theming |
| `docs/agents/devops/` | 08 — bootstrap, CI/CD, mock, pm-runtime, pm-git-strategy |
| `docs/agents/qa/` | 09 — test strategy, mock, coverage, acceptance, perf, a11y |

## Globálny kontext

- `GOAL.md` — projektový kontext, scope, NFR, multi-tenancy, MVP-first.
- `README.md` — verejný popis projektu (treba s ním zladiť tón).
- `.agents/pipeline.yaml` — pre pochopenie pipeline-u (informačné, do
  výstupu nepatrí).

## **Mimo vstupov** — explicitne zakázané čítať

- `docs/ca-service-management-17-4.pdf` — to je zdroj 01. Ak ti niečo chýba,
  je to chyba 01, eskaluj cez `## Otvorené závislosti`.
- `.agents/<NN>-<name>/*` — agent kontrakty. Nepatria do tvojej konsolidácie.
