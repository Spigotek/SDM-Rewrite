# Acceptance Criteria — SDM-Rewrite

## Changelog (round 2)

- Pridaná nová sekcia **§4 Security test vectors** ktorá konsoliduje QA test
  vectors zo 05 (auth-flow §8, multi-tenancy-security §10, OWASP A01–A10,
  threat-model R1–R10). 18 journey riadkov v §1 + 10 cross-cutting v §3 sú
  zachované bez zmeny.
- Cross-reference z journey riadkov (#1, #4, #11, #18) na `@security:<vector-id>`
  tagy v §4 — security testy nesedia v izolácii, ale fan-out z journey context-u.
- Uzavreté flagy: 05 emergency 2FA challenge type → default TOTP
  (`[business-deferred]`), 07 keyboard shortcuts → `[resolved-in-round-2]`,
  04 tenant context → `X-Tenant` header per ADR-11.

> Mapovanie 18 user journeys z `docs/agents/ux-persona-analyst/journeys.md`
> na konkrétne testy. **Žiadny test bez acceptance criterion**, **žiadny
> journey bez aspoň jedného E2E**.
>
> Notácia tagu: `@scenario:<journey-id>`. Persona tag: `@persona:<persona>`.
> Modul tag: `@module:<modul>`. Security tag: `@security:<vector-id>`.

## 1. Master mapping table

| # | Journey ID | Persona | Modul | Primárny test typ | E2E? | Smoke (PR)? | Contract test ref | Multi-tenant? | Security cross-ref |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `portal-incident-broken-laptop` | requester_lucia | incident, attachment | E2E (happy + 3 alternates) | yes | **yes** | `incident.ctest.ts`, `attachment.ctest.ts` | yes (tenant breadcrumb) | `@security:auth-login`, `@security:attachment-413`, `@security:session-expiry` |
| 2 | `portal-request-software` | requester_lucia | request, service-catalog | E2E (happy + approval reject) | yes | **yes** | `request.ctest.ts`, `service-catalog.ctest.ts` | no | `@security:csrf-mutation` |
| 3 | `portal-kb-self-help` | requester_lucia | knowledge | E2E (search → article → "useful") + alt (0 výsledkov) | yes | no | `knowledge.ctest.ts` | no | `@security:kb-xss-sanitization` |
| 4 | `workspace-incident-triage` | agent_l1_anna | incident, knowledge | E2E (queue → close 3 via KB) + tenant switch alternate | yes | **yes** | `incident.ctest.ts` | yes (tenant switch mid-flow) | `@security:tenant-switch`, `@security:tenant-cache-flush`, `@security:cross-tab-tenant-sync` |
| 5 | `workspace-incident-resolve-with-cmdb` | agent_l1_anna | incident, cmdb | E2E (CI link + problem link + close) | yes | no | `incident.ctest.ts`, `cmdb.ctest.ts` | no | `@security:rbac-denial-tooltip` |
| 6 | `workspace-incident-escalate-to-l2` | agent_l1_anna | incident | E2E (escalate happy) + integration (empty group fail-fast) | yes | no | `incident.ctest.ts` | yes (cross-tenant group) | `@security:audit-log-mutation` |
| 7 | `workspace-problem-rca` | agent_l2_marek | problem, incident, knowledge | E2E (bulk-link 12 incidents, RCA, KB draft) | yes | no | `problem.ctest.ts`, `knowledge.ctest.ts` | yes (cross-tenant link alt) | `@security:cross-tenant-deny` |
| 8 | `workspace-cmdb-impact-analysis` | agent_l2_marek | cmdb, change | E2E (graph 23 nodes → filter → export) + perf (200+ nodes cluster) | yes | no | `cmdb.ctest.ts` | no | – |
| 9 | `workspace-incident-deep-dive` | agent_l2_marek | incident, knowledge | E2E (close required-field block + KB from ticket + reviewer fallback) | yes | no | `incident.ctest.ts`, `knowledge.ctest.ts` | no | – |
| 10 | `workspace-change-cab-prep` | change_manager_peter | change | E2E (filter "CAB pending", calendar view, tag 5 "discuss", PDF export) | yes | no | `change.ctest.ts` | no | – |
| 11 | `workspace-change-emergency-approve` | change_manager_peter | change, auth | E2E (mobile viewport, 2FA confirm, rollback empty → block) | yes | **yes** | `change.ctest.ts`, `auth.ctest.ts` | no | `@security:step-up-totp`, `@security:audit-log-step-up`, `@security:csrf-mutation` |
| 12 | `workspace-change-cross-tenant-conflict` | change_manager_peter | change | E2E (toggle "All my tenants", overlap detection) + integration (no role in second tenant → read-only) | yes | no | `change.ctest.ts` | yes (cross-tenant calendar) | `@security:cross-tenant-view-sp` |
| 13 | `workspace-kb-author-new` | kb_editor_jana | knowledge | E2E (new article → preview → submit) + integration (autosave recovery) | yes | no | `knowledge.ctest.ts` | no | `@security:kb-markdown-sanitization` |
| 14 | `workspace-kb-from-incident` | kb_editor_jana | knowledge, incident | E2E (notification → editor → publish) + integration (visibility scope per tenant) | yes | no | `knowledge.ctest.ts` | yes (visibility scope) | `@security:kb-visibility-scope` |
| 15 | `workspace-kb-analytics-review` | kb_editor_jana | knowledge | E2E (analytics dashboard → mark articles for update) | yes | no | `knowledge.ctest.ts` | no | – |
| 16 | `workspace-cmdb-ci-detail` | cmdb_owner_robert | cmdb | E2E (CI detail → 47 attrs → collapse sections → patch-ready) + integration (time filter on history) | yes | no | `cmdb.ctest.ts` | no | – |
| 17 | `workspace-cmdb-relationship-impact` | cmdb_owner_robert | cmdb | E2E (graph + filter depends-on-me + PDF export progress) | yes | no | `cmdb.ctest.ts` | no | – |
| 18 | `workspace-cmdb-cross-tenant-shared` | cmdb_owner_robert | cmdb | E2E (HQ CI consumed by Acme East, read-only detail) + integration (no role → aggregate only) | yes | **yes** | `cmdb.ctest.ts` | yes (cross-tenant visibility) | `@security:cross-tenant-attachment`, `@security:cross-tenant-cmdb` |

**Riadkov: 18** ✓ (validačný kontrakt outputs.md splnený, počet sa nemení voči r1).

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
- [ ] Upload 80 MB → 413 → inline error "Maximum 25 MB. Skús screenshot." Formulár zachovaný. [`@security:attachment-413`]
- [ ] SSO session expired mid-submit → 401 → draft uložený v localStorage → po re-login formulár obnovený. [`@security:session-expiry`]
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

**DoD (alternate — malicious KB content):**
- [ ] KB článok obsahuje `<script>alert(1)</script>` (mocked from CA SDM) → render bez execution (DOMPurify / rehype-sanitize odstráni). [`@security:kb-xss-sanitization`]

**Tag:** `@scenario:portal-kb-self-help @persona:requester_lucia @module:knowledge @tenant:single`

### `workspace-incident-triage` (#4)

**DoD (happy path):**
- [ ] Workspace otvor → default queue "My team — New" → 12 ticketov sort by priority desc.
- [ ] Filter "Hardware" → 4 tickety.
- [ ] Klik prvý → split view.
- [ ] Klávesy `r`, `c`, `j` fungujú per `personas.md` a per 07 keyboard shortcut map.
- [ ] PATCH ticket status=resolved → ticket fade-out, queue scroll preserved.

**DoD (alternate — tenant switch):**
- [ ] Otvorený ticket detail → switch tenanta → detail sa zatvorí, toast "Prepol si do Acme East — queue prenahraná", nový queue load. [`@security:tenant-switch`, `@security:tenant-cache-flush`]
- [ ] Cross-tab: tab A switch → tab B detekuje zmenu cez BroadcastChannel / cookie verzia → reload. [`@security:cross-tab-tenant-sync`]

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
- [ ] CI nepriradené → right panel "CI: Nepriradené" + "Prideliť CI" button **disabled** s tooltipom "Nemáš oprávnenie editovať CMDB" (RBAC). [`@security:rbac-denial-tooltip`]

**Tag:** `@scenario:workspace-incident-resolve-with-cmdb @persona:agent_l1_anna @module:incident @tenant:single`

### `workspace-incident-escalate-to-l2` (#6)

**DoD (happy path):**
- [ ] Klik "Eskalovať" → modal "Eskalovať na ktorú skupinu?" → vyber "L2 Network" → poznámka → submit → ticket zmizne z My queue, toast.
- [ ] Audit log event `incident.escalated` sa emituje s `actor`, `ticketId`, `fromGroup`, `toGroup`, `tenantId` (overené v BFF integration test). [`@security:audit-log-mutation`]

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
- [ ] Bulk add obsahuje 2 z iného tenanta → ikona badge + warning "Linkuješ tickety z viacerých tenantov — povolené?" — záleží na finálnom rozhodnutí GAP-2. Default v MVP: 422 z BFF s `cross_tenant_linking_forbidden`. [`@security:cross-tenant-deny`]

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
- [ ] **Step-up auth** s default TOTP challenge — `acr_values=mfa` v step-up flow, sessionTTL 5 min. [`@security:step-up-totp`]
- [ ] Audit log event `change.approve.emergency` s `stepUpAt`, `actor`, `changeId`, `tenantId` (overené v BFF integration test). [`@security:audit-log-step-up`]

**DoD (alternate — 2FA fail):**
- [ ] 2FA network error → retry button without losing context (nie redirect na home).

**DoD (alternate — rollback empty):**
- [ ] Rollback plan empty → Approve disabled + warning → "Request changes" akcia → späť implementorovi.

**DoD (alternate — CSRF):**
- [ ] POST `/api/changes/CHG-503/approve` bez `X-CSRF-Token` header → 403. [`@security:csrf-mutation`]

**Tag:** `@scenario:workspace-change-emergency-approve @persona:change_manager_peter @module:change @tenant:single`

### `workspace-change-cross-tenant-conflict` (#12)

**DoD (happy path):**
- [ ] Toggle "All my tenants" → calendar overlay HQ + Acme East.
- [ ] HQ maintenance 00:00–06:00 + Acme East change 02:00–06:00 → red overlap badge.
- [ ] SP cross-tenant view toggle ON → step-up auth required (sektion §5 multi-tenancy-security). [`@security:cross-tenant-view-sp`]

**DoD (alternate — no role in second tenant):**
- [ ] Peter nemá rolu v "Acme East" → toggle "Show external tenants (read-only)" → fungovanie závislé od finálneho rozhodnutia GAP-3. Default MVP: hide.

**Tag:** `@scenario:workspace-change-cross-tenant-conflict @persona:change_manager_peter @module:change @tenant:multi`

### `workspace-kb-author-new` (#13)

**DoD (happy path):**
- [ ] New article → template "How-to" → title, category, body → WYSIWYG s drag-drop screenshot → tagy → Preview → Submit for review.
- [ ] Pri save body je sanitizovaný (DOMPurify) — pokus o `<script>` v markdown body sa stripuje. [`@security:kb-markdown-sanitization`]

**DoD (alternate — autosave):**
- [ ] Browser crash → re-open editor → "Obnoviť draft z 14:32" banner → klik → obsah obnovený.

**DoD (alternate — missing category):**
- [ ] Submit bez kategórie → inline error + focus.

**Tag:** `@scenario:workspace-kb-author-new @persona:kb_editor_jana @module:knowledge @tenant:single`

### `workspace-kb-from-incident` (#14)

**DoD (happy path):**
- [ ] Notification "Marek vytvoril KB draft" → klik → editor → edit → Publish → 200, visibility per tenant.

**DoD (alternate — visibility scope):**
- [ ] Pôvodný ticket v inom tenante → KB editor má visibility selector (per tenant vs. all tenants) → Jana musí explicitne vybrať. [`@security:kb-visibility-scope`]
- [ ] Pokus o publish do iného tenantu bez `sp_admin` → 403. [`@security:kb-visibility-scope`]

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
- [ ] CI "stg-shared-01" (HQ) → relationship "consumed by Acme East apps (3)" → klik → list 3 CI s badge "External tenant" → klik na app → read-only detail. [`@security:cross-tenant-cmdb`]

**DoD (alternate — no role in East):**
- [ ] Robert nemá rolu → relationship ukáže aggregate count bez detailu + contact tenant administrátora.

**DoD (alternate — shared ownership):**
- [ ] Shared CI → badge "Shared ownership: HQ + Acme East" → edit disabled s tooltipom.

**DoD (alternate — attachment cross-tenant):**
- [ ] GET `/api/attachments/<T1-id>` ako T2 user → 404 (nie 403 — leakuje existenciu). [`@security:cross-tenant-attachment`]

**Tag:** `@scenario:workspace-cmdb-cross-tenant-shared @persona:cmdb_owner_robert @module:cmdb @tenant:multi`

## 3. Cross-cutting acceptance criteria

Mimo per-journey overení musí byť pokryté:

| # | Aspekt | Layer | Tag |
|---|---|---|---|
| C1 | Tenant izolácia: prepnutie tenanta vyčistí cache / state predošlého | E2E + integration | `@tenant:isolation` |
| C2 | Tenant switcher: zoznam iba tenantov, kde má user rolu | E2E | `@tenant:list` |
| C3 | Tenant scope v každom request — `X-Tenant` header validovaný server-side per ADR-11 | contract | `@tenant:scope` |
| C4 | RBAC per tenant: rovnaký user, rôzne role v rôznych tenantoch → rôzne UI | E2E | `@tenant:rbac` |
| C5 | i18n: SK + EN pre všetky route — žiadne hard-coded stringy v JSX | static + integration smoke | `@i18n` |
| C6 | a11y: žiadne `serious`/`critical` axe violations na hlavných obrazovkách | E2E | `@a11y` |
| C7 | Perf: TTI < 2 s pre portál na typickej linke + BFF p50 < 200 ms, p95 < 800 ms | Lighthouse CI + BFF perf | `@perf` |
| C8 | Browser matrix: Chrome/Edge/Firefox last 2, Safari last 2 | E2E (nightly cross-browser) | `@browser-matrix` |
| C9 | Session expiry: silent re-auth na 401, fallback na login + draft preserved | E2E | `@auth:expiry` |
| C10 | Auto-save drafts: ticket form + KB editor — recovery po crash | E2E | `@draft-recovery` |

## 4. Security test vectors (nová sekcia r2)

> Sekcia konsoliduje QA test vectors zo Security agent (05) artefaktov:
> `auth-flow.md §8`, `multi-tenancy-security.md §10`, `threat-model.md §12 risk
> register`, `owasp-mitigations.md` (A01–A10), `rbac.md §10`. Každý vector má
> presný journey cross-ref (ak existuje) alebo beží ako standalone integration /
> BFF integration / contract test.
>
> Pre security vector platí: **každý 403 / 401 / 422 z BFF musí súčasne emitovať
> audit log event** — testuje sa cez assertion na audit log sink (in-memory v
> BFF integration testoch). Audit emission je samostatný cross-cutting cieľ.

### 4.1 Auth a session lifecycle

| Vector ID | Scenár | Test typ | Tag | Journey cross-ref | Zdroj |
|---|---|---|---|---|---|
| `auth-login` | Happy path: SPA → BFF → IdP → BFF → SDM → SPA s validnou cookie. PKCE state+nonce validation, EEM artifact exchange. | BFF integration + E2E | `@security:auth-login` | #1 | auth-flow §2.1, §8 |
| `auth-state-mismatch` | Callback s tampered `state` → abort + audit event `auth.state_mismatch`. | BFF integration | `@security:auth-state-mismatch` | – | auth-flow §6 |
| `auth-nonce-mismatch` | ID token s tampered `nonce` → abort + audit event. | BFF integration | `@security:auth-nonce-mismatch` | – | auth-flow §6 |
| `auth-audience-confusion` | ID token s `aud` ≠ BFF client_id → reject. | BFF integration | `@security:auth-audience` | – | OWASP A07, threat-model §3 |
| `auth-token-issuer-downgrade` | JWT s `alg: none` alebo `alg: HS256` od RS256 issuer → reject. | BFF integration (unit) | `@security:auth-alg-downgrade` | – | OWASP A07, threat-model §3 |
| `session-expiry` | Idle 15 min bez heartbeat → next call 401 `reason=idle_timeout` → modal + redirect /login. Draft preserved v localStorage. | E2E | `@security:session-expiry` | #1 | auth-flow §2.4 |
| `session-refresh` | Access key blízko expirácie → BFF silent re-auth s `POST /caisd-rest/rest_access` → user nevidí prerušenie. | BFF integration | `@security:session-refresh` | – | auth-flow §2.2 |
| `refresh-token-rotation` | IdP refresh-token rotation — re-use detection → IdP terminates session → SPA force re-login. | BFF integration | `@security:refresh-rotation` | – | auth-flow §2.2 |
| `logout-3-way` | Logout: cookie zmazaná + BFF session delete + CA SDM `DELETE /rest_access/<id>` + IdP `/revoke` (SLO best-effort). | BFF integration + E2E | `@security:logout-3way` | – | auth-flow §2.3 |
| `cross-tab-logout` | Logout v tab A → tab B detekuje cez BroadcastChannel → redirect /login. | E2E | `@security:cross-tab-logout` | – | auth-flow §2.6 |
| `csrf-mutation` | POST/PUT/DELETE bez `X-CSRF-Token` → 403. POST s expired/wrong token → 403. | BFF integration + E2E | `@security:csrf-mutation` | #2, #11 | auth-flow §4.2, OWASP A07/A04 |

### 4.2 Multi-tenancy a tenant switch

| Vector ID | Scenár | Test typ | Tag | Journey cross-ref | Zdroj |
|---|---|---|---|---|---|
| `tenant-switch` | Tenant switch happy path: user s 2 tenantmi → `POST /me/active-tenant` → session.activeTenantId update → SPA cache flush → refetch /me. | BFF integration + E2E | `@security:tenant-switch` | #4 | auth-flow §2.5, multi-tenancy-security §3 |
| `tenant-switch-attack-l1` | Forge `tenantId` mimo `session.allowedTenants[]` → 403 `forbidden_tenant` + audit event `forbidden_tenant_switch`. | BFF integration | `@security:tenant-switch-attack` | – | multi-tenancy-security L1, §10 |
| `tenant-cache-flush-l2` | Po switch z T1 do T2: žiadny T1 ID v DOM / network response / React Query cache. | E2E + integration | `@security:tenant-cache-flush` | #4 | multi-tenancy-security L2 |
| `tenant-stale-sw-l3` | Service Worker cache nedrží tenant-scoped data po switch. | E2E (PWA mode) | `@security:tenant-sw-cache` | – | multi-tenancy-security L3 |
| `cross-tab-tenant-sync-l4` | Tab A switch na T2 → tab B detekuje (BroadcastChannel + cookie tenantVer fallback) do 2 s → auto refetch /me. | E2E | `@security:cross-tab-tenant-sync` | #4 | multi-tenancy-security L4, auth-flow §2.6 |
| `tenant-error-shape-l5` | BFF error response v T1 neobsahuje T2 field names / IDs. | BFF integration | `@security:tenant-error-shape` | – | multi-tenancy-security L5 |
| `tenant-search-leak-l6` | Search query "secret-only-in-T1" v T2 → 0 výsledkov. | BFF integration + E2E | `@security:tenant-search-leak` | – | multi-tenancy-security L6 |
| `cross-tenant-attachment-l7` | `GET /api/attachments/<T1-id>` ako T2 user → **404** (nie 403, lebo 403 leakuje existenciu). | BFF integration + E2E | `@security:cross-tenant-attachment` | #18 | multi-tenancy-security L7, §10 |
| `tenant-activity-log-leak-l8` | Activity log endpoint vráti iba events z aktívneho tenantu. | BFF integration | `@security:tenant-activity-leak` | – | multi-tenancy-security L8 |
| `cross-tenant-cmdb-l9` | CMDB relationship graph v T1 neukáže T2 CI bez `shared` marker / `sp_admin` role. | E2E + integration | `@security:cross-tenant-cmdb` | #18 | multi-tenancy-security L9 |
| `cross-tenant-change-l10` | Change calendar v T1 neukáže T2 changes bez `change.read.calendar.cross-tenant` permission. | E2E + integration | `@security:cross-tenant-change` | #12 | multi-tenancy-security L10 |
| `tenant-telemetry-l11` | Sentry `beforeSend` hook stripne tenant-specific PII, group errors per UI-role. | unit + integration | `@security:tenant-telemetry` | – | multi-tenancy-security L11 |
| `tenant-race-l12` | Request sent v T1 returns po switch do T2 → AbortController cancels + response s `X-Response-Tenant` mismatch discard. | BFF integration + integration | `@security:tenant-race` | – | multi-tenancy-security L12 |
| `tenant-deep-link-l13` | URL ticket v T1 share-nutý kolegovi v T2 → BFF vráti `TENANT_FORBIDDEN` s `correctTenantId: T1` → UI ponúkne switch. | E2E | `@security:tenant-deep-link` | – | multi-tenancy-security L13 |
| `cross-tenant-view-sp-l14` | SP `sp_admin` zapne cross-tenant view → step-up auth → audit event `cross_tenant_view_enabled` + per-record `cross_tenant_read`. | E2E + BFF integration | `@security:cross-tenant-view-sp` | #12 | multi-tenancy-security §5, L14 |
| `tenant-bootstrap-claim-l15` | IdP `groups[]` claim sa použije iba pri prvom logine, neaktualizuje session zmeny. | BFF integration | `@security:tenant-bootstrap` | – | multi-tenancy-security L15 |
| `tenant-suspension` | Tenant suspended v CA SDM → next API call → 403 + redirect na tenant switcher + toast. | BFF integration + E2E | `@security:tenant-suspension` | – | multi-tenancy-security §7 |

### 4.3 Step-up auth a sensitive operations

| Vector ID | Scenár | Test typ | Tag | Journey cross-ref | Zdroj |
|---|---|---|---|---|---|
| `step-up-totp` | Default emergency 2FA challenge = TOTP. SP cross-tenant ON / tenant admin / bulk delete > 50 / audit export / impersonation start → step-up TTL 5 min. | E2E + BFF integration | `@security:step-up-totp` | #11 | multi-tenancy-security §6 |
| `step-up-expiry` | Step-up TTL vyprší → ďalšia sensitive op vyžaduje znova MFA. | BFF integration | `@security:step-up-expiry` | – | multi-tenancy-security §6 |
| `bulk-delete-step-up` | Bulk delete 60 záznamov → 403 + `step_up_required` → MFA prompt. | E2E | `@security:bulk-step-up` | – | OWASP A04, rbac §6.1 |
| `audit-log-step-up` | Každá step-up authenticated mutation emituje audit log event s `stepUpAt` timestampom + `actor` + `resource`. | BFF integration | `@security:audit-log-step-up` | #11 | audit-and-compliance §2 |

### 4.4 RBAC enforcement (per `rbac.md §10`)

| Vector ID | Scenár | Test typ | Tag | Journey cross-ref | Zdroj |
|---|---|---|---|---|---|
| `rbac-denial-tooltip` | UI action button disabled s tooltipom keď rola nemá permission (nie hide). Sample: requester sa snaží editovať CI. | E2E + integration | `@security:rbac-denial-tooltip` | #5 | rbac §9 |
| `rbac-route-guard-direct-url` | User naviguje na route bez `screen.access` priamou URL → 403 page (server-side guard, nielen UI hide). | E2E | `@security:rbac-route-guard` | – | rbac §1, OWASP A01 |
| `rbac-role-stale` | User downgradnutý z agent_l2 na agent_l1 v CA SDM → next BFF call (do 60 s) → 401 `role_changed` → force re-login. | BFF integration | `@security:rbac-role-stale` | – | rbac §1, threat-model §2 |
| `rbac-cross-tenant-deny` | Cross-tenant operácia (read/write) bez `*.cross-tenant` permission → 403. | BFF integration | `@security:cross-tenant-deny` | #7 | rbac §6 |
| `rbac-server-side-enforcement` | UI route guard sa obíde, ale BFF guard 100% zachytí. Matica role × endpoint × tenant → expected status. | BFF integration | `@security:rbac-server-side` | – | rbac §10, OWASP A01 |
| `rbac-object-level-authorization` | Requester sa pokúsi `GET /api/incidents/<niekto-iný-incident-id>` v rovnakom tenante → 403/404 (ownership check). | BFF integration | `@security:rbac-object-level` | – | OWASP A01 |
| `rbac-bulk-limit-per-role` | Bulk operations limity per role (≤50 L1, ≤200 L2). Pokus o > 200 → 422 / 429. | BFF integration | `@security:rbac-bulk-limit` | – | rbac §6.1 |

### 4.5 OWASP top-10 cross-cutting (per `owasp-mitigations.md`)

| Vector ID | Scenár | Test typ | Tag | Zdroj |
|---|---|---|---|---|
| `kb-xss-sanitization` | KB markdown s `<script>` / `javascript:` URL / `<img onerror=>` → sanitizer (DOMPurify / rehype-sanitize) strip. | Component + E2E | `@security:kb-xss-sanitization` | OWASP A03 |
| `kb-markdown-sanitization` | KB editor save body sanitizuje per render path (no `dangerouslySetInnerHTML` mimo whitelisted markdown wrapper). | Component | `@security:kb-markdown-sanitization` | OWASP A03, threat-model §5 |
| `attachment-filename-render` | Attachment filename render ako safe text node, nikdy `dangerouslySetInnerHTML`. | Component | `@security:attachment-filename` | OWASP A03, threat-model §5 |
| `wc-filter-builder-injection` | `WC=summary%3DU'%20OR%201%3D1` cez API → BFF query builder whitelist blocknul → 400. | BFF integration | `@security:wc-injection` | OWASP A03 |
| `https-only` | HTTP redirect → permanent redirect na HTTPS. TLS 1.2+ only (audit cipher suite cez external scan, non-CI). | manual / nightly | `@security:https-only` | OWASP A02 |
| `cookie-attributes` | Audit session cookie atribútov v DevTools: `__Host-` prefix, `HttpOnly`, `Secure`, `SameSite=Lax`, `Max-Age=28800`. | E2E | `@security:cookie-attrs` | OWASP A02, auth-flow §4.1 |
| `local-storage-no-tokens` | Lint pravidlo zachytí `localStorage.setItem("auth*"|"token*"|"user*"|"session*"|"access_key*")`. CI lint step fail. | lint (CI) | `@security:no-token-storage` | OWASP A02 |
| `source-map-not-deployed` | DevTools — `/main.js.map` returns 404 v prod build. | E2E (prod build) | `@security:no-source-map-prod` | OWASP A05 |
| `server-header-strip` | curl response headers — žiadny `Server:` s verziou, žiadny `X-Powered-By:`. | manual / smoke | `@security:server-header` | OWASP A05 |
| `rate-limit-login` | 100 login attempts in 1 min → 429 + audit + CAPTCHA escalation. | BFF integration | `@security:rate-limit-login` | OWASP A04, A07 |
| `anti-enumeration-login` | Rapid `/auth/login` s rôznymi usernames → constant response time (no `user not found` text leak). | BFF integration | `@security:anti-enumeration` | OWASP A07 |
| `replay-oidc-code` | Replay OIDC code → IdP 400 `invalid_grant`. | BFF integration | `@security:oidc-replay` | OWASP A07 |
| `ssrf-private-ip` | POST `/api/some-endpoint { url: "http://169.254.169.254/..." }` → 400 invalid_url. Redirect chain to private IP → blocked. | BFF integration | `@security:ssrf-private-ip` | OWASP A10 |
| `prototype-pollution` | Forge `__proto__` pollution payload v JSON body → BFF parser safe (Zod schema). | BFF integration | `@security:proto-pollution` | OWASP A08, threat-model §6 |
| `dependency-scan-clean` | CI `pnpm audit --audit-level=high` — žiadne High/Critical CVE bez waiver. | CI step | `@security:dep-scan` | OWASP A06 |

### 4.6 Audit log emission (cross-cutting)

| Vector ID | Scenár | Test typ | Tag | Zdroj |
|---|---|---|---|---|
| `audit-log-mutation` | Každý mutation endpoint (POST/PUT/PATCH/DELETE) emituje structured audit event s `correlationId`, `actor.userId`, `action`, `resource`, `tenantId`, `ip`, `ua`, `result`. | BFF integration | `@security:audit-log-mutation` | audit-and-compliance §2, owasp A09 |
| `audit-log-403` | Každý 403 z BFF (forbidden tenant, forbidden resource, RBAC denial) emituje audit event. | BFF integration | `@security:audit-log-403` | owasp A09 |
| `audit-log-redaction` | Audit log riadky neobsahujú `password`, `accessKey`, `refreshToken`, `token`, full credit card / IBAN — pre-emit hook redaction. | BFF integration | `@security:audit-log-redaction` | owasp A09 |
| `audit-log-cross-tenant` | SP cross-tenant read / write emituje audit s `cross_tenant=true, source_tenant, target_tenant, actor`. | BFF integration | `@security:audit-log-cross-tenant` | multi-tenancy-security §5 |
| `audit-log-tenant-switch` | `POST /me/active-tenant` emituje audit event s `event=tenant_switch, fromTenant, toTenant`. | BFF integration | `@security:audit-log-tenant-switch` | architecture A-020 |
| `audit-log-correlation-id` | `X-Correlation-Id` header generated per request, propagated to CA SDM upstream + included v error responses. | BFF integration | `@security:audit-log-correlation` | owasp A09 |

## 5. Definícia "passed" pre jeden journey

Journey je **passed** ak:

1. Happy path E2E zelený.
2. **Všetky** alternate flow z `journeys.md` pre tento journey majú aspoň
   jeden test (E2E alebo integration podľa stĺpca "Primárny test typ").
3. Cross-cutting kritériá (§3) ktoré pre tento journey platia, sú zelené
   (napr. tenant izolácia pre #4).
4. Security test vectors (§4) cross-ref-nuté v journey row sú zelené.
5. Acceptance criteria checkbox-y z §2 sú odškrtnuté v PR review.

## Otvorené závislosti

- `[01-api-analyst]` Acceptance pre GAP-1 (dynamic form schema) — riadky #2,
  #13, #14 (Service Catalog, KB editor) majú placeholder DoD pre dynamické polia.
  Po post-conv pre 01 sa doplnia konkrétne field-validation testy.
- `[01-api-analyst]` Acceptance pre GAP-2, GAP-3, GAP-4 — riadky #7, #12, #15
  majú alternate DoD podmienené finálnym rozhodnutím. Default v MVP:
  cross-tenant deny, KB analytics hidden.
- `[05-security]` emergency 2FA challenge type → **default TOTP**
  (`[business-deferred]`) — biznis rozhodnutie pre konkrétny IdP-side AMR;
  E2E mock-ne TOTP challenge. Vector `step-up-totp` testuje default; ak sa
  zmení na push / SMS, mock sa adjustuje.
- `[07-design-system]` Klávesové skratky (`j/k/r/c/t/e`) pre workspace —
  `[resolved-in-round-2]`. 07 r2 publikoval globálny keymap v `?` overlay
  s `aria-keyshortcuts` atribútom; E2E testy referencujú konštanty z
  `@sdm/design-system/keymap.ts`.
- `[04-architecture]` Tenant context mechanizmus — `[resolved-in-round-2]`.
  `X-Tenant` header per ADR-11; cross-cutting C3 (contract test šablóna)
  testuje jeden mechanizmus, nie fallback chain.
- `[02-ux-persona-analyst]` GAP-3 cross-tenant viewer rola — pretrváva. Ak CA
  SDM takúto rolu nemá, journey #12 (`workspace-change-cross-tenant-conflict`)
  bude v MVP markovaný `@skip:gap-3` a presunutý do v1 backlog. Default v MVP:
  hide.
- `[09-qa]` Security test vectors §4 sú **kompletný extrakt** z 05 r1
  artefaktov. Po post-conv 05 (ak doplní ďalšie vectors) sa doplnia tu.
  Self-flag pre konsolidáciu cez `tools/security-test-coverage.ts` (audit
  matrix po implementačnej fáze).
