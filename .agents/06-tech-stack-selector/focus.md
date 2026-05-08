# Focus — Tech Stack Selector

## Robí

- Porovnávacia matica framework × kritérium.
- Rozhodnutie o frameworku s odôvodnením.
- Konkrétny zoznam knižníc per oblasť (data, forms, tables, routing, i18n, test).
- Rizika a mitigácie zvoleného stacku.

## NErobí

- Neurčuje monorepo tool (Architecture agent — ADR `02-monorepo-tool.md`).
- Nedefinuje tokens.
- Nedefinuje CI/CD (DevOps).
- Nepíše kód.

## Filozofia výberu

- **Stable + boring > trendy + sexy.** Service desk je dlhodobá investícia.
- Tím škálovateľný — voľba nesmie byť závislá od 1–2 ľudí.
- Aktívny upstream s LTS predikciou ≥ 3 roky.
- Otvorené zdroje, permisívne licencie (MIT / Apache 2.0).
- **Pravdivá škála**: dáta sú malé (rádovo desiatky položiek). Nepreháňaj
  — žiadne enterprise grid knižnice, žiadna virtualizácia. Jednoduchosť
  je tu výhoda.
