# UX riziká a otvorené otázky — SDM-Rewrite

> Riziká identifikované počas mapovania person, journeys a wireframov.
> Každé riziko má adresáta (vlastníka pre mitigáciu) a navrhované zmiernenie.
> Tabuľka má stĺpce: kód, riziko, dopad, kde sa prejavuje, navrh mitigácie,
> vlastník.

## R-001 až R-020 — UX-domain riziká

| # | Riziko | Dopad | Kde | Mitigácia | Vlastník |
|---|---|---|---|---|---|
| R-001 | **Dynamic Service Catalog formuláre** — CA SDM Request Item template má potenciálne 3–15 polí rôzneho typu; bez detailu schémy nedokážeme navrhnúť form rendering komponent | High — blokuje wireframe `portal/03-service-catalog.md` od finalizácie a celý `portal-request-software` journey | Portal Service Catalog form, Request module ako celok | Eskalovať API analystovi (priorita); v paralel pripraviť **field type catalog** (text, number, date, select, multi-select, file, user-picker, ci-picker) ako tech-agnostický kontrakt | `01-api-analyst` |
| R-002 | **Cross-tenant linkovanie ticketov** (Incident → Problem v inom tenante) — bez znalosti, či to CA SDM dovoľuje, sú journeys `workspace-problem-rca` a `workspace-change-cross-tenant-conflict` riskantné | Medium — postihuje L2 personu Mareka a Change Manager Petra; v MVP možný downgrade na single-tenant scope, v1 obnova | 3 journeys, 2 wireframy | Pri MVP defaultne **disabled cross-tenant linking** s tooltipom „Vyžaduje osobitné oprávnenie"; mapovať API limit a zvýrazniť pre v1 | `01-api-analyst`, `05-security` |
| R-003 | **Cross-tenant viewer rola** — predpoklad „global compliance officer" / „global change manager" — neoverené | Medium — Peter cross-tenant change calendar nefunguje bez tejto roly | `workspace/03-change-calendar.md`, journey `workspace-change-cross-tenant-conflict` | Buď CA SDM má túto rolu, alebo BFF zhromaždí výstupy z viacerých tenant scope-ov pre špecifickú rolu (compliance) | `01-api-analyst`, `05-security` |
| R-004 | **KB analytics endpoints** — helpfulness ratings, search miss queries, view counts — vystavuje CA SDM REST? | Medium — persona Jana scenár 3 (analytics review) je dôležitý pre KB životný cyklus | `wireframes/workspace/04-kb-editor.md` analytics teaser, journey `workspace-kb-analytics-review` | Ak CA SDM nemá: BFF vlastný telemetry store (POST z portál + workspace), výhoda — kontrola dát; nevýhoda — duplicate truth | `01-api-analyst`, `04-architecture` |
| R-005 | **Shared CI ownership cross-tenant** — `cmdb_owner_robert` scenár 3 (storage zdieľaný HQ + East) | Low-Medium — pri MVP CMDB read-only sa to neprejaví; v1 CMDB editor potrebuje toto vyriešiť | `wireframes/workspace/05-cmdb-ci-detail.md` cross-tenant variant | CA SDM owner field je single-valued; potrebné rozšírenie schémy alebo BFF override; potvrdiť | `01-api-analyst`, `03-domain-modeller` |
| R-006 | **Tenant prepnutie pri otvorenom formulári / ticket detaile** — confirm dialog pridáva friction, no-confirm môže spôsobiť stratu dát | Medium — UX kvalita, denne zažívajú všetky persony s viacerými tenantmi | `wireframes/shared/tenant-switcher.md` | Confirm dialog **iba pri „dirty" state** (nezapísaný komentár / formulár); v iných prípadoch silent switch s toast | `04-architecture`, `07-design-system` |
| R-007 | **Tenant context strata** pri SSO session expiry — po re-login môže byť aktívny tenant resetovaný na default | Low — drobné friction, ale frustrujúce pri mid-task expiry | Globálne, najmä `workspace` (long-running session) | Tenant context persistovat do **server-side session** (nielen cookie), obnoviť po SSO refresh | `04-architecture`, `05-security` |
| R-008 | **Hot-keys konflikt** — `j/k/r/c/e/t` v `workspace` môže kolizovať s prehliadačom alebo screen-readerom | Medium — ovplyvňuje produktivitu agentov L1/L2 | Workspace queue + ticket detail | Definovať skratky v Design System (globálna mapa); poskytnúť overlay `?` s referenciou; testovať s VoiceOver/NVDA | `07-design-system`, `09-qa-test-strategy` |
| R-009 | **Mobile emergency change approve** — Peter scenár; vyžaduje step-up auth (2FA), ktorá je sieťovo závislá | Medium — kritický business flow | `wireframes/workspace/03-change-calendar.md` mobile variant | 2FA fallback pre offline scenarios (pre-generated time-based codes); UX musí komunikovať prečo 2FA | `05-security` |
| R-010 | **WYSIWYG editor pre KB** — výber knižnice ovplyvňuje UX podstatne (TipTap vs. ProseMirror vs. Lexical má rôzne limity) | Medium — KB editor je v1, ale early decision je lepší | `wireframes/workspace/04-kb-editor.md` | Tech Stack agent zvolí; Design System pripraví wrapper, aby výmena bola možná | `06-tech-stack-selector`, `07-design-system` |
| R-011 | **CMDB graph viewer** — pri 200+ nodes performance a UX clutter | Medium — Marek/Robert kritický flow pre impact analysis | `wireframes/workspace/05-cmdb-ci-detail.md` Relationships tab | Auto-cluster + filter „depends on me" + virtualization v graph layout (Cytoscape canvas mode) | `06-tech-stack-selector` |
| R-012 | **Real-time updates** — má CA SDM webhooks / SSE? Inak polling = každých 30 s a stale data riziko | Medium — najmä `workspace` ticket detail (Anna pracuje s tým, čo Marek práve zmenil) | Workspace ticket detail, queue refresh | Polling 30 s s optimistic locking + ETag conflict warning; v1 evaluate webhooks | `01-api-analyst`, `04-architecture` |
| R-013 | **i18n pre persona names** — držíme slovenské mená alebo `en` deploy ich ukáže nesprávne | Low — interné dokumenty, externe sa neprejaví | Persony, journeys | Persony sú interný dev artefakt — nemenné. UI labels samostatne i18n. | `[?]` |
| R-014 | **Resolution code list** — agenti pri close ticketu vyberajú z dropdown; veľký zoznam je UX antipattern | Low-Medium — ovplyvňuje rýchlosť uzatvárania (KPI agent L1) | `wireframes/workspace/02-ticket-detail.md` close modal | UX: hierarchický dropdown (kategória → kód) alebo type-ahead search; potrebujem zoznam | `03-domain-modeller`, `01-api-analyst` |
| R-015 | **Notifikačný kanál konzistencia** — UI na portáli ukazuje „Anna pridala komentár", e-mail prichádza, Slack notifikácia (ak integrovaná). Trojnásobná notifikácia z toho istého eventu je UX cruft | Low | Portál ticket detail, notifikácie globálne | Notification preferences per persona (UI toggle); BFF deduplikuje; badge counter sync | `04-architecture` |
| R-016 | **Performance portál mobile** — TTI < 2 s na typickej linke, ale formulár môže obsahovať dynamic schema z BFF (wait čas) | Medium | `wireframes/portal/03-service-catalog.md` form load | Pre-fetch top 10 catalog items + form schemas pri page idle; loading skeleton | `04-architecture`, `06-tech-stack-selector`, `08-devex-devops` |
| R-017 | **Search miss vs. permissions** — používateľ hľadá KB článok, ktorý existuje, ale nie je voľný v jeho tenante / role; UI musí ukázať „Nič som nenašiel", nie „403 forbidden" | Low | `wireframes/portal/05-kb-search.md` | Backend filter pred search response; UI nikdy neukáže existenciu skrytých článkov | `05-security`, `01-api-analyst` |
| R-018 | **Bulk actions v queue** — `workspace` v MVP nemá bulk; ale L1 agenti to očakávajú (Anna). Frustrácia od day-1 | Medium | `wireframes/workspace/01-queue.md` | Skoré v1 alebo MVP-stretch: bulk Take, bulk Close. Communicate v release notes | `[?]` (Product Owner equiv) |
| R-019 | **Service Catalog approval delay** — Lucia žiada Figma, manažér má 5 dní dovolenku; UI musí ukázať „Schvaľuje X, OOO until Y" | Low-Medium | `wireframes/portal/04-ticket-detail.md` Pending Approval state | OOO indikátor v approver field + auto-escalation policy (per tenant) | `01-api-analyst`, `03-domain-modeller` |
| R-020 | **Resolution / closure confirmation** — v portáli žiadateľ konfirmuje uzavretie. Ak nereaguje 7 dní, ticket sa auto-close. Komunikácia této politiky v UI | Low | `wireframes/portal/04-ticket-detail.md` Resolved state | Inline text v Resolved card: „Ak nereaguješ do 7 dní, zatvoríme ticket automaticky." | `03-domain-modeller` |

