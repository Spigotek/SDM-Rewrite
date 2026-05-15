# OWASP Top 10 (2021) — mitigation matrix

> Cieľ: mapovať každú kategóriu OWASP top 10 (2021) na konkrétne riziko
> v SDM-Rewrite a definovať mitigácie + kde žijú.
>
> Cross-ref: `threat-model.md` (STRIDE per container), `auth-flow.md`,
> `rbac.md`, `multi-tenancy-security.md`, `headers-and-csp.md`.

## A01 — Broken Access Control

### Riziká v projekte

- Klient-side route guards sa obídu priamou URL navigáciou.
- Tenant-id forgery v request param.
- Stale role — user downgradnutý ale session ešte živá.
- Vertical privilege escalation (requester → agent_l2).
- Horizontal privilege escalation (vidieť ticket iného requestera v rovnakom tenante).
- IDOR — direct object reference (`/api/incidents/<id>` bez ownership check).

### Mitigácie

| Mitigácia | Kde | Detail |
|---|---|---|
| Default-deny RBAC eval | BFF middleware | Každý route handler má explicit `requirePermission(...)` check; missing check = build fail (lint pravidlo / integration test). |
| Server-side tenant scope filter | BFF | Vždy `activeTenantId` zo session, ignore request input. Explicit `WC=tenant%3DU'...'` na CA SDM volaní. |
| 60s role re-fetch | BFF | Session keeps `rolesLoadedAt`; pri každom call ak `> 60s` triggeruj refresh z CA SDM `cnt_role`. |
| Object-level authorization | BFF | Pre `/api/incidents/:id` overiť `incident.tenant === activeTenantId` AND (role ∈ {agent_l1,l2,sp_admin} OR `incident.customer === userId`). |
| Per-tenant cache key | BFF + SPA React Query | `[tenantId, ...queryKey]` — eliminuje cross-tenant cache poisoning. |
| Integration test matrix | QA | role × endpoint × tenant → expected status code. Detekuje regression. |
| Audit log forensic | BFF | `403_forbidden_*` events sa eskalujú do SIEM (`forbidden_tenant_switch`, `forbidden_resource`). |

### Test vectors

- Requester sa pokúsi GET `/api/incidents/<niekto-iný-incident-id>` v rovnakom tenante → 403/404.
- Agent v T1 pokus o switch na T2 mimo allowed → 403 + audit.
- Permission downgrade počas active session → next call 401 `role_changed`.

## A02 — Cryptographic Failures

### Riziká v projekte

- Plain HTTP fallback (mixed content).
- Slabé TLS ciphers / starý TLS verzie.
- CA SDM Access Key uložený v `localStorage`.
- Refresh token vidieť v JS.
- Session cookie cez Secure=false v dev a fail-open v prod.

### Mitigácie

| Mitigácia | Kde | Detail |
|---|---|---|
| HTTPS only | Reverse proxy + HSTS | `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` |
| TLS 1.2+ only | Reverse proxy | Disable TLS 1.0/1.1; cipher whitelist (AEAD only); no RC4/3DES |
| `__Host-` prefix cookies | BFF | Path=/, Secure required, no Domain attr |
| HttpOnly cookies | BFF | Token mimo JS scope (variant A) |
| Variant B: in-memory only | SPA | Žiadne `localStorage`/`sessionStorage` pre tokeny; ESLint pravidlo |
| JWT signature RS256+ | BFF | Reject `none`, reject `HS*` ak issuer používa RS; JWKS pinning |
| Encryption at rest | Redis session store | TLS to Redis; AES-256 encryption pre persistent storage (admin layer) |
| Password handling | n/a (delegovaná na IdP) | CA SDM Basic creds nikdy nie sú v BFF JS heap — exchange za Access Key pri logine, potom forget |

### Test vectors

- Pokus o HTTP load → permanent redirect na HTTPS.
- Audit ciphersuites — `nmap --script ssl-enum-ciphers -p 443 <bff>` musí povoliť len TLS 1.2/1.3 AEAD.
- Audit session cookie atribútov v DevTools.

## A03 — Injection

### Riziká v projekte

- SQL injection cez `WC` filter param posielaný do CA SDM REST.
- XSS v KB markdown / ticket description / attachment filename.
- XSS v error toasty (CA SDM error messages cez BFF).
- Header injection (CRLF) cez user-supplied URL.
- LDAP injection (mimo MVP — IdP rieši).

### Mitigácie

