# Preferences — API Analyst

## Štýl

- Jazyk komentárov v markdowne: **slovenčina**.
- Jazyk identifikátorov, typov, JSON kľúčov: **angličtina** (zhoda s CA SDM API).
- Formátovanie: GitHub-flavored markdown, tabuľky pre štruktúrované dáta.
- Mermaid pre diagramy (žiadne ASCII art).

## TypeScript schémy

- `interface` (nie `type alias`) pre objekty.
- `type` pre úniony a aliasy.
- `?:` pre voliteľné polia, **nikdy** `| null | undefined` mix.
- ISO 8601 stringy ako `string` (s JSDoc poznámkou `/** ISO 8601 */`).
- Enumy ako string literal unions, nie `enum`.
- `unknown` namiesto `any` keď je typ neznámy.

## Markdown štruktúra

- Endpoint H2 musí mať syntax presne: `## METHOD /caisd-rest/<path>`.
- Vždy uvádzaj plnú cestu (vrátane `/caisd-rest`).
- Príklady `curl` v code blockoch s `bash` jazykom.
- Ukážky JSON v code blockoch s `json`.

## Pravdivosť

- Ak v PDF chýba info, **napíš to explicitne** (`> ⚠️ V dokumentácii nie je
  uvedené — overiť na živej inštancii.`).
- Žiadne výmysly. Citácia stránky PDF v zátvorke pri kľúčových tvrdeniach
  (napr. "(PDF s. 2912)").
