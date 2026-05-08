# Kickoff — multi-chat staged pipeline (runbook)

> Tento súbor je **runbook** pre user-a. Hovorí, ako spustiť analytickú
> pipeline a čo paste-núť do každého nového Claude Code chatu.

## Princíp

Pipeline beží v **staged móde**: každá úroveň spracovania má **vlastný adresár**
v `.agents/runs/<runId>/stage-<NN>-<label>/`. **Predošlý stage pripraví
ďalší** (prompts + instructions.md), takže vždy presne vidíš, čo paste-núť
do nového chatu.

Stagey sú:

| # | Stage | Čo robí |
|---|---|---|
| init | (Bash) | `tools/init-pipeline.sh` — vytvorí runId, branches, prvý stage |
| 01-phase-a | CC chat | round 1 phase A: agenti 01, 02, 03 paralelne |
| 02-phase-b | CC chat | round 1 phase B: agenti 04–09 paralelne |
| 03-refinement-r2 | CC chat | refinement runda 2 (len ak treba) |
| ... | CC chat | ďalšie refinement rundy do konvergencie alebo max 5 |
| 99-post-conv | CC chat | agent 10 (documentation author) |
| final-pr | CC chat | push pipeline-vetvy, otvorenie PR proti `main` |

## Bootstrap

V termináli z repo root:

```bash
bash tools/init-pipeline.sh
```

Skript vykoná:
1. Pre-flight check.
2. Vygeneruje `runId` (timestamp).
3. Vytvorí `pipeline/<runId>` a `pipeline/<runId>/round-1` z `main`.
4. Pripraví prvý stage v `.agents/runs/<runId>/stage-01-phase-a/`:
   - `prompts/01-api-analyst.md`, `02-ux-persona-analyst.md`, `03-domain-modeller.md`
     — kompletné system prompty (concat agent kontraktov + task wrapper),
   - `instructions.md` — krok-za-krokom inštrukcie pre PM-proxy.
5. Vypíše presný prompt, ktorý paste-neš do nového CC chatu.

## Per-stage workflow

V termináli sa už nič nerobí (okrem `init` na začiatku). Workflow ostáva:

1. **Prečítaj `instructions.md`** aktuálneho stage-u — vieš čo a v akom poradí spustíš.
2. **Otvor nový Claude Code chat** v repo root.
3. **Paste-ni prompt** — vždy vo formáte:

   > Si PM pre SDM-Rewrite. Tvoja inštrukcia je v
   > `.agents/runs/<runId>/stage-<NN>-<label>/instructions.md`. Vykonaj ju.

4. CC vykoná stage:
   - spustí agentov paralelne (Agent tool, `isolation: worktree`),
   - validuje výstupy,
   - mergne agent-vetvy do round-vetvy,
   - **pripraví ďalší stage** cez `tools/prepare-stage.sh` (alebo manuálne pre refinement),
   - **vypíše ti**, ktorý súbor paste-núť do ďalšieho chatu.
5. Otvor nový chat, paste-ni — opakuj kým nedosiahnete `final-pr`.

## Helper skripty

| Skript | Účel |
|---|---|
| `tools/init-pipeline.sh` | Bootstrap nového behu (runId, branches, prvý stage). |
| `tools/prepare-stage.sh <runId> <stage>` | Generovanie ďalšieho stage adresára (volá CC alebo user manuálne). |
| `tools/assemble-prompt.sh <agent-id> <runId> <mode>` | Konkatenácia agent kontraktov do single promptu (volá `prepare-stage.sh`). |
| `tools/preflight.sh` | Sanity check pred kickoff-om / pred každým stage-om. |

## Štruktúra stage adresára

```
.agents/runs/<runId>/
├── manifest.json                       # meta o behu (runId, status, branches)
└── stage-<NN>-<label>/
    ├── instructions.md                 # ← paste-ni do CC chatu
    ├── prompts/
    │   ├── <NN>-<agent>.md             # full system prompt + task per agent
    │   └── ...
    ├── revision-context.md             # (iba refinement) prečo táto runda
    ├── done.txt                        # CC vytvorí po skončení
    ├── log.md                          # CC zapíše outcome
    └── escalation.md                   # (iba pri eskalácii)
```

## Pravidlá pre CC v každom stage-u

CC v stage chate je **PM-proxy** s úzkym scope-om — robí iba **jednu fázu**:

- Pred štartom: `bash tools/preflight.sh`.
- Spúšťa agentov paralelne (jedna správa, viac Agent volaní).
- Po validácii merguje agent-vetvy do round-vetvy (`--no-ff`).
- Generuje ďalší stage (`tools/prepare-stage.sh` pre broadcast/post-conv;
  pre refinement píše prompty manuálne podľa flag-analýzy).
- Označí `done.txt`, vypíše hand-off pre user-a.
- **Žiaden merge do `main` priamo** — len cez PR v `final-pr` stage.

## Post-konvergenčný flow

1. Po `02-phase-b`: ak konvergencia → `tools/prepare-stage.sh <runId> 99-post-conv`.
2. `99-post-conv`: agent 10 vyrobí konsolidované dokumenty (`docs/spec/*`,
   `docs/system-overview.md`, `docs/dev-handbook.md`, `docs/onboarding.md`).
3. Ak agent 10 nájde **kritickú** inkonzistenciu → re-otvor refinement
   rundu medzi 01–09.
4. Inak: `tools/prepare-stage.sh <runId> final-pr`.
5. `final-pr` chat: `git push` + `gh pr create` proti `main`. Človek
   robí review v PR.

## Eskalácia

Pri zlyhaní validácie / max iteráciách / oscilácii / merge konflikte:
- Stage chat **nepokračuje**, zapíše `escalation.md` v stage adresári.
- Vypíše user-ovi krátky súhrn + odkaz na escalation.md.
- User rozhodne: opraví manuálne, dá direktívu, alebo prepustí pipeline na neskôr.

## Tip — kontrola stavu

Kedykoľvek z terminálu:

```bash
cat .agents/.current-run-id                       # aktuálny runId
ls .agents/runs/$(cat .agents/.current-run-id)/   # zoznam stagov
cat .agents/runs/<runId>/manifest.json            # status pipeline-u
```
