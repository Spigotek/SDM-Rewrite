# Threat model — STRIDE per container

## Changelog (round 2)

- **Zarovnanie 1:1 na 04 container set** (per `docs/agents/architecture/architecture.md` §3.1 + `components/{bff,portal,workspace}.md`).
- BFF rozbitý z monolitnej C6 na **tri sub-containers** (Auth module, API module, Aggregator module) podľa 04 `components/bff.md` §2. Každý má vlastnú STRIDE tabuľku.
- Pridaná samostatná STRIDE tabuľka pre **Session Store** (in-memory / Redis) a **Runtime Config endpoint** — tieto boli 04 publikované ako prvotriedne containers.
- Cross-link na konkrétne 04 súbory pridaný do hlavičky každej STRIDE sekcie.
- Mock backend (C9) zachovaný — 08 `runtime-config.md` ho hostuje cez MSW dev-only.
- Risk register (§ 12) prečíslovaný — pridané R11 (Aggregator fan-out poisoning), R12 (Session Store leakage), R13 (Runtime config tampering).

> Cieľ: STRIDE-based threat model pre konkrétny container set z 04 `architecture.md` §3.1
> a 04 `components/{bff,portal,workspace}.md`.
>
> Vstupy: GOAL.md §4/§8/§9, `docs/agents/api-analyst/auth.md`,
> `docs/agents/api-analyst/multi-tenancy.md`,
> `docs/agents/architecture/architecture.md`,
> `docs/agents/architecture/components/bff.md`,
> `docs/agents/architecture/components/portal.md`,
> `docs/agents/architecture/components/workspace.md`,
> `docs/agents/architecture/decision-records/01-bff.md`,
> `docs/agents/architecture/decision-records/11-multi-tenancy.md`,
> `auth-flow.md`, `rbac.md`, `multi-tenancy-security.md`.

## 0. Containers v scope (zarovnané na 04 architecture)

| # | Container | Zdroj v 04 | Kde žije | Trust boundary |
|---|---|---|---|---|
| C1 | **Portal SPA** | `architecture.md` §3.1, `components/portal.md` | browser, `portal.<org>` | klient — non-trusted |
| C2 | **Workspace SPA** | `architecture.md` §3.1, `components/workspace.md` | browser, `workspace.<org>` | klient — non-trusted |
| C3 | **`@sdm/auth` package** | `architecture.md` §3.2 (`@sdm/auth`) | bundled v oboch SPA | bundled with SPA, non-trusted |
| C4 | **`@sdm/api-client` package** | `architecture.md` §3.2 (`@sdm/api-client`) | bundled v oboch SPA | bundled with SPA, non-trusted |
| C5 | **`@sdm/design-system` package** | `architecture.md` §3.2 (`@sdm/design-system`) | bundled v oboch SPA | bundled, non-trusted (renders UGC) |
| C6a | **BFF :: Auth module** | `components/bff.md` §2.2 (SSO handler + Session manager + Key broker) | server-side, BFF process | semi-trusted (DMZ) |
| C6b | **BFF :: API module** | `components/bff.md` §2.3 (REST proxy + SOAP adapter + Error shaper) | server-side, BFF process | semi-trusted (DMZ) |
| C6c | **BFF :: Aggregator module** | `components/bff.md` §2.4 (`/me/tenants`, queue, ticket-detail handlers) | server-side, BFF process | semi-trusted (DMZ) |
| C6d | **Session Store** | `architecture.md` §3.1 (`Session store — in-memory / Redis`) + `components/bff.md` §2.2 | server-side, BFF-internal (in-memory MVP) alebo Redis (post-MVP) | trusted-internal |
| C6e | **Runtime config endpoint `/config`** | `architecture.md` §3.1 + ADR-12 | server-side, BFF Platform module (`components/bff.md` §2.5) | semi-trusted (DMZ, public read) |
| C7 | **IdP** (corp Azure AD / Keycloak / iné) | `architecture.md` §2 (Externé systémy) | externý / on-prem | trusted boundary |
| C8 | **CA SDM 17.4 REST + SOAP** | `architecture.md` §2 + `components/bff.md` §3 | on-prem | trusted boundary |
| C9 | **Mock backend (MSW)** | 08 `runtime-config.md` (auth.mode=mock + MSW handlers) | dev-only, browser-side | dev-only, mimo prod threat model |

> Mapovanie r1 → r2: r1 mal monolitný C6 "BFF / API Gateway" — r2 ho rozbije na
> C6a/b/c (per 04 dekompozícia) a pridáva C6d (Session Store) + C6e (Runtime config).
> Pôvodná C6 STRIDE tabuľka (`§6` v r1) je v r2 rozdelená medzi tieto sub-tabuľky.

### Data flow diagram (high-level, zarovnaný na 04 §3)

