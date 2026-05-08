# SDM-Rewrite

Nový frontend pre **CA Service Desk Manager 17.4** (Broadcom CA Service
Management) postavený nad jeho existujúce REST API. Cieľom je nahradiť pôvodné
webové rozhranie produktu modernou SPA aplikáciou — bez zásahu do backendu.

> **Status**: prípravná fáza (preparation). Repo zatiaľ obsahuje zdrojovú
> produktovú dokumentáciu a plán prác — aktívny vývoj kódu ešte nezačal.

## Prečo

CA SDM 17.4 je stabilný, ale jeho natívne webové UI je dlhodobo zastarané a
neflexibilné. Backend (REST API a doménový model) je naopak živý a otvorený —
postavenie nového FE je preto najefektívnejšia cesta k modernému používateľskému
zážitku bez rizika migrácie dát alebo zmeny BE platformy.

## Architektúra (high-level)

Dve nezávislé SPA aplikácie zdieľajú spoločnú knižnicu nad CA SDM REST API:

```
  Portal SPA           Workspace SPA
  (self-service)       (agent / analyst)
        │                    │
        └────────┬───────────┘
                 ▼
         IdP (SSO — TBD)
                 │
                 ▼
         BFF / Gateway (TBD)
                 │
                 ▼
        CA SDM 17.4 REST API
```

- **`portal`** — self-service pre koncových používateľov (žiadosti, KB,
  sledovanie stavu).
- **`workspace`** — agent / analyst console (queue, Incident, Problem, Change,
  KB editor, CMDB).
- Spoločné: `api-client`, `domain`, `design-system`, `auth` — v podobe
  monorepo packages.

Detail: [`GOAL.md`](./GOAL.md) (sekcia 8 — diagram, sekcia 9 — repo layout).

## Scope

Doručujeme **MVP-first**, v1 a ďalšie iterácie po validácii MVP.

| Téma | MVP | v1+ |
|---|:---:|:---:|
| Incident Management | ✓ | rozšírené operácie |
| Request Management (vrátane Service Catalog) | ✓ | rozšírené formuláre |
| Problem Management | ✓ (read + linkovanie) | full edit |
| Change Management | ✓ (read + základný approval) | CAB workflow, kalendár |
| Knowledge Management (KB) | ✓ (read + search) | editor + publish |
| CMDB (Configuration Items, vzťahy) | ✓ (read + impact view) | editor + Visualizer |
| **Multi-tenancy** (per-user tenant switcher, role per tenant) | ✓ | — |
| Bulk operations vo workspace | — | ✓ |
| Mobilné natívne apky | — | — |
| Modifikácia BE / migrácia dát | — | — |
| BI / reporting | — | — |

**i18n**: SK + EN.
**Veľkosť dát**: rádovo desiatky položiek v queue / CI (jednoduchá voľba
tabuľkových knižníc).
**Auth**: SSO (SAML / OIDC), tenant-scoped RBAC.
**API endpoint**: konfigurovateľný cez `config.json` runtime (referenčná CA SDM
inštancia bude dostupná až po nasadení; vývoj cez mock backend).

## Tech stack

**Zatiaľ nezvolený** — výber prebehne v rámci prípravnej fázy. Kritériá a
kandidáti (React / Angular / Vue) sú zdokumentované v
[`GOAL.md` §6](./GOAL.md#6-otvorené-rozhodnutia-deliberately-deferred). Stack
zvolí dedikovaný **Tech Stack Selector** agent na základe výstupov z analytickej
fázy.

## Štruktúra repa (cieľová)

```
sdm-rewrite/
├── apps/
│   ├── portal/                 # self-service SPA
│   └── workspace/              # agent workspace SPA
├── packages/
│   ├── api-client/             # typovaný klient CA SDM REST
│   ├── domain/                 # entity, state machines, validátory
│   ├── design-system/          # komponenty, tokeny, theming
│   └── auth/                   # SSO / token helpers
├── docs/
│   ├── ca-service-management-17-4.pdf
│   └── agents/                 # výstupy analytických agentov
├── tools/
└── .agents/                    # prompty a definície rolí agentov
```

V tejto fáze existujú iba `docs/`, `GOAL.md` a `README.md`.

## Spôsob práce — agentický pipeline

Príprava prebieha cez postupnosť úzko špecializovaných agentov (každý má vlastný
chat / kontext, vlastný vstup a definovaný výstupný artefakt). Detail vrátane
poradia a závislostí v [`GOAL.md` §7](./GOAL.md#7-návrh-agentov-a-ich-rolí).

| # | Agent | Výstup |
|---|---|---|
| 1 | API Analyst | katalóg REST endpointov, schémy, auth flow, gaps |
| 2 | UX / Persona Analyst | persony, user journeys, wireframy |
| 3 | Domain Modeller | doménové entity, vzťahy, životné cykly |
| 4 | Architecture | komponenty, ADRs, monorepo layout, BFF rozhodnutie |
| 5 | Security | auth flow, threat model, RBAC |
| 6 | Tech Stack Selector | porovnávacia matica, voľba stacku |
| 7 | Design System | tokeny, komponenty, a11y |
| 8 | DevEx / DevOps | bootstrap repa, CI/CD, dev env |
| 9 | QA / Test Strategy | test pyramída, mock stratégia |

## Roadmap

1. **Preparation** ← *aktuálny stav*
   - Definícia cieľov, scope, agentov (`GOAL.md`).
2. **Analysis**
   - Spustenie agentov 1–3 (paralelne, kde to ide).
3. **Design**
   - Architecture, Security, Stack, Design System (agenti 4–7).
4. **Bootstrap**
   - DevOps agent + scaffold repa, CI/CD, mock backend.
5. **Implementation — MVP**
   - Portal: vytvorenie ticketu, sledovanie stavu, KB search.
   - Workspace: queue, detail Incident/Request, KB read.
6. **Implementation — v1**
   - Doplnenie Problem, Change, CMDB, KB editor, bulk operations.
7. **Pilot & Feedback**
8. **Production rollout**

Konkrétny timeline doplnený po dohode s biznis stranou (open question v
`GOAL.md` §11).

## Dokumentácia

- [`GOAL.md`](./GOAL.md) — cieľ projektu, scope, agenti, architektúra,
  otvorené otázky.
- `docs/ca-service-management-17-4.pdf` — autoritatívna dokumentácia CA SDM 17.4
  (Broadcom). Kľúčové sekcie:
  - Product Architecture — str. 286, 291
  - REST API — str. 2906, 3766
  - Web Services — str. 1398, 3395
  - Database Views — str. 2501

## Kontakt / vlastníctvo

- Projektový vlastník: Dušan Lago (`dusan.lago@soimco.sk`)
- Repository: interný — `SDM-Rewrite`

## Licencia

Interný projekt. Licenčný režim bude doplnený pred prvým release-om.
