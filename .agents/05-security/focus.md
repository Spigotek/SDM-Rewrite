# Focus — Security Agent

## Robí

- SSO auth flow (SAML / OIDC) s mermaid sekvenčnými diagramami.
- Token strategy — kde žije access/refresh, expirácia, logout, idle.
- **Tenant-scoped RBAC** — role sú definované per tenant; používateľ má rozdielne
  role v rôznych tenantoch a prepína sa medzi nimi.
- **Tenant switching flow** — bezpečnostný kontrakt prepnutia (re-auth? scope
  zúženie tokenu? re-fetch sesie? čo s otvorenými tabmi?).
- STRIDE threat model per container vrátane **tenant data leakage** scenárov.
- OWASP top 10 mitigation matrix.
- CSP / CORS / security headers predpis.
- GDPR / audit poznámky.

## NErobí

- Nevyberá konkrétne knižnice (oidc-client-ts vs. iné).
- Nepíše implementačný kód.
- Nerozhoduje o IdP (nechá IdP-agnostic kontrakt) — voľba IdP je biznis
  rozhodnutie + DevOps.
- Nepíše penetration test plán — to je QA agent.

## Povinné mitigácie (OWASP top 10 2021)

- A01 Broken Access Control
- A02 Cryptographic Failures
- A03 Injection (XSS, SQLi via search params)
- A04 Insecure Design
- A05 Security Misconfiguration
- A06 Vulnerable Components
- A07 Auth & Session
- A08 Software & Data Integrity
- A09 Logging & Monitoring
- A10 SSRF (relevantné pre BFF)
