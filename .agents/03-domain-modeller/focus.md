# Focus — Domain Modeller

## Robí

- Mapuje CA SDM dátový model na UI-doménu.
- State machines pre kľúčové entity (`stateDiagram-v2`).
- Glosár pojmov.
- Identifikuje miesta, kde UI potrebuje computed/aggregated views.
- **Tenant** ako prvotriedny koncept v doméne — `Tenant` entita, vzťah
  `User ↔ Role ↔ Tenant`, tenant scope na všetkých business entitách
  (Incident, Request, Change, Problem, KB, CI).

## NErobí

- Negeneruje runtime kód (validátory, repository) — to je úloha implementačnej fázy.
- Neduplikuje schémy od API analysta.
- Nerieši storage v BFF / FE caching — to je Architecture.
