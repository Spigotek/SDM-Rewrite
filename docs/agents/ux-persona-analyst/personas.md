# Persony — SDM-Rewrite

> Šesť person, ktoré pokrývajú obe cieľové aplikácie (`portal`, `workspace`).
> Persony sú zostavené z modulových popisov CA SDM 17.4 (Incident, Request,
> Problem, Change, Knowledge, CMDB) a kalibrované na typickú on-prem prevádzku
> stredne veľkého enterprise IT (cca 1 500–5 000 zamestnancov, 30–80 členný
> service desk, multi-tenant — HQ + dcérske spoločnosti).
>
> Každá persona má reálne meno, profil, prostredie, ciele, frustrácie,
> tri scenáre a pridelenú aplikáciu. Cieľom je, aby Architecture / Design
> System / Stack agenti mali konkrétny obraz koho navrhujú UI pre.

---

## requester_lucia — Žiadateľka (interná zamestnankyňa)

**Aplikácia:** `portal`
**Rola v CA SDM:** End User (`employee`)
**Tenant:** primárny (HQ); občas potrebuje preskočiť do tenantu dcérky pri
projektovej spolupráci.

### Profil

Lucia má 34 rokov, pracuje v marketingu centrály ako Brand Manager. Pracuje na
firmenom MacBooku, denne má 6–8 stretnutí, často z mobilu. Technicky priemerná —
pozná Excel, Outlook, Slack, Adobe Creative Cloud. IT nástroje nepoznala
hlbšie — pre ňu je „IT support" tlačidlo, ktoré niečo opraví.

Ticket otvára 2–4× mesačne: typicky pomalý notebook, prístup do systému, žiadosť
o softvér, výmena kabeláže pri presťahovaní stola.

### Prostredie

- Open-space kancelária + home office.
- Hlavný kanál: webový portál (firemný intranet → SSO redirect).
- Sekundárny kanál: Slack channel `#it-help` (kde hľadá ticket-link na zdieľanie
  s kolegom).
- Mobilný prístup: 30 % požiadaviek otvára z telefónu, dopisuje status
  z notebooku.

### Ciele

- Otvoriť ticket za **menej než 60 sekúnd** bez čítania manuálov.
- Vidieť **transparentný status** ticketu bez nutnosti telefonovať na helpdesk.
- Nájsť **odpoveď v KB skôr** než vytvorí ticket — nie z lojality, ale lebo je
  to rýchlejšie ako čakať na L1.
- Pri zmene tenantu (projekt s dcérkou) nestratiť kontext — vidieť, **ktorá
  organizácia jej teraz odpovedá**.

### Frustrácie

- „Service Catalog" v starom CA SDM mal 200+ položiek a žiadny rozumný search.
- Po odoslaní formuláru nevedela, či to vôbec niekto videl — žiadna potvrdzujúca
  obrazovka, žiadny e-mail, len redirect na zoznam.
- Pri uploadovaní screenshotu z chyby mu starý portál ukázal `error 500` a stratil
  vyplnenú správu.
- V Slacku jej kolega poslal ticket-link, ale po kliknutí dostala
  „insufficient permissions" — pretože ticket bol v inom tenante, do ktorého má
  rolu, ale nebol aktívny.

### Top scenáre (referencia do `journeys.md`)

1. **`portal-incident-broken-laptop`** — notebook sa náhodne reštartuje,
   potrebuje rýchlo nahlásiť a pokračovať v práci na náhradnom stroji.
2. **`portal-request-software`** — žiada licenciu Figma cez Service Catalog,
   manažér musí schváliť.
3. **`portal-kb-self-help`** — VPN nefunguje doma; chce nájsť KB článok skôr
   než otvorí ticket.

### UX dôsledky pre návrh

- Domov musí byť **„kde mi to bolí"-orientovaná** — nie zoznam funkcií.
- Submit ticketu = jediná vec na obrazovke, žiadne sidebary plné metrík.
- Tenant switcher musí zobraziť **organizačný kontext, nie technické ID** —
  napr. „Acme HQ" / „Acme East s.r.o.", nie `tenant_42`.

---

## agent_l1_anna — Service Desk Analyst (L1)

