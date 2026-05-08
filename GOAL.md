# SDM-Rewrite — GOAL

> Interný dokument pre prípravnú fázu. Slúži ako vstup do ďalších chatov / agentov,
> ktoré budú jednotlivé oblasti detailne analyzovať a navrhovať.
> Zámerne stručný — detaily produkuje každý agent vo svojom artefakte.

## 1. Kontext a cieľ

- **Backend (existujúci, nemenený)**: Broadcom **CA Service Desk Manager 17.4**
  (CA Service Management 17.4 suite). Komerčný on-prem produkt.
- **Cieľ projektu**: postaviť **nový frontend** nad existujúce REST API CA SDM,
  ktoré nahradí/doplní pôvodné webové rozhranie produktu.
- **Backend nemodifikujeme** — všetky integrácie cez verejné REST/Web Services
  rozhrania CA SDM.

## 2. Backend — známe fakty (zdroj: `docs/ca-service-management-17-4.pdf`)

| Oblasť | Strana v PDF |
|---|---|
| CA SDM Product Architecture | 291 |
| CA Service Management Solution Architecture | 286 |
| Database Views (read model) | 2501 |
| **REST API** | **2906** |
| REST API — Service Point | 2907 |
| Web Services — best practices | 1398 |
| Web Services Methods | 3395 |
| REST HTTP Methods | 3436 |
| Web Services Attachment Methods | 3462 |
| Web Services Knowledge Methods | 3465, 3476 |
| Web Services Business Methods | 3517 |
| **API Documentation for RESTful Services** | **3766** |
| DatabaseInstance reference | 4013 |

Z toho odvodené:
- CA SDM exponuje **REST API** (`/caisd-rest/...`) aj **SOAP Web Services**
  (legacy). Cieľový FE použije **REST**, SOAP je fallback len pre operácie,
  ktoré REST nepokrýva (potvrdiť v analýze).
- Auth: produkt štandardne podporuje výmenu credentials za **REST access key**
  (`/caisd-rest/rest_access`). SSO (SAML/OIDC) je možné cez integráciu na
  reverse proxy / IdP — **rozhodnutie odložené na Security agenta** (§7).

## 3. Scope

Doručujeme v dvoch etapách: **MVP** (prvé funkčné nasadenie) a **v1** (rozšírenie).
Konkrétny dátum MVP zatiaľ nie je stanovený — definujeme ho po dokončení
analytickej fázy.

### V scope MVP
- **Incident Management** — vytvorenie, zobrazenie, queue, základný update.
- **Request Management** — servisné požiadavky, Service Catalog (čítanie + submit).
- **Problem Management** — read + linkovanie na incidenty.
- **Change Management** — read + základný approval flow.
- **Knowledge Management** — vyhľadávanie + čítanie KB článkov.
- **CMDB** — read CI + zobrazenie vzťahov (bez editácie).
- **Multi-tenancy** — riešiteľ vidí zoznam tenantov, v ktorých má rolu, a môže
  sa medzi nimi prepínať. Všetky volania a dáta sú izolované per aktívny tenant.

### Plánované do v1 (po MVP)
- Bulk operations vo workspace queue.
- KB editor (write/publish).
- CMDB editor + Visualizer integrácia.
- Pokročilý Change Calendar a CAB workflow.
- Reporting widgety.

### Mimo scope (natrvalo)
- Mobilné natívne aplikácie.
- Modifikácia backendu / custom polia v CA SDM.
- Migrácia historických dát.
- Plnohodnotné BI / reporting (predpoklad: existujúce nástroje).

## 4. Cieľové skupiny a návrh dvoch FE aplikácií

Namiesto jednej "unified" aplikácie navrhujem **dve samostatné SPA** v jednom monorepe:

| Aplikácia | URL (návrh) | Cieľová skupina | Charakter UI |
|---|---|---|---|
| **`portal`** | `portal.<org>` | zamestnanci, žiadatelia, koncoví zákazníci | nízka inf. hustota, čisté formuláre, self-service |
| **`workspace`** | `workspace.<org>` (alebo `agent.<org>`) | analytici L1/L2, change manageri, KB editori, CMDB správcovia | vysoká hustota, queues, hot-keys, multi-pane, bulk operations |

**Prečo dve aplikácie a nie jedna:**
- Rôzne security profily (portál má užší API rozsah a menší attack surface).
- Diametrálne odlišné UX patterny — splatenie nákladu ekonomicky výhodnejšie
  ako kompromisné UI pre obidve roly.
- Nezávislý release cyklus a nasadenie (rýchlejšie iterácie agent workspace).
- Spoločný kód minimalizuje duplikáciu cez monorepo (§9).

