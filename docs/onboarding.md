# SDM-Rewrite — Onboarding

> Day-1 čítanie pre nového člena tímu. Cieľ: pochopiť čo projekt robí, ako ho
> spustiť a kde čo nájsť. Hĺbka v ďalších dokumentoch.

## TOC

1. Cieľ projektu
2. Repo clone + dev start
3. Kľúčové persony
4. Kde čo nájdem
5. Ďalšie kroky
6. Otvorené závislosti

## 1. Cieľ projektu

**SDM-Rewrite** je nový frontend nad existujúce REST API **Broadcom CA Service
Desk Manager 17.4**. Backend nemodifikujeme — všetky integrácie idú cez
`/caisd-rest/` a `/bui/` rozhrania.

Návrh stojí na **dvoch SPA** v jednom monorepe:

- **`portal`** — self-service pre zamestnancov (nahlásenie incidentu, service
  catalog, KB search).
- **`workspace`** — agent workspace pre service desk analytikov, change
  managerov, KB editorov, CMDB ownerov.

Plus **BFF** (Backend for Frontend) na **Hono 4 + Node 22 LTS**, ktorý drží
CA SDM Access Key (browser ho nikdy neuvidí), agreguje multi-call endpointy
(`/me/tenants`, ticket-detail) a unifikuje error shape.

Stack: **React 19 + TypeScript 5.7 + Vite 5 + TanStack Query + Radix UI**.
Multi-tenancy je prvotriedny koncept. SK + EN locales.

Detail: [`GOAL.md`](../GOAL.md) a [`docs/system-overview.md`](system-overview.md).

## 2. Repo clone + dev start

### Predpoklady

| Komponent | Verzia |
|---|---|
| Node.js | 20.11 LTS minimum / 22.x LTS odporúčaná |
| pnpm | 9.x |
| git | 2.40+ |
| gh (GitHub CLI) | 2.40+ |

Inštalácia:

```bash
nvm install --lts && nvm use --lts
corepack enable && corepack prepare pnpm@9.12.0 --activate
```

### 5 krokov k bežiacej appke

```bash
# 1. Klon
git clone git@github.com:Spigotek/SDM-Rewrite.git sdm-rewrite
cd sdm-rewrite

# 2. .env
cp .env.example .env
# nepotrebuješ nič vyplniť pre lokálny dev — defaultné hodnoty fungujú s MSW

# 3. Závislosti
pnpm install --frozen-lockfile

# 4. Spusti dev stack (paralelne portal + BFF + workspace)
pnpm dev

# 5. Otvor v prehliadači
# Portal:    http://localhost:5173
# Workspace: http://localhost:5175
# BFF:       http://localhost:5174 (REST endpointy)
```

MSW Node server beží v BFF dev procese — serve-uje `/caisd-rest/*` upstream
mocky. **Žiadna sieť von z dev laptopu.**

Ctrl-C zabije celý stack.

### Validácia že je všetko OK

```bash
pnpm lint        # ESLint + Prettier check
pnpm typecheck   # TypeScript --noEmit
pnpm test        # Vitest unit + component
pnpm build       # Turbo run build pre všetkých 3 apps
```

Detail: [`docs/agents/devex-devops/repo-bootstrap.md`](agents/devex-devops/repo-bootstrap.md) + [`docs/agents/devex-devops/dev-environment.md`](agents/devex-devops/dev-environment.md).

## 3. Kľúčové persony

Šesť person, ktoré pokrývajú obe aplikácie:

| Persona | App | Rola | Čo robí |
|---|---|---|---|
| **Lucia (requester)** | `portal` | end user | Otvorí ticket za 60 s, sleduje status, hľadá v KB pred otvorením ticketu. |
| **Anna (agent_l1)** | `workspace` | L1 analyst | Triage 25–60 ticketov / zmenu, klávesovo `j/k/r/c`, prevažne uzatvára cez KB. |
| **Marek (agent_l2)** | `workspace` | L2 specialist + problem manager | Deep-dive eskalovaných incidentov, RCA, vytváranie KB článkov. |
| **Peter (change_manager)** | `workspace` | Change Manager + CAB chair | Týždenný CAB review 25 changes, emergency approve z mobilu. |
| **Jana (kb_editor)** | `workspace` | Knowledge Engineer | Daily 1–3 nové články, review/publish, analytics retrospektíva. |
| **Robert (cmdb_owner)** | `workspace` | CMDB Owner | CI detail review, impact analysis pred patches, cross-tenant shared CI. |

Detail s profilmi, frustráciami, scenármi: [`docs/agents/ux-persona-analyst/personas.md`](agents/ux-persona-analyst/personas.md).

## 4. Kde čo nájdem

### Top-level dokumentácia

| Kde | Čo |
|---|---|
| [`GOAL.md`](../GOAL.md) | Projektový kontext, scope, NFR, multi-tenancy, MVP-first. **Začni tu.** |
| [`docs/system-overview.md`](system-overview.md) | High-level tour: C4 diagramy, stack, auth, dáta, branching. |
| [`docs/dev-handbook.md`](dev-handbook.md) | Vývojárska príručka — coding conventions, ako pridať feature, FAQ. |
| [`docs/spec/<modul>.md`](spec/) | Per-modul konsolidovaná špecifikácia (Incident, Request, Problem, Change, KB, CMDB, Multi-tenancy). |

