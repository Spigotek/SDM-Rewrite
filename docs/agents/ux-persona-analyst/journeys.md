# User journeys — SDM-Rewrite

> 18 user journey scenárov (6 person × 3). Každý journey má **happy path**
> + **alternate / edge flow** s chybovými stavmi a UX zmierňujúcimi reakciami.
>
> Notácia: `mermaid journey` pre lineárne flowy, swimlane (mermaid `sequenceDiagram`)
> pre cross-actor scenáre. Kde CA SDM 17.4 nepodporuje predpokladanú feature,
> je to označené `[GAP]` a vrátené ako otvorená závislosť dole.

---

## requester_lucia

### `portal-incident-broken-laptop`

**Kontext:** Lucia je v stredu ráno doma na home office. Po reštarte sa MacBook
správa divno — niekedy black screen, niekedy „kernel panic". Potrebuje to nahlásiť
a do popoludnia mať náhradný stroj.

**Happy path:**

```mermaid
journey
    title Lucia — broken laptop incident
    section Otvorenie
      Otvor portal.acme    : 5: Lucia
      SSO redirect + login : 4: Lucia
      Vidí domov           : 5: Lucia
    section Submit
      Klik "Nahlásiť problém": 5: Lucia
      Vyber "Hardvér"      : 4: Lucia
      Vyplní popis + screenshot pridá: 4: Lucia
      Odošle              : 5: Lucia
    section Po odoslaní
      Vidí ticket #INC-1042: 5: Lucia
      Email potvrdenie     : 5: Lucia
      Status "New"         : 4: Lucia
    section Update
      Pop-up: "Anna pridala komentár": 5: Lucia
      Vidí "Donesieme náhradný do 14:00": 5: Lucia
```

**Alternate (edge):**

- Lucia nahrá 80 MB video — backend odmietne s `413 Payload Too Large`. UI musí
  ukázať **inline error** s návrhom: „Maximum 25 MB. Skús screenshot alebo
  krátky GIF." Žiadny stratený formulár.
- SSO session vypršala uprostred submitu — UI musí zachovať draft v
  `localStorage`, redirect na login, po návrate **obnoviť vyplnený formulár**.
- Tenant context: Lucia má rolu v dvoch tenantoch („Acme HQ" a „Acme East").
  Default je HQ. Ak by si neuvedomila, že to nahlasuje do správneho tenantu,
  formulár musí mať **viditeľný breadcrumb** „Tenant: Acme HQ".

---

### `portal-request-software`

**Kontext:** Lucia potrebuje Figma Pro licenciu na nový brand projekt.
Manažér Tomáš musí schváliť (cost > 0).

**Happy path (swimlane):**

```mermaid
sequenceDiagram
    participant L as Lucia (portál)
    participant SC as Service Catalog
    participant API as CA SDM REST
    participant T as Tomáš (manažér)
    participant A as Anna (L1)

    L->>SC: hľadá "figma"
    SC-->>L: 1 výsledok: "Figma Professional License"
    L->>SC: klik, vyplní "projekt: Brand 2026", "trvanie: 12 mesiacov"
    L->>API: submit Request #REQ-308
    API-->>L: 201, status "Pending Approval"
    API->>T: notify (email + portal banner)
    T->>API: approve
    API->>A: assign to L1 (fulfillment)
    A->>API: provision license
    API-->>L: status "Fulfilled" + license key v komentári
```

**Alternate:**

- Tomáš odmietne s dôvodom „použij Adobe XD, je v balíčku". Lucia dostane
  **rejection notification** s textom dôvodu — UI musí dôvod zobraziť **prominentne**
  v ticket detaile, nie zahrabaný v komentároch.
- Service Catalog formulár pre Figma má **dynamické polia** podľa typu licencie
  (single user vs. team). Polia sa generujú z CA SDM Request Item template
  `[GAP-1]` — UX musí byť pripravené, že počet polí je 3–15.

---

### `portal-kb-self-help`

