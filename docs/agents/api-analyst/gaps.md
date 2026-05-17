# CA SDM 17.4 — REST API gaps

> Operácie potrebné pre nový FE (per GOAL.md §3 scope), ktoré **REST API
> nepokrýva** alebo pokrýva neuspokojivo. Pre každý gap navrhujeme:
> A) SOAP fallback, B) BUI vrstva fallback, C) odložiť do v1, alebo
> D) blocker — vyžaduje zásah do backendu (mimo scope, eskalácia).

## Sumárna tabuľka

| # | Gap | Modul | Severity | Návrh |
|---|---|---|---|---|
| 1 | Bulk update / bulk close ticketov | Workspace queue | medium | A) SOAP `updateMultipleObjects` (overiť existenciu) — alt. B) loop PUT v BFF s rate-limitingom |
| 2 | Plno-textové vyhľadávanie KB | Knowledge | high | B) `/bui/getDocument` + `/suggestedSolutions` cez Service Point token; alebo SOAP `searchKnowledgeBase` |
| 3 | Dynamic form rendering pre Service Catalog (option types, validation rules) | Request Mgmt | high | Najpresnejšie cez Service Catalog REST (nie CA SDM) — vyžaduje samostatnú integráciu; **otvorené, eskalovať na 03-domain-modeller a 04-architecture** |
| 4 | Endpoint pre "moje tenanty" | Multi-tenancy | high | C) odvodiť z `GET /caisd-rest/cnt/{id}/roles` + `GET /caisd-rest/tenant_group_member`; BFF ich agreguje |
| 5 | Generic search across tickets (cez summary, description) | All ticket modules | medium | A) `WC=summary%20LIKE%20'%term%'` ide len na jeden factory naraz; B) parallel search + dedup v BFF; alebo SOAP `doSelect` |
| 6 | Approval flow operations (approve / reject change task) | Change | high | Cez PUT `wf` so zmenou `status` na "Approved"/"Rejected" — funguje, ale vyžaduje validáciu, ktorá nie je v REST docu jasná. **Overiť na inštancii.** |
| 7 | Notifications API (push events, websocket) | All | low (mimo MVP) | C) odložiť do v1; v MVP polling cez `last_mod_dt` filter |
| 8 | Quick ticket templates aplikácia (ako one-shot create) | Incident, Request | medium | A) SOAP `createQuickTicket`; ekv. v REST je sada PUT na pre-existing template entity, nie one-shot |
| 9 | Aktivácia / inaktivácia (delete_flag toggle) bez DELETE | All | low | Interné — všetky použijú PUT s `delete_flag=1`. Ošetriť v `api-client` helper-i. |
| 10 | "Acknowledge ticket" — automatický prechod statusov so side-effects (notifikácie) | Incident | medium | A) SOAP `closeTicket`; v REST manuálny PUT na `status` ale notifications sa môžu nesúvisle správať |
| 11 | "Assign ticket to me" v jednom kroku (s assignee = current user + group based on default role) | Incident, Request | low | Riešiť v BFF: client pošle "assign-me", BFF si vytiahne current user UUID + default role group, urobí PUT |
| 12 | Custom search saved queries (`crsq`) | Workspace | low (v1) | C) v MVP nie; v1 cez `GET /caisd-rest/crsq` |
| 13 | Survey response capture (po close ticketu) | Request, Change | low (v1) | C) v MVP nie; survey rendering je BUI flow |
| 14 | Audit log (kto kedy čo zmenil — granular field-level) | Workspace | low (v1) | A) SOAP `getRelatedListValues` na `audlog`; v REST cez collection `/caisd-rest/audlog?WC=...` (existuje, ale neoverené permissions) |
| 15 | Service Provider tenant switch (impersonation) | Multi-tenancy | medium | A) SOAP `impersonate`; v REST nie je explicitne dostupný — nutné cez nový BOPSID flow alebo zostať na user role |
| 16 | Request escalation s automatickým re-assign | Workspace | low | A) SOAP `escalateTicket`; v REST manuálny PUT |
| 17 | Health-check / heartbeat endpoint | DevOps / FE | medium | **Blocker** — CA SDM nemá. Riešiť cez ľubovoľný GET (napr. `GET /caisd-rest/sevrty?size=1`) ako synthetic ping |
| 18 | Bulk attachment upload | Knowledge, Tickets | low | C) v MVP single-file iteration |
| 19 | KB versioning (history dokumentu) | Knowledge | low (v1) | C) v MVP read latest version only; v1 cez `KCAT_VERSION` table (REST endpoint neoverený) |
| 20 | Cross-module relationship view (incidents linked to a CI) | CMDB | medium | Pokryté cez `/caisd-rest/nr/{id}/all_open_creq` (QREL). OK. |

## Detail per gap

### #1 — Bulk update ticketov

**Use case**: Workspace agent vyberie 20 incidentov v queue a chce naraz
zmeniť priority alebo assignee.

**Stav v REST**: REST API nemá bulk endpoint. PUT pracuje per `{id}`.

**Návrh**:
- **A) SOAP fallback**: SOAP `updateObject` je per-objekt; SOAP nemá batch.
  Kontrola: PDF s. 3395–3416 popisuje SOAP methods, **bulk endpoint NIE JE
  uvedený**.
- **B) BFF loop**: BFF spustí parallel PUT s controlled concurrency
  (max 5–10 paralelných volaní, exponential backoff pri 5xx). Vhodné pre
  batch < 50 položiek (rádovo desiatky podľa GOAL.md §11).
- **Doporučenie**: B). Detail v `qa` agent strategy (rate-limit testy).

### #2 — Plno-textové vyhľadávanie KB

