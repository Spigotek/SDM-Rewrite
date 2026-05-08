# `.agents/` — definície sub-agentov pre SDM-Rewrite pipeline

Každý sub-folder = jeden agent. Project Manager (`00-project-manager/`) ich
číta a spúšťa cez **Claude Agent SDK** (`@anthropic-ai/claude-agent-sdk`) — SDK
je povinný komponent projektu.

## Štruktúra agent-folderu

| Súbor | Účel | Formát |
|---|---|---|
| `agent.md` | Hlavná definícia: YAML frontmatter (`name`, `description`, `tools`, `model`) + system prompt | Claude Code subagent |
| `focus.md` | Rola, expertíza, **negative scope** (čo agent **NErobí**) | Markdown |
| `inputs.md` | Vstupy — PDF page ranges, výstupy predchádzajúcich agentov, sekcie GOAL.md | Markdown |
| `outputs.md` | Kontrakt výstupných artefaktov (cesta + minimálna štruktúra) | Markdown — PM validuje |
| `skills.md` | Ktoré `buddy:*` / custom skills použiť a kedy | Markdown |
| `mcp.json` | Konfigurácia MCP serverov (alebo `{"mcpServers":{}}`) | JSON |
| `hooks.json` | Hooks (PreToolUse, PostToolUse, SubagentStop) | JSON |
| `preferences.md` | Tón, jazyk, formátovanie, metodika | Markdown |

## Pipeline — iteratívny konvergenčný model

Zdroj pravdy: [`pipeline.yaml`](./pipeline.yaml) (v2).

**Round 1** — paralelný broadcast v dvoch fázach:

- **Phase A** (paralelne): `01-api-analyst`, `02-ux-persona-analyst`, `03-domain-modeller`
  — vstup je GOAL.md + PDF.
- **Phase B** (paralelne, po validácii Phase A): `04-architecture`, `05-security`,
  `06-tech-stack-selector`, `07-design-system`, `08-devex-devops`, `09-qa-test-strategy`
  — vstup je GOAL.md + výstupy Phase A.

**Round 2..N** — refinement loop (PM-driven):

PM po každej rounde parsuje `## Otvorené závislosti` z artefaktov, detekuje
cross-artifact konflikty, **selektívne re-invokuje** dotknutých agentov
v revision móde, validuje a vyhodnocuje konvergenciu. Loop končí keď:

- žiadny artefakt nemá neuzavreté flagy,
- cross-ref medzi artefaktmi je konzistentný,
- validácia kontraktov prešla,
- **alebo** dosiahli sa `max_iterations` (default 5) → eskalácia človeku.

## Revision contract — povinná záverečná sekcia v každom artefakte

Každý markdown artefakt, ktorý agent produkuje, **musí končiť** sekciou
`## Otvorené závislosti`. PM ju číta v refinement loope a podľa nej rozhoduje,
či a koho re-invokovať.

**Formát:**

```markdown
## Otvorené závislosti

- `[04-architecture]` Predpokladám BFF pre token handling — ak Architecture
  zvolí direct flow, mení sa auth flow v sekciách X, Y.
- `[06-tech-stack-selector]` Form rendering závisí od voľby framework.
  Predpoklad: React + React Hook Form. Re-validovať po Phase B.
- `[?]` Otvorené pre kohokoľvek: chýba mi GDPR retention policy zo strany usera.
```

Ak žiadne flagy nie sú: napíš `Žiadne. Artefakt je samonosný.` — PM tento stav
počíta ako splnený `no_open_dependencies` signál.

**Sémantika tagu**:

- `[<agent-id>]` — adresovaný konkrétnemu agentovi (PM ho zaradí do jeho revision requestu).
- `[?]` — adresované user-ovi / nezaradené (PM eskaluje v záverečnom súhrne).
- `[resolved-in-round-<N>]` — flag, ktorý už bol uzatvorený v predošlej runde
  (necháva sa v zázname pre auditovateľnosť).

