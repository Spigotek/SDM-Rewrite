# Data flows — kľúčové scenáre

> Sekvenčné diagramy pre kritické end-to-end flows. Pomáha Security agentovi
> overiť threat model, QA agentovi naplánovať integračné testy a 10
> Documentation Author napísať per-module specs.

## Changelog (round 2)

- Tenant header v sequence diagrame § 2 (Tenant switch) zharmonizovaný na
  **`X-CA-SDM-Tenant`** (zhoda s ADR-11 r2 update + 08 `runtime-config.md`).
  Sémantika diagramov nezmenená.

## 1. Login flow (SSO)

```mermaid
sequenceDiagram
    autonumber
    participant U as Browser
    participant SPA as Portal / Workspace SPA
    participant BFF as BFF
    participant IdP as Corp IdP (SAML / OIDC)
    participant SDM as CA SDM REST

    U->>SPA: GET / (static index.html)
    SPA->>BFF: GET /config
    BFF-->>SPA: { apiBaseUrl, features, i18n, ... }
    SPA->>BFF: GET /me
    BFF-->>SPA: 401 (no session)
    SPA->>SPA: redirect to /login
    SPA->>BFF: GET /auth/login
    BFF->>IdP: 302 redirect (SAML AuthnRequest / OIDC authorize)
    IdP->>U: login page
    U->>IdP: credentials + MFA
    IdP->>BFF: 302 callback with SAMLResponse / OIDC code
    BFF->>BFF: validate signature, verify issuer/audience
    BFF->>SDM: POST /caisd-rest/rest_access (Basic Auth from IdP-mapped creds)
    SDM-->>BFF: 201 { access_key, expiration_date }
    BFF->>BFF: create session { userId, accessKey, activeTenantId = defaultTenant }
    BFF-->>U: 302 to / + Set-Cookie sessionId (HttpOnly, Secure, SameSite=Lax)
    U->>SPA: GET / (with session cookie)
    SPA->>BFF: GET /me
    BFF-->>SPA: { user, tenants, activeTenantId, preferences }
    SPA->>SPA: render shell + initial route
```

**Edge cases**:
- **IdP login fail**: BFF dostane error v callback → redirect SPA do
  `/login?error=auth_failed` s human-friendly message.
- **CA SDM `rest_access` zlyhá**: BFF vráti 502 do FE, SPA ukáže
  "Backend nedostupný — skús neskôr".
- **No CA SDM role mapping**: user existuje v IdP, ale CA SDM ho nepozná →
  BFF mapuje na `AUTH_FORBIDDEN` s message "Tvoj účet nemá oprávnenie".

## 2. Tenant switch flow

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant SPA as Workspace SPA
    participant QC as TanStack QueryClient
    participant BFF as BFF
    participant SDM as CA SDM REST

    Note over U,SPA: aktuálny tenant: T1
    U->>SPA: klik tenant switcher → vyberie T2

    alt aktuálny formulár je dirty
        SPA->>U: confirm dialog "Máš nezapísané zmeny. Prepnúť aj tak?"
        U->>SPA: confirm
    end

    SPA->>QC: cancelQueries() — zruš in-flight requests
    SPA->>BFF: POST /me/active-tenant { tenantId: T2 }
    BFF->>BFF: session.activeTenantId = T2
    BFF->>BFF: select X-Role from cnt_role matching T2
    BFF-->>SPA: 200 { activeTenantId: T2, role: {...} }
    SPA->>QC: clear() — flush whole cache (T1 stale)
    SPA->>SPA: update TenantContext

    alt aktuálny route je entity-scoped (e.g. /tickets/INC-1042)
        SPA->>SPA: navigate("/") — entity patrí T1
    else aktuálny route je list / dashboard
        SPA->>SPA: refetch current page queries
    end

    SPA->>BFF: GET /api/queue (X-CA-SDM-Tenant: T2)
    BFF->>SDM: GET /caisd-rest/in (X-AccessKey, X-Role-for-T2, WC tenant=T2)
    SDM-->>BFF: data
    BFF-->>SPA: UiQueueItem[]
    SPA->>U: toast "Prepol si tenant na T2 (Acme East)"
