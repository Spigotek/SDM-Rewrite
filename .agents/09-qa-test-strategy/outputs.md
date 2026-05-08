# Outputs — QA / Test Strategy Agent

Cieľový adresár: `docs/agents/qa/`

| Cesta | Účel | Min. obsah |
|---|---|---|
| `test-strategy.md` | Hlavná stratégia — pyramída, layers, runner-y | mermaid pyramída + tabuľka layers |
| `mock-strategy.md` | MSW / wiremock prístup | konkrétny zoznam handler-ov per modul |
| `coverage-targets.md` | Coverage ciele per package | tabuľka |
| `acceptance-criteria.md` | Mapovanie journeys ↔ testy | tabuľka: journey-id, scenár, test typ, tag |
| `performance.md` | Lighthouse CI prahy + budgety | tabuľky: stránka, prah TTI/LCP/CLS |
| `a11y-tests.md` | a11y test plan (axe-core, manual checklist) | tabuľka |
| `flaky-policy.md` | Pravidlá pre flaky testy | retry, quarantine, eskalácia |
| `test-data.md` | Faktory, seedy, fixture strategy | popis + ukážky |

## Povinná záverečná sekcia v každom artefakte

Každý markdown artefakt zo zoznamu vyššie **musí končiť** sekciou
`## Otvorené závislosti` podľa kontraktu v `.agents/README.md`. PM ju parsuje
v refinement loope a podľa nej rozhoduje o opätovnej invokácii. Ak žiadne
flagy nemáš, napíš `Žiadne. Artefakt je samonosný.`.

## Validácia (PM)

- `test-strategy.md` má diagram pyramídy.
- `mock-strategy.md` má aspoň 6 handler-blokov (po jednom per modul).
- `acceptance-criteria.md` pokrýva všetkých kritické user journeys (ak ich
  je v `journeys.md` 18+, tu má byť aspoň 18 riadkov).
- `coverage-targets.md` má číselné ciele per package, nie len opisy.