**Kontext:** Lucia nemôže pripojiť VPN klienta z home office, predtým než otvorí
ticket chce overiť, či to nie je niečo banálne.

**Happy path:**

```mermaid
journey
    title Lucia — VPN nefunguje, hľadá v KB
    section Hľadanie
      Otvor portal       : 4: Lucia
      Klik "Pomocník"    : 5: Lucia
      Search "VPN nefunguje doma": 4: Lucia
      Top výsledok: "Reset VPN klienta": 5: Lucia
    section Riešenie
      Číta kroky 1-5     : 5: Lucia
      Po kroku 4 funguje : 5: Lucia
      Klik "Bolo to užitočné": 5: Lucia
    section Bez ticketu
      Nezakladá ticket   : 5: Lucia
```

**Alternate:**

- Search „VPN home office" má 0 výsledkov. Portál musí ponúknuť **„Nenašiel
  som odpoveď — chceš otvoriť ticket?"** akciu, ktorá pred-vyplní formulár
  z hľadaného dotazu (kategória: Connectivity, popis: „VPN home office").
- Článok existuje, ale je v EN; Lucia má SK profil. Ak je dostupný len EN,
  **nezobrazujeme stub „Translation pending"** — zobrazíme EN obsah s malým
  badge „Iba v angličtine", lebo to je užitočnejšie ako prázdne.

---

## agent_l1_anna

### `workspace-incident-triage`

**Kontext:** Pondelok 8:15, Anna otvára workspace. Cez víkend prišlo 12 nových
ticketov, treba klasifikovať a prideliť (alebo vyriešiť cez KB).

**Happy path:**

```mermaid
sequenceDiagram
    participant Anna
    participant W as Workspace UI
    participant API as CA SDM REST

    Anna->>W: otvor workspace, default queue "My team — New"
    W-->>Anna: 12 ticketov, sort by priority desc
    Anna->>W: filter "Hardware" — 4 ticketov
    Anna->>W: klik prvý — split view, ticket vpravo
    Anna->>W: skim popis + KB suggestion v right panel
    Anna->>W: stlačí "r" (reply), vloží KB link, "c" (close + KB)
    W->>API: PATCH ticket status=resolved, resolution=KB-link
    API-->>W: 200
    W-->>Anna: ticket fade-out, scroll v queue zachovaný
    Anna->>W: stlačí "j" (next), pokračuje
```

**Alternate:**

- Anna omylom prepne tenant (klikne na switcher, vyberie „Acme East"). UI
  musí **pri zmene tenantu uzavrieť otvorený ticket detail** (lebo patrí
  k inému tenantu) a ukázať toast „Prepol si do Acme East — queue prenahraná".
  Bez toho Anna napíše odpoveď do nesprávneho tenantu.
- Ticket je **assigned na iného agenta** (Anna ho otvorí omylom). UI musí
  ukázať badge „Assigned to: Marek" a **zablokovať reply button** s tooltipom
  „Najprv prevezmi ticket na seba (Take)". Anna stlačí `t` (take), reply sa
  odomkne.
- Queue sort sa stratí pri refresh — UI musí **persistovať queue preferences**
  (sort, filter, columns) do localStorage per persona.

---

### `workspace-incident-resolve-with-cmdb`

**Kontext:** Ticket „Outlook nefunguje od rána" — Anna potrebuje overiť, či to
nie je následok nedávneho Windows updatu.

**Happy path:**

```mermaid
journey
    title Anna — Outlook nefunguje, využíva CMDB
    section Otvorenie ticketu
      Klik ticket #INC-2104: 5: Anna
      Right panel: Lucia (žiadateľ): 5: Anna
      CI: laptop "L-1042" : 5: Anna
    section Diagnostika
      Klik na CI         : 5: Anna
      Vidí: posledný patch dnes 03:00: 5: Anna
      Vidí: 8 ďalších incidentov rovnaký patch: 5: Anna
    section Akcia
      Linkuje na Problem #PRB-44: 5: Anna
      Reply z KB článku "Workaround Outlook patch": 5: Anna
      Close as workaround: 4: Anna
```

**Alternate:**

- CI nie je v CMDB priradené (žiadateľ má laptop, ktorý discovery nezachytil).
  UI v right paneli ukáže „CI: Nepriradené" s odkazom „Prideliť CI" (ide
  do CMDB modulu — ale Anna nemá write právo, len read). Tlačidlo musí byť
  **disabled s tooltipom** „Nemáš oprávnenie editovať CMDB" (RBAC).
- Linkovanie na Problem je open-text dropdown — Anna napíše „Outlook patch"
  a UI musí ukázať **fuzzy search výsledky** (Problem records s podobným
  popisom), nie ju nútiť pamätať si Problem ID.

---

### `workspace-incident-escalate-to-l2`

**Kontext:** Sieťový problém v dcérke „Acme East" — Anna ho rieši 25 minút,
nevie pokračovať, eskaluje na L2 Mareka.

**Happy path:**

```mermaid
sequenceDiagram
    participant Anna
    participant W as Workspace
    participant API
    participant Marek

    Anna->>W: otvor ticket, kontext
    Anna->>W: klik "Eskalovať" v action bar
    W-->>Anna: modal "Eskalovať na ktorú skupinu?"
    Anna->>W: vyber "L2 Network"
    Anna->>W: pridať poznámku "skontrolované: kabeláž OK, ping fail na gateway"
    W->>API: PATCH ticket assignment_group=L2-Network, status=Escalated
    API->>Marek: notify (push + email)
    API-->>W: 200
    W-->>Anna: ticket zmizol z "My queue", toast "Eskalované"
```

**Alternate:**

- Anna pri eskalácii zabudne pridať poznámku — UI musí mať **soft validation**:
  pri prázdnej poznámke ukázať warning „Eskalujete bez poznámky. L2 musí
  prečítať celý ticket. Pokračovať?" (nie hard-block, ale prompt).
- Cieľová skupina „L2 Network" nemá v tenantu „Acme East" žiadnych aktívnych
  členov (svojím tenant scope). UI musí **fail-fast**: skupinu vôbec
  nezobraziť, alebo zobraziť s badge „Žiadny aktívny člen — kontakt cez HQ".
  Nikdy nedovoliť eskaláciu do prázdnej skupiny.

---

## agent_l2_marek

### `workspace-problem-rca`

**Kontext:** Tri tickety za týždeň o pomalom e-mail klientovi v dcérke „Acme East".
Marek otvorí Problem record, robí RCA.

**Happy path:**

```mermaid
journey
    title Marek — Problem record + linkovanie
    section Setup
      Vytvor Problem #PRB-118: 5: Marek
      Popis: "Outlook latency Acme East": 4: Marek
    section Linkovanie
      Tab "Linked Incidents": 5: Marek
      Bulk add 12 incidentov : 4: Marek
      Vyhľadanie cez query "outlook AND Acme-East": 5: Marek
    section RCA
      Tab "Root Cause" — píše analýzu: 5: Marek
      Linkuje na CI "exch-east-01": 5: Marek
      Označuje ako Known Error: 5: Marek
    section Workaround → KB
      Tlačidlo "Create KB from this": 5: Marek
      KB Editor predvyplnený  : 5: Marek
```

**Alternate:**

- Bulk add 12 incidentov — niektoré sú v inom tenante (cross-tenant). UI musí
  **vizuálne oddeliť** v zozname (ikona / badge) a varovať „Linkuješ tickety
  z viacerých tenantov — povolené?" `[GAP-2: cross-tenant linkovanie?]`
- Pri tvorbe KB článku „Create from this" treba zachovať odkaz Problem→KB
  (aby budúci žiadateľ vedel, že to je „Known Error workaround"). UI musí
  zachovať tento link **viditeľne** v KB metadata.

---

### `workspace-cmdb-impact-analysis`

**Kontext:** Storage server `srv-stg-east-02` má naplánovaný patch budúci
týždeň. Marek potrebuje overiť, čo na ňom závisí.

**Happy path:**

```mermaid
journey
    title Marek — impact analysis pred patch
    section Vyhľadanie
      CMDB search "srv-stg-east-02": 5: Marek
      Otvor CI detail            : 5: Marek
    section Vzťahy
      Tab "Relationships"        : 5: Marek
      Vidí graph 23 závislostí   : 5: Marek
      Filter: "depends on me"    : 5: Marek
      Zoom + expand layer 2      : 4: Marek
    section Akcia
      Export do PDF (pre change ticket): 5: Marek
      Link CI do Change record   : 5: Marek
```

**Alternate:**

- Graph má 200+ uzlov (storage je core service). UI musí ponúknuť **automatický
  cluster** (zoskupiť podľa typu CI: aplikácie, ďalšie servery, network),
  nie ich kresliť ako spaghetti.
- Marek klikne na CI „app-customer-portal" v grafe — chce vidieť **impact
  na biznisu** (počet užívateľov, business owner). Tieto atribúty musia byť
  v CI detail right-side panel (pop-out na hover/click).

---

### `workspace-incident-deep-dive`

**Kontext:** Eskalovaný ticket od Anny — VPN klient odmieta pripojenie kvôli
expirovanému certifikátu na klientovi.

**Happy path:**

```mermaid
sequenceDiagram
    participant Marek
    participant W as Workspace
    participant API
    participant Jana as KB Editor

    W-->>Marek: ticket #INC-2105 (eskalovaný)
    Marek->>W: čítať Anniny poznámky
    Marek->>W: rieši na remote session (mimo UI)
    Marek->>W: pridá komentár "vyriešené: regenerácia client certu"
    Marek->>W: close ticket
    Marek->>W: klik "Vytvoriť KB článok z tohto ticketu"
    W-->>Marek: KB editor predvyplnený (problem, resolution)
    Marek->>W: dopíše steps, klik "Submit for review"
    W->>API: KB article draft, reviewer=Jana
    API->>Jana: notify
```

**Alternate:**

- Marek omylom pri close zabudne resolution code (Required field). UI musí
  **inline blockovať close** s focus na chýbajúcom poli, nie celú obrazovku
  modálne prerušiť.
- KB článok submituje, ale **Jana je na PN-ke**. UI by malo navrhnúť
  alternatívneho reviewera z tej istej skupiny (KB Editors).

---

## change_manager_peter

### `workspace-change-cab-prep`

**Kontext:** Pondelok 8:00, CAB meeting o 10:00. Peter musí prejsť 25 changes
naplánovaných na týždeň.

**Happy path:**

```mermaid
journey
    title Peter — CAB prep
    section Otvorenie
      Workspace → Change tab : 5: Peter
      Filter "CAB pending"   : 5: Peter
      25 changes v zozname   : 4: Peter
    section Bulk review
      Toggle "Calendar view" : 5: Peter
      Týždenný kalendár      : 5: Peter
      Vidí 2 konfliktné okná: 4: Peter
      Klik na change → side detail: 5: Peter
    section Označenie pre diskusiu
      Tag 5 changes "discuss in CAB": 5: Peter
      Pridať poznámku        : 4: Peter
    section Pred CAB
      Export agenda do PDF   : 5: Peter
```

**Alternate:**

- Konflikt v okne (dva changes na ten istý CI v rovnakom čase). UI musí
  v kalendári **automaticky zvýrazniť konflikt** (red border / warning ikona)
  a v change detaile zobraziť „Conflict with #CHG-441 at 22:00–23:00".
- Bulk tagging „discuss" — UI musí byť **klávesnicovo prístupné** (Peter
  premieta na projektor v CAB-e a chce navigovať bez myši).

---

### `workspace-change-emergency-approve`

**Kontext:** 14:30, prišiel security advisory — patch na Apache Log4j cez
weekend. Peter musí schváliť emergency change do 16:00.

**Happy path:**

```mermaid
sequenceDiagram
    participant Peter
    participant W as Workspace
    participant API
    participant Mobile

    Peter->>Mobile: notification "Emergency CAB approval"
    Mobile->>W: deeplink na change #CHG-503
    W-->>Peter: change detail (mobile-friendly)
    Peter->>W: čítať impact, rollback plan
    Peter->>W: klik "Approve" (požaduje 2FA confirm)
    W->>API: PATCH approval=approved, approver=Peter, ts=now
    API-->>Peter: confirm + status "Approved, awaiting implementation"
```

**Alternate:**

- 2FA challenge zlyhá (network issue) — UI musí ponúknuť **retry** bez straty
  context (nie redirect na home).
- Peter chce schváliť, ale rollback plán je prázdny. UI musí **zablokovať**
  approve s viditeľným warningom „Rollback plán je vyžadovaný pre emergency
  changes" — ale ponúknuť `Request changes` akciu (pošle späť implementorovi
  s poznámkou).

---

### `workspace-change-cross-tenant-conflict`

**Kontext:** Change v dcérke „Acme East" je naplánovaný na sobotu 02:00–06:00.
Peter v HQ má v ten istý čas maintenance window. Treba uvidieť konflikt.

**Happy path:**

```mermaid
journey
    title Peter — cross-tenant change calendar
    section Setup
      Otvor change calendar  : 5: Peter
      Toggle "All my tenants": 5: Peter
    section Vidí konflikt
      HQ window 00:00-06:00  : 5: Peter
      Acme East change 02:00-06:00: 4: Peter
      Visual overlap (red badge): 5: Peter
    section Akcia
      Komunikácia s East tímom: 4: Peter
      Re-schedule jeden     : 4: Peter
```

**Alternate:**

- Peter nemá rolu v „Acme East" tenantu — nemôže schvaľovať tam, ale potrebuje
  ho **vidieť** v read-only mode (cross-tenant visibility). UI musí ponúknuť
  toggle „Show external tenants (read-only)" — ale len ak má používateľ
  dostatočnú rolu v HQ (compliance officer / global change manager).
  `[GAP-3: má CA SDM cross-tenant viewer rolu?]`

---

## kb_editor_jana

### `workspace-kb-author-new`

**Kontext:** Jana píše nový článok „Reset hesla pre VPN klienta" po viacerých
ticketoch s rovnakou témou.

**Happy path:**

```mermaid
journey
    title Jana — nový KB článok
    section Vytvorenie
      KB modul → "New article": 5: Jana
      Vyber šablónu "How-to"  : 5: Jana
      Vyplní title, kategória : 4: Jana
    section Editácia
      WYSIWYG editor          : 5: Jana
      Drag-drop screenshot    : 5: Jana
      Pridanie linku na CI    : 5: Jana
      Tagy: vpn, reset, password: 4: Jana
    section Publikácia
      Klik "Preview"          : 5: Jana
      Skontroluje ako vyzerá v portáli: 5: Jana
      "Submit for review" → reviewer auto-assign: 5: Jana
```

**Alternate:**

- Auto-save: ak prehliadač spadne, draft musí byť obnoviteľný. UI musí
  ukázať **„Obnoviť draft z 14:32"** banner pri otvorení editora.
- Submit s nepripojenou kategóriou — UI inline error „Kategória je
  vyžadovaná pre publish" + focus na poli.

---

### `workspace-kb-from-incident`

**Kontext:** Marek pri close ticketu klikol „Create KB article". Jana dostala
notification s draft-om.

**Happy path:**

```mermaid
sequenceDiagram
    participant Jana
    participant W
    participant API

    W-->>Jana: notification "Marek vytvoril KB draft #KB-DRAFT-92"
    Jana->>W: klik na notification
    W-->>Jana: KB editor s draft
    Jana->>W: edituje (jazyk, štruktúra, screenshoty)
    Jana->>W: "Publish"
    W->>API: status=Published, visibility=both apps
    API-->>Jana: confirm
```

**Alternate:**

- Pôvodný ticket bol v inom tenante. KB článok musí mať **visibility scope**
  per tenant — Jana musí explicitne zvoliť, či článok vidieť všetkým tenantom
  alebo len tomu, kde vznikol problém. UI musí mať jasný `Visibility` selector.

---

### `workspace-kb-analytics-review`

**Kontext:** Piatok 15:00, Jana robí týždennú analytics retrospektívu.

**Happy path:**

```mermaid
journey
    title Jana — KB analytics review
    section Otvorenie dashboardu
      KB modul → Analytics tab: 5: Jana
      Časový rozsah: posledný týždeň: 5: Jana
    section Insights
      Top 10 článkov (views)  : 5: Jana
      Bottom 5 helpfulness    : 4: Jana
      Search miss queries     : 5: Jana
    section Akcie
      Označuje 3 články na update: 5: Jana
      Vytvára 2 stub-y pre chýbajúce témy: 4: Jana
```

**Alternate:**

- Search miss query „password reset" má 50 výskytov — ale článok existuje.
  Jana zistí, že články sú v EN, používatelia hľadajú v SK. UI musí ukázať
  **language match analytics** (čo hľadali vs. v ktorom jazyku je článok).
  `[GAP-4: vystavuje CA SDM tieto metriky natívne?]`

---

## cmdb_owner_robert

### `workspace-cmdb-ci-detail`

**Kontext:** Robert kontroluje CI „srv-prod-db-01" pred plánovaným patch-om.

**Happy path:**

```mermaid
journey
    title Robert — CI detail review
    section Vyhľadanie
      CMDB modul → search    : 5: Robert
      Klik na výsledok       : 5: Robert
    section Detail
      Sticky header: name, type, owner: 5: Robert
      Section: 47 atribútov  : 4: Robert
      Section: 23 vzťahov    : 5: Robert
      Section: 6 otvorených incidentov: 5: Robert
      Section: change history: 4: Robert
    section Akcia
      Označuje ako "patch-ready": 4: Robert
      Linkuje na nadchádzajúci change: 5: Robert
```

**Alternate:**

- 47 atribútov — Robert chce **collapse** sekcie, ktoré nepoužíva (custom UDF
  fields). UI musí mať per-user preferencie: ktoré sekcie collapsed by default.
- CI history má 200+ záznamov za 3 roky. UI musí ponúknuť **time filter**
  (last week / month / year) namiesto plnej tabuľky.

---

### `workspace-cmdb-relationship-impact`

**Kontext:** Biznis chce vyradiť legacy aplikáciu „crm-legacy". Robert ukáže
manažmentu, čo na nej závisí.

**Happy path:**

```mermaid
journey
    title Robert — impact analysis pre decommission
    section Setup
      Otvor CI "crm-legacy"  : 5: Robert
      Tab "Relationships graph": 5: Robert
    section Analyse
      Graph 35 vzťahov       : 5: Robert
      Filter: "depends on me": 5: Robert
      Vidí 4 batch joby + 2 reporty: 5: Robert
      Klik každý → detail right panel: 5: Robert
    section Export
      Export do PDF report   : 4: Robert
      Share link s manažmentom: 5: Robert
```

**Alternate:**

- „depends on me" filter ukazuje aj **deprecated** vzťahy (CI bol
  vyradený, ale vzťah ostal). UI musí farebne odlíšiť aktívne vs. deprecated
  CI v grafe.
