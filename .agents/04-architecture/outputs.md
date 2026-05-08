# Outputs — Architecture Agent

Cieľový adresár: `docs/agents/architecture/`

| Cesta | Účel | Min. obsah |
|---|---|---|
| `architecture.md` | High-level architektúra — C4 L1+L2 | mermaid diagramy + popis containerov |
| `components/<container>.md` | C4 L3 per container | mermaid + popis komponentov |
| `decision-records/<NN>-<topic>.md` | ADR (Architecture Decision Record) | sekcie: kontext, alternatívy, rozhodnutie, dôsledky |
| `monorepo-layout.md` | Finálna repo štruktúra | tree + popis per dir |
| `boundaries.md` | Hranice medzi packages a apps | tabuľka: package, exports, kto importuje |
| `data-flows.md` | Kľúčové dátové toky (login, ticket create, queue load) | mermaid `sequenceDiagram` per flow |
| `risks.md` | Riziká a otvorené otázky pre Security / Stack / DevOps | tabuľka |

## Povinné ADRs

Minimálne 10 ADR (zoznam v `focus.md`). Pomenovanie: `01-bff.md`, `02-monorepo-tool.md`, ...

## Povinná záverečná sekcia v každom artefakte

Každý markdown artefakt zo zoznamu vyššie **musí končiť** sekciou
`## Otvorené závislosti` podľa kontraktu v `.agents/README.md`. PM ju parsuje
v refinement loope a podľa nej rozhoduje o opätovnej invokácii. Ak žiadne
flagy nemáš, napíš `Žiadne. Artefakt je samonosný.`.

## Validácia (PM)

- `architecture.md` má aspoň 2 mermaid diagramy.
- `decision-records/` má aspoň 10 .md súborov.
- Každý ADR má sekcie: `## Kontext`, `## Rozhodnutie`, `## Dôsledky`, `## Alternatívy`.
- `monorepo-layout.md` obsahuje plný strom adresárov.