## Revízny mód — agent re-invokovaný v round 2..N

Keď PM agenta opätovne spustí, dostane v user-prompt:

1. **Link na vlastný predošlý výstup** (cesta + posledná verzia).
2. **Linky na delta výstupov ostatných agentov**, ktoré sa medzi rundami
   zmenili — filtrované cez `context_hints` z `pipeline.yaml`.
3. **Konkrétny revision request** od PM:
   > „Agent 04 zvolil BFF s OIDC; tvoj `auth.md` predpokladal direct flow —
   > prepracuj sekciu X, sekciu Y nechaj.“
4. **Round counter** (napr. „toto je round 3 z max 5").

Agent v revision móde:

- **Nezačína od nuly.** Iteruje vlastný predošlý výstup.
- **Honors prior decisions** — rozhodnutia ostatných berie ako fakt
  (nie podnet na diskusiu), pokiaľ nenájde konflikt — ten označí novým flag-om.
- Aktualizuje `## Otvorené závislosti` (uzatvára vyriešené, pridáva nové).
- Krátky **changelog** na začiatok artefaktu: čo zmenil oproti predošlej runde.

## Izolácia vetiev a merge stratégia

`main` je **chránená**. PM riadi všetky git operácie; sub-agenti **nikdy
nespúšťajú git príkazy**.

**Branch hierarchia**:

```
main
└── pipeline/<runId>
    ├── pipeline/<runId>/round-1
    │   ├── agent/<runId>/01-api-analyst
    │   ├── agent/<runId>/02-ux-persona-analyst
    │   └── agent/<runId>/03-domain-modeller
    ├── pipeline/<runId>/round-2
    │   └── agent/<runId>/<id>-<name>          (len dotknutí v refinement)
    └── ...
```

**Worktree per agent** — paralelný beh bez kolízie working tree:

```
.agents/runs/<runId>/worktrees/
├── 01-api-analyst/                ← worktree na agent/<runId>/01-api-analyst
├── 02-ux-persona-analyst/         ← worktree na agent/<runId>/02-ux-persona-analyst
└── 03-domain-modeller/
```

PM spustí každého agenta cez Claude Agent SDK s `cwd` nastaveným na jeho
worktree. Agent vidí len svoj worktree — nemusí (a nesmie) sa starať o branche.

**PM-driven merge**:

1. Agent dokončí beh → PM commitne v jeho worktree
   (`[<runId>][round-<N>][<NN>] <summary>`).
2. Po fáze/runde PM mergne všetky agent-vetvy do round-vetvy (`--no-ff`).
3. Po validácii rundy PM mergne round-vetvu do `pipeline/<runId>`.
4. Po konvergencii PM otvorí **PR z `pipeline/<runId>` do `main`** cez
   `gh pr create`. **Človek robí review a finálny merge.**

**Pri merge konflikte** (zriedkavé — agenti píšu do disjunktných ciest)
PM eskaluje človeku, neauto-resolvuje.

Detail v [`pipeline.yaml`](./pipeline.yaml) sekcia `git` a
[`GOAL.md`](../GOAL.md) §7.6.

## Stav pipeline

PM udržuje `.agents/state.json`:

```json
{
  "runId": "<uuid>",
  "startedAt": "<iso>",
  "agents": {
    "01-api-analyst": { "status": "completed", "outputsValid": true, "durationMs": 1234567 },
    "02-ux-persona-analyst": { "status": "running" },
    "03-domain-modeller": { "status": "pending" }
  }
}
```

## Spustenie pipeline (cieľový stav)

```bash
pnpm --filter @sdm/pm run pipeline                # spustí celý pipeline
pnpm --filter @sdm/pm run pipeline --only 01,02   # len vybraných agentov
pnpm --filter @sdm/pm run pipeline --resume       # pokračuje zo state.json
```

Implementáciu PM dodá DevOps agent v bootstrap fáze. V tomto kroku definujeme
len kontrakt.