Tradeoff: dva CI/CD pipeliny, dve domény / vhosty, mierne vyššie náklady DevOps —
prijateľné vzhľadom na benefit. **Finálne rozhodnutie potvrdí Architecture agent** (§7).

## 5. Nefunkčné požiadavky

- **Auth**: SSO-ready (SAML alebo OIDC), tenant-scoped RBAC, žiadne credentials
  v browseri, short-lived tokeny, audit log. (Detail: Security agent.)
- **Multi-tenancy**: per-tenant izolácia v UI a v API volaniach, tenant switcher
  ako prvotriedny prvok navigácie, default tenant z používateľského profilu,
  zoznam dostupných tenantov je odvodený z CA SDM rolí používateľa.
- **API endpoint — konfigurovateľný**: produkčný backend nie je počas vývoja
  dostupný. Endpoint sa preto rieši cez:
  - **build-time** `.env` premennú (`VITE_API_BASE_URL` alebo ekv.) ako fallback,
  - **runtime** `config.json` načítaný pri štarte aplikácie (umožňuje meniť
    endpoint bez rebuildu — kritické pre on-prem deployment).
  - Vývoj prebieha proti **mock backendu** (MSW), ktorý implementuje DevOps agent
    nad schémami z API analysta.
- **i18n**: SK + EN (oba production-ready, kompletné preklady). Žiadne ďalšie
  jazyky v MVP.
- **a11y**: WCAG 2.1 AA cieľ.
- **Performance**: Time-to-Interactive na portáli < 2 s na typickej linke.
  Dáta sú malé (rádovo desiatky položiek v queue / CI) — nie je potrebná
  virtualizácia ani enterprise-grade tabuľkové knižnice.
- **Browsery**: Chrome/Edge/Firefox last 2, Safari last 2. IE/legacy = nie.
- **Observability**: štruktúrované logy v BFF (ak bude), error tracking
  (Sentry alebo ekvivalent), real user monitoring nice-to-have.
- **Compliance**: GDPR-aware (osobné údaje v ticketoch), audit trail v BE
  (CA SDM rieši natívne).

## 6. Otvorené rozhodnutia (deliberately deferred)

| Téma | Vlastník | Rozhoduje sa kedy |
|---|---|---|
| Tech stack (React / Angular / Vue) | Tech Stack Selector + Architecture | po doménovej analýze |
| Auth flow + IdP | Security agent | po stack-rozhodnutí |
| BFF áno/nie | Architecture agent | po API analyse |
| **Stratégia multi-tenancy** (HTTP header / cookie / route prefix / subdoména) | Architecture + Security | spoločne v svojej fáze |
| **Stratégia runtime configu** (`config.json` + endpoint `/config` vs. inline window object) | Architecture + DevOps | v Architecture fáze |
| Design system (custom / MUI / Mantine / …) | Design System agent | po UX person-osu |
| Hosting / deploy target | DevOps agent | po stack-rozhodnutí |
| Service Catalog UX (formulár generovanie) | UX agent + API Analyst | po Request module spec |

Kritériá výberu stacku (vstup pre selectora):
- Stredne komplexná SPA s tabuľkami **rádovo desiatok riadkov** — preferuj
  jednoduché knižnice, žiadna potreba virtualizácie pre 10k+ riadkov.
- Silný typový systém vs. CA SDM REST schém.
- Form rendering pre dynamické Service Catalog formuláre.
- Multi-tenancy plumbing — tenant context v každom volaní bez friction.
- Aktívna komunita, dlhodobá udržateľnosť.
- Integrovateľnosť SSO knižníc.
- Bundle size pre portál (mobile-first použitie).

## 7. Návrh agentov a ich rolí

Pipeline stojí na **Claude Agent SDK** (`@anthropic-ai/claude-agent-sdk`) — povinný
komponent projektu. Každý agent je samostatná Claude Code subagent inštancia
spustená **Project Manager** agentom (00) cez `query()` zo SDK. Konfigurácia
každého agenta žije v `.agents/<NN>-<name>/` (folder per subagent).

### 7.1 Štruktúra folderu agenta

Každý agent má v `.agents/<NN>-<name>/` tieto súbory (kontrakt, ktorý PM vie čítať):