| Mitigácia | Kde | Detail |
|---|---|---|
| Parameterized `WC` filter builder | BFF | Helper funkcia, ktorá escapuje user input pred zaradením do CA SDM `WC=` query. Whitelist polí. Žiadna voľná konkatenácia. |
| Output encoding | SPA Design System | React `{value}` (auto-escape); zakázaný `dangerouslySetInnerHTML` (ESLint rule) okrem markdown wrapperu |
| Markdown sanitizer whitelist | Design System | Whitelist tagov: `p, strong, em, ul, ol, li, code, pre, a, h1-h6, blockquote, img, table*`. Zakázané: `script, style, iframe, form, object, embed`. Atributes whitelist (no `on*`, no `style`, no `javascript:` URIs). |
| CSP backstop | Reverse proxy | `script-src 'self' 'nonce-<n>'` (viď `headers-and-csp.md`) |
| Filename render-as-text | Design System | `<span title={filename}>{filename}</span>` — nikdy ako URL alebo `<img alt=>` bez escape |
| Content-Type sniffing block | Reverse proxy | `X-Content-Type-Options: nosniff` |
| Server-side schema validation | BFF | Zod / equivalent schema na všetkých inputs; reject extra fields |
| URL validation pre redirects | BFF | Whitelist return URLs; reject `javascript:`, `data:`, externé domény |

### Test vectors

- KB markdown `[click](javascript:alert(1))` → sanitizer remove.
- KB markdown `<script>alert(1)</script>` → sanitizer remove.
- Ticket description s embeddeed `<img src=x onerror=alert(1)>` → sanitizer remove `onerror`.
- WC filter `WC=summary%3DU'%20OR%201%3D1` → CA SDM môže akceptovať (fallback je BFF query whitelist).
- Attachment name `<script>` → render bezpečne.

## A04 — Insecure Design

### Riziká v projekte

- Chýbajúce rate limity na login → brute force.
- Predictable session id.
- Žiadny step-up pre sensitive ops.
- Open registration / self-service tenant creation (mimo MVP — non-issue).
- No defense in depth (jediná vrstva auth).

### Mitigácie

| Mitigácia | Kde | Detail |
|---|---|---|
| Rate limit login | BFF | 10/min per IP, 5/min per username; exponential backoff; CAPTCHA after 3 failures |
| Cryptographically random session id | BFF | ≥256 bits entropy from `crypto.randomBytes`; format opaque base64url |
| Step-up auth pre sensitive ops | BFF + IdP | MFA prompt pre tenant admin, bulk delete > 50, SP cross-tenant enable (`multi-tenancy-security.md` §6) |
| Defense in depth | BFF + CA SDM | (1) IdP token validate, (2) BFF session check, (3) BFF tenant filter, (4) CA SDM role-based scope |
| Threat modeling per feature | Design process | Každá nová feature s user input prejde threat-model checklist (`threat-model.md` §10 + this doc) |
| Secure defaults | BFF | Default-deny; default-secure cookie flags; default-no-CORS for new endpoints |
| Anti-automation | BFF | Slow path: failed logins delay 1–3 s (constant time); CAPTCHA escalation |

### Test vectors

- 100 login attempts in 1 min → 429 + audit.
- Rapid /auth/login s rôznymi username → constant response time (no enumeration).
- Bulk delete 60 → 403 + step_up_required.

## A05 — Security Misconfiguration

### Riziká v projekte

- Default CSP príliš permissívne.
- CORS allow `*`.
- Source maps deployed in prod.
- Debug endpoints v prod (`/debug`, `/health` with too much detail).
- Default credentials v config files.
- Verbose error pages.

### Mitigácie

| Mitigácia | Kde | Detail |
|---|---|---|
| Strict CSP | Reverse proxy | Viď `headers-and-csp.md`. `default-src 'none'`; explicit allow per direktívu. |
| CORS minimal | BFF | Default deny. Žiaden `*` origin. Pre BFF same-origin nie je potrebné CORS (SPA + BFF za rovnakou doménou alebo subdomain s explicit allow). |
| Source maps strategy | Build | `sentry-cli` uploaduje source maps počas CI; build artifact obsahuje len `.map` references; deployed bundle nemá `.map` files |
| Health endpoint minimal | BFF | `GET /health` vráti `{ status: "ok" }` only. Detail `/health/deep` len pre internal IP range alebo Basic auth s rotating secret. |
| Env-based config | BFF | All secrets cez env vars; never in repo; pre-commit hook (`gitleaks`) |
| Production error pages | BFF + SPA | Generic message + correlation id; never stack trace |
| Server header strip | Reverse proxy | `Server: ` header neexponuje verziu (Nginx `server_tokens off` / equivalent) |
| Default account audit | DevOps | Žiaden default admin v BFF; admin bootstrap len cez IdP claim |

### Test vectors

- Curl response headers → no `Server: <version>`, no `X-Powered-By:`.
- DevTools — `/main.js.map` returns 404 in prod.
- CSP report-only mode v staging zachytáva violácie pred go-live.

## A06 — Vulnerable and Outdated Components

### Riziká v projekte