```

**Two-tab race condition**:
- Tab A má T1, Tab B má T1. User v Tab A switchne na T2.
- Tab B robí ďalší request s `X-CA-SDM-Tenant: T1` v hlavičke, ale BFF session má T2.
- BFF detekuje mismatch → vráti `TENANT_FORBIDDEN` s `{ correctTenantId: T2 }`.
- `@sdm/api-client` zachytí, FE auto-refresh Tab B do T2 a toast "Tenant
  bol prepnutý v inom okne".

## 3. Ticket create — incident (Lucia portal)

```mermaid
sequenceDiagram
    autonumber
    participant L as Lucia (Portal)
    participant SPA as Portal SPA
    participant Form as react-hook-form
    participant QC as TanStack QueryClient
    participant BFF as BFF
    participant SDM as CA SDM REST

    L->>SPA: navigate /new-incident
    SPA->>BFF: GET /api/reference/categories?type=incident (cached 15 min)
    BFF-->>SPA: pcat list
    SPA->>SPA: render form
    L->>Form: vyplní summary, popis, kategória, priorita
    L->>Form: attach screenshot (Drag-drop)
    Form->>BFF: POST /api/attachments (multipart, file)
    BFF->>SDM: POST /caisd-rest/attmnt (multipart)
    SDM-->>BFF: 201 attmnt
    BFF-->>Form: { attachmentId }
    L->>Form: submit
    Form->>SPA: validated payload
    SPA->>BFF: POST /api/tickets/incident { summary, category, priority, ... }
    BFF->>SDM: POST /caisd-rest/in (with tenant + role injection)
    SDM-->>BFF: 201 { ref_num: "INC-1042", persid: "cr:..." }
    BFF->>SDM: PUT /caisd-rest/in/.../attachments — link attachment (if not done in create)
    BFF-->>SPA: { id, ref: "INC-1042", status: "OP", ... }
    SPA->>QC: invalidateQueries(['my-tickets'])
    SPA->>SPA: navigate /tickets/INC-1042
    SPA->>SPA: toast "Ticket vytvorený: INC-1042"
```

**Edge cases**:
- **Attachment > 25 MB**: BFF vráti 413 → FE inline error "Maximum 25 MB"
  + zachová form state (no redirect).
- **Validation fail**: BFF vráti `VALIDATION` AppError s `fieldErrors`
  → react-hook-form set per-field errors.
- **CA SDM 401 (key expired)**: BFF silent refresh `rest_access`, retry once;
  ak znova fail → `AUTH_EXPIRED` → SPA redirect /login (zachová form draft
  v localStorage cez `@sdm/auth.preferences`).

## 4. Queue load (Anna workspace)

```mermaid
sequenceDiagram
    autonumber
    participant A as Anna
    participant SPA as Workspace SPA
    participant QC as TanStack QueryClient
    participant BFF as BFF
    participant SDM as CA SDM REST

    A->>SPA: navigate /queue
    SPA->>QC: useQuery(['queue', filters])
    QC->>QC: cache miss
    QC->>BFF: GET /api/queue?filters=...
    BFF->>BFF: queue aggregator handler
    par fan-out
        BFF->>SDM: GET /caisd-rest/in?WC=...&X-Obj-Attrs=...
    and
        BFF->>SDM: GET /caisd-rest/cr?WC=type=R AND ...
    and
        BFF->>SDM: GET /caisd-rest/pr?WC=...
    end
    BFF->>BFF: merge, denormalize contacts/groups (cached lookups), compute SLA badge
    BFF-->>QC: UiQueueItem[]
    QC->>SPA: data
    SPA->>A: render table (28-32px rows)
    Note over SPA,A: 30s TTL — auto refetch
    SPA->>QC: refetch on focus / interval
    A->>SPA: stlačí "j" → next row, "Enter" → open ticket
    SPA->>SPA: navigate /tickets/:id
