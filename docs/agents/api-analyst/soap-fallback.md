# CA SDM 17.4 — SOAP Web Services fallback

> Operácie, kde REST API nestačí a navrhujeme volať legacy SOAP Web Services.
> Cieľ je minimalizovať počet SOAP volaní — ideálne **zero v MVP**, prijatá
> realita ich môže pridať v jasných hot-spots.
>
> Zdroj: PDF *Web Services Methods* (s. 3395–3461), *Web Services Knowledge
> Methods* (s. 3465–3516), *Web Services Business Methods* (s. 3517–3765).
>
> **WSDL endpoint**: `http://<host>:<port>/axis/services/USD_R11?wsdl`.
> Default port = `8080` (web client). SOAP envelope namespace:
> `http://www.ca.com/UnicenterServicePlus/ServiceDesk`.

## Auth flow (SOAP)

SOAP používa session ID (`sid` integer), ktorý sa získa cez `loginService`:

```xml
<ser:loginService>
  <username>ServiceDesk</username>
  <password>openSesame</password>
</ser:loginService>
```

Response: `<sid>123456</sid>`. Tento `sid` sa potom posiela ako parameter
v každom SOAP volaní. Logout: `<ser:logout><sid>123456</sid></ser:logout>`.

Alternatívne `loginServiceWithArtifact` (pre EEM SSO) a `loginServiceManaged`
(pre managed providers).

## Operácie navrhované ako SOAP fallback

### 1. impersonate (multi-tenancy)
- **Method**: `impersonate(sid, userId) → newSid`
- **Use case**: Service Provider preberie identitu zákaznickeho tenanta.
- **Bezpečnosť**: Vyžaduje special function access. Logované do audit log.
- **REST ekv.**: nie je.

### 2. createQuickTicket (template-based create)
- **Method**: `createQuickTicket(sid, customerHandle, customerName, descript,
  ...) → newTicketHandle`
- **Use case**: Portal user submitne formulár → ticket s pre-set kategóriou,
  prioritou z templatu.
- **REST ekv.**: viacero PUT-ov + POST, ale bez side-effects (notifikácie,
  auto-assign).

### 3. closeTicket
- **Method**: `closeTicket(sid, descript, ticketHandle)`
- **Use case**: Korektné uzatvorenie tikketu vrátane SLA stop, notifikácie,
  audit.
- **REST ekv.**: PUT na `status='CL'` — funguje, ale **neoverené**, či
  spustí všetky side-effects.

### 4. notifyContacts
- **Method**: `notifyContacts(sid, contextObject, msgHandles, notifyMethods,
  msgPriority, ackRequired, mailHeader, mailBody, contactList)`
- **Use case**: Posielanie notifikácie skupine kontaktov mimo bežného
  workflowu (napr. "incident eskalovaný" cez SMS aj email).
- **REST ekv.**: nie je.

### 5. attachChangeToRequest
- **Method**: `attachChangeToRequest(sid, creator, changeHandle, requestHandles)`
- **Use case**: Linkovanie existujúceho changu na incident(y) — auto-creates
  back-reference.
- **REST ekv.**: PUT `cr.change` = id changu (single direction). Pre
  bidirectional auto-link je SOAP cleaner.

### 6. attachURLLink (interný link na URL z aktivity)
- **Method**: `attachURLLink(sid, creator, contextHandle, urlName, urlPath,
  description)`
- **Use case**: Pridanie URL linku ako attachment (napr. odkaz na monitoring
  dashboard).
- **REST ekv.**: POST `attmnt` s `link_only=1`, `link_type=URL`.

### 7. searchKnowledgeBase
- **Method**: `searchKnowledgeBase(sid, contactHandle, searchString,
  documentTypes, classes, props, attachClasses, ...)`
- **Use case**: Pokročilé fulltext + classifikácia search nad KB.
- **REST ekv.**: BUI `/suggestedSolutions` (slabšie filtrovanie).

### 8. getDocument (rich KB document)
- **Method**: `getDocument(sid, contactHandle, documentId,
  resolutionFlag, ...)`
- **Use case**: Plná knowledge document s pre-rendered HTML obsahom.
- **REST ekv.**: GET `SKELETONS/{id}` (raw CONTENT field).

### 9. getRelatedListValues (deep query)
- **Method**: `getRelatedListValues(sid, objectHandle, listName, attrs, sortBy)`
- **Use case**: Get child collection s deep attribute-traversal (`assignee.combo_name`).
- **REST ekv.**: GET sub-resource — funguje, ale **dotted attribute path
  (e.g. `assignee.last_name`) nie je v REST povolený** (PDF s. 3438).