```mermaid
flowchart LR
    U[End user] -->|HTTPS| C1[Portal SPA]
    U -->|HTTPS| C2[Workspace SPA]
    C1 -. bundled .-> C3[@sdm/auth]
    C1 -. bundled .-> C4[@sdm/api-client]
    C1 -. bundled .-> C5[@sdm/design-system]
    C2 -. bundled .-> C3
    C2 -. bundled .-> C4
    C2 -. bundled .-> C5
    C1 -->|GET /config| C6e[BFF :: /config]
    C2 -->|GET /config| C6e
    C3 -->|OIDC redirect| C7[IdP]
    C7 -->|callback| C6a[BFF :: Auth]
    C4 -->|fetch + cookie + X-Tenant| C6b[BFF :: API]
    C4 -->|fetch + cookie + X-Tenant| C6c[BFF :: Aggregator]
    C6a -. session lifecycle .-> C6d[(Session Store)]
    C6b -. session lookup .-> C6d
    C6c -. session lookup .-> C6d
    C6a -->|X-AccessKey| C8[CA SDM REST/SOAP]
    C6b -->|X-AccessKey + X-Role| C8
    C6c -->|X-AccessKey + X-Role<br/>fan-out| C8
    C6a -. audit log .-> A[(Audit log sink)]
    C6b -. audit log .-> A
    C6c -. audit log .-> A
```

## 1. STRIDE — Portal SPA (C1)

> Zdroj: `docs/agents/architecture/components/portal.md` § 1–2.
> Persona: `requester_lucia` (a `requester_external` subset).

| Kategória | Threat | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| **S**poofing | XSS-injected JS impersonuje user akcie | Med | High | CSP `script-src 'self' 'nonce-<n>'`; striktné sanitization KB markdown; HttpOnly cookies → script nemá prístup k session |
| | Clickjacking — iframe overlay | Med | Med | `X-Frame-Options: DENY` + `frame-ancestors 'none'` v CSP |
| **T**ampering | Modify form data v devtools pred submit | High | Med | Server-side validation v BFF; client-side validation len UX |
| | Modify URL param `tenant=X` | High | Med | BFF ignoruje request input pre auth — `activeTenantId` len zo session (viď `multi-tenancy-security.md` L1) |
| **R**epudiation | User popiera, že ticket otvoril on | Low | Med | Audit log na BFF s `actor.userId` + ip + ua; CA SDM `audlog` je dôveryhodný |
| **I**nformation disclosure | Console.log leakuje PII pri error | High | Low | Production build odstráni `console.*`; Sentry beforeSend scrub |
| | Source map prístupný v prod | Med | Med | Source maps len pre Sentry upload, nie deployed |
| | LocalStorage / SessionStorage obsahuje user data | High | Med | Policy: žiadne tokeny / PII v Web Storage. Lint pravidlo zakazujúce `localStorage.setItem("auth...")`/`"user..."` patterns |
| **D**oS | Bundle size DoS na mobile (3G) | Med | Low | Bundle size budget 200 KB initial pre portal; code-split per route; lazy load Service Catalog renderer |
| | Memory leak v React Query cache | Low | Low | Cache TTL 5 min; `queryClient.clear()` pri logout |
| **E**levation of privilege | Klient-side route guard sa obíde priamou URL navigáciou | High | High | UI route guards sú UX only. **Vždy** server-side BFF guard. Akýkoľvek 200 na unauthorized route je security bug. |

## 2. STRIDE — Workspace SPA (C2)

> Zdroj: `docs/agents/architecture/components/workspace.md` § 1–3.
> Persony: `agent_l1_anna`, `agent_l2_marek`, `change_manager_peter`,
> `kb_editor_jana`, `cmdb_owner_robert` (a `sp_admin`).

| Kategória | Threat | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| **S**poofing | Phishing site mimikuje workspace.<org> | Med | High | Vyžadovaný `__Host-` cookie prefix viaže cookie na presnú doménu; HSTS preload; user education |
| | Stolen session cookie cez network sniff | Low | High | HTTPS only; `Secure` cookie flag; HSTS `max-age=63072000; includeSubDomains; preload` |
| **T**ampering | Force-edit JSON in API client interceptor | Med | Med | BFF re-validates everything; client-side mutation hooks nie sú trust boundary |
| | Modify CMDB graph node IDs in browser | Med | High | BFF API guard pre `ci.update` (mimo MVP); CSRF token na all mutations |
| **R**epudiation | Agent zatvoril ticket, ale nehlási sa k tomu | Low | Med | Audit log per close action; CA SDM `audlog` má immutable trail |
| **I**nformation disclosure | DevTools network tab vidí cudzí-tenant data | High | High | Server-side tenant filter (viď `multi-tenancy-security.md` §3); per-request `X-Response-Tenant` header validation |
| | Search autocomplete leakuje názvy z cudzieho tenantu | Med | Med | Server-side scope filter na search endpoint |
| | Error toast obsahuje IDs z internal DB | Med | Med | BFF error normalizer (whitelist polí) |
| **D**oS | Bulk operation > limit | Med | Low | Per-role limit (50 / 200 rows); 429 response z BFF |
| | Long-running export blocks UI | Med | Low | Async export → background job + email; spinner with cancel |
| **E**levation of privilege | Agent L1 vidí Change calendar (read) ale chce schvaľovať | Med | High | Tenant-scoped RBAC enforcement na BFF (viď `rbac.md`); UI nezobrazuje action button |
| | Stale role — agent bol downgradnutý z L2 na L1 ale session ešte živá | High | Med | BFF re-fetch role každých 60 s; `roleChangedAt` v `cnt` triggeruje force re-login |

