# Acceptance Criteria — SDM-Rewrite

> Mapovanie 18 user journeys z `docs/agents/ux-persona-analyst/journeys.md`
> na konkrétne testy. **Žiadny test bez acceptance criterion**, **žiadny
> journey bez aspoň jedného E2E**.
>
> Notácia tagu: `@scenario:<journey-id>`. Persona tag: `@persona:<persona>`.
> Modul tag: `@module:<modul>`.

## 1. Master mapping table

| # | Journey ID | Persona | Modul | Primárny test typ | E2E? | Smoke (PR)? | Contract test ref | Multi-tenant? |
|---|---|---|---|---|---|---|---|---|
| 1 | `portal-incident-broken-laptop` | requester_lucia | incident, attachment | E2E (happy + 3 alternates) | yes | **yes** | `incident.ctest.ts`, `attachment.ctest.ts` | yes (tenant breadcrumb) |
| 2 | `portal-request-software` | requester_lucia | request, service-catalog | E2E (happy + approval reject) | yes | **yes** | `request.ctest.ts`, `service-catalog.ctest.ts` | no |
| 3 | `portal-kb-self-help` | requester_lucia | knowledge | E2E (search → article → "useful") + alt (0 výsledkov) | yes | no | `knowledge.ctest.ts` | no |
| 4 | `workspace-incident-triage` | agent_l1_anna | incident, knowledge | E2E (queue → close 3 via KB) + tenant switch alternate | yes | **yes** | `incident.ctest.ts` | yes (tenant switch mid-flow) |
| 5 | `workspace-incident-resolve-with-cmdb` | agent_l1_anna | incident, cmdb | E2E (CI link + problem link + close) | yes | no | `incident.ctest.ts`, `cmdb.ctest.ts` | no |
| 6 | `workspace-incident-escalate-to-l2` | agent_l1_anna | incident | E2E (escalate happy) + integration (empty group fail-fast) | yes | no | `incident.ctest.ts` | yes (cross-tenant group) |
| 7 | `workspace-problem-rca` | agent_l2_marek | problem, incident, knowledge | E2E (bulk-link 12 incidents, RCA, KB draft) | yes | no | `problem.ctest.ts`, `knowledge.ctest.ts` | yes (cross-tenant link alt) |
| 8 | `workspace-cmdb-impact-analysis` | agent_l2_marek | cmdb, change | E2E (graph 23 nodes → filter → export) + perf (200+ nodes cluster) | yes | no | `cmdb.ctest.ts` | no |
| 9 | `workspace-incident-deep-dive` | agent_l2_marek | incident, knowledge | E2E (close required-field block + KB from ticket + reviewer fallback) | yes | no | `incident.ctest.ts`, `knowledge.ctest.ts` | no |
| 10 | `workspace-change-cab-prep` | change_manager_peter | change | E2E (filter "CAB pending", calendar view, tag 5 "discuss", PDF export) | yes | no | `change.ctest.ts` | no |
| 11 | `workspace-change-emergency-approve` | change_manager_peter | change, auth | E2E (mobile viewport, 2FA confirm, rollback empty → block) | yes | **yes** | `change.ctest.ts`, `auth.ctest.ts` | no |
| 12 | `workspace-change-cross-tenant-conflict` | change_manager_peter | change | E2E (toggle "All my tenants", overlap detection) + integration (no role in second tenant → read-only) | yes | no | `change.ctest.ts` | yes (cross-tenant calendar) |
| 13 | `workspace-kb-author-new` | kb_editor_jana | knowledge | E2E (new article → preview → submit) + integration (autosave recovery) | yes | no | `knowledge.ctest.ts` | no |
| 14 | `workspace-kb-from-incident` | kb_editor_jana | knowledge, incident | E2E (notification → editor → publish) + integration (visibility scope per tenant) | yes | no | `knowledge.ctest.ts` | yes (visibility scope) |
| 15 | `workspace-kb-analytics-review` | kb_editor_jana | knowledge | E2E (analytics dashboard → mark articles for update) | yes | no | `knowledge.ctest.ts` | no |
| 16 | `workspace-cmdb-ci-detail` | cmdb_owner_robert | cmdb | E2E (CI detail → 47 attrs → collapse sections → patch-ready) + integration (time filter on history) | yes | no | `cmdb.ctest.ts` | no |
| 17 | `workspace-cmdb-relationship-impact` | cmdb_owner_robert | cmdb | E2E (graph + filter depends-on-me + PDF export progress) | yes | no | `cmdb.ctest.ts` | no |
| 18 | `workspace-cmdb-cross-tenant-shared` | cmdb_owner_robert | cmdb | E2E (HQ CI consumed by Acme East, read-only detail) + integration (no role → aggregate only) | yes | **yes** | `cmdb.ctest.ts` | yes (cross-tenant visibility) |