| Súbor | Obsah |
|---|---|
| `agent.md` | YAML frontmatter (`name`, `description`, `tools`, `model`) + system prompt — vo formáte Claude Code subagent |
| `focus.md` | rola, expertíza, čo agent **NErobí** (negative scope) |
| `inputs.md` | vstupy — PDF page ranges, výstupy predchádzajúcich agentov, GOAL.md sekcie |
| `outputs.md` | kontrakt výstupných artefaktov (cesta + štruktúra súboru) v `docs/agents/<name>/` |
| `skills.md` | ktoré `buddy:*` / custom skills sa majú použiť a kedy |
| `mcp.json` | MCP servery, ktoré agent potrebuje (alebo `{}`) |
| `hooks.json` | hooks (PreToolUse, PostToolUse, SubagentStop) pre logovanie a validáciu |
| `preferences.md` | tón, jazyk, formátovanie, metodika |

### 7.2 Zoznam agentov

| # | Folder | Rola |
|---|---|---|
| 00 | `00-project-manager` | **Supervízor** — orchestruje pipeline, validuje výstupy, eskaluje |
| 01 | `01-api-analyst` | Katalóg REST/SOAP endpointov, schémy, auth flow, gaps |
| 02 | `02-ux-persona-analyst` | Persony, user journeys, wireframy |
| 03 | `03-domain-modeller` | Doménové entity, vzťahy, life cycles |
| 04 | `04-architecture` | Komponenty, ADRs, monorepo layout, BFF rozhodnutie |
| 05 | `05-security` | Auth flow, threat model, RBAC |
| 06 | `06-tech-stack-selector` | Porovnávacia matica, voľba stacku |
| 07 | `07-design-system` | Tokens, komponenty, a11y |
| 08 | `08-devex-devops` | Bootstrap repa, CI/CD, mock backend |
| 09 | `09-qa-test-strategy` | Test pyramída, mock stratégia |

### 7.3 Project Manager (00) — supervízor s konvergenčným loopom

PM riadi **iteratívny loop**, kým návrh nekonverguje. Beh má **2-fázový
round 1** + **N kôl refinement**, ukončený rozhodnutím PM (alebo limitom
max iterácií).

Zodpovednosti:
- Načíta `.agents/pipeline.yaml` (round-1 fázy + refinement config).
- **Round 1 — paralelný broadcast v 2 fázach**:
  - **Phase A** (vstup: GOAL.md + PDF): 01, 02, 03 paralelne.
  - **Phase B** (vstup: GOAL.md + výstupy Phase A): 04, 05, 06, 07, 08, 09 paralelne.

  Po každej fáze validácia výstupov.
- **Refinement loop (round 2..N)**:
  1. Z každého artefaktu parsuje sekciu `## Otvorené závislosti` (povinná, kontrakt v `.agents/README.md`).
  2. Detekuje cross-artifact konflikty (LLM-driven diff + cross-reference scan).
  3. Identifikuje cieľových agentov: tí, ktorých flagy nie sú uzavreté, alebo ktorých výstupy zasahuje konflikt.
  4. Zostaví **revision request** per cieľového agenta (predošlý výstup + delta od ostatných cez `context_hints` + konkrétne body na úpravu + round counter) a re-invokuje ho v **revision móde** (paralelne).
  5. Validuje nové výstupy.
  6. Vyhodnotí konvergenciu. Ak nie → next iteration.
- **Konvergenčné signály** (všetky musia platiť):
  - `no_open_dependencies` — žiadny artefakt nemá neuzavreté flagy.
  - `no_cross_artifact_conflicts` — cross-ref konzistentný.
  - `validation_passed` — outputs.md kontrakty splnené.
- **Eskalácia človeku**:
  - `max_iterations` dosiahnuté (default 5).
  - **Oscilácia** — agent osciluje medzi 2 stavmi v posledných 3 rundách.
  - Neriešiteľný konflikt (PM nevie zostaviť revision request).
- Stav v `.agents/state.json` **per agent per round**.

### 7.4 Pipeline schéma

```
                       ┌──────────────────────────────────┐
                       │   00 Project Manager              │
                       │   (orchestrácia + konvergencia)   │
                       └─────────────────┬────────────────┘
                                         │
   ┌─────────────────────────────────────┼─────────────────────────────────┐
   ▼                                     ▼                                 ▼

ROUND 1 — broadcast (2 fázy)        ROUND 2..N — refinement loop          
─────────────────────────────       ─────────────────────────────         
                                    ┌────────────────────────────┐
Phase A (paralelne):                │  parse `Otvorené závislosti`│
  01 API Analyst                    │  + cross-artifact diff       │
  02 UX/Persona                     └──────────────┬─────────────┘
  03 Domain Modeller                               │
                                                   ▼
─── PM validation ───               ┌────────────────────────────┐
                                    │  selektívna re-invokácia    │
Phase B (paralelne, vstup =          │  (len dotknutí agenti,      │
GOAL + Phase A výstupy):             │   paralelne, revision mode) │
  04 Architecture                   └──────────────┬─────────────┘
  05 Security                                       │
  06 Tech Stack                                     ▼
  07 Design System                  ┌────────────────────────────┐
  08 DevEx/DevOps                   │  konvergencia?              │
  09 QA Strategy                    │  YES → exit                 │
                                    │  NO  → next iteration       │
─── PM validation + flag scan ───   │  MAX → eskalácia človeku    │
                                    └────────────────────────────┘
```