## 3. STRIDE — `@sdm/auth` package (C3)

> Zdroj: `docs/agents/architecture/architecture.md` §3.2 (`@sdm/auth` —
> login/logout helpers, role guards, session bootstrap pre SPA). FE-side modul,
> bundled v oboch SPA. Server-side auth logika je v C6a (BFF :: Auth module).

| Kategória | Threat | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| **S**poofing | OIDC `state` replay attack | Med | High | State je opaque, single-use, 5-min TTL v BFF cache |
| | ID token theft cez XSS | Low | Critical | ID token nikdy v JS heap (variant A). Variant B: in-memory only, žiadne storage |
| **T**ampering | ID token claim modification | Low | High | JWT signature verification (RS256+); reject `none` algorithm; pinned issuer + audience |
| | Code injection v PKCE flow | Low | High | `code_verifier` cryptographically random ≥43 chars; one-time use |
| **R**epudiation | User popiera prihlásenie | Low | Med | IdP audit log + BFF login event |
| **I**nformation disclosure | Refresh token leakuje cez log/exception | Low | High | Refresh token nikdy v error message; redact pred logging; in IdP refresh-token rotation |
| | Nonce in ID token replay | Low | High | Nonce mismatch → abort + audit event |
| **D**oS | Brute-force `/auth/callback` s random code | Low | Med | Rate limit per IP (10/min); state validation invaliduje bogus calls |
| **E**levation of privilege | Token-issuer downgrade attack (algorithm confusion) | Low | High | JWKS pinning; reject `alg: none`; reject `alg: HS256` ak issuer používa RS256 |
| | Audience confusion — token vydaný pre inú app | Med | High | `aud` claim strict equality check (BFF client_id) |

## 4. STRIDE — `@sdm/api-client` package (C4)

> Zdroj: `docs/agents/architecture/architecture.md` §3.2 (`@sdm/api-client` —
> typed wrapper okolo `fetch`, vkladá session cookie + `X-Tenant` header
> per 04 ADR 11).

| Kategória | Threat | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| **S**poofing | DNS spoofing pre BFF endpoint | Low | High | HTTPS s certificate pinning na BFF API surface (v MVP cez HSTS + CA trust); pre on-prem zvážiť pinning |
| **T**ampering | Modified API response (MITM) | Low | High | HTTPS-only; HSTS; certificate validation strict |
| | Manipulácia request body cez interceptor | High | Med | BFF re-validates; CSRF token per mutating call |
| **R**epudiation | Cliento-only optimistic update bez server confirm | Med | Low | Optimistic updates rollback on error; UI shows "saving..." indicator |
| **I**nformation disclosure | Network error message s endpoint URL leakne v Sentry | Med | Low | Sentry beforeSend redact path query params; group by route template not by ID |
| | Response cache leakuje cudzí-tenant data | High | High | Per-tenant cache key v React Query (`{ tenantId, ...keys }`); `queryClient.clear()` pri switch |
| **D**oS | Retry storm pri 5xx | Med | Med | Exp. backoff (3 retries, jitter); circuit breaker pattern (open after 5 consecutive failures) |
| | Polling explosion (auto-refresh) | Med | Med | Polling interval ≥ 30s per query; visibility API pauznutie pri tab hidden |
| **E**levation of privilege | Forge `X-CSRF-Token` | Low | High | HMAC-validated; secret v BFF env; token rotated pri tenant switch / re-login |

## 5. STRIDE — `@sdm/design-system` package (C5)

> Zdroj: `docs/agents/architecture/architecture.md` §3.2 (`@sdm/design-system`)
> + 07 `library-recommendation.md` (Radix UI primitives, TipTap pre KB editor,
> `react-markdown` pre KB read, DOMPurify pre rich-text sanitization).

> Špecifická pozornosť: Design System renderuje **UGC** (KB články markdown, ticket descriptions, attachment names, chat-style comments).