```

## 5. Ticket detail view (Anna workspace W-02)

```mermaid
sequenceDiagram
    autonumber
    participant A as Anna
    participant SPA as Workspace SPA
    participant QC as TanStack QueryClient
    participant BFF as BFF
    participant SDM as CA SDM REST

    A->>SPA: open /tickets/INC-1042
    SPA->>QC: useQuery(['ticket', 'incident', 'INC-1042'])
    QC->>BFF: GET /api/tickets/incident/INC-1042
    BFF->>BFF: ticket-detail aggregator handler
    par fan-out
        BFF->>SDM: GET /caisd-rest/in/<id> + sub-resources
    and
        BFF->>SDM: GET /caisd-rest/cnt/<assignee>
    and
        BFF->>SDM: GET /caisd-rest/cnt/<requester>
    and
        BFF->>SDM: GET /caisd-rest/nr/<affectedCi>
    and
        BFF->>SDM: GET /caisd-rest/in/<id>/act_log (page 1)
    and
        BFF->>SDM: GET /caisd-rest/in/<id>/attachments
    end
    BFF->>BFF: assemble UiTicketDetail<Incident>
    BFF-->>QC: data
    QC->>SPA: data
    SPA->>A: render 3-pane layout

    A->>SPA: stlačí "r", composer open
    A->>SPA: napíše KB link reply
    A->>SPA: stlačí "c" (close + KB)
    SPA->>QC: useMutation closeTicket
    QC->>QC: optimistic update (status = "CL")
    SPA->>A: ticket fade-out v queue
    QC->>BFF: POST /api/tickets/incident/INC-1042/close
    BFF->>SDM: PUT /caisd-rest/in/<id> (status=CL, resolution_code=KB)
    BFF->>SDM: POST /caisd-rest/in/<id>/act_log (closure note)
    SDM-->>BFF: 200
    BFF-->>QC: success
    QC->>QC: invalidateQueries(['queue', ...])
```

## 6. Service Catalog request submit (Lucia portal)

```mermaid
sequenceDiagram
    autonumber
    participant L as Lucia
    participant SPA as Portal SPA
    participant BFF as BFF
    participant SDM as CA SDM
    participant SC as Service Catalog (CA SDM BUI / iné)

    L->>SPA: navigate /catalog
    SPA->>BFF: GET /api/catalog/offerings (paginated)
    BFF->>SC: GET /getOfferings (BUI vrstva, X-AccessToken)
    SC-->>BFF: offerings summary
    BFF-->>SPA: catalog items
    L->>SPA: hľadá "figma", klikne Figma Pro
    SPA->>BFF: GET /api/catalog/items/<id>
    BFF->>SC: GET /getOffering(id) — z service catalog detail endpoint
    BFF->>BFF: normalize → DynamicFormSchema (ADR-06)
    BFF-->>SPA: DynamicFormSchema
    SPA->>SPA: render JsonSchemaForm
    L->>SPA: vyplní formulár (3 polia: projekt, trvanie, justification)
    L->>SPA: submit
    SPA->>BFF: POST /api/tickets/request { catalogItemId, formData }
    BFF->>BFF: re-validate formData against schema
    BFF->>SDM: POST /caisd-rest/cr (with category=catalog item, formData → CA SDM custom attrs)
    SDM-->>BFF: 201 { ref_num: "REQ-308" }
    BFF-->>SPA: { id, ref, status: "Pending Approval" }
    SPA->>SPA: navigate /tickets/REQ-308
