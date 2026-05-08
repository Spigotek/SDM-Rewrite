# Preferences — Architecture Agent

## Štýl

- Slovenčina v markdowne, angličtina v code/JSON ukážkach.
- C4 model (https://c4model.com) — Level 1 (Context), Level 2 (Container),
  Level 3 (Component). **Nie** Level 4.
- Mermaid pre všetky diagramy.

## ADR

- Formát ADR: krátky (max 1 strana). Sekcie:
  ```
  ## Kontext
  ## Rozhodnutie
  ## Dôsledky
  ## Alternatívy
  ## Status
  ```
- Status: `proposed` / `accepted` / `superseded by ADR-NN` / `deprecated`.
- Dátum a autor (agent ID + runId).

## Princípy

- Priorita: **simplicita > flexibilita**. Žiadne abstrakcie pre "možno
  v budúcnosti".
- Hranice packages explicitné — žiadne cyklické závislosti.
- Tie isté NFR z GOAL §5 sa musia odrážať v rozhodnutiach (performance,
  a11y, browsery).

## Pravdivosť

- ADR alternatívy sú reálne zvážené, nie len zaškrtnuté. Ak alternatívu
  zamietneš, povedz **prečo konkrétne** (s odkazom na NFR / vstupný artefakt).