| Kategória | Threat | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| **S**poofing | Phishing link v KB článku | Med | Med | Markdown link sanitization: `target="_blank" rel="noopener noreferrer"`; URL whitelist? — too restrictive, instead show domain hover |
| **T**ampering | KB article markdown injection | High | High | Markdown parser whitelist mode (no raw HTML, no inline `<script>`, no `javascript:` URIs); CSP backstop |
| **R**epudiation | n/a (no business logic) | – | – | – |
| **I**nformation disclosure | Attachment filename XSS | Med | High | Always render filenames cez safe text node, nikdy `dangerouslySetInnerHTML`; sanitize attribute values |
| | SVG with embedded script | Med | High | SVG attachments rendered ako `<img>` not inline; CSP `img-src` allows blob, but blocks script execution context |
| **D**oS | Markdown s nested 1000-level deep list | Low | Low | Markdown parser depth limit |
| | Image bomb (ZIP/JPEG decompression) | Low | Med | Image size limit cez `<img>` `loading="lazy"` + `decoding="async"`; back-end max-file-size 25 MB |
| **E**levation of privilege | `<form action="cudzia-domena">` v KB markdown vykonal POST | Med | High | Markdown forms zakázané; CSP `form-action 'self' <bff>` |

## 6a. STRIDE — BFF :: Auth module (C6a)

> Zdroj: `docs/agents/architecture/components/bff.md` § 2.2 (SSO callback
> handler + Session manager + CA SDM Access Key broker).

| Kategória | Threat | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| **S**poofing | Forged session cookie | Low | Critical | Cookie value je opaque random ≥256 bits; verifikované server-side proti C6d Session Store |
| | IdP issuer spoofing | Low | Critical | JWKS endpoint pinned; cert pinning na IdP; reject unknown issuer |
| | SSO callback bez state/nonce match | Low | Critical | State (single-use, 5-min TTL) + nonce overené pred token exchange; mismatch = `csrf.violation` audit event |
| **T**ampering | Replay OIDC `code` | Low | High | `code` single-use; IdP-side re-use detection terminuje sessionu |
| | ID-token claim tampering | Low | Critical | JWT signature RS256+; pinned JWKS; reject `alg: none` / `HS256` ak issuer RS256 |
| | Audience confusion | Med | High | `aud` claim strict equality (BFF client_id) |
| **R**epudiation | Login event chýba v audit | Low | Med | Auth module emituje `login.initiated`, `login.callback.success/failure`, `login.completed` per `audit-and-compliance.md` §2.1 |
| **I**nformation disclosure | Refresh token v log/exception | Low | High | Logger redaction (`refresh_token`, `id_token` → `[REDACTED]`) per `audit-and-compliance.md` §4.1 |
| | Bootstrap method leak (EEM artifact v error) | Low | Med | Error shaper (C6b) maskuje internal bootstrap detaily; client dostáva generic + `correlationId` |
| **D**oS | Brute-force `/auth/login` | High | Med | Per-IP rate limit (10/min); per-username (5/min); CAPTCHA after 3 failures |
| | IdP downtime → BFF retry storm | Low | High | Circuit breaker na IdP `/token`; cache `.well-known/openid-configuration` (TTL 1 h) |
| **E**levation of privilege | Token-issuer downgrade (alg confusion) | Low | High | JWKS pinning; reject `alg: none`; reject `alg: HS*` ak issuer používa RS |
| | Bootstrap role-mapping pošle agent_l1 ako sp_admin | Low | Critical | Role mapping je bootstrap-only (first login); CA SDM = source of truth potom; mapping config v BFF env, audit pri zmene |
| | Step-up bypass (sensitive op bez MFA) | Med | High | `session.stepUpAt` re-check per request; missing = 403 + `step_up_required` redirect (viď `multi-tenancy-security.md` §6) |

## 6b. STRIDE — BFF :: API module (C6b)

> Zdroj: `docs/agents/architecture/components/bff.md` § 2.3 (REST proxy + SOAP
> adapter + Error shaper).