**Riadkov: 18** ✓ (validačný kontrakt outputs.md splnený).

**Smoke E2E suite (per PR)**: # 1, 2, 4, 11, 18 → 5 scenárov, ~2 min wall clock.

## 2. Per-journey acceptance criteria (detailný breakdown)

### `portal-incident-broken-laptop` (#1)

**Persona:** requester_lucia (`portal`)

**DoD (happy path):**
- [ ] Lucia otvorí portál, SSO redirect prebehne (mocked).
- [ ] Domov ukáže "Nahlásiť problém" ako primárnu akciu (nie zoznam funkcií).
- [ ] Klik na "Hardvér" + popis + screenshot (5 MB) → submit za < 60 sekúnd (UI-time, simulované).
- [ ] Po submit: vidí ticket ID, status "New", potvrdenie e-mailu (mocked).
- [ ] Tenant breadcrumb "Tenant: Acme HQ" viditeľný počas celého formulára.

**DoD (alternate):**
- [ ] Upload 80 MB → 413 → inline error "Maximum 25 MB. Skús screenshot." Formulár zachovaný.
- [ ] SSO session expired mid-submit → 401 → draft uložený v localStorage → po re-login formulár obnovený.
- [ ] Tenant switch pred submitom → breadcrumb sa zmení, formulár preserved.

**Tag:** `@scenario:portal-incident-broken-laptop @persona:requester_lucia @module:incident @tenant:multi`

### `portal-request-software` (#2)

**DoD (happy path):**
- [ ] Service Catalog search "figma" → 1 výsledok.
- [ ] Klik → dynamický formulár (3 polia: project name, duration, business justification).
- [ ] Submit → 201 → status "Pending Approval" + email manažérovi (mocked).
- [ ] Po `approve` (mocked second user session): status "Fulfilled" + license key v komentári.

**DoD (alternate — rejection):**
- [ ] Manager zamietne s dôvodom → notification → ticket detail ukáže **rejection reason prominentne** (nie zahrabaný v komentároch).

**Tag:** `@scenario:portal-request-software @persona:requester_lucia @module:request @tenant:single`

### `portal-kb-self-help` (#3)

**DoD (happy path):**
- [ ] Search "VPN nefunguje doma" → top result "Reset VPN klienta".
- [ ] Article render — všetky kroky čitateľné.
- [ ] Klik "Bolo to užitočné" → 200 → toast confirmation.
- [ ] Žiaden ticket sa nezaloží.

**DoD (alternate — 0 výsledkov):**
- [ ] Search "abrakadabra" → 0 výsledkov → CTA "Nenašiel som odpoveď — chceš otvoriť ticket?" → pred-vyplnený form.

**DoD (alternate — EN article, SK profil):**
- [ ] Article len v EN → render s badge "Iba v angličtine" (nie stub "Translation pending").

**Tag:** `@scenario:portal-kb-self-help @persona:requester_lucia @module:knowledge @tenant:single`

### `workspace-incident-triage` (#4)

**DoD (happy path):**
- [ ] Workspace otvor → default queue "My team — New" → 12 ticketov sort by priority desc.
- [ ] Filter "Hardware" → 4 tickety.
- [ ] Klik prvý → split view.
- [ ] Klávesy `r`, `c`, `j` fungujú per `personas.md`.
- [ ] PATCH ticket status=resolved → ticket fade-out, queue scroll preserved.

**DoD (alternate — tenant switch):**
- [ ] Otvorený ticket detail → switch tenanta → detail sa zatvorí, toast "Prepol si do Acme East — queue prenahraná", nový queue load.

**DoD (alternate — ticket assigned na iného):**
- [ ] Otvorí cudzí ticket → reply button disabled s tooltipom → klávesa `t` (take) → reply odomknutý.

