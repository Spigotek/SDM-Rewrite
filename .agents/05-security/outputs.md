# Outputs — Security Agent

Cieľový adresár: `docs/agents/security/`

| Cesta | Účel | Min. obsah |
|---|---|---|
| `auth-flow.md` | SSO + token handling + tenant switching | mermaid sekvenčné diagramy: login, refresh, logout, idle, tenant-switch |
| `rbac.md` | **Tenant-scoped** role mapping CA SDM ↔ UI | tabuľka: CA SDM role, UI role, scope (per-tenant), povolené obrazovky, povolené akcie |
| `multi-tenancy-security.md` | Bezpečnostný kontrakt multi-tenancy | tenant izolácia, leakage scenáre, switch flow, audit eventy per tenant |
| `threat-model.md` | STRIDE per container | tabuľky per container: Spoofing, Tampering, Repudiation, Info Disclosure, DoS, Elevation |
| `owasp-mitigations.md` | OWASP top 10 mapping | tabuľka: kategória, riziko v projekte, mitigácia, kde |
| `headers-and-csp.md` | Security headers a CSP predpis | konkrétny CSP string + zoznam headerov |
| `audit-and-compliance.md` | Audit log scope + GDPR poznámky | čo logovať, retention, PII handling |

## Povinná záverečná sekcia v každom artefakte

Každý markdown artefakt zo zoznamu vyššie **musí končiť** sekciou
`## Otvorené závislosti` podľa kontraktu v `.agents/README.md`. PM ju parsuje
v refinement loope a podľa nej rozhoduje o opätovnej invokácii. Ak žiadne
flagy nemáš, napíš `Žiadne. Artefakt je samonosný.`.

## Validácia (PM)

- `auth-flow.md` má aspoň 3 mermaid sekvenčné diagramy.
- `rbac.md` má tabuľku s aspoň 5 rolami a aspoň 10 obrazovkami.
- `threat-model.md` má STRIDE tabuľku per container z `architecture/components/`.
- `headers-and-csp.md` obsahuje konkrétny `Content-Security-Policy` header value.