## R-100 série — Tech-stack a a11y prierezové

| # | Riziko | Dopad | Mitigácia | Vlastník |
|---|---|---|---|---|
| R-101 | **WCAG 2.1 AA** je cieľ (GOAL §5) — workspace má vysokú density, obtiažne k contrast / focus indicators | Medium-High | Design tokens s explicitným contrast-checked pair (AA pre body, AAA pre primary actions); audit pred MVP | `07-design-system`, `09-qa-test-strategy` |
| R-102 | **i18n SK + EN** — niektoré CA SDM hodnoty (status labels, category names) sú per-tenant konfigurovateľné v EN; potrebujeme i18n keys vs. dynamic values stratégiu | Medium | i18n knižnica musí podporovať ICU MessageFormat + fallback na backend-provided label; vystavená v BFF | `04-architecture`, `06-tech-stack-selector` |
| R-103 | **Dark mode** — `kb_editor_jana` preferuje dark mode (písanie); `requester_lucia` typicky neexpektuje. Implications pre theming arch | Low-Medium | Design tokens light + dark + auto (system preference); per-app default (portal=light, workspace=auto) | `07-design-system` |
| R-104 | **Print stylesheet** — Peter premieta CAB agenda; PDF export je primárny, ale print fallback je vhodný | Low | `@media print` rules v Design System base | `07-design-system` |
| R-105 | **Touch targets na mobile** — formy v portáli, mobile approve flow Petra; current low-fi má radio buttons / switches v desktop dimenzii | Medium | Min 44 × 44 px touch targets na mobile (WCAG); responsive breakpoint < 768 px má adapted spacing | `07-design-system` |