**Aplikácia:** `workspace`
**Rola v CA SDM:** Analyst (Level 1) — patrí do skupiny `Service Desk L1`
**Tenant:** všetky tri aktívne tenanty firmy; defaultne sa loguje do HQ a počas
zmeny prepína podľa rotácie.

### Profil

Anna má 27 rokov, druhý rok v service desku. Pracuje v 8h zmenách, na svojej
zmene si „načerpá" 25–60 tiketov. Technicky zdatná — pozná Active Directory,
základy siete, vie písať PowerShell skripty. Hot-keys používa ak ich pozná,
ale nemá čas si ich zapamätávať z dokumentácie.

Ráno otvorí workspace, nasaje tiketov z queue, zatvára ich tempom 1 každých
6–10 minút. Pri komplexnejšom probléme eskaluje na L2.

### Prostredie

- Dva monitory: ľavý queue + ticket detail, pravý KB + remote session.
- Slúchadlá s mikrofónom — telefón cez softfón v inej tabe.
- Headset v jednej ruke, klávesnica druhou — UI musí byť **klávesnicovo prvotriedne**.
- Veľmi často kopíruje texty z chatu zákazníka do polí ticketu — clipboard
  flow musí byť bezbolestný.

### Ciele

- Vyriešiť čo najviac tiketov za zmenu (KPI: First Contact Resolution > 60 %).
- Nestrácať kontext pri prepínaní medzi tiketmi (pamäť hlavy je drahá).
- Mať **na klik vidieť** súvisiace KB články, predošlé tickety toho istého
  žiadateľa, jeho CI (notebook, model, lokácia).
- Bulk operations (v1): označiť 10 spamových ticketov, zatvoriť všetky.

### Frustrácie

- Starý CA SDM web bol pomalý — každý refresh queue trval 4–6 sekúnd.
- Pri otvorení ticketu sa stratil scroll v queue — vrátenie sa znamenalo
  hľadať ho znova.
- KB hľadanie bola samostatná stránka, kopírovala odkaz späť do ticketu ručne.
- Tenant context v starom UI bola len malá ikonka v rohu — niekoľkokrát
  napísala odpoveď zákazníkovi z nesprávneho tenantu (compliance incident).

### Top scenáre

1. **`workspace-incident-triage`** — ráno nasaje 12 nových ticketov, klasifikuje
   prioritu, prideľuje, niekoľko zatvára cez KB.
2. **`workspace-incident-resolve-with-cmdb`** — ticket „Outlook nefunguje";
   rýchlo identifikuje CI (laptop žiadateľa), uvidí že má posledný Windows
   update z dnes rána a v KB existuje známy problém.
3. **`workspace-incident-escalate-to-l2`** — sieťový problém, ktorý nedokáže
   vyriešiť; eskaluje s plným kontextom (nie znova vyplniť polia).

### UX dôsledky pre návrh

- Queue = **gridová**, dense, riadky 28–32 px, kontextové menu na pravý klik.
- Detail v split view (queue ostane vľavo) — zachováva scroll, mental model.
- Right panel s CI / requester / history — **vždy viditeľný**, nie modálny.
- Tenant indicator v hornej lište **veľký a farebný** (visual fail-safe proti
  cross-tenant odpovedi).
- Klávesové skratky: `j/k` next/prev v queue, `r` reply, `c` close, `e` escalate.

---

## agent_l2_marek — Specialist (L2 / Network & Infrastructure)

**Aplikácia:** `workspace`
**Rola v CA SDM:** Analyst (Level 2) + `Problem Manager` (read+write na Problem)
**Tenant:** tri tenanty; primárne HQ, ale dcérky často eskalujú zložité prípady.

### Profil

Marek má 41 rokov, 12 rokov v IT, 4 roky v tejto firme ako Network Specialist.
Pracuje v reaktívnom móde (eskalácie) aj proaktívnom (Problem Management,
known errors, trending). Dáva si záležať na dokumentácii — vie, že KB článok,
ktorý napíše dnes, ušetrí L1 stovky hodín za rok.

Otvára 5–15 ticketov denne, ale na každom strávi 30–120 minút. Pre neho je UI
„nástroj na precíznu prácu" — performance je dôležitá, ale dôležitejšia je
**hĺbka informácií**.

### Prostredie

