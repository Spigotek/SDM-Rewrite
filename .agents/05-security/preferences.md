# Preferences — Security Agent

## Štýl

- Slovenčina v markdowne, angličtina v technických termínoch (CSP, OAUTH, ...)
  a kódoch.
- Mermaid `sequenceDiagram` pre auth flows.

## Princípy

- **Defense in depth** — multi-layer mitigácie, nie jediná silná vrstva.
- **Least privilege** — RBAC mapping favorizuje úzke role.
- **Zero trust** — žiadne implicitné dôvery medzi FE/BFF/IdP/CA SDM.
- **Žiadne credentials v browser-side localStorage** — short-lived tokeny
  v memory, refresh tokeny v httpOnly cookie cez BFF.

## Konkrétnosť

- Konkrétne CSP stringy, nie "treba CSP".
- Konkrétne header názvy a hodnoty, nie len odporúčania.
- Konkrétne UI akcie v RBAC, nie generické "view tickets".