| Kategória | Threat | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| **S**poofing | DNS / cert spoofing CA SDM endpoint | Low | Critical | Endpoint URL pinned in BFF env; HTTPS cert validation strict; HSTS na BFF surface |
| | Server-side request forgery (SSRF) z hostname param | Med | Critical | Whitelist of allowed upstream URLs (CA SDM, IdP); block private IP ranges (RFC 1918, 169.254/16, ::1); viď `owasp-mitigations.md` A10 |
| **T**ampering | `X-Tenant` header forgery | High | High | BFF revaliduje `X-Tenant === session.activeTenantId`; mismatch = 409 `TENANT_MISMATCH` per 04 ADR 11; viď `auth-flow.md` §4.3 a `multi-tenancy-security.md` §3 |
| | WC filter injection cez search params | Med | High | Parameterized `WC` builder s whitelist polí; per `owasp-mitigations.md` A03 |
| | Replay attack on signed CSRF token | Low | Med | Token includes timestamp + nonce; expiry 15 min; rotated on tenant switch |
| | XML/JSON injection v ticket payload | Med | Med | BFF normalizes/escapes payload pre rendering; output encoding na SPA |
| **R**epudiation | Mutating call bez audit | Low | Med | Per-mutation audit event (`permission.denied`, `cross_tenant.write`, ...) per `audit-and-compliance.md` §2 |
| **I**nformation disclosure | Stack trace leakuje DB connection string | Med | High | Error shaper: client gets generic + `correlationId`; full trace len v server log (per ADR 09) |
| | CA SDM flat 401 → klient nevie auth vs. forbidden | High | Med | Error shaper rozlišuje `AUTH_EXPIRED` vs. `AUTH_FORBIDDEN` cez timestamp + retry policy |
| | Direct SOAP fallback leakuje shared secret v body | Low | High | SOAP whitelist (no generic passthrough per `components/bff.md` §2.3); same BFF-mediated auth |
| **D**oS | Slowloris attack na long polling | Med | Med | Connection timeout 30 s; max concurrent connections per IP |
| | Memory exhaustion via large payload | Med | Med | `Content-Length` limit (1 MB JSON, 25 MB attachment); JSON parser depth limit |
| | Retry storm pri 5xx z CA SDM | Med | Med | Circuit breaker (open after 5 consecutive failures); exp. backoff |
| **E**levation of privilege | Misconfigured RBAC eval (default-allow) | Med | Critical | Default-deny pattern; explicit `requirePermission(...)` per handler; integration test per role × endpoint (viď `rbac.md` §10) |
| | Path traversal v attachment download | Med | Critical | Whitelist of repository paths; canonicalize before access; never accept path z URL param |
| | Prototype pollution v JS BFF | Low | High | Helmet middleware; `Object.freeze` na shared objects; safe parsers (žiadny `eval`, `vm.runInNewContext` s user inputom) |

## 6c. STRIDE — BFF :: Aggregator module (C6c)

> Zdroj: `docs/agents/architecture/components/bff.md` § 2.4 (`/me/tenants`,
> queue handler, ticket-detail handler, CI neighborhood handler).
> Špecifické riziko: **fan-out multi-call** — jeden request agreguje 3–6
> paralelných CA SDM volaní (per 04 ADR 01 § dôsledok 3).

| Kategória | Threat | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| **S**poofing | Aggregator forge cudzieho user-id pri fan-out | Low | Critical | Fan-out volania zdedia session context (auth, activeTenantId); žiadny per-call user-input pre identity |
| **T**ampering | Partial-failure response zamlčí cudzí-tenant entry | Med | High | Fan-out merge: per-record `tenant` field validovaný proti `session.activeTenantId`; mismatch → drop + audit `cross_tenant.read.unexpected` |
| | Race condition: tenant switch počas in-flight fan-out | High | High | Per-request snapshot `activeTenantId` capture na request start; response tag `X-Response-Tenant`; SPA validuje (viď `multi-tenancy-security.md` §4 L12) |
| **R**epudiation | Aggregator chyba bez per-leg log | Low | Med | Per CA SDM leg log: `casdm: { calls, totalMs, errors }` (per 04 ADR 09 BFF JSON log format) |
| **I**nformation disclosure | Cache leak medzi tenantmi v aggregator | Med | Critical | Per-tenant cache key v `Reference data cache` (`{tenantId}:reference:{type}`); per `components/bff.md` §2.3 + `multi-tenancy-security.md` §4 L2 |
| | `/me/tenants` aggregator leakuje cudzie tenants | Low | High | BFF query CA SDM `cnt_role` filter k aktuálnemu userId; never trust user input; per `auth-flow.md` §4.5 `/me` contract |
| **D**oS | Fan-out N×CA SDM volaní zaplaví backend | High | Med | Per-aggregator-endpoint per-session rate limit; circuit breaker per CA SDM endpoint; max parallelism per request (default 6) |
| | Long-running ticket-detail aggregator zamkne worker | Med | Med | Hard timeout 5 s per aggregator endpoint; partial-response s error markers ak partial timeout |
| **E**levation of privilege | Aggregator obíde tenant filter v jednom z N volaní | Med | Critical | Defense-in-depth: každý leg dostane `WC=tenant%3DU'<id>'` explicit (per 04 ADR 11 § "Defenzívny WC filter"); integration test per aggregator |

## 6d. STRIDE — Session Store (C6d)

> Zdroj: `docs/agents/architecture/architecture.md` §3.1 (`Session store —
> in-memory / Redis`) + `components/bff.md` §2.2.
> MVP: in-memory single-instance per 04 ADR 01 § dôsledok 4. Post-MVP: Redis
> (gating na `[08-devex-devops] session-store`).