**Use case**: Portal user píše ticket → suggested KB články, alebo Workspace
agent hľadá KB článok podľa kľúčových slov.

**Stav v REST**: `WC=KEYWORDS%20LIKE%20'%term%'` na `KCAT` / `SKELETONS` je
SQL LIKE — **žiadne ranking, žiadny index**. Nepoužiteľné pre real-time UX.

**Návrh**:
- **B) BUI fallback**: `GET /suggestedSolutions?text=<query>&tenant=<id>` —
  využíva indexovanie Service Point. Vhodné pre Portal UI.
- **B) BUI fallback 2**: `GET /pcatSearch?query=<term>` pre kategorický
  search.
- **A) SOAP fallback**: `searchKnowledgeBase` (PDF s. 6515) má pokročilé
  filtrovanie (boolean, similarity, classes).
- **Doporučenie**: B) pre Portal, A) pre Workspace pokročilý search.

### #3 — Dynamic form rendering pre Service Catalog

**Use case**: User klikne "Reserve a Virtual Machine" v Service Catalogu →
formulár musí dynamicky vyrenderovať fieldy (text, select, file upload, ...)
definované adminom v Service Catalogu.

**Stav v REST**: `/getOfferings` vracia summary (id, name, description,
options) — **option detail (input type, validation, default)** nie je
v PDF dokumentovaný.

**Návrh**: **Otvorené** — vyžaduje:
- 03-domain-modeller: Definuj domain model dynamického formulára.
- 04-architecture: Rozhodni, či FE volá CA Service Catalog priamo (separátna
  REST API mimo CA SDM) alebo cez Service Point widget.
- 02-ux-persona: Definuj UX flow (full form vs. wizard).

**Severity**: high — bez tohto Request module v MVP nemá Service Catalog UX.

### #4 — Endpoint "moje tenanty"

**Use case**: Po prihlásení FE potrebuje zoznam tenantov, na ktoré má user
prístup, aby mohol urobiť tenant switcher.

**Stav v REST**: Žiadny dedikovaný endpoint. Z PDF s. 3781 (`cnt`) vyplýva,
že kontakt má `tenant` SREL a `roles` BREL → každá rola má svoj tenant.
`tenant_group_member` umožňuje skupinové členstvá.

**Návrh**: BFF agreguje:
1. `GET /caisd-rest/cnt/{currentUserUuid}` → `tenant` + `roles`
2. `GET /caisd-rest/cnt_role?WC=contact%3DU'...'` → list rolí s tenantmi
3. `GET /caisd-rest/tenant_group_member?WC=tenant_id%3D...` → effective tenants
4. **Service Provider** (`tenant.service_provider=1`) má prístup ku všetkým:
   `GET /caisd-rest/tenant?WC=delete_flag%3D0`

**Severity**: high — kritické pre MVP. Detail v `multi-tenancy.md`.

### #5 — Generic ticket search

**Use case**: Workspace search bar — "Find tickets matching 'firewall'".

**Stav v REST**: `WC` query je per factory. Treba volať `cr`, `in`, `pr`,
`chg`, `iss` paralelne a unifikovať výsledky.

**Návrh**: BFF orchestruje fan-out + dedup. Cache na 30 s.

### #6 — Approval flow

**Use case**: Manager schvaľuje Change Task.

**Stav v REST**: Workflow tasks (`wf`) majú status, ktorý sa updatuje
PUT-om. **Avšak**: spôsob, ako approve vyvolá ďalší task v sequencii a
notifikácie, je v PDF s. 3987 popísaný len high-level.

**Návrh**: A) Workflow je business logika v CA SDM — PUT na `wf.status`
spustí internú logiku. **Overiť na inštancii**.

### #15 — Service Provider impersonation

**Use case**: Service Provider tenant chce vidieť dáta konkrétneho
zákazníckeho tenanta (s plnou auditovateľnosťou).

**Stav v REST**: REST nemá explicit impersonation endpoint. Možno simulovať
cez Multiple Access Keys (zvlášť pre každý tenant), ale je to klugó.

**Návrh**: A) SOAP `impersonate(sid, userid)` (PDF s. 1910) — vráti nový
sid s identitou cieľového usera. BFF mapuje na nový Access Key.

> ⚠️ Bezpečnostne citlivé — Security agent musí schváliť threat model.

## Otvorené závislosti

| # | Flag | Smer | Popis |
|---|---|---|---|
| 1 | `service-catalog-form-schema` | → 03-domain-modeller, 04-architecture | Gap #3 vyžaduje rozhodnutie, ako bude FE vykresľovať dynamický catalog form. Buď ďalšia integrácia s CA Service Catalog, alebo "render via Service Point iframe". Otvorené. |
| 2 | `bulk-rate-limit` | → 04-architecture, 09-qa | Gap #1 — či CA SDM má rate-limit na PUT volania nie je v PDF dokumentované. Treba reálny test alebo konzervatívny limit. |
| 3 | `impersonation-policy` | → 05-security | Gap #15 — impersonation flow potrebuje audit a schválenie, kým ho zaradíme do MVP. |
| 4 | `audlog-rest-availability` | → 03-domain-modeller | Gap #14 — `audlog` je v PDF s. 3460 ako `Required` tenant attribute, ale REST availability nie je explicitne potvrdené. **Overiť.** |
| 5 | `chg-trans-allowed-filtering` | → 03-domain-modeller | Gap #6 — či CA SDM exposuje "permitted transitions for this user on this ticket" alebo musí FE filtrovať `chg_trans` na základe role manuálne. |
| 6 | `quick-ticket-create` | → 03-domain-modeller | Gap #8 — či `cr_template` má REST hook na one-shot create. PDF popisuje SOAP `createQuickTicket`, REST ekvivalent neoverený. |