## R-200 série — Process / handoff riziká

| # | Riziko | Dopad | Mitigácia | Vlastník |
|---|---|---|---|---|
| R-201 | **Agent pipeline race** — UX a API analyst bežia paralelne; UX wireframy závisia na API kontraktoch (R-001, R-004); Round 1 niesú lockstep | Medium | UX flagy v `Otvorené závislosti` pre API analyst; refinement loop v Round 2 zladí | `00-project-manager` |
| R-202 | **Domain Modeller závisí na API analystovi** — UX domain assumptions (state machines, permissions) si UX vymýšľa; Domain Modeller ich validuje | Low | Otvorené flagy v personas/journeys → reviewuje 03 v Phase B | `03-domain-modeller` |
| R-203 | **Design System tokens late** — UX sa rozhoduje pre density (28-32 px riadky) bez tokens; Design System ich musí akceptovať alebo počítať s overload | Low-Medium | UX defines requirements (density, color semantics); Design System dodáva tokens v Phase B | `07-design-system` |

## Otvorené závislosti

- `[01-api-analyst]` Konsolidované GAP listy z journeys + wireframes (GAP-1
  až GAP-5) — naviac zopakované v risks pre prehľadnosť (R-001, R-002, R-003,
  R-004, R-005). Odpovedaj v `gaps.md` API analystu — UX iteration v round 2
  ich uzavrie.
- `[03-domain-modeller]` State machines pre Incident, Request, Problem,
  Change, KB — UX assumptions sú v risks; potvrdiť alebo opraviť.
- `[04-architecture]` Tenant prenášania stratégia (header / cookie /
  route prefix) — má dopad na tenant switcher implementáciu (R-006, R-007).
- `[05-security]` Permission gating (R-017), step-up auth (R-009), tenant
  loss handling (R-007).
- `[06-tech-stack-selector]` Tabuľková knižnica (R-018), graph knižnica
  (R-011), WYSIWYG editor (R-010).
- `[07-design-system]` Tokens pre density, contrast, hot-key overlay
  (R-008, R-101–R-105).
- `[?]` Bulk actions priority — MVP-stretch alebo v1 (R-018) — vyžaduje
  product owner rozhodnutie.
- `[?]` i18n stratégia pre dynamic backend values (R-102).