| Kategória | Threat | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| **S**poofing | Forge session record (Redis admin compromise) | Low | Critical | Redis ACL per-app; network isolated (VPC); auth required; no public network exposure |
| **T**ampering | Direct Redis write bypassuje validation | Low | Critical | BFF je jediný writer (Session manager API: `createSession/getSession/refreshIfNeeded/destroySession` per `components/bff.md` §2.2); Redis ACL: app-user iba GET/SET na keyspace `sess:*` |
| | Co-tenant Redis kontamination (multi-app Redis) | Low | Critical | Per-app Redis instance alebo per-app keyspace + ACL; encryption at rest (Redis 6+); TLS to Redis |
| **R**epudiation | Session destroy bez log | Low | Med | Audit event `session.invalidated.server` (per `audit-and-compliance.md` §2.1) |
| **I**nformation disclosure | Memory dump v core dump leaknuje session payload | Low | Critical | `RLIMIT_CORE=0` v prod; secrets v sealed-secret manager pre Redis password; encryption at rest |
| | `KEYS sess:*` scan z Redis admin | Low | High | Redis ACL: app-user nedostal `KEYS`, `SCAN`; iba `GET/SET/DEL` per `sess:<sid>` pattern |
| | Session timeout race: zombie sessions | Med | Med | TTL na Redis key = absolute session lifetime (8 h); BFF Session manager honoruje idle pred TTL |
| **D**oS | Redis OOM cez milión session vytvorení | Low | High | Per-IP rate limit na `/auth/login` (10/min); max session count per user (default 5) |
| | Single-instance in-memory store reset → mass re-login | Med | Low | Acceptable v MVP (per 04 ADR 01 § dôsledok 4 a `audit-and-compliance.md` §8: "session store nemusí mať backup"); post-MVP Redis = HA |
| **E**levation of privilege | Session key brute-force | Low | Critical | Session ID `crypto.randomBytes(32)` ≥256 bits; no enumeration; constant-time compare |
| | Session fixation (attacker pre-creates sid, victim používa) | Low | High | BFF generuje sid len pri úspešnom `login.completed`; client nemôže injectovať sid |

## 6e. STRIDE — Runtime Config endpoint (C6e)

> Zdroj: `docs/agents/architecture/components/bff.md` §2.5 (`/config` endpoint)
> + ADR-12 (Runtime config) + 08 `runtime-config.md`.
> Verejný endpoint (no auth required) — vracia JSON s `apiBaseUrl`, `features`,
> `i18n`, `branding`.

| Kategória | Threat | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| **S**poofing | Phantom `/config` endpoint v MITM | Low | Critical | HTTPS + HSTS; cert pinning na BFF surface; SPA bootstrap len cez same-origin / whitelisted origin |
| **T**ampering | Tamper `config.json` na disku → SPA-wide misconfig | Med | High | File ownership 0644 root:bff; integrity check (SHA256 fingerprint v `/config` response + monitoring v SIEM); `Cache-Control: no-store` na `/config` aby SPA refresh prejavil zmenu |
| | Tamper `apiBaseUrl` → presmeruje SPA na rogue BFF | Med | Critical | CSP `connect-src` restrict (per `headers-and-csp.md` §1); SPA validuje `apiBaseUrl` proti same-origin alebo whitelisted origin |
| **R**epudiation | Config zmena bez audit | Med | Med | Watch `config.json` mtime; emit audit event `config.reloaded` s diff |
| **I**nformation disclosure | `/config` leakuje internal hostname / secret | Low | High | Schema validation pred response (per 08 `runtime-config.md` §3 Zod schema); whitelist polí; no secrets v `/config` (secrets v env-only) |
| | Feature flag leak (post-MVP features) | Low | Low | Feature flag values per role/tenant — `/config` vracia len defaults; tenant-specific cez authenticated `/me` |
| **D**oS | Hot-reload na každý request — file IO burst | Med | Low | File watcher cache; lazy re-read s 5 s debounce |
| | Anonymous flood `/config` (no auth) | Med | Low | Rate limit per IP (30/min); cache aggressively v reverse proxy |
| **E**levation of privilege | Inject malicious feature flag → SPA enable hidden admin UI | Low | High | Feature flags sú **UI hint only** — server-side enforcement v C6b (per `rbac.md` §1.4); klient-side check nie je security gate |

## 7. STRIDE — IdP (C7)

> Zdroj: `docs/agents/architecture/architecture.md` §2 (Externé systémy).
> IdP je **trusted boundary** — threats mimo nášho scope (corp IdP team).
> Listujeme čo MY garantujeme voči IdP a čo požadujeme od IdP.

