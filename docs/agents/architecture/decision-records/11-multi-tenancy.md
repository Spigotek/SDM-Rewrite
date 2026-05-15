# ADR-11 — Multi-tenancy stratégia

**Status**: accepted
**Dátum**: 2026-05-15
**Autor**: 04-architecture agent (runId 20260508-192438, round 1)

## Kontext

GOAL §5 + §11: multi-tenancy je **povinná**. Riešiteľ vidí len tenantov,
v ktorých má rolu, a môže sa medzi nimi prepínať. Per-tenant izolácia
v UI aj v API volaniach.

Vstupy:
- **api-analyst** (`multi-tenancy.md`): CA SDM **nemá natívny `X-Tenant`
  header** — tenant scope sa odvodzuje z aktívnej roly (`X-Role` header)
  alebo z user-vej `cnt.tenant`. CA SDM nemá dedikovaný "moje tenanty"
  endpoint — BFF musí agregovať z 3+ volaní.
- **domain** (`entities.md`): každá business entita má `tenantId` invariant.
  Tenant switch flow vyžaduje cache flush.
- **UX** (`risks.md` R-006, R-007): tenant prepnutie pri otvorenom
  formulári / ticket detaile, tenant context strata pri SSO session expiry.
- **UX** (`personas.md` `agent_l1_anna`): "veľký a farebný" tenant indicator,
  visual fail-safe proti cross-tenant odpovedi.

Kandidáti propagácie tenant kontextu z FE → BFF:
1. URL prefix (`/t/<tenantSlug>/queue`).
2. Subdoména (`acme-hq.workspace.example.com`).
3. Cookie (server-managed v BFF session).
4. HTTP header (`X-Tenant: <id>` per request).
5. Path query (`?tenant=...`).

## Rozhodnutie

**Server-side aktívny tenant v BFF session + HTTP header `X-Tenant` v API
volaniach z FE.**

Mechanika:
1. **Po login**: BFF zoberie `User.defaultTenantId` (z `UiUserProfile`).
   Uloží do session ako `activeTenantId`.
2. **FE bootstrap**: `GET /me` vráti `{ user, tenants, activeTenantId }`.
   FE uloží do `TenantContext`.
3. **Per request**: `@sdm/api-client` v FE injektuje `X-Tenant: <activeTenantId>`
   header. BFF re-validuje (`activeTenantId === session.activeTenantId`),
   defenzívne — header je informačný, autorita je v session.
4. **BFF → CA SDM**: BFF pridá `X-Role: <roleIdScopedToTenant>` (vybraná
   z `cnt_role` matching tenant) + defenzívne `WC=tenant%3DU'<id>'` filter
   v query stringu (per `multi-tenancy.md` §3.3).
5. **Tenant switch**: `POST /me/active-tenant { tenantId }` na BFF.
   - BFF aktualizuje session.
   - FE: `queryClient.cancelQueries()` + `queryClient.clear()` (TanStack
     Query cache flush).
   - FE: presmeruje na app root (`/`) ak aktuálny route je entity-scoped
     (entita patrí starému tenantu).
   - FE: toast "Prepol si tenant na X".
6. **Confirm dialog pri "dirty" state** (R-006): ak je v `apps/*/src/...`
   otvorený formulár s nezapísanými zmenami (react-hook-form `isDirty`)
   → pred switch confirm prompt.
7. **SSO session expiry recovery** (R-007): po re-login BFF obnoví
   `activeTenantId` zo session storage (Redis/in-memory ho prežije, ak
   session má extended persistence) **alebo** z `User.defaultTenantId`
   fallback. Toast "Tenant prepnutý na default po obnove sessiony" ak
   sa zmenil.

**NEpoužívame URL prefix ani subdoménu.** Dôvody nižšie.

## Dôsledky

**Pozitívne**:
1. **URL stabilita** — `/tickets/INC-1042` je deep-linkovateľný **per user
   session** (otvoriť v rovnakom tenante). Po tenant switch sa URL nemení,
   ale data flush spôsobí navigate-fallback.
2. **Žiadny subdomain ceremony** — DNS, SSL cert per tenant, CORS conf.
3. **Server-side authority** — BFF session je single source of truth.
   FE-side `X-Tenant` header je defenzívny / audit-friendly, ale autoritu má
   server. Privilege escalation nemožné cez header tampering.
4. **Defenzívny WC filter na CA SDM volaniach** — aj keď CA SDM má `X-Role`
   scope, redundant filter chráni pred konfiguračnými chybami v CA SDM
   roles.
