# Inputs — Architecture Agent

## Predchodcovia

- `docs/agents/api-analyst/` — všetky výstupy
  - kritické: `endpoints.md`, `auth.md`, `gaps.md` (vplyv na potrebu BFF)
- `docs/agents/ux/` — všetky výstupy
  - kritické: `screen-inventory.md` (vplyv na routing, code-splitting)
  - `risks.md` (UX requirements ktoré tlačia architektúru)
- `docs/agents/domain/` — všetky výstupy
  - kritické: `entities.md`, `ui-views.md` (vplyv na BFF agregáty)

## GOAL.md

- §4 — dve aplikácie (kritické pre monorepo layout).
- §5 — NFR (performance, browsery, observability).
- §6 — deferred decisions (čo ešte zostáva otvorené).
- §9 — návrh repo layout (východiskový bod pre finalizáciu).
