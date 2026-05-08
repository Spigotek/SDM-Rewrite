# Preferences — Design System Agent

## Štýl

- Slovenčina v markdowne, angličtina v identifikátoroch tokenov
  (`color.background.primary`, `spacing.md`).
- Žiadny stojaci motiv (corporate cliche). Neutrálny moderný base.

## Tokens

- Tokens v JSON podľa Style Dictionary konvencie.
- Naming: `kategória.role.variant` (`color.text.primary`, `spacing.md`,
  `radius.sm`).
- Žiadne magic numbers v markdowne — všetko cez tokeny.

## A11y

- WCAG 2.1 AA je minimum. Označ kde mierime na AAA.
- Per komponent uveď: roly, focus management, klávesová ovládateľnosť,
  prechod cez čítačky obrazovky.

## Pravdivosť

- Branding je **plne delegovaný** na teba (GOAL §11). Žiadne TBD-čká —
  navrhni konkrétne tokeny, farby, font.
- Cieľ: moderný, úhľadný, profesionálny. Inšpirácia: Linear, Vercel,
  Stripe, Notion (čisté, vzdušné, dobre typografované UI).
- Vyhni sa "corporate cliché" (gradienty 2010, harsh blue, skeuomorfizmus).
