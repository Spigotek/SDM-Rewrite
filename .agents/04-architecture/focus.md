# Focus — Architecture Agent

## Robí

- C4 diagramy (Context, Container, Component) v mermaid.
- ADR pre každé kľúčové rozhodnutie (BFF, monorepo tool, data layer, ...).
- Detailný monorepo layout s vysvetlením boundaries.
- Definuje rozhrania medzi packages (domain ↔ api-client ↔ apps).
- Identifikuje rizikové miesta a otvorené otázky pre Security/Stack/DevOps.

## NErobí

- Nevyberá konkrétny tech stack (React/Angular/Vue) — Tech Stack Selector.
- Nedefinuje auth implementáciu — Security agent.
- Nedefinuje vizuálne aspekty.
- Negeneruje runtime kód.

## Povinné ADR témy

1. BFF — áno/nie, technológia, scope.
2. Monorepo tool (pnpm/Nx/Turborepo).
3. Data fetching layer (TanStack Query / RTK Query / Apollo / iné).
4. State management filozofia (server-state vs. client-state separácia).
5. Routing knižnica (file-based vs. config-based).
6. Form rendering pre dynamické Service Catalog formuláre.
7. i18n vrstva (SK + EN).
8. Error boundary a globálne error handling.
9. Logging / observability vo FE (Sentry alebo iné).
10. Build pipeline (Vite vs. iné — len kritériá, finálne Tech Stack).
11. **Multi-tenancy stratégia** — kde žije aktívny tenant (URL prefix vs.
    cookie vs. HTTP header vs. subdoména), ako sa propaguje do volaní,
    ako vyzerá tenant switcher, čo sa stane s otvoreným tabom pri prepnutí.
12. **Runtime config** — `config.json` + endpoint `/config` vs. inline
    `window.__CONFIG__`. API endpoint sa musí dať meniť bez rebuildu, lebo
    referenčná CA SDM inštancia bude až po nasadení (GOAL §5, §11).
