# Outputs — Design System Agent

Cieľový adresár: `docs/agents/design-system/`

| Cesta | Účel | Min. obsah |
|---|---|---|
| `tokens.md` | Design tokens — autoritatívny zdroj | tabuľky: type scale, colors (light/dark), spacing, radius, shadow, motion |
| `tokens.json` | Tokens v Style Dictionary kompatibilnom JSON | parsovateľný JSON |
| `components.md` | Inventory komponentov pre v1 | jeden H2 per komponent, sekcie: účel, varianty, props, a11y |
| `a11y.md` | WCAG 2.1 AA checklist + globálne pravidlá | tabuľka: kritérium, ako splníme |
| `theming.md` | Theming model (light/dark/HC) | popis tokenov, ktoré sa menia per téma |
| `microcopy.md` | Voice & tone, chybové hlášky, CTA | tabuľka: kontext, vzor, antipattern |
| `library-recommendation.md` | Custom vs. nadstavba (MUI/Mantine/...) | porovnanie + odporúčanie |

## Povinná záverečná sekcia v každom artefakte

Každý markdown artefakt zo zoznamu vyššie **musí končiť** sekciou
`## Otvorené závislosti` podľa kontraktu v `.agents/README.md`. PM ju parsuje
v refinement loope a podľa nej rozhoduje o opätovnej invokácii. Ak žiadne
flagy nemáš, napíš `Žiadne. Artefakt je samonosný.`.

## Validácia (PM)

- `tokens.md` má aspoň 5 tabuliek (type, colors, spacing, radius, shadow).
- `tokens.json` je validný JSON a má kľúče `color`, `font`, `spacing`, `radius`, `motion`.
- `components.md` má aspoň 25 H2 (komponentov).
- `a11y.md` pokrýva všetky WCAG 2.1 AA success criteria.