5. **Tenant switcher UX** — UX/`personas.md` Anna scenár "veľký a farebný
   indicator" je realizovateľný. Switch je deklaratívny: jeden POST + cache
   flush.
6. **Audit logging** — každý BFF log riadok obsahuje `tenantId`, audit trail
   per tenant je natívne dostupný.

**Negatívne**:
1. **Žiadny tenant v URL = horšie share-able links pri cross-tenant share**
   (kolega v inom tenante klikne na link, BFF mu vráti 404 / TENANT_FORBIDDEN).
   Mitigácia: error UI ponúkne "Prepnúť do tenantu kde existuje" akciu
   ak ten istý user má rolu v target tenantu.
2. **Two-tab pattern lock** — ak user otvorí workspace v dvoch taboch a
   v jednom prepne tenant, druhý tab má stale tenant kontext v JS pamäti
   (X-Tenant header), ale BFF má novú hodnotu v session. BFF musí
   detektovať mismatch a vrátiť `TENANT_FORBIDDEN` (s `correctTenantId`
   field), FE auto-reload do správneho tenantu. Detail v `data-flows.md`.
3. **Dirty form switch UX friction** — confirm dialog je trochu viac kliknutí.
   Acceptable, je to UX safety net.

## Alternatívy

### A) URL prefix (`/t/<tenantSlug>/queue`)

**Plus**: každý URL je tenant-explicit, ľahší share, history per tenant.
**Mínus**:
- Každú route musíme vyrobiť tenant-aware (`useParams().tenantSlug`).
- Tenant switch znamená URL rewrite všetkých open tabov — alebo prinútime
  navigate s tenant prefix-om.
- Slug → tenantId mapping je extra koľaj (CA SDM nemá tenant slug, len UUID).
- Compatibility so `data-flows.md` § Tenant switch je horšia (URL je
  imperatívny, my chceme deklaratívny BFF session).
- UX agent risk R-006/R-007 sa rieši rovnako (cache flush stále potrebný).

### B) Subdoména (`acme-hq.workspace.example.com`)

**Plus**: každý tenant má vlastnú origin → cookies sú prirodzene izolované.
**Mínus**:
- DNS / SSL operations overhead — wildcard certifikát alebo per-tenant
  certifikát.
- CORS / X-Frame-Options config per subdomain.
- Tenant switch = full page reload do inej subdomény → strata in-memory
  state.
- Tenant slug v URL again (rovnaké problémy ako A).

### C) Cookie-only (žiadny FE-side `X-Tenant` header)

**Plus**: jeden source (session cookie), žiadny defenzívny mapping.
**Mínus**:
- Žiadny audit-friendly header v BFF logoch (musíme parsovať session
  payload — overhead).
- Two-tab pattern (`B-2` výše) je horšie debug-ovateľný — bez header-a
  FE nevie, ktorý tenant je aktívny okrem BFF roundtrip.
- Defense-in-depth — header je deklaratívna intencia FE; session je autorita;
  mismatch je auditable event.

### D) Tenant v session **iba**, žiadne defense-in-depth

**Plus**: jednoduchšia BFF logika.
**Mínus**:
- Privilege escalation cez `X-Role` exclusive (multi-tenancy.md §6) možná,
  ak by CA SDM rola mala širší scope ako očakávame.

## Otvorené závislosti

| # | Flag | Smer | Popis |
|---|---|---|---|
| 1 | `service-provider-multi-view` | → 02-ux-persona, 04-architecture (post-MVP) | Service Provider tenant vidí 100+ managed tenantov. UI flow (search v switcher, pinned) — UX agent v post-MVP. V MVP scope predpoklad: < 10 tenantov per user. |
| 2 | `tenant-impersonation` | → 05-security | SOAP `impersonate` flow (gap #15) — post-MVP. Architecture neodporúča v MVP. |
| 3 | `cross-tenant-view-role` | → 01-api-analyst, 05-security | "Global compliance officer" rola — gap #3, UX risk R-003. Závisí od existencie v CA SDM. |
| 4 | `two-tab-tenant-conflict` | → 09-qa | Test scenár — open 2 tabs, switch v jednom, verify automatic reload v druhom. QA strategy. |
| 5 | `tenant-switch-perf` | → 09-qa, 04-architecture | Cache flush + first refetch < 800 ms goal. Meraný v workspace render. |
| 6 | `bff-session-persistence` | → 08-devex-devops | In-memory MVP / Redis v1 — vplyv na SSO recovery (R-007). |