### Autoritatívne výstupy 9 analytických agentov

V `docs/agents/<name>/` žijú detailné výstupy:

| Adresár | Obsah |
|---|---|
| [`api-analyst/`](agents/api-analyst/) | REST katalóg, auth flow, multi-tenancy, gaps + SOAP fallback. |
| [`ux-persona-analyst/`](agents/ux-persona-analyst/) | 6 person, 18 user journeys, wireframy (portal + workspace + shared). |
| [`domain-modeller/`](agents/domain-modeller/) | Entity, vzťahy, 5 lifecycles (Incident / Request / Problem / Change / KB). |
| [`architecture/`](agents/architecture/) | C4 L1/L2, 12 ADRs, monorepo layout, data flows. |
| [`security/`](agents/security/) | Auth flow, RBAC matica, OWASP mitigations, multi-tenancy security, audit a compliance. |
| [`tech-stack-selector/`](agents/tech-stack-selector/) | Porovnávacia matica, libraries, risks. |
| [`design-system/`](agents/design-system/) | Tokens, komponenty (P0/P1), a11y, theming, microcopy. |
| [`devex-devops/`](agents/devex-devops/) | Bootstrap, CI/CD, mock strategy, runtime config. |
| [`qa-test-strategy/`](agents/qa-test-strategy/) | Test pyramída, coverage targets, acceptance criteria pre 18 journeys, performance, a11y testy. |

### Kde je čo v repe

| Cesta | Účel |
|---|---|
| `apps/portal/src/features/` | Portal feature moduly per route (home, new-incident, catalog, ticket-detail, kb-search, ...). |
| `apps/workspace/src/features/` | Workspace feature moduly (queue, ticket-detail, problems, changes, change-calendar, kb-editor, cmdb, command-palette, ...). |
| `apps/bff/src/` | BFF — `auth/`, `api/`, `aggregator/`, `platform/`, `session-store/`. |
| `packages/domain/src/lifecycles/` | State machines per entita. |
| `packages/domain/src/permissions/` | `RoleCode → Permission[]` mapping. |
| `packages/design-system/src/primitives/` | Button, Input, Select, Modal, ... |
| `packages/design-system/src/composites/` | DataTable, TenantSwitcher, Toast, Composer, Timeline, ... |
| `packages/api-mocks/src/handlers/` | MSW handlers. |
| `packages/api-mocks/src/factories/` | Test fixture factories (seeded). |
| `e2e/` | Playwright E2E specs (per modul). |
| `tools/` | Build tooling: ESLint config, TS base config, i18n-check, boundaries-check, coverage threshold script. |
| `.agents/` | Agent prompty + run state (PM CLI). |
| `.github/workflows/` | CI/CD pipelines. |

### Kde sú ADRs

`docs/agents/architecture/decision-records/` — 12 ADRs (BFF, monorepo,
data fetching, state, routing, dynamic forms, i18n, error handling,
observability, build, multi-tenancy, runtime config). Všetky `accepted`
post round 2.

Krátky súhrn v [`docs/dev-handbook.md`](dev-handbook.md) §6.

## 5. Ďalšie kroky

### Pre nového vývojára

1. **Prečítaj** `GOAL.md` (cca 20 min) — pochopíš čo robíme a prečo.
2. **Skús** `pnpm dev` (5 min) — uvidíš Portal aj Workspace beží proti MSW.
3. **Pre tvoj modul**: otvor `docs/spec/<modul>.md` (5–8 strán, navigovateľné).
4. **Pre tvoju oblasť**: prejdi relevantný `docs/agents/<name>/` adresár.
5. **Coding conventions**: prečítaj `docs/dev-handbook.md` §2.
6. **Tvoj prvý PR**: pozri sekciu §3 "Ako pridať nový feature".

### Pre nového PO / PM-a (non-engineering)

1. **Prečítaj** `GOAL.md` — projekt v jednom dokumente.
2. **Persony**: `docs/agents/ux-persona-analyst/personas.md` — 6 person s profilmi.
3. **User journeys**: `docs/agents/ux-persona-analyst/journeys.md` — 18 scenárov.
4. **Scope** (čo je v MVP, čo nie): `docs/spec/<modul>.md` §1 per modul.
5. **Open issues** v každom modulovom spec-u: sekcia `§9 Otvorené body`.

### Pre nového security reviewera

1. **Auth model**: `docs/agents/security/auth-flow.md` (OIDC + BFF + httpOnly).
2. **RBAC**: `docs/agents/security/rbac.md` (7 UI rolí, 31 obrazoviek, ~60 permission keys).
3. **Multi-tenancy threat model**: `docs/agents/security/multi-tenancy-security.md`
   (15 leakage scenárov, mitigácie).
4. **OWASP**: `docs/agents/security/owasp-mitigations.md` (A01–A10).
5. **Audit**: `docs/agents/security/audit-and-compliance.md`.

### Pre nového designera

1. **Persony + journeys** (kontext).
2. **Wireframy**: `docs/agents/ux-persona-analyst/wireframes/` (portal + workspace + shared).
3. **Tokens + komponenty**: `docs/agents/design-system/tokens.md` a `components.md`.
4. **A11y**: `docs/agents/design-system/a11y.md`.
5. **Microcopy** (SK / EN texts): `docs/agents/design-system/microcopy.md`.

## Otvorené závislosti

Žiadne. Artefakt je samonosný.
