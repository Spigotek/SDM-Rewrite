# CA SDM 17.4 — Autentifikačný flow

> Zdroj: `docs/ca-service-management-17-4.pdf`, sekcia *REST HTTP Methods → CA SDM
> Authentication Scheme* (s. 3447–3450) a *REST API → API Documentation for
> RESTful Services* (s. 2906–2912).

CA SDM podporuje **tri webové vrstvy**, ktoré sa autentifikujú odlišne. Pre nový
frontend je relevantná najmä vrstva **REST API** (`/caisd-rest/...`); BUI/Service
Point endpointy uvádzame iba ako alternatívu pre špecifické UI scenáre.

| Vrstva | Path prefix | Auth header | Token lifecycle |
|---|---|---|---|
| **CA SDM REST API** (primárna) | `/caisd-rest/` | `X-AccessKey: <numeric>` | Access Key + Secret Key vydané endpointom `POST /caisd-rest/rest_access`; default expirácia v `expiration_date` (epoch). |
| **CA SDM BUI / Service Point** (sekundárna, používa Service Point UI) | `/bui/`, `/api/`, `/gs/`, `/getOfferings`, ... | `X-AccessToken: <token>` | Vydaný cez `POST /api/getAccess`; používaný interne Service Point widgetom, vhodný pre Service Catalog operácie, ktoré primárny REST nemá. |
| **CA SDM SOAP Web Services** (legacy fallback) | `/axis/services/USD_R11` | SOAP envelope so `<sid>` | `loginService` / `loginServiceWithArtifact` vráti `int sid`. |

## 1. Primárny flow — REST API (`/caisd-rest`)

REST API podporuje **štyri** autentifikačné schémy. V poradí klesajúcej
preferencie:

1. **REST Secret Key** — HMAC podpis každej požiadavky. Najsilnejšia, ale
   logikou náročná pre browser-side klient (Web Crypto + HMAC-SHA256). Vhodná
   skôr pre BFF.
2. **External CA EEM Artifact** — predvalidovaný artefakt z CA EEM (interná
   broadcom IAM služba). Vhodné pri integrácii s on-prem SSO, ktoré zatiaľ
   produkt nepodporuje OOTB.
3. **REST Basic Authentication** — base64 `userid:password` v `Authorization`
   header, výmena za Access Key. **Najjednoduchšia** a aj v dokumentácii sa
   používa pre samples. Vhodné cez HTTPS pre development a ako bootstrap pre
   neskoršiu výmenu za Secret Key. Možno globálne vypnúť option-om
   `NX_REST_WEBSERVICE_DISABLE_BASIC_AUTH=Yes` (s. 3449).
4. **REST BOPSID** — single-sign-on token získaný z iného CA SDM rozhrania.
   Použiteľné pri prechode z webclienta do nového FE bez re-loginu.

### 1.1 Login (Basic Auth → Access Key)

```http
POST /caisd-rest/rest_access HTTP/1.1
Host: sdm.example.org
Content-Type: application/xml;charset=UTF-8
Authorization: Basic QWxhZGRpbjpvcGVuIHNlc2FtZQ==

<rest_access/>
```

Odpoveď (PDF s. 3453):

```http
HTTP/1.1 201 Created
Content-Type: application/xml

<rest_access id="400001" REL_ATTR="400001" COMMON_NAME="770921656">
  <link href="http://hostname:8050/caisd-rest/rest_access/400001" rel="self"/>
  <access_key>770921656</access_key>
  <expiration_date>1335276895</expiration_date>
</rest_access>
```

`access_key` (8-miestne číslo) sa potom posiela v každej následnej požiadavke
ako HTTP header `X-AccessKey`.

### 1.2 BOPSID flow (SSO bridge)

```http
POST /caisd-rest/bopsid HTTP/1.1
Host: sdm.example.org
Accept: application/xml

<bopsid/>
```

Odpoveď:
```xml
<bopsid><bopsid_val>987982618</bopsid_val></bopsid>
```

Klient potom použije BOPSID na získanie Access Keya:

```http
POST /caisd-rest/rest_access HTTP/1.1
X-BOPSID: 987982618

<rest_access/>
```

### 1.3 EEM Artifact flow

```http
POST /caisd-rest/rest_access HTTP/1.1
X-ExtAuthArtifact: <EEM-artifact-token>
X-UserName: <userid>

<rest_access/>
```

### 1.4 Logout (delete Access Key)

```http
DELETE /caisd-rest/rest_access/{accessKeyId} HTTP/1.1
X-AccessKey: <access-key>
```

Odpoveď: `204 No Content`. Po DELETE je Access Key neplatný.

### 1.5 Switch role (per request)

REST API podporuje výber role z Attached Roles používateľa cez header
`X-Role: <role.id>` na každom volaní (s. 3447):

```http
POST /caisd-rest/cnt HTTP/1.1
X-AccessKey: 51461077
X-Role: 10002
```

Toto sa pri integrácii cez Access Type **REST Web Service API Role** nutne nemusí
volať — default role je nastavená na Access Type. Ale je užitočné pre testovanie
RBAC v UI.

## 2. Sekundárny flow — Service Point / BUI

> Service Point (`Leh-17.2 GA` swagger v PDF s. 2912) je samostatný self-service
> widget, ktorého REST endpointy začínajú `/api`, `/bui`, `/gs`, prípadne sú
> root-level (`/getOfferings`, `/pcatSearch`). Volajú sa s headerom
> `X-AccessToken` — **iný token** ako `X-AccessKey`.

```http
GET /api/getAccess HTTP/1.1
Host: sdm.example.org
Authorization: Basic <base64-credentials>
```

Token sa vráti v hlavičke `X-AccessToken` odpovede a používa sa pre všetky BUI
volania:

```http
GET /bui/getMyTicketDetails('cr:400001') HTTP/1.1
X-AccessToken: <accessToken>
```

> ⚠️ Pre nový FE preferujeme primárny `/caisd-rest`. BUI/Service Point endpointy
> sa použijú iba ako fallback pre operácie, ktoré primárny REST nepokrýva
> (typicky Service Catalog offering search, suggested solutions). Detail v
> `gaps.md` a `soap-fallback.md`.

## 3. Sekvenčný diagram (REST API + BFF, primárny flow)

```mermaid
sequenceDiagram
    autonumber
    participant U as User (browser)
    participant FE as Portal/Workspace SPA
    participant BFF as BFF (TBD — Architecture)
    participant SDM as CA SDM REST<br/>/caisd-rest

    U->>FE: enter credentials (form)
    FE->>BFF: POST /auth/login {userid, password}
    BFF->>SDM: POST /caisd-rest/rest_access<br/>Authorization: Basic <b64>
    SDM-->>BFF: 201 + <access_key>, <expiration_date>
    BFF-->>FE: Set-Cookie HttpOnly (session) +<br/>JSON {expiresAt}
    FE->>FE: store session in memory<br/>(no token in JS)

    Note over FE,SDM: Subsequent calls

    FE->>BFF: GET /api/incidents?...
    BFF->>SDM: GET /caisd-rest/in?WC=...<br/>X-AccessKey: <k><br/>X-Role: <roleId><br/>X-Obj-Attrs: ref_num,summary,...
    SDM-->>BFF: 200 + UDSObjectList
    BFF-->>FE: 200 + shaped JSON (camelCase, paginated)

    Note over U,SDM: Logout

    FE->>BFF: POST /auth/logout
    BFF->>SDM: DELETE /caisd-rest/rest_access/<id>
    SDM-->>BFF: 204
    BFF-->>FE: 204 + Clear-Cookie
```

> ℹ️ Diagram predpokladá **BFF ako broker** — odporúčaná architektúra (Architecture
> agent rozhodne definitívne). Bez BFF musí prehliadač držať `X-AccessKey`
> priamo (riziko XSS). Detail v `gaps.md`.

## 4. Tabuľka kľúčových auth endpointov