### 10. transferTicket / escalateTicket
- **Method**: `transferTicket(sid, ticketHandle, newAssigneeHandle, comment)`
- **Use case**: Workflow assist — transfer s commentom, escalation s
  predefinovanou logikou.
- **REST ekv.**: PUT na `assignee` + POST `act_log`.

### 11. updateObjectByHandle / updateObjectsByCriteria (bulk)
- **Note**: V PDF s. 2283 sa spomína `updateObject`. **Bulk variant
  (multi-record) v dokumente nie je explicitne uvedený.** **Overiť na
  inštancii** — keď nie je, pre bulk zostáva BFF loop.

## Tabuľka — SOAP method → CA SDM REST equivalent

| SOAP method | REST ekv. | MVP fallback? |
|---|---|---|
| `loginService` | `POST /caisd-rest/rest_access` | nie (REST používame) |
| `logout` | `DELETE /caisd-rest/rest_access/{id}` | nie |
| `impersonate` | — | možno (gap #15) |
| `createTicket` | `POST /caisd-rest/in` (alebo `cr`/`pr`) | nie |
| `createChangeOrder` | `POST /caisd-rest/chg` | nie |
| `createQuickTicket` | viacero REST volaní | možno (gap #8) |
| `createObject` | `POST /caisd-rest/{factory}` | nie |
| `updateObject` | `PUT /caisd-rest/{factory}/{id}` | nie |
| `getObjectValues` | `GET /caisd-rest/{factory}/{id}` | nie |
| `searchObjects` (`doSelect`) | `GET /caisd-rest/{factory}?WC=...` | nie |
| `getRelatedListValues` | sub-resource GET | čiastočne — pri dotted attrs SOAP |
| `closeTicket` | `PUT /caisd-rest/in/{id}` (status=CL) | možno (gap #10) |
| `notifyContacts` | — | áno (gap #4 ext.) |
| `attachChangeToRequest` | PUT bilateral | možno |
| `attachURLLink` | `POST /caisd-rest/attmnt` (link_only=1) | nie |
| `searchKnowledgeBase` | BUI `/suggestedSolutions` + REST WC | možno (gap #2) |
| `getDocument` | BUI `/bui/getDocument` + REST `SKELETONS` | nie (BUI postačuje) |
| `transferTicket` | PUT + POST act_log | nie |
| `escalateTicket` | PUT (status, priority) + side-effects | možno |
| `getDocumentTypes` | `GET /caisd-rest/<doc_type>` (neoverené) | možno |
| `getValidTransitions` | `GET /caisd-rest/{factory}_trans` | nie (REST má) |
| `getKDListPerAssignee` | `GET /caisd-rest/SKELETONS?WC=ASSIGNEE%3D...` | nie |

## Implementačné poznámky pre BFF

Pre SOAP integráciu v BFF (TypeScript / Node.js) navrhujeme:

- **Knižnica**: `strong-soap` alebo `easy-soap-request` (lightweight). Voľbu
  potvrdí 06-tech-stack.
- **Connection pooling**: SOAP volania sú stateful (potrebujú `sid`). BFF
  drží separátny SOAP session pool, paralelne s REST Access Key sessionou.
- **Error handling**: SOAP fault → Internal `SoapError` typ; mapovanie na
  HTTP 5xx pre downstream.
- **Logging**: Plný SOAP envelope log (pri DEBUG), redact credentials.

## Bezpečnostné konzistencie

- SOAP používa **iný session-token** ako REST. Single sign-on cez BOPSID
  bridge je možný (`POST /caisd-rest/bopsid` po REST login → SOAP volanie
  s tým istým usermanom — overiť).
- Function access pre SOAP je samostatne — kontakt musí mať vyplnené
  **Web Service and API Role** v Access Type (paralelne k REST role).

## Otvorené závislosti

| # | Flag | Smer | Popis |
|---|---|---|---|
| 1 | `soap-bulk-update` | → 03-domain-modeller, 09-qa | Existencia SOAP bulk update API nie je v PDF potvrdená. Bez nej je BFF loop jediný spôsob bulk operácií. **Overiť na inštancii**. |
| 2 | `soap-knowledge-vs-bui` | → 02-ux-persona | Pre KB search v Workspace: SOAP `searchKnowledgeBase` (silnejšie filtrovanie) vs. BUI `/suggestedSolutions` (jednoduchšie). UX agent rozhodne podľa requirements. |
| 3 | `soap-impersonation-policy` | → 05-security | SOAP `impersonate` je výrazný security risk; Security potvrdí, či ho v MVP vôbec povolíme. |
| 4 | `soap-library` | → 06-tech-stack | Voľba SOAP klienta (strong-soap, soap-cli, custom) závisí od stacku. |