- npm package s known CVE.
- Outdated React / framework version.
- Outdated CA SDM client SDK (ak by sme používali).
- Transitive deps drift.

### Mitigácie

| Mitigácia | Kde | Detail |
|---|---|---|
| Lockfile committed | Repo | `pnpm-lock.yaml` / equivalent always committed; `--frozen-lockfile` v CI |
| Dependency scanning v CI | CI pipeline | `npm audit --audit-level=high` (or Snyk / Dependabot / Renovate); fail build na High/Critical bez waiver |
| Automated PR updates | Bot | Renovate / Dependabot — týždenné PR pre dep updates |
| SBOM generation | CI | CycloneDX SBOM v každom release artifact |
| Pin major versions | Repo | `^1.2.3` len pre patches; majors cez explicit upgrade PR |
| Cron security scan | CI | Nightly run audit aj keď nie sú zmeny — detekuje newly-disclosed CVE |
| Browser support matrix | Repo | Last 2 versions Chrome/Edge/Firefox/Safari (GOAL §5) — žiadne polyfills pre IE / legacy |

### Test vectors

- CI fails na injected high-severity dependency.
- SBOM diff medzi releases zachytí pridanú transitive.

## A07 — Identification and Authentication Failures

### Riziká v projekte

- Brute force login.
- Credential stuffing.
- Stolen session cookie.
- Replay attack na OIDC code.
- Token-issuer downgrade attack.
- Audience confusion.

### Mitigácie

| Mitigácia | Kde | Detail |
|---|---|---|
| OIDC PKCE | BFF + IdP | `code_verifier` ≥43 chars, one-time use, S256 challenge method |
| State + nonce validation | BFF | Per-flow generated, single-use, 5-min TTL |
| Audience strict check | BFF | `aud` claim equals BFF client_id |
| JWKS pinning | BFF | Hash of expected JWKS in config; alert na change |
| Refresh token rotation | BFF + IdP | Each use issues new token; re-use detection na IdP terminates whole session |
| Step-up MFA | BFF + IdP | `multi-tenancy-security.md` §6 |
| Rate limit + CAPTCHA | BFF | A04 mitigations |
| Account lockout | IdP-side | Out of our scope; IdP enforces per corp policy |
| Password requirements | n/a | Delegated to IdP |
| Anti-enumeration | BFF | Constant-time login response; no "user not found" message difference |
| Session timeout | BFF | Idle 15/30 min + absolute 8h max |

### Test vectors

- Replay OIDC code → 400 invalid_grant.
- Tamper `aud` claim → reject.
- Reuse refresh token → IdP terminates session.

## A08 — Software and Data Integrity Failures

### Riziká v projekte

- CDN-loaded library tampering (3rd party script src).
- CI/CD pipeline poisoning.
- Insecure deserialization.
- Auto-update without signature verification (n/a — no auto-update).
- Tampered build artifact.

### Mitigácie

| Mitigácia | Kde | Detail |
|---|---|---|
| Self-hosted assets only | Build | Žiadne external CDN scripts (Google Fonts, jsdelivr, ...). All assets bundled. CSP `script-src 'self'`. |
| SRI for any unavoidable external | HTML | Subresource Integrity hash if any external script needed (audited per-PR) |
| CI/CD pipeline security | DevOps | Pinned action versions (no `@main`); secrets via secret manager; review required for PRs to release branches |
| Signed commits | Repo | Branch protection: signed commits required for main |
| Reproducible builds | Build | Deterministic build inputs; SBOM + checksum in release |
| JSON parser only | BFF | No `eval`, no `vm.runInNewContext`, no `node-serialize`. Use safe parsers. |
| Schema validation | BFF | Zod / equivalent on all input boundaries |
| Artifact signature | Build | Sign release artifacts (Sigstore / GPG); verify before deploy |

### Test vectors

- Inject 4th-party CDN script → fails CSP `script-src 'self'`.
- Modify build artifact → checksum verification fails.

## A09 — Security Logging and Monitoring Failures

### Riziká v projekte

- Žiadny audit log → forensics nemožný.
- Logs leakujú PII / secrets.
- Logs nie sú monitored → breach detekcia mimo capacity.
- Žiadny correlation id → distributed trace nemožný.

### Mitigácie

| Mitigácia | Kde | Detail |
|---|---|---|
| Structured audit log | BFF | JSON lines: `{ ts, correlationId, actor, action, resource, tenant, ip, ua, result, ...details }`. Detail v `audit-and-compliance.md`. |
| Log shipping | DevOps | Audit log → SIEM (Splunk / Elasticsearch / equivalent) cez TLS; retention per compliance |
| Redaction | BFF logger | Pre-emit hook redacts: `password`, `accessKey`, `refreshToken`, `token`, full credit card, full IBAN — replaced with `[REDACTED]` |
| Correlation id | BFF + SPA | `X-Correlation-Id` header generated per request; propagated to CA SDM `X-Correlation-Id`; included in error messages for UX support |
| Alerting | SIEM | Alerts na: rate of 403/401, forbidden_tenant_switch, SP cross-tenant ops, login failure spikes |
| Tamper-evident logs | DevOps | Append-only S3 bucket / immutable storage; hash-chain optional |
| Frontend error tracking | Sentry | beforeSend hook scrubs PII; group by route template not by ID |