| Kategória | Threat | Likelihood | Impact | Mitigation (our side) |
|---|---|---|---|---|
| **S**poofing | Stolen IdP credentials | Med | Critical | MFA wymaga corp policy; step-up MFA pre sensitive ops (`multi-tenancy-security.md` §6) |
| **T**ampering | Token replay after revoke | Low | High | BFF kontroluje `iat` claim; refresh-token rotation; revocation propagation viď IdP SLA |
| **R**epudiation | n/a (IdP responsibility) | – | – | – |
| **I**nformation disclosure | Claims contain excess PII | Med | Med | OIDC scope minimal (`openid profile email`); request only required claims |
| **D**oS | IdP downtime → no logins | Low | High | Visible error page s contact info; cache `/.well-known/openid-configuration` (TTL 1h); circuit breaker |
| **E**levation of privilege | Misconfigured client `grant_types` allows implicit | Low | High | BFF client config pinned: `authorization_code` + `refresh_token` only; reject `implicit`, `password` |

## 8. STRIDE — CA SDM REST + SOAP (C8)

> Zdroj: `docs/agents/architecture/architecture.md` §2 + `components/bff.md` §3.
> Trusted backend. BFF (C6b/c) je jediný klient.

| Kategória | Threat | Likelihood | Impact | Mitigation (our side) |
|---|---|---|---|---|
| **S**poofing | Phantom CA SDM (rogue endpoint) | Low | Critical | Endpoint URL pinned in BFF env; HTTPS cert validation |
| **T**ampering | XML/JSON injection v ticket payload (CA SDM ↔ external systems) | Med | Med | BFF normalizes/escapes ticket fields pre rendering; output encoding |
| **R**epudiation | n/a (CA SDM has audlog) | – | – | BFF correlation id passed to CA SDM `X-Correlation-Id` for traceability |
| **I**nformation disclosure | CA SDM returns 401 for both invalid auth and missing permission (flat semaphore) | High | Med | BFF maps to proper 401 vs. 403; UX message distinguishes |
| | Direct SOAP fallback leakuje shared secret | Low | High | SOAP fallback iba pre operácie, kde REST nestačí (gaps); same BFF-mediated auth |
| **D**oS | CA SDM single instance, slow query | Med | Med | BFF query timeout 30 s; circuit breaker; cache read-mostly endpoints (5 min) |
| **E**levation of privilege | CA SDM rola má širší scope ako predpokladané | Med | High | Defense in depth: BFF aplikuje explicit `WC=tenant%3DU'...'` filter (viď `multi-tenancy-security.md` §3.1) |

## 9. STRIDE — Mock backend (C9, MSW, dev-only)

> Zdroj: 08 `runtime-config.md` (`auth.mode=mock` + MSW handlers v dev profile).
> Mock backend žije len v dev / test prostredí. Hlavné riziko: produkčný release
> omylom zahrnie MSW handlers.

| Kategória | Threat | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| **S**poofing | MSW intercepts produkčnú reálnu requestu | Low | High | MSW init iba pri `import.meta.env.MODE === "development"`; build-time tree-shaking; explicit check `if (window?.location?.hostname === "localhost")` |
| **T**ampering | Mock data v Storybook obsahuje real PII | Med | Low | Mock dataset používa Faker-generated synthetic data; nikdy real exports |
| **D**oS | Mock latency simulation zaberá CPU | Low | Low | Limit simulated delay max 2 s |
| **E**levation of privilege | Mock auth handler dáva všetkým "admin" role | High | n/a (dev only) | Documented; Storybook role switcher pre realistic UI testing |

## 10. Cross-cutting threats — summary

| # | Threat | Containers dotknuté | Primárna mitigácia |
|---|---|---|---|
| X1 | Cross-tenant data leak | C1, C2, C4, C6b, C6c, C6d, C8 | Per-tenant cache; server-side WC filter; cross-tab broadcast |
| X2 | XSS via UGC | C1, C2, C5 | CSP nonce + Radix nonce prop + DOMPurify (per `headers-and-csp.md` §1.4 a 07 lib choice); markdown sanitization; output encoding |
| X3 | Token theft | C1, C2, C3, C6a, C6d | HttpOnly cookies (canonical per `auth-flow.md` §2); CSP `script-src` strict |
| X4 | CSRF | C1, C2, C6b | `SameSite=Lax` + HMAC CSRF token; double-submit cookie pattern fallback |
| X5 | Session fixation | C3, C6a, C6d | Rotate session id pri prihlásení; pri tenant switch |
| X6 | Open redirect | C3, C6a, C6b | Whitelist of return URLs; reject external schemes |
| X7 | Insecure deserialization | C6b | JSON parser only (no eval); schema validation (Zod / equivalent) na input |
| X8 | Supply chain | All | Lockfile committed; CI dependency scan (per 08 `ci-cd.md` security-audit job); SBOM generation |
| X9 | Logging sensitive data | C6a, C6b, C6c | Log redaction: passwords, tokens, full SSN/IBAN — never logged (per `audit-and-compliance.md` §4) |
| X10 | Time-based attacks (login enumeration) | C6a | Constant-time compare; uniform response time pre exists/not-exists user |