- Tri monitory: ticket + CMDB visualizer + terminál (SSH na switche, routery).
- Často potrebuje vidieť **viacero CI naraz** s ich vzťahmi (impact analysis).
- Pracuje s časovými oknami — niektoré veci robí len v noci (change windows).

### Ciele

- Nájsť **root cause**, nie len obísť symptóm.
- **Linkovať** Incident → Problem → Change tak, aby budúci L1 vedel okamžite
  čo je „už riešené".
- Vyrobiť KB článok (alebo Known Error) z každého netriviálneho problému.
- Vidieť **CI relationships** vizuálne — ktoré servery, switche, services
  závisia na sebe.

### Frustrácie

- Starý CA SDM Visualizer (str. 167 PDF) bol Java applet — nefungoval na
  modernom prehliadači.
- Linkovanie Incident → Problem bol 4-step modal, neintuitívny — pol kolegov
  to nerobilo.
- CMDB read-only stránka mu ukázala 80 atribútov v plochom zozname — bez
  schopnosti zoskupiť alebo skryť nepoužívané.

### Top scenáre

1. **`workspace-problem-rca`** — opakujúci sa pomalý e-mail v dcérke, vyrobí
   Problem record, urobí RCA, pripojí 12 incidentov.
2. **`workspace-cmdb-impact-analysis`** — potrebuje vyradiť server z prevádzky;
   chce vidieť všetko, čo na ňom závisí, predtým než to oznámi biznisu.
3. **`workspace-incident-deep-dive`** — eskalovaný ticket od Anny (L1), rieši
   problém s VPN cez certifikát, dokumentuje riešenie do KB.

### UX dôsledky pre návrh

- CMDB CI detail = **vizuálny graph** (nie tabulátor 80 atribútov).
- Linkovanie Incident ↔ Problem ↔ Change musí byť **inline** v ticket detaile
  (nie modal-modal-modal).
- KB editor musí byť dostupný ako **„draft from this ticket"** akcia — predvyplniť
  problém + riešenie z ticket polí.

---

## change_manager_peter — Change Manager / CAB Chair

**Aplikácia:** `workspace`
**Rola v CA SDM:** Change Manager + CAB Member
**Tenant:** HQ; občas vstupuje do dcérok pre cross-tenant change schválenie.

### Profil

Peter má 48 rokov, IT manager, vedie weekly CAB (Change Advisory Board).
Pre neho je UI primárne **rozhodovací nástroj** — koľko changes čaká na review,
ktoré majú konflikt v okne, kto je za schválenie zodpovedný.

Týždenne robí 30–50 schválení, mesačne 1–2 emergency changes (CAB-emergency).
Pred CAB meetingom potrebuje za 15 minút prejsť 20 zmien a označiť, čo sa bude
diskutovať.

### Prostredie

- Veľký monitor + notebook na CAB stretnutí.
- Často premieta workspace na projektor — UI musí byť **čitateľné aj zo 6 metrov**.
- Email a kalendár rovnako kritické — chce vidieť change calendar v kontexte
  business udalostí.

### Ciele

- Vidieť **change calendar** ako týždenný/mesačný heatmap — kde sú konflikty,
  freeze periódy, blackouts.
- Schváliť/odmietnuť change s **plným kontextom** (impact, rollback plán,
  approvals od ostatných CAB members).
- Pre emergency changes mať **rýchly approve flow** — 2 kliky, nie 8.
- Reporting: koľko changes mesačne, success rate, zmeškané CAB-y.

### Frustrácie

- Starý CA SDM Change Calendar bol HTML tabuľka mesiacov bez drag-zoom.
- Pri schvaľovaní musel kliknúť 5× pre návrat do CAB queue — stratil pozíciu
  v zozname.
- Nemal vidieť **kto všetko ešte nepristúpil ku schvaľovaniu** — len agregátne
  „2 of 4 approved".

### Top scenáre

1. **`workspace-change-cab-prep`** — pondelok 8:00, pripravuje agenda na CAB
   meeting; prejde 25 changes, označí 5 na hlbšiu diskusiu.
2. **`workspace-change-emergency-approve`** — security patch, treba schváliť do
   2 hodín; chce overiť rollback plán a okno, schváliť mobilom.