### 7.5 Ako sa agent spúšťa (round-1 vs. revision mode)

```ts
import { query } from "@anthropic-ai/claude-agent-sdk";

// Round 1 — fresh invocation
const agent = loadAgentConfig(".agents/01-api-analyst");
for await (const ev of query({
  systemPrompt: agent.systemPrompt,
  allowedTools: agent.tools,
  mcpServers: agent.mcp,
  hooks: agent.hooks,
  workingDirectory: process.cwd(),
})) recordEvent(runId, round, "01-api-analyst", ev);

// Round N — revision mode (PM injects revision context as user message)
const revisionRequest = pm.buildRevisionRequest({
  agentId: "01-api-analyst",
  previousOutputs: ".../round-1/01-api-analyst/",
  deltaFrom: ["04-architecture", "05-security"],   // z context_hints
  itemsToRevise: [
    "Auth flow predpokladal direct rest_access; 04 ADR-01 zvolil BFF s OIDC.",
    "Multi-tenancy header sa rozhoduje v 04 ADR-11 — uzavri flag v gaps.md.",
  ],
  round: 2,
  maxIterations: 5,
});
for await (const ev of query({
  systemPrompt: agent.systemPrompt,        // rovnaký system prompt
  appendUserMessage: revisionRequest,      // kontext rozdielu navyše
  allowedTools: agent.tools,
  mcpServers: agent.mcp,
  hooks: agent.hooks,
  workingDirectory: process.cwd(),
})) recordEvent(runId, round, "01-api-analyst", ev);
```

Konkrétny kód PM — vrátane revision-prompt assemblera, diff analyzéra,
oscillation detectora a konvergenčného scoringu — implementuje DevOps agent
v bootstrap fáze. Tu definujeme kontrakt.

### 7.6 Izolácia vetiev a merge stratégia

`main` je **chránená**. Žiadny sub-agent nepíše do `main` priamo. Všetky
zápisy idú cez agent-špecifickú vetvu a PM ich kontrolovane merguje.

**Branching model**:

```
main                                            ← chránená; iba PR-merge
└── pipeline/<runId>                            ← integration vetva pipeline behu
    ├── pipeline/<runId>/round-<N>              ← integration vetva rundy
    │   ├── agent/<runId>/01-api-analyst        ← sub-agent vetva
    │   ├── agent/<runId>/02-ux-persona-analyst
    │   └── ...
    └── ...
```

**Mechanizmus** (PM riadi):

1. **Štart pipeline**: PM vytvorí `pipeline/<runId>` z `main`.
2. **Pre každú rundu**: PM vytvorí `pipeline/<runId>/round-<N>` z `pipeline/<runId>`.
3. **Pre každého agenta** v rámci rundy:
   - PM vytvorí vetvu `agent/<runId>/<NN>-<name>` z aktuálnej round-vetvy.
   - PM vytvorí **`git worktree`** v `.agents/runs/<runId>/worktrees/<NN>-<name>/`
     (umožňuje **skutočne paralelný** beh agentov bez kolízie working tree).
   - PM spustí agenta cez Claude Agent SDK s `cwd` nastaveným na worktree path.
   - Agent píše iba súbory do svojho worktree. **Žiadne git príkazy** —
     to robí PM.
   - Po skončení a validácii PM commitne v worktree:
     `[<runId>][round-<N>][<NN>] <summary>`.
4. **Po fáze**: PM mergne všetky agent-vetvy do round-vetvy
   (`--no-ff`, jeden merge commit per agent), uvoľní worktrees.
5. **Po validácii rundy**: PM mergne round-vetvu do `pipeline/<runId>`.
6. **Po konvergencii**: PM otvorí **PR z `pipeline/<runId>` do `main`** cez
   `gh pr create`. **Finálny merge do `main` schvaľuje človek** v PR review.

**Konfliktná stratégia**:

Sub-agenti píšu do **disjunktných ciest** (`docs/agents/<name>/`), takže
merge konflikty sú zriedkavé. Pri konflikte PM eskaluje človeku, neauto-resolvuje.

**Branch protection na úrovni GitHub** (server-side reinforcement, nezávislé
od PM):

