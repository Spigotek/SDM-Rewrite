# Phase F — BFF real implementation

> Cieľ: SPA prepneme z MSW na bežiaci BFF. End-to-end loop funguje proti reálnemu CA SDM
> backend-u (alebo upstream mocku ak by produkčný B-E nebol dostupný).

## Cross-chunk decisions (zachytené v session E.3 → F.1 planning)

### D1 — Real CA SDM backend k dispozícii

Dev/test CA SDM endpoint: **`http://10.11.35.35:8050/caisd-rest/`** s test creds
`vueuser:Vue@user123!` (Basic Auth na `/rest_access`).

**Vplyv naprieč Phase F:**

- **F.1** stavia auth flow okolo **Basic Auth → access_key**, nie OIDC. OIDC SSO postponed do
  samostatného chunku po sprístupnení corp IdP.
- **F.2-F.4** môžu robiť integračné testy proti reálnemu B-E (vitest + MSW Node ako fallback
  pre CI, kde 10.11.35.35 nie je dostupný).
- **E.1 scope deviation** (upstream `/caisd-rest/*` mocky odložené do Phase F) sa **ruší** —
  reálny B-E nahrádza potrebu upstream mockov pre dev. Pre CI sa pridajú selective MSW Node
  handlery v rozsahu nutnom pre testy.

### D2 — Redis session store odložené

bff.md §2.2 hovorí _"in-memory MVP single-instance, Redis post-MVP"_; ROADMAP F.1 wording
_"Redis + in-memory adapter"_ je nadhodnotený. **F.1 implementuje len in-memory** s `SessionStore`
interface-om pripraveným ako drop-in pre Redis. Redis impl ide do post-F.1 chunku (kandidát:
`F.6 — Session store hardening` keď bude jasné, kedy je Redis nutný — typicky pri horizontálnom
scaling, čo v MVP nie je).

### D3 — SAML out of MVP scope

`auth-flow.md §0` má SAML 2.0 ako _"ak corp IdP nevie OIDC"_. Žiadny zákaznícky tlak na SAML
nie je známy; SAML implementácia post-MVP.

### D4 — `/me` shape divergencia E.3 → F.5

E.3 shell session loader očakáva separate `/me` + `/me/tenants` s minimálnym shape-om. Canonical
contract v `auth-flow.md §4.5` má bohatší shape (embedded tenants, `effectivePermissions[]`,
`csrfToken`, `featureFlags`, `i18n`, `session.idleTimeoutSec`).

**Plán**: F.1 BFF vystaví **canonical shape** (§4.5). F.5 upraví shell session loader (single
fetch `/me` namiesto dvoch, no FE permission derivation, CSRF token storage). MSW handler v
`@sdm/api-mocks` sa zarovná spolu s F.5 (aby `VITE_USE_MOCKS=true` zostal funkčný cesta).

### D5 — CSRF middleware patrí do F.1, nie F.4

ROADMAP F.4 spomína CSRF, ale `bff.md §2.1` ho radí pod Gateway concerns a `auth-flow.md §4.2`
ho potrebuje pre `/me/active-tenant` v F.1. **F.1 vlastní Origin/Referer check middleware**
(per r2 closed dep — žiadny double-submit token). F.4 môže CSRF rozšíriť ak vyplynie potreba
(napr. token rotation), ale baseline je v F.1.

### D6 — Audit logger taxonómia odložená do F.4

F.1 píše štruktúrované pino logy s `correlationId` (basic), ale **plnú 40-event taxonómiu**
(`auth.*`, `authz.*`, `sensitive.*`, `security.*`, `data.*` per `audit-and-compliance.md §2`)
implementuje F.4.

## Sekvencia chunkov

```
F.1 — Auth module (Basic Auth + session + /me + CSRF + cookie)
    ↓ blokuje
F.2 — REST proxy (api endpoints, tenant scoping, error shaper)
    ↓ blokuje
F.3 — Aggregator endpoints (/me/tenants fan-out, queue, ticket-detail)
    ↓ paralelne s F.4
F.4 — Platform (audit taxonómia, /config full, /readyz CA SDM ping)
    ↓ blokuje
F.5 — Cleanup MSW vs BFF (SPA prepnutie, shape align, login UI)
```

F.3 a F.4 sú **paralelizovateľné** — F.3 nepotrebuje F.4 audit eventy, F.4 nepotrebuje F.3
aggregator endpoints. Ak by pomohlo, dajú sa robiť súčasne v dvoch session-och na dvoch
branchoch (rebase pred mergom).

## Phase F entry criteria

- ✅ E.1-E.3 merged (MSW handlers, RBAC, App Shell)
- ✅ Reálny CA SDM endpoint dostupný (`10.11.35.35:8050`)
- ✅ `apps/bff/src/index.ts` stub existuje (Hono + pino + health probes)
- ⏳ Sieťový prístup z dev stroja na `10.11.35.35:8050` (verify cez curl pred F.1)

## Phase F exit criteria (Done-when celá Phase F)

- SPA proti BFF funguje (`VITE_USE_MOCKS=false`) — full login → queue → ticket → logout loop
- Vitest + integration testy zelené (BFF unit + integration)
- E2E browser-test scenár prešli proti BFF (nie len MSW)
- Audit log emit-uje canonical events
- ROADMAP Phase F → ✅ DONE; next-up = Phase G (cross-cutting concerns)