**DoD (alternate — queue prefs persistence):**
- [ ] Sort + filter nastavený → reload → preferencie zachované z localStorage.

**Tag:** `@scenario:workspace-incident-triage @persona:agent_l1_anna @module:incident @tenant:multi`

### `workspace-incident-resolve-with-cmdb` (#5)

**DoD (happy path):**
- [ ] Ticket detail → right panel: requester + CI (laptop "L-1042") + 8 ďalších incidentov rovnaký patch.
- [ ] Link na Problem #PRB-44 → fuzzy search "Outlook patch" funguje.
- [ ] Reply z KB článku → close as workaround.

**DoD (alternate):**
- [ ] CI nepriradené → right panel "CI: Nepriradené" + "Prideliť CI" button **disabled** s tooltipom "Nemáš oprávnenie editovať CMDB" (RBAC).

**Tag:** `@scenario:workspace-incident-resolve-with-cmdb @persona:agent_l1_anna @module:incident @tenant:single`

### `workspace-incident-escalate-to-l2` (#6)

**DoD (happy path):**
- [ ] Klik "Eskalovať" → modal "Eskalovať na ktorú skupinu?" → vyber "L2 Network" → poznámka → submit → ticket zmizne z My queue, toast.

**DoD (alternate — prázdna poznámka):**
- [ ] Submit bez poznámky → soft warning "Eskalujete bez poznámky. Pokračovať?" (nie hard-block).

**DoD (alternate — prázdna skupina):**
- [ ] L2 Network nemá v "Acme East" aktívnych členov → group nezobrazená alebo zobrazená s badge "Žiadny aktívny člen". Nikdy nepovolí eskaláciu do prázdnej skupiny.

**Tag:** `@scenario:workspace-incident-escalate-to-l2 @persona:agent_l1_anna @module:incident @tenant:multi`

### `workspace-problem-rca` (#7)

**DoD (happy path):**
- [ ] Create Problem #PRB-118 → tab "Linked Incidents" → bulk add 12 z query "outlook AND Acme-East".
- [ ] RCA tab → link na CI "exch-east-01" → mark Known Error.
- [ ] "Create KB from this" → KB editor pred-vyplnený.

**DoD (alternate — cross-tenant linkovanie):**
- [ ] Bulk add obsahuje 2 z iného tenanta → ikona badge + warning "Linkuješ tickety z viacerých tenantov — povolené?" — záleží na finálnom rozhodnutí GAP-2.

**Tag:** `@scenario:workspace-problem-rca @persona:agent_l2_marek @module:problem @tenant:multi`

### `workspace-cmdb-impact-analysis` (#8)

**DoD (happy path):**
- [ ] CMDB search "srv-stg-east-02" → CI detail → "Relationships" tab → graph 23 nodes.
- [ ] Filter "depends on me" → expand layer 2.
- [ ] PDF export → success.

**DoD (alternate — large graph):**
- [ ] Graph 200+ nodes → automatický cluster (typy CI grouped) namiesto spaghetti.

**DoD (perf):**
- [ ] Graph render < 800 ms pre 23 nodes (UI-perf budget).

**Tag:** `@scenario:workspace-cmdb-impact-analysis @persona:agent_l2_marek @module:cmdb @tenant:single`

### `workspace-incident-deep-dive` (#9)

**DoD (happy path):**
- [ ] Eskalovaný ticket → Anniny poznámky čitateľné → komentár → close → "Vytvoriť KB článok" → editor pred-vyplnený → "Submit for review" → reviewer=Jana.

**DoD (alternate — required field):**
- [ ] Close bez resolution code → **inline** block (focus na poli), nie modálne prerušenie.

**DoD (alternate — reviewer PN):**
- [ ] Jana je inactive → UI navrhne alternatívneho reviewera zo skupiny "KB Editors".

**Tag:** `@scenario:workspace-incident-deep-dive @persona:agent_l2_marek @module:incident @tenant:single`

### `workspace-change-cab-prep` (#10)

**DoD (happy path):**
- [ ] Filter "CAB pending" → 25 changes → calendar view (week) → 2 konflikty vizuálne zvýraznené.
- [ ] Tag 5 changes "discuss in CAB" → poznámky.
- [ ] PDF export agenda.

**DoD (alternate — keyboard nav):**
- [ ] Bulk tag funguje len klávesnicou (Peter premieta).

