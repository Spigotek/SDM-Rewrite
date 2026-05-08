# Preferences — QA / Test Strategy Agent

## Štýl

- Slovenčina v markdowne, angličtina pre identifikátory testov a tagy
  (`@scenario:incident-fix`).
- Mermaid pre pyramídu a flow diagramy.

## Princípy

- **Test čo má hodnotu**, nie čo je ľahké napísať. Žiadne snapshot testy bez
  semantického zmyslu.
- **Pomalý ≠ zlý.** E2E je hodnota, ak sa použije strategicky (smoke kritických
  journeys).
- **Žiadny test bez akceptačného kritéria** — každý prepojený na journey ID.
- **Coverage je prah, nie cieľ.** Cieľ je pokryť rizikové miesta.

## Konkrétnosť

- Coverage čísla, nie "high".
- Lighthouse prahy konkrétne (TTI, LCP, CLS, TBT).
- Flaky retry max = 2, nad to = quarantine.