## 11. Mapovanie na OWASP a NIST

Detailný OWASP top 10 mapping je v `owasp-mitigations.md`. Tu krížový odkaz:

| STRIDE kategória | OWASP top 10 (2021) najbližšia kategória |
|---|---|
| Spoofing | A07 Identification and Authentication Failures |
| Tampering | A08 Software and Data Integrity Failures, A03 Injection |
| Repudiation | A09 Security Logging and Monitoring Failures |
| Information disclosure | A01 Broken Access Control, A02 Cryptographic Failures |
| Denial of service | A04 Insecure Design (rate limit absence) |
| Elevation of privilege | A01 Broken Access Control, A04 Insecure Design |

## 12. Risk register — top 10 risks

> Likelihood × Impact = Priority. Likelihood: L/M/H. Impact: L/M/H. Priority škálovaná na 1–9.

| # | Risk | L | I | Prio | Owner | Status |
|---|---|---|---|---|---|---|
| R1 | Cross-tenant data leak cez stale cache po switch | H | H | 9 | Architecture (C6b/c) + Security | Mitigated (per-tenant cache key + queryClient.clear) |
| R2 | XSS v KB markdown renderingu | H | H | 9 | Design System (C5) + Security | Mitigated (DOMPurify whitelist + CSP nonce + Radix nonce prop) |
| R3 | Stolen session cookie cez XSS na cudzí route | M | H | 6 | Security | Mitigated (HttpOnly + CSP nonce) |
| R4 | Privilege escalation cez stale role | H | M | 6 | BFF (C6a/b) + Security | Mitigated (60s role re-fetch) |
| R5 | SSRF v BFF z hostname param | M | H | 6 | BFF (C6b) + Security | Mitigated (URL whitelist) |
| R6 | Forge tenantId v switch request | M | H | 6 | BFF (C6a) | Mitigated (server-side session.allowedTenants check) |
| R7 | CSRF na mutating endpointe | M | M | 4 | BFF (C6b) | Mitigated (SameSite=Lax + HMAC token) |
| R8 | Token replay po refresh rotation | L | H | 3 | IdP + BFF (C6a) | Mitigated (IdP-side re-use detection) |
| R9 | Stack trace leak via 500 response | M | M | 4 | BFF (C6b) | Mitigated (error shaper, per 04 `components/bff.md` §2.3) |
| R10 | Open redirect po login | L | M | 2 | BFF (C6a) | Mitigated (return URL whitelist) |
| R11 | Aggregator partial-failure leakuje cudzí-tenant entry | M | H | 6 | BFF (C6c) | Mitigated (per-leg tenant validation + drop+audit) |
| R12 | Session Store memory dump → mass session leak | L | C | 3 | BFF (C6d) + DevOps | Mitigated (`RLIMIT_CORE=0`, encryption at rest Redis) |
| R13 | Runtime config tampering → SPA-wide rogue `apiBaseUrl` | M | C | 6 | BFF (C6e) + DevOps | Mitigated (file owner 0644 root:bff + SHA256 fingerprint v `/config` + SPA same-origin assertion) |

## Otvorené závislosti

- `[04-architecture]` Container set — `[resolved-in-round-2]` 04 publikoval konkrétny set (`architecture.md` §3.1 + `components/{bff,portal,workspace}.md`). STRIDE 1:1 mapped. Nové containers (reverse-proxy, secrets manager, observability collector) sa v 04 r2 neobjavili; ak vzniknú v post-MVP, doplníme.
- `[04-architecture]` BFF vs. no-BFF — `[resolved-in-round-2]` 04 ADR 01 = BFF=YES. Variant B v `auth-flow.md` § A je legacy archive.
- `[04-architecture]` Session store technologia — `[resolved-in-round-2]` MVP in-memory single-instance, post-MVP Redis (gating na `[08-devex-devops] session-store`). C6d STRIDE tabuľka pokrýva obe deployment módy.
- `[07-design-system]` Markdown rendering sanitization — `[resolved-in-round-2]` 07 `library-recommendation.md` + 06 `libraries.md` §17 vybrali **DOMPurify** pre TipTap (KB editor) + **`react-markdown` s default whitelist** pre KB read. Kontrakt: žiadny raw HTML, žiadny `javascript:` URI.
- `[06-tech-stack-selector]` JWT validation / OIDC client / markdown sanitizer / rate limiting — `[resolved-in-round-2]` per 06 r2 BFF stack (Node.js: `openid-client` + `jose`; rate-limit cez fastify/hono middleware podľa BFF stack choice). FE markdown sanitizer = DOMPurify (TipTap rich-text) + `react-markdown` default sanitization (read-only).
- `[09-qa-test-strategy]` Risk register v sekcii 12 je vstup pre test priority a test focus.
- `[?]` Penetration test plan — out of scope tohto dokumentu, ale risk register je vstup pre testers.