**Tag:** `@scenario:workspace-change-cab-prep @persona:change_manager_peter @module:change @tenant:single`

### `workspace-change-emergency-approve` (#11)

**DoD (happy path, mobile):**
- [ ] Notification → deep-link → change detail (mobile viewport 375 px).
- [ ] Read impact + rollback → "Approve" → 2FA challenge → confirm → status "Approved".

**DoD (alternate — 2FA fail):**
- [ ] 2FA network error → retry button without losing context (nie redirect na home).

**DoD (alternate — rollback empty):**
- [ ] Rollback plan empty → Approve disabled + warning → "Request changes" akcia → späť implementorovi.

**Tag:** `@scenario:workspace-change-emergency-approve @persona:change_manager_peter @module:change @tenant:single`

### `workspace-change-cross-tenant-conflict` (#12)

**DoD (happy path):**
- [ ] Toggle "All my tenants" → calendar overlay HQ + Acme East.
- [ ] HQ maintenance 00:00–06:00 + Acme East change 02:00–06:00 → red overlap badge.

**DoD (alternate — no role in second tenant):**
- [ ] Peter nemá rolu v "Acme East" → toggle "Show external tenants (read-only)" → fungovanie závislé od finálneho rozhodnutia GAP-3.

**Tag:** `@scenario:workspace-change-cross-tenant-conflict @persona:change_manager_peter @module:change @tenant:multi`

### `workspace-kb-author-new` (#13)

**DoD (happy path):**
- [ ] New article → template "How-to" → title, category, body → WYSIWYG s drag-drop screenshot → tagy → Preview → Submit for review.

**DoD (alternate — autosave):**
- [ ] Browser crash → re-open editor → "Obnoviť draft z 14:32" banner → klik → obsah obnovený.

**DoD (alternate — missing category):**
- [ ] Submit bez kategórie → inline error + focus.

**Tag:** `@scenario:workspace-kb-author-new @persona:kb_editor_jana @module:knowledge @tenant:single`

### `workspace-kb-from-incident` (#14)

**DoD (happy path):**
- [ ] Notification "Marek vytvoril KB draft" → klik → editor → edit → Publish → 200, visibility per tenant.

**DoD (alternate — visibility scope):**
- [ ] Pôvodný ticket v inom tenante → KB editor má visibility selector (per tenant vs. all tenants) → Jana musí explicitne vybrať.

**Tag:** `@scenario:workspace-kb-from-incident @persona:kb_editor_jana @module:knowledge @tenant:multi`

### `workspace-kb-analytics-review` (#15)

**DoD (happy path):**
- [ ] Analytics tab → posledný týždeň → top 10 views, bottom 5 helpfulness, search miss.
- [ ] Mark 3 článkov "update" → stub 2 chýbajúce.

**DoD (alternate — language mismatch):**
- [ ] Search miss "password reset" 50× → analytics ukáže "search SK, article EN" — záleží od GAP-4.

**Tag:** `@scenario:workspace-kb-analytics-review @persona:kb_editor_jana @module:knowledge @tenant:single`

### `workspace-cmdb-ci-detail` (#16)

**DoD (happy path):**
- [ ] CMDB search → CI "srv-prod-db-01" → sticky header (name, type, owner) → 47 atribútov + 23 vzťahov + 6 incidentov + change history.
- [ ] Označiť "patch-ready" + link na nadchádzajúci change.

**DoD (alternate — collapse):**
- [ ] Collapse UDF sekcií → preferencia per-user persistuje.

**DoD (alternate — time filter):**
- [ ] History 200+ entries → time filter "last month" → < 50 entries.

**Tag:** `@scenario:workspace-cmdb-ci-detail @persona:cmdb_owner_robert @module:cmdb @tenant:single`

### `workspace-cmdb-relationship-impact` (#17)

**DoD (happy path):**
- [ ] CI "crm-legacy" → graph 35 vzťahov → filter "depends on me" → 4 batch joby + 2 reporty.
- [ ] Klik každý → right panel detail.
- [ ] PDF export progress (% bar, nie freeze).

**DoD (alternate — deprecated nodes):**
- [ ] "depends on me" obsahuje deprecated CI → farebne odlíšené v grafe.

**Tag:** `@scenario:workspace-cmdb-relationship-impact @persona:cmdb_owner_robert @module:cmdb @tenant:single`