```

## 7. Tenant resolution — `/me/tenants` aggregate

```mermaid
sequenceDiagram
    autonumber
    participant SPA as SPA (bootstrap)
    participant BFF as BFF (Aggregator)
    participant SDM as CA SDM REST

    SPA->>BFF: GET /me/tenants
    BFF->>BFF: check cache (5 min TTL)
    alt cache miss
        BFF->>SDM: GET /caisd-rest/cnt/<userUuid>?X-Obj-Attrs=tenant,roles
        SDM-->>BFF: { tenant, roles[] }
        BFF->>SDM: GET /caisd-rest/cnt_role?WC=contact=U'...'
        SDM-->>BFF: cnt_role[]
        par
            BFF->>SDM: GET /caisd-rest/role/<roleId>?X-Obj-Attrs=tenant,name
        and (foreach role)
            BFF->>SDM: ...
        end
        SDM-->>BFF: role details with tenant SREL
        BFF->>SDM: GET /caisd-rest/tenant_group_member?WC=tenant_id=U'...'
        SDM-->>BFF: tenant group memberships
        BFF->>BFF: dedup, resolve groups, mark service provider
        BFF->>BFF: cache for 5 min
    end
    BFF-->>SPA: { tenants: TenantInfo[], defaultTenantId, activeTenantId }
```

Detail flow je v api-analyst/`multi-tenancy.md` §3.1.

## 8. Logout

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant SPA as SPA
    participant QC as QueryClient
    participant BFF as BFF
    participant SDM as CA SDM REST
    participant IdP as IdP

    U->>SPA: klik "Odhlásiť sa"
    SPA->>QC: clear() — flush cache
    SPA->>BFF: POST /auth/logout
    BFF->>SDM: DELETE /caisd-rest/rest_access/<id>
    SDM-->>BFF: 204
    BFF->>BFF: destroy session
    alt IdP single logout
        BFF->>IdP: SLO request (SAML / OIDC)
        IdP-->>BFF: 200
    end
    BFF-->>SPA: Set-Cookie sessionId=; Max-Age=0
    SPA->>SPA: navigate /login
```

## 9. Mobile emergency approve (Peter — W-03 mobile)

```mermaid
sequenceDiagram
    autonumber
    participant P as Peter (mobile)
    participant SPA as Workspace SPA (mobile viewport)
    participant BFF as BFF
    participant IdP as IdP (2FA challenge)
    participant SDM as CA SDM

    P->>SPA: open deeplink /changes/CHG-503/mobile-approve
    SPA->>BFF: GET /me (existing session?)
    alt session valid
        BFF-->>SPA: user + tenant
    else session expired
        SPA->>BFF: GET /auth/login (SSO re-auth)
        BFF->>IdP: 302
        P->>IdP: complete 2FA
        IdP->>BFF: callback
        BFF-->>SPA: 302 to /changes/CHG-503/mobile-approve
    end
    SPA->>BFF: GET /api/tickets/change/CHG-503
    BFF-->>SPA: UiTicketDetail<Change>
    P->>SPA: read impact, rollback plan
    P->>SPA: klik "Approve"

    Note over SPA,BFF: step-up auth pre approve (Security agent)
    SPA->>BFF: POST /auth/step-up { context: "approve-change" }
    BFF->>IdP: AMR challenge
    IdP->>P: 2FA prompt
    P->>IdP: confirm
    BFF-->>SPA: step-up confirmed token

    SPA->>BFF: POST /api/changes/CHG-503/approve { stepUpToken }
    BFF->>SDM: PUT /caisd-rest/wf/<id> status=Approved
    SDM-->>BFF: 200
    BFF-->>SPA: confirm
```

Detail step-up auth vlastní Security agent (05).

## Otvorené závislosti

| # | Flag | Smer | Popis | Status |
|---|---|---|---|---|
| 1 | `step-up-auth-flow` | → 05-security | Detail step-up flow pre approve / sensitive actions. | open (post-MVP — A-113) |
| 2 | `service-catalog-detail-endpoint` | → 01-api-analyst | gap #3. | open (inherent API gap) |
| 3 | `attachment-link-flow` | → 01-api-analyst | Pre-attach + link-after-create vs. kombinovaný multipart. | open (operatívne — BFF voľba per scenár) |
| 4 | `single-logout-spec` | → 05-security | SLO flow. | open (post-MVP) |
| 5 | `optimistic-update-list` | → 09-qa | Per-mutation policy. 09 v r1 doručil 18 acceptance criteria. | `[resolved-in-round-2]` (na úrovni stratégie); per-mutation matrix v 09 dev handbook. |