3. **`workspace-change-cross-tenant-conflict`** — change v dcérke koliduje s HQ
   maintenance windowom; potrebuje vidieť obe v jednom kalendári.

### UX dôsledky pre návrh

- Change calendar = **interaktívny grid** (mesiac/týždeň/deň), color-coded
  podľa rizika, hover detail.
- Approval flow = **dedikovaná obrazovka** s checklistom (nie modálne okienko).
- Cross-tenant view = **multi-tenant overlay** v kalendári (povolený len rolám
  s rolou v oboch tenantoch).

---

## kb_editor_jana — Knowledge Engineer

**Aplikácia:** `workspace`
**Rola v CA SDM:** Knowledge Author / Approver
**Tenant:** HQ; KB články sú často publikované cez tenant boundaries
(spoločné riešenia).

### Profil

Jana má 36 rokov, technical writer s background v IT supporte (predtým 5 rokov
L2). Špeciálnu pozíciu má pol roka, jej úlohou je **zlepšovať First Contact
Resolution** cez kvalitnú KB.

Denne publikuje 1–3 nové články, edituje 5–8, archivuje 1–2 zastarané. Veľmi
sa zaujíma o **metriky** — koľkokrát článok pomohol, koľkokrát sa „dislikol",
search-miss queries.

### Prostredie

- Jeden veľký monitor (4K), prefer dark mode.
- Pracuje primárne s textom a obrázkami — UI musí byť **WYSIWYG-friendly**
  bez zbytočných panelov.
- Často kopíruje screenshoty z Snipping Tool / Snagit — drag-and-drop musí
  byť bezbolestný.

### Ciele

- Napísať článok za 15–25 minút (od draftu po publish).
- Vidieť, **ktoré články fungujú** a ktoré nie (analytics).
- Spravovať verzie a publikačný flow (draft → review → publish → archive).
- Nájsť **gap-y** — search dotazy bez výsledku → témy, ktoré chýbajú.

### Frustrácie

- Starý CA SDM KB editor bola ohavná legacy textareá s minimálnym formattingom.
- Vkladanie obrázkov vyžadovalo upload mimo článku, potom ručne `<img>` tag.
- Kategorizácia bola taxonomy strom 4 úrovne hlboký — autori s tým bojovali
  a tagovali nesprávne.
- Nevedela ľahko duplikovať existujúci článok ako šablónu (každý nový napísať
  od začiatku).

### Top scenáre

1. **`workspace-kb-author-new`** — píše článok „Reset hesla pre VPN klienta",
   draft → preview → request review → publish.
2. **`workspace-kb-from-incident`** — Marek (L2) jej zaslal vyriešený ticket;
   z neho vyrobí článok bez retypovania (predvyplnené z ticketu).
3. **`workspace-kb-analytics-review`** — týždenná retrospektíva: ktoré články
   majú nízky helpfulness score, kde sú search-miss queries.

### UX dôsledky pre návrh

- KB editor = WYSIWYG s markdown podporou, drag-drop obrázky.
- „Create from ticket" akcia v ticket detaile (predvyplní problem statement
  + resolution).
- Analytics dashboard ako súčasť KB modulu (nie samostatný BI tool).

---

## cmdb_owner_robert — CMDB Owner / Asset Manager

**Aplikácia:** `workspace`
**Rola v CA SDM:** CI Owner / Configuration Manager
**Tenant:** HQ + jedna dcérka (zdieľaná infraštruktúra).

### Profil

Robert má 52 rokov, 20+ rokov v IT operations, dnes vedie CMDB tím (3 ľudia).
Pre neho je CMDB **„zdroj pravdy"** — ak v ňom nie je presný stav, celý
ITIL framework padá.

Robí menej ticketov, viac **údržbu CI dát**: discovery imports, manual
reconciliations, vzťahy medzi CI, audity. Rád používa CSV export a CLI
pre bulk operácie.

### Prostredie

- Pracuje s veľkými datasetmi — niekedy 10k+ CIs naraz (ale GOAL.md hovorí
  „desiatky", takže workspace UI nemusí mať virtualizáciu — Robert robí bulk
  cez backend tooling, UI je len na detail prácu).
- Často exportuje do Excelu na audit reporty.

### Ciele