- PDF export trvá > 30 sekúnd (veľký graph). UI musí ukázať **loading state**
  s % progress, nie freezed obrazovka.

---

### `workspace-cmdb-cross-tenant-shared`

**Kontext:** Dcérka „Acme East" používa storage z HQ tenantu. Robert kontroluje
cross-tenant CI vzťahy pred zmenou storage layera.

**Happy path:**

```mermaid
sequenceDiagram
    participant Robert
    participant W
    participant API

    Robert->>W: otvor CI "stg-shared-01" (HQ owned)
    W-->>Robert: CI detail, vzťah "consumed by Acme East apps (3)"
    Robert->>W: klik na cross-tenant relationship
    W-->>Robert: list 3 CI z Acme East (badge "External tenant")
    Robert->>W: klik na app — read-only view (Robert nemá write rolu v East)
    W-->>Robert: app detail, owner contact
    Robert->>W: kopíruje contact, posiela e-mail
```

**Alternate:**

- Robert nemá vôbec rolu v „Acme East" — UI musí ukázať **CI relationship
  ako agregát** („3 CIs consumed by Acme East") **bez detailu**, ale s
  contact-om na tenant administrátora. Compliance princíp: ukázať **že to
  existuje**, ale nie **čo to je**.
- Cross-tenant CI je „shared ownership" — kto môže meniť? UI musí mať
  jasný badge „Shared ownership: HQ + Acme East" a v action bar disabled
  edit s tooltipom „Vyžaduje súhlas oboch ownerov".
  `[GAP-5: podporuje CA SDM shared CI ownership?]`

---

## Otvorené závislosti

- `[01-api-analyst]` `[GAP-1]` Service Catalog dynamic forms — formulárové
  polia sa generujú z CA SDM Request Item template. Potvrď schému, formát
  field definícií, validačné pravidlá; UX inak nedokáže navrhnúť form
  rendering komponent.
- `[01-api-analyst]` `[GAP-2]` Cross-tenant linkovanie ticketov (Incident →
  Problem v inom tenante) — povolené, blokované, alebo vyžaduje špeciálnu
  rolu? Tento GAP ovplyvňuje 3 journeys (Marek RCA, Marek deep-dive, Peter
  cross-tenant change).
- `[01-api-analyst]` `[GAP-3]` Cross-tenant viewer role — existuje v CA SDM
  „global compliance" rola, ktorá vidí read-only do všetkých tenantov?
  Ak nie, Peter cross-tenant scenár nie je realizovateľný v MVP.
- `[01-api-analyst]` `[GAP-4]` KB analytics — vystavuje CA SDM REST endpointy
  pre views, helpfulness, search miss? Alebo to musíme vybudovať v BFF?
  Ak to nie je v MVP, persona Jana má scenár 3 mimo scope.
- `[01-api-analyst]` `[GAP-5]` Shared CI ownership cross-tenant — podporuje
  CA SDM CMDB ownership pre 2+ tenantov per CI?
- `[03-domain-modeller]` Triple linkovanie Incident → Problem → Change.
  Potvrď, či CA SDM podporuje **multi-step asociácie** (priamy link Incident
  → Change cez Problem) alebo len **párové** (Incident-Problem, Problem-Change
  separátne).
- `[03-domain-modeller]` Resolution code list — používateľ ho v UI vyberá
  z dropdown. Aký je zdroj zoznamu (CA SDM `cr_resolutions` alebo per-tenant
  config)?
- `[04-architecture]` Tenant switching pri otvorenom ticket detaile — PM
  musí rozhodnúť stratégiu (uzavrieť detail, varovať pred prepnutím, ponechať
  cross-tenant view). Default UX: uzavrieť + toast „Prepol si tenant".
- `[04-architecture]` Auto-save drafts (formuláre v portáli, KB editor) —
  client-side localStorage alebo BFF endpoint pre server-side draft? Impact
  na UX spoľahlivosť.
- `[05-security]` Mobilný emergency approve flow Petra — vyžaduje step-up
  auth (2FA na mobile)? Ak áno, vyplýva to z policy a ovplyvní UX prieťah
  approve flowu.
- `[05-security]` Cross-tenant aggregate read (Robert „3 CIs consumed by
  External tenant" ukazujeme len count, nie detaily) — potrebuje audit
  log? UX kalibrácia textu „External tenant" musí súhlasiť s compliance.
- `[07-design-system]` Klávesové skratky pre Annu — `j/k/r/c/e/t` — sú
  kolízne so štandardmi (napr. `Cmd+R` refresh)? Design System musí
  poskytnúť globálnu mapu skratiek pre `workspace`.