| Metóda | Cesta | Auth (vstup) | Vrstva | Účel |
|---|---|---|---|---|
| POST | `/caisd-rest/rest_access` | `Authorization: Basic` *alebo* `X-BOPSID` *alebo* `X-ExtAuthArtifact` + `X-UserName` | REST | Vydaj Access Key |
| GET  | `/caisd-rest/rest_access/{id}` | `X-AccessKey` | REST | Read access info (bez secret_key) |
| DELETE | `/caisd-rest/rest_access/{id}` | `X-AccessKey` | REST | Logout / invalidate key |
| POST | `/caisd-rest/bopsid` | `X-AccessKey` (alebo prázdny request po prihlásení) | REST | Vydaj single-use BOPSID pre SSO bridge |
| POST | `/api/getAccess` | `Authorization: Basic` | BUI | Vydaj X-AccessToken pre Service Point |
| GET | `/bui/getEEMAuth` | `X-AccessToken` | BUI | Získaj EEM artifact |
| GET | `/bui/getBopSID` | `X-AccessToken` | BUI | BOPSID z BUI vrstvy |

## 5. Roly a oprávnenia

- Každý kontakt má v CA SDM **Access Type** s lookup poľom **REST Web Service
  API Role**. Bez vyplneného poľa REST API vráti `401 Unauthorized` aj pre
  validné Basic credentials. (PDF s. 3447)
- Default role sa použije, ak klient neposielá `X-Role`.
- **Function Access** kontroluje, čo môže rola robiť per objekt
  (READ/UPDATE/CREATE/DELETE). Pri zlyhaní vráti REST `401`, nie `403`
  (semaforika je flat — všetky failed authoriz vyústia v `401`). To si treba
  dať pozor pri klient-error handlingu.
- **Tenancy**: ak je multi-tenancy zapnutá, požiadavky vidia iba
  záznamy s tenantom v rolách používateľa. Detail v `multi-tenancy.md`.

## 6. Bezpečnostné poznámky pre nový FE

| Riziko | Mitigácia |
|---|---|
| Access Key je dlhožijúci shared-secret v request paramteri | **BFF musí držať Access Key v session-side store**, FE dostane len HttpOnly session cookie. Žiadny `X-AccessKey` v browseri. |
| Basic Auth credentials cez sieť | Vždy HTTPS. Možno zakázať Basic globálne (`NX_REST_WEBSERVICE_DISABLE_BASIC_AUTH=Yes`). |
| Secret Key flow vyžaduje HMAC v JS | Nie je vhodný pre browser. Použiť BFF ako podpisovača. |
| Logout pri zatvorení tabu | BFF musí mať periodický cleanup expired keys. CA SDM neposkytuje natívny "session keep-alive" endpoint (mimo iného volania). |

> ⚠️ **Heartbeat**: CA SDM neexponuje endpoint typu `GET /heartbeat` —
> "živosť" sessiony sa zachová akýmkoľvek volaním pred `expiration_date`.
> BFF si overí, či musí key obnoviť, pred PR/CR call-om. Detail
> `expiration_date`-handling v `endpoints.md` § `rest_access`.

## Otvorené závislosti

| # | Flag | Smer | Popis |
|---|---|---|---|
| 1 | `bff-decision` | → 04-architecture | Auth flow predpokladá BFF, ktorý drží `X-AccessKey`. Ak Architecture rozhodne inak, treba prerobiť client-side handling secrets. |
| 2 | `idp-strategy` | → 05-security | Ak IdP (SAML/OIDC) bude pred CA SDM, treba zladiť BOPSID/EEM Artifact flow s mapovaním identít. Otvorené, kým Security nepublikuje threat model. |
| 3 | `tenant-list-source` | → 04-architecture, 05-security | Endpoint na zoznam tenantov používateľa (`GET /caisd-rest/cnt/{id}/cnt_role`?) nie je v PDF priamo dokumentovaný — nutné odvodiť z Domain Modellera (`cnt_role` + `tenant_group_member`). |
| 4 | `secret-key-flow-need` | → 05-security | Či vôbec chceme používať Secret Key (HMAC) flow nad rámec Basic + Access Key. Závisí od threat modelu — Basic over HTTPS môže byť dostatočné. |