- Mať CI detail s **úplným prehľadom**: atribúty, vzťahy, history zmien,
  prepojené incidenty/problems/changes.
- Vidieť **impact analysis** vizuálne (ten istý visualizer čo Marek, ale
  z pohľadu „čo sa pokazí ak vypnem toto").
- V1 (mimo MVP): editovať CI atribúty inline.
- Multi-tenant: vidieť, ktoré CI sú **zdieľané** medzi tenantmi (master/replica).

### Frustrácie

- Starý CMDB editor neumožňoval undo — chyby v atribútoch sa rozšírili
  do downstream systémov.
- Vzťahy boli zobrazené ako plochá tabuľka — nemožno pochopiť topológiu.
- Reporting o CI changes (kto čo zmenil, kedy) bol cez DBA tím.

### Top scenáre

1. **`workspace-cmdb-ci-detail`** — kontroluje CI „srv-prod-db-01" pred
   plánovaným patch-om; chce vidieť všetky vzťahy, otvorené incidenty.
2. **`workspace-cmdb-relationship-impact`** — biznis chce vyradiť aplikáciu;
   Robert ukáže, na čom všetkom závisí (CI graph) a čo bude nezávislé.
3. **`workspace-cmdb-cross-tenant-shared`** — dcérka používa HQ-vlastnený
   storage; potrebuje vidieť tieto cross-tenant vzťahy a permission boundaries.

### UX dôsledky pre návrh

- CI detail = sticky header s key attrs, scrollable sections (attrs,
  relationships, history, related tickets).
- Relationship view = **interaktívny graph** s zoom + filter + expand/collapse.
- Cross-tenant CI vizuálne **odlíšené** (badge alebo border color) — okamžitý
  signál, že CI nie je „len naša".

---

## Persona-to-app overview

| Persona | App | Primárny modul | Sekundárny modul |
|---|---|---|---|
| `requester_lucia` | `portal` | Incident, Request | Knowledge |
| `agent_l1_anna` | `workspace` | Incident | Knowledge, CMDB (read) |
| `agent_l2_marek` | `workspace` | Incident, Problem | CMDB, Knowledge (write) |
| `change_manager_peter` | `workspace` | Change | CMDB (impact) |
| `kb_editor_jana` | `workspace` | Knowledge | Incident (source) |
| `cmdb_owner_robert` | `workspace` | CMDB | Change, Incident (impact) |

## Otvorené závislosti

- `[01-api-analyst]` Predpokladám, že CA SDM REST API (`/caisd-rest/...`)
  vystavuje endpoint pre **zoznam tenantov používateľa** — potrebné pre tenant
  switcher na všetkých obrazovkách. Ak takého endpointu niet (len cez SOAP / per-call
  context), prepíšeme tenant flow v `wireframes/shared/tenant-switcher.md`.
- `[01-api-analyst]` Persona `kb_editor_jana` predpokladá KB analytics
  (helpfulness score, search-miss queries) — potvrď, či CA SDM KB API tieto
  metriky vystavuje, alebo ich treba odvodiť BFF-om / je to v1+ feature.
- `[03-domain-modeller]` `agent_l2_marek` linkuje Incident → Problem → Change.
  Potvrď state machines týchto entít a možnosť **triple-link** (mám pocit,
  že v CA SDM je to dvojica + tag, nie graph).
- `[04-architecture]` Tenant switcher predpokladá, že tenant kontext žije
  **client-side state + per-request HTTP header** (nie route prefix). Ak
  Architecture zvolí route prefix (`/{tenant}/...`), upravíme wireframes
  shared/tenant-switcher (URL-aware variant).
- `[05-security]` `change_manager_peter` chce schvaľovať z mobilu — potvrď,
  či mobilný flow bude over the same SSO redirect alebo má vlastný endpoint
  (impacts portál mobile use case `requester_lucia` tiež).
- `[07-design-system]` Density requirement: `workspace` queue rows 28–32 px,
  `portal` form fields min-height 44 px (touch target). Potrebné v tokens.
- `[?]` Lokalizácia mien person — držíme slovenské mená alebo ich
  internationalizujeme (Lucia → Lucy / Anna → Anna)? Predpoklad: SK persony
  ostávajú tak, ako sú (interný dokument).
