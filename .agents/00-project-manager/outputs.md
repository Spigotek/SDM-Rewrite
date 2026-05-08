# Outputs — Project Manager

PM **nepíše do `docs/agents/`**. Jeho výstupy sú orchestračné — stav, logy,
súhrny.

## Povinné výstupy

| Cesta | Účel | Formát |
|---|---|---|
| `.agents/state.json` | Aktuálny stav pipeline (per-agent status, časy, runId) | JSON |
| `.agents/runs/<runId>/manifest.json` | Metadáta behu (start/end, agenti, výsledky) | JSON |
| `.agents/runs/<runId>/<NN>-<name>.log` | Stream udalostí konkrétneho agenta | JSONL |
| `.agents/runs/<runId>/summary.md` | Ľudsky čitateľný súhrn behu | Markdown |

## Schéma `state.json`

```json
{
  "runId": "<uuid>",
  "startedAt": "<iso>",
  "updatedAt": "<iso>",
  "completedAt": "<iso|null>",
  "status": "round1-phase-a|round1-phase-b|refinement|completed|failed|escalated",
  "currentRound": 1,
  "maxIterations": 5,
  "git": {
    "pipelineBranch": "pipeline/<runId>/integration",
    "baseRef": "<sha-of-main-at-start>",
    "finalPrUrl": "<gh-pr-url|null>"
  },
  "rounds": [
    {
      "round": 1,
      "kind": "broadcast",
      "startedAt": "<iso>",
      "completedAt": "<iso|null>",
      "branch": "pipeline/<runId>/round-1",
      "phases": {
        "a": {
          "agents": ["01-api-analyst", "02-ux-persona-analyst", "03-domain-modeller"],
          "status": "completed",
          "validationPassed": true
        },
        "b": {
          "agents": ["04-architecture", "05-security", "06-tech-stack-selector",
                    "07-design-system", "08-devex-devops", "09-qa-test-strategy"],
          "status": "completed",
          "validationPassed": true
        }
      }
    },
    {
      "round": 2,
      "kind": "refinement",
      "startedAt": "<iso>",
      "completedAt": "<iso|null>",
      "branch": "pipeline/<runId>/round-2",
      "agentsRun": ["01-api-analyst", "04-architecture", "05-security"],
      "convergenceCheck": {
        "openDependenciesCount": 4,
        "conflictsCount": 1,
        "decision": "continue|exit|escalate"
      }
    }
  ],
  "agents": {
    "<agent-id>": {
      "lastRound": 2,
      "lastStatus": "completed|failed|skipped",
      "totalRuns": 2,
      "lastValidationPassed": true,
      "openDependencies": ["[04-architecture] ...", "[?] ..."],
      "branches": [
        { "round": 1, "branch": "agent/<runId>/01-api-analyst", "merged": true, "commitSha": "<sha>" },
        { "round": 2, "branch": "agent/<runId>/01-api-analyst-r2", "merged": true, "commitSha": "<sha>" }
      ],
      "worktree": ".agents/runs/<runId>/worktrees/<NN>-<name>/",
      "history": [
        { "round": 1, "outputsValid": true, "durationMs": 123456 },
        { "round": 2, "outputsValid": true, "durationMs": 78900 }
      ]
    }
  },
  "oscillationLog": [
    { "agent": "<id>", "rounds": [2, 3, 4], "stateHashes": ["hashA", "hashB", "hashA"], "detected": false }
  ]
}
```

## Validačný kontrakt

Pre každého dokončeného agenta v každej runde PM kontroluje:
1. Existencia každej cesty deklarovanej v jeho `outputs.md`.
2. Každý markdown súbor má veľkosť > 1024 B (filter pre prázdne stuby).
3. Markdown obsahuje aspoň jeden H1 a jeden H2.
4. JSON súbory sú syntakticky validný JSON.
5. **Každý markdown artefakt obsahuje sekciu `## Otvorené závislosti`**
   (kontrakt v `.agents/README.md`).

## Konvergenčný kontrakt

Po každej runde 2..N PM vyhodnocuje:
- **`no_open_dependencies`** — celkový počet flag-ov v sekciách
  `## Otvorené závislosti` všetkých artefaktov je 0 (alebo všetky sú
  `[resolved-in-round-<N>]`).
- **`no_cross_artifact_conflicts`** — LLM-driven check porovná tvrdenia
  cross-referenced medzi artefaktmi a hľadá rozpory; výsledok = 0 konfliktov.
- **`validation_passed`** — všetky `outputs.md` kontrakty splnené.

Všetky 3 signály musia platiť → loop ukončený, status `completed`.

## Eskalácia človeku

Pri eskalácii PM vypíše:
1. Aktuálny round + dôvod eskalácie (`max_iterations` / `oscillation` /
   `unresolvable_conflict` / `merge_conflict`).
2. Otvorené závislosti zoradené po cieľových agentoch.
3. Konflikty (cross-artifact) so zdrojovými artefaktmi.
4. Pre osciláciu: trace stavov agenta cez posledné rundy.
5. **Pre merge konflikt**: súbor + path + zoznam agentov, ktorí ho oba menili.
6. Návrh ďalších krokov (napr. „daj direktívu pre 04, či má byť BFF, a re-spusti").

## Finálny merge — Pull Request

Po dosiahnutí konvergencie PM:
1. Commitne posledný integration stav do `pipeline/<runId>/integration`.
2. Pushne `pipeline/<runId>/integration` do `origin`.
3. Otvorí PR cez `gh pr create --base main --head pipeline/<runId>/integration` s
   pre-pripraveným titulkom a popisom (template v `pipeline.yaml` `git.pull_request`).
4. URL PR-u zapíše do `state.json.git.finalPrUrl`.
5. Vypíše človeku link na PR a ukončí beh so `status: completed`.

**PM nikdy nemerguje do `main` priamo.** Aj keď konvergencia prešla,
finálne rozhodnutie je na človeku.
