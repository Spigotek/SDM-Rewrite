# Preferences — Domain Modeller

## Štýl

- Jazyk: slovenčina (markdown), angličtina (kód, identifikátory, mermaid labely
  ak sú citáciou CA SDM stavov ako `OPEN`, `IN_PROGRESS`).
- Mermaid v `stateDiagram-v2` (nie v1) — modernejší syntax.

## TypeScript

- `interface` pre UI-only entity, `type` pre úniony.
- Re-exporty zo `schemas/` API analysta — nikdy neduplikuj definície.
- UI-only entity prefixuj `Ui` (napr. `UiIncidentSummary`).

## Pravdivosť

- Ak je state machine v PDF nedostatočne popísaný, vypíš to do `risks` sekcie
  v `entities.md` a žiadaj overenie.
