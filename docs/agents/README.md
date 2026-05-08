# `docs/agents/` — výstupy analytických agentov

Tento adresár obsahuje **autorské artefakty** vyprodukované 9 analytickými
agentmi z `.agents/01-*` až `.agents/09-*` počas behu pipeline-u.

## Štruktúra

```
docs/agents/
├── api-analyst/        ← 01-api-analyst
├── ux/                 ← 02-ux-persona-analyst
├── domain/             ← 03-domain-modeller
├── architecture/       ← 04-architecture
├── security/           ← 05-security
├── stack/              ← 06-tech-stack-selector
├── design-system/      ← 07-design-system
├── devops/             ← 08-devex-devops
└── qa/                 ← 09-qa-test-strategy
```

Mapovanie agent → cieľový adresár je definované v každom
`.agents/<NN>-<name>/outputs.md` (sekcia „Cieľový adresár").

## Životný cyklus

- **Generuje** Project Manager (PM) tým, že spúšťa sub-agentov v izolovaných
  git worktrees a po validácii ich výstupy merguje do round-vetvy.
- **Nemodifikovať ručne** — výstupy sú reproducibilne generované.
  Manuálne zásahy patria do `.agents/<NN>-<name>/` kontraktov, nie sem.
- **Auditovateľnosť**: každý súbor má v záhlaví changelog pri revision rundách
  (kontrakt v `.agents/README.md` § Revízny mód).

## Ako vznikajú

Po prvom behu pipeline-u (kickoff podľa `.agents/kickoff.md`) vznikne kompletná
sada výstupov. Každý markdown artefakt končí sekciou `## Otvorené závislosti`
podľa revision contractu v [`.agents/README.md`](../../.agents/README.md).

## Validácia

PM po každej runde overí:
- existenciu všetkých ciest deklarovaných v `outputs.md` daného agenta,
- minimálnu veľkosť (> 1024 B),
- štruktúru (H1 + H2, validný JSON kde aplikovateľné),
- prítomnosť `## Otvorené závislosti`.

Detail: `.agents/00-project-manager/outputs.md` § Validačný kontrakt.
