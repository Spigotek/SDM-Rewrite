# Per-chunk plans

> **Účel**: pre `/clear` workflow. Každý súbor `<Phase>.<N>.md` je self-contained guide pre jeden chunk:
> čo prečítať, čo vytvoriť, čo musí byť hotové, ako postupovať (subagenty / sequencing), aké open
> questions zostávajú.
>
> **Hierarchia**:
>
> - `docs/ROADMAP.md` = strategický plán (poradie + status, jeden zdroj pravdy)
> - `docs/plans/<Phase>.md` = phase-level overview + cross-chunk decisions
> - `docs/plans/<Phase>.<N>.md` = chunk-level work order (`/clear`-ready)
> - `docs/agents/**/*` = doménová špec (nemení sa per chunk; chunk plány na ňu odkazujú)

## Prompt na začiatok nového chatu

```text
Pokračujeme SDM-Rewrite. Najbližší chunk: <Phase>.<N>.

Stratégia + Inputs + Outputs + Done-when sú v `docs/plans/<Phase>.<N>.md`.
Phase-level kontext: `docs/plans/<Phase>.md`.
Status: `docs/ROADMAP.md` → Aktuálny stav.
PR-flow memory sa načíta z MEMORY.md.

Prečítaj plán + Inputs, povedz krátky plán a začni.
```

## Maintenance

- **Pred začatím chunku**: aktualizuj `Status: 🔜 NEXT → ⏳ IN-FLIGHT` v hlavičke `<Phase>.<N>.md`.
- **Po merge**: aktualizuj status na `✅ DONE` + doplň PR číslo. Zároveň prepni `docs/ROADMAP.md`.
- **Pri scope-pivot v rámci chunku**: pridaj zmenu do sekcie `Pivot vs ROADMAP` v príslušnom pláne,
  nie do ROADMAP-u (ROADMAP nesie len výsledný status, nie rozhodovaciu históriu).
- **Pri rozdelení/zlúčení chunkov**: rename / split súborov + sync ROADMAP. Nikdy nemeň fáza letter
  sémantiku (F je F).

## Index

| Súbor              | Chunk                  | Status |
| ------------------ | ---------------------- | ------ |
| [F.md](./F.md)     | Phase F — BFF overview | 🔜     |
| [F.1.md](./F.1.md) | Auth module            | 🔜     |
| [F.2.md](./F.2.md) | REST proxy             | 🔜     |
| [F.3.md](./F.3.md) | Aggregator endpoints   | ✅     |
| [F.4.md](./F.4.md) | Platform               | ✅     |
| [F.5.md](./F.5.md) | Cleanup MSW vs BFF     | 🔜     |

`F.5-prompt.md` is the matching `/clear`-ready prompt template (analogous to `F.1-prompt.md` / `F.3-prompt.md`).
