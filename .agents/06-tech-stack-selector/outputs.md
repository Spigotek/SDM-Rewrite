# Outputs — Tech Stack Selector

Cieľový adresár: `docs/agents/stack/`

| Cesta | Účel | Min. obsah |
|---|---|---|
| `comparison.md` | Porovnávacia matica framework × kritérium | tabuľka 3 riadky × 7+ stĺpcov + score + odôvodnenie |
| `decision.md` | Finálne rozhodnutie | sekcia: zvolený framework, dôvod, hlavné riziká |
| `libraries.md` | Konkrétne knižnice per oblasť | tabuľky: oblasť, voľba, alternatívy, licencia, aktivita |
| `risks.md` | Riziká stacku a mitigácie | tabuľka: riziko, pravdepodobnosť, dopad, mitigácia |
| `migration-notes.md` | Pozn. pre prípadný neskorší prechod (ak by sme menili framework) | high-level points |

## Povinná záverečná sekcia v každom artefakte

Každý markdown artefakt zo zoznamu vyššie **musí končiť** sekciou
`## Otvorené závislosti` podľa kontraktu v `.agents/README.md`. PM ju parsuje
v refinement loope a podľa nej rozhoduje o opätovnej invokácii. Ak žiadne
flagy nemáš, napíš `Žiadne. Artefakt je samonosný.`.

## Validácia (PM)

- `comparison.md` má aspoň 3 riadky (frameworky) × 7 stĺpcov (kritériá).
- `decision.md` má sekciu `## Riziká voľby` s aspoň 3 bodmi.
- `libraries.md` pokrýva minimálne: bundler, data fetching, form, table,
  routing, i18n, unit test, e2e test, http klient, error tracking.
- Každá knižnica má URL, licenciu a dátum overenia aktivity.