```bash
# Jednorazový setup, vyžaduje admin rights na repo:
gh api -X PUT repos/Spigotek/SDM-Rewrite/branches/main/protection \
  -F required_pull_request_reviews.required_approving_review_count=1 \
  -F enforce_admins=false \
  -f required_status_checks.strict=true \
  -F restrictions=null
```

Tým sa zabezpečí, že ani priamy push do `main` (omylom z lokálu) neprejde —
musí ísť cez PR + review.

## 8. High-level architektonický skeleton

```
                       ┌────────────────────────────┐
                       │       End Users            │
                       └──────┬──────────────┬──────┘
                              │              │
                              ▼              ▼
                  ┌──────────────────┐  ┌────────────────────┐
                  │  Portal SPA      │  │  Workspace SPA     │
                  │  portal.<org>    │  │  workspace.<org>   │
                  └─────────┬────────┘  └─────────┬──────────┘
                            │                     │
                            └──────────┬──────────┘
                                       ▼
                        ┌──────────────────────────────┐
                        │   IdP (SAML / OIDC)          │  ← Security
                        │   (TBD — corp Keycloak/AzAD) │     agent
                        └──────────────┬───────────────┘
                                       │
                                       ▼
                        ┌──────────────────────────────┐
                        │   BFF / API Gateway (TBD)    │  ← Architecture
                        │   • token validation         │     agent rozhodne
                        │   • aggregation / shaping    │     či vôbec
                        │   • caching, rate limit      │
                        └──────────────┬───────────────┘
                                       │
                                       ▼
                        ┌──────────────────────────────┐
                        │   CA Service Desk Manager    │
                        │   17.4  — REST API           │
                        │   /caisd-rest/...            │
                        │   (+ SOAP WS fallback)       │
                        └──────────────────────────────┘
```

## 9. Návrh repo štruktúry (monorepo)

```
sdm-rewrite/
├── apps/
│   ├── portal/                 # self-service SPA
│   └── workspace/              # agent workspace SPA
├── packages/
│   ├── api-client/             # typovaný klient nad CA SDM REST
│   ├── domain/                 # entity + state machines + validátory
│   ├── design-system/          # komponenty, tokeny, theming
│   └── auth/                   # SSO/token helpers
├── docs/
│   ├── ca-service-management-17-4.pdf   # zdrojová dokumentácia
│   └── agents/                 # výstupy agentov (§7)
├── tools/                      # lint, format, build config
├── .agents/                    # prompty a definície rolí agentov
├── GOAL.md
└── README.md
```

Konkrétny package manager / workspace tool (pnpm / Nx / Turborepo / iné) zvolí
**DevOps agent** podľa zvoleného stacku.

## 10. Ďalšie kroky (immediate next steps)

1. Schváliť GOAL.md (užívateľ).
2. Spustiť **API Analyst** ako prvý agent v samostatnom chate s presne vymedzeným
   page rangeom (2906–4013) a šablónou výstupu.
3. Paralelne spustiť **UX / Persona Analyst** — nezávislý od API.
4. Po obidvoch agentov spustiť **Domain Modeller**.
5. Až potom Architecture → Security → Stack → Design System → DevOps → QA.

## 11. Vstupy od používateľa — odpovede (2026-05-08)

| Otázka | Odpoveď a dôsledok |
|---|---|
| Referenčná inštancia CA SDM | **Teraz nie je k dispozícii.** Bude až po nasadení na server. → API endpoint je **konfigurovateľný cez `.env` + runtime `config.json`** (viď §5). Vývoj prebehne nad mock backendom (08 DevOps + MSW handlers podľa schém z 01). |
| Branding / vizuálna identita | **Plná delegácia na Design System agent (07).** Cieľ: moderný, úhľadný, profesionálny vzhľad. Žiadne corporate constraints; agent navrhne kompletne tokens, font, paletu. |
| Multi-tenancy | **Povinné.** Každý riešiteľ vidí len tenantov, v ktorých má definovanú rolu, a môže sa medzi nimi prepínať. → Per-tenant RBAC, tenant switcher v UI, tenant kontext v každom volaní (detail: 04 + 05). |
| Cieľová veľkosť dát | **Rádovo desiatky položiek** v queue / CI. → Žiadna virtualizácia, žiadne enterprise-grade tabuľkové knižnice. Preferuj jednoduchú voľbu (HTML table / TanStack Table v základnom režime). |
| SLA / timeline | **MVP first.** v1 sa dopracuje neskôr. Konkrétny dátum MVP TBD. |
| Jazyky UI | **SK + EN** — výlučne tieto dva. |