### `workspace-cmdb-cross-tenant-shared` (#18)

**DoD (happy path):**
- [ ] CI "stg-shared-01" (HQ) → relationship "consumed by Acme East apps (3)" → klik → list 3 CI s badge "External tenant" → klik na app → read-only detail.

**DoD (alternate — no role in East):**
- [ ] Robert nemá rolu → relationship ukáže aggregate count bez detailu + contact tenant administrátora.

**DoD (alternate — shared ownership):**
- [ ] Shared CI → badge "Shared ownership: HQ + Acme East" → edit disabled s tooltipom.

**Tag:** `@scenario:workspace-cmdb-cross-tenant-shared @persona:cmdb_owner_robert @module:cmdb @tenant:multi`

## 3. Cross-cutting acceptance criteria

Mimo per-journey overení musí byť pokryté:

| # | Aspekt | Layer | Tag |
|---|---|---|---|
| C1 | Tenant izolácia: prepnutie tenanta vyčistí cache / state predošlého | E2E + integration | `@tenant:isolation` |
| C2 | Tenant switcher: zoznam iba tenantov, kde má user rolu | E2E | `@tenant:list` |
| C3 | Tenant scope v každom request | contract | `@tenant:scope` |
| C4 | RBAC per tenant: rovnaký user, rôzne role v rôznych tenantoch → rôzne UI | E2E | `@tenant:rbac` |
| C5 | i18n: SK + EN pre všetky route — žiadne hard-coded stringy v JSX | static + integration smoke | `@i18n` |
| C6 | a11y: žiadne `serious`/`critical` axe violations na hlavných obrazovkách | E2E | `@a11y` |
| C7 | Perf: TTI < 2 s pre portál na typickej linke | Lighthouse CI | `@perf` |
| C8 | Browser matrix: Chrome/Edge/Firefox last 2, Safari last 2 | E2E (nightly cross-browser) | `@browser-matrix` |
| C9 | Session expiry: silent re-auth na 401, fallback na login + draft preserved | E2E | `@auth:expiry` |
| C10 | Auto-save drafts: ticket form + KB editor — recovery po crash | E2E | `@draft-recovery` |

## 4. Defínícia "passed" pre jeden journey

Journey je **passed** ak:

1. Happy path E2E zelený.
2. **Všetky** alternate flow z `journeys.md` pre tento journey majú aspoň
   jeden test (E2E alebo integration podľa stĺpca "Primárny test typ").
3. Cross-cutting kritériá (§3) ktoré pre tento journey platia, sú zelené
   (napr. tenant izolácia pre #4).
4. Acceptance criteria checkbox-y z §2 sú odškrtnuté v PR review.

## Otvorené závislosti

- `[01-api-analyst]` Acceptance pre GAP-1 (dynamic form schema) — riadky 2,
  13, 14 (Service Catalog, KB editor) majú placeholder DoD pre dynamické polia.
  Po doimplementovaní schémy doplníme konkrétne field-validation testy.
- `[01-api-analyst]` Acceptance pre GAP-2, GAP-3, GAP-4 — riadky 7, 12, 15
  majú alternate DoD podmienené finálnym rozhodnutím. Round 2: zmení sa
  alternate na buď "happy path" (povolené) alebo "blocked with toast"
  (zamietnuté).
- `[05-security]` Acceptance pre emergency 2FA flow (riadok 11) — finálny
  challenge type (TOTP / push / SMS) ovplyvní E2E test (ako mock-ujeme
  2FA odpoveď v MSW).
- `[07-design-system]` Klávesové skratky (`j/k/r/c/t/e`) pre workspace —
  finálny global keymap musí byť dostupný ako exportovaná konštanta
  z design-systému, inak E2E testy budú referencovať magic strings.
- `[04-architecture]` Tenant context mechanizmus ovplyvní cross-cutting
  C3 (contract test šablónu). Súčasná verzia testuje fallback chain
  všetkých 3 možností — finálny mechanizmus zúži test.
- `[02-ux-persona-analyst]` `[GAP-3]` cross-tenant viewer role — ak CA SDM
  takúto rolu nemá, journey #12 (workspace-change-cross-tenant-conflict)
  bude v MVP markovaný `@skip:gap-3` a presunutý do v1 backlog.