### Test vectors

- Trigger 403 → audit event present in SIEM within 60 s.
- Trigger high-volume 401 burst → alert fires.
- Verify password field never appears in any log line.

## A10 — Server-Side Request Forgery (SSRF)

### Riziká v projekte

- BFF endpoint that fetches user-supplied URL (e.g. attachment from external system, MDR link, webhook).
- OIDC discovery URL z user-supplied IdP config (mimo MVP).
- KB article rich-link unfurl (mimo MVP — feature nie je v scope).

### Mitigácie

| Mitigácia | Kde | Detail |
|---|---|---|
| URL whitelist | BFF | Allowed upstreams: CA SDM endpoint(s), IdP `/.well-known/`, Sentry; nothing else by default. |
| Block private IPs | BFF | Resolve DNS server-side; reject if resolved IP ∈ {RFC 1918, 127.0.0.0/8, 169.254.0.0/16, ::1, fc00::/7, fe80::/10, link-local IPv6} |
| Block metadata endpoints | BFF | Explicit block `169.254.169.254`, `metadata.google.internal`, `metadata.azure.com` |
| Use scheme whitelist | BFF | `https://` only for external; `http://` disabled even for internal (use TLS to CA SDM if possible) |
| No follow-redirect to disallowed | BFF | If 3xx, re-validate Location URL against whitelist |
| Egress firewall | DevOps | Network-level: BFF can only reach explicitly allowed FQDNs |
| Timeout | BFF | 30 s max per outbound request; circuit breaker |

### Test vectors

- POST `/api/some-endpoint { url: "http://169.254.169.254/latest/meta-data" }` → 400 invalid_url.
- POST with hostname that resolves to private IP → 400.
- Redirect chain leading to private IP → blocked after first hop.

## Cross-OWASP — global mitigations summary

| Mitigácia | OWASP categories it touches |
|---|---|
| HttpOnly cookies | A01, A02, A07 |
| CSP nonce-based | A03, A05, A08 |
| Server-side authorization | A01, A04 |
| Rate limiting + step-up | A04, A07 |
| Structured audit log + SIEM | A09 |
| Dependency scanning in CI | A06, A08 |
| URL whitelist + private-IP block | A10 |
| Schema validation (Zod) | A01, A03, A04 |

## Verification — security review checklist (per PR)

Tento checklist je vstup pre `buddy:security-review` skill volaný PR-time:

- [ ] Nový endpoint má explicit `requirePermission(...)` call.
- [ ] User input validovaný cez Zod schema.
- [ ] Žiadny `dangerouslySetInnerHTML` mimo whitelisted markdown wrapper.
- [ ] Žiadny `eval`, `Function(...)`, `vm.run*`.
- [ ] No new external script src bez SRI a CSP whitelisting.
- [ ] Audit log event pre nové sensitive akcie.
- [ ] Test: 403/401 path covered.
- [ ] Test: cross-tenant isolation if endpoint accesses tenant-scoped data.
- [ ] No secrets in code / config files (pre-commit gitleaks).
- [ ] Dependency changes reviewed (`pnpm audit` clean).

## Otvorené závislosti

- `[04-architecture]` Sentry / observability collector — kde žije, aké credentials, či pristupuje k cudzímu tenantu (Sentry org-level). Treba zladiť so SIEM stratégiou.
- `[04-architecture]` Reverse proxy voľba (Nginx / Envoy / Traefik / cloud LB) — určuje, kde sa configuruje HSTS, CSP, server header strip.
- `[06-tech-stack-selector]` Markdown sanitizer knižnica (rehype-sanitize, sanitize-html, ...) — kontrakt whitelist je definovaný, výber je stack rozhodnutie.
- `[06-tech-stack-selector]` Zod / equivalent schema validation knižnica — pre BFF a SPA boundary validation.
- `[08-devex-devops]` SBOM generator, dependency scanner, secrets scanner integration v CI — konkrétne nástroje a thresholds.
- `[08-devex-devops]` SIEM destinácia + retention policy + alerting rules — DevOps + Security spoločne.
- `[09-qa-test-strategy]` Test vectors v každej sekcii sú návrh; QA agent ich konsoliduje do test plánu.
- `[?]` Penetration test plan a frequency — out of scope tohto dokumentu, biznis rozhodnutie.
- `[?]` Bug bounty program — mimo MVP scope, decision deferred.
