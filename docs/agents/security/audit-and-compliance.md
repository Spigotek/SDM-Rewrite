# Audit log & compliance — scope, GDPR, retention

## Changelog (round 2)

- **Konkrétne hodnoty finalized** (r2):
  - Idle timeout: **30 min** (oba aplikácie).
  - Step-up TTL: **5 min**.
  - Reopen time-box (requester own ticket): **7 dní** od `resolve_date`.
  - Retention auth/authz log: **1 rok**.
  - Retention data log: **3 roky**.
  - Bulk step-up threshold: **> 50** záznamov.
- Cross-link na 04 ADR 09 (Observability) + 08 `runtime-config.md` + 08 `ci-cd.md` (security-audit job: npm audit + CodeQL/Snyk podľa 08 r2).
- `correlationId` formát zarovnaný s 04 ADR 09 (UUID v4 alebo ULID — 04 nechalo otvorené v `correlation-id-spec` flag; pre tento dokument predpokladáme UUID v4 ako default).
- §0 pridaná — Konkrétne hodnoty v jednej tabuľke pre rýchlu referenciu.

> Cieľ: definovať, ČO loguje FE / BFF nad rámec CA SDM native audlog, AKO sa
> tieto logy spravujú a aké GDPR / compliance ohraničenia platia.
>
> Cross-ref: `auth-flow.md`, `rbac.md`, `multi-tenancy-security.md`,
> `threat-model.md`, `owasp-mitigations.md` (A09),
> `docs/agents/architecture/decision-records/09-observability.md`,
> `docs/agents/devex-devops/ci-cd.md`,
> `docs/agents/devex-devops/runtime-config.md`.

## 0. Konkrétne hodnoty — kanonická referenčná tabuľka (r2)

| Parameter | Hodnota | Citácia / odkaz |
|---|---|---|
| Idle timeout (portal aj workspace) | **30 min** | `auth-flow.md` §0, §2.4 |
| Idle timeout per-tenant override | 5–120 min | `auth-flow.md` §2.4 |
| Absolute session lifetime | **8 hodín** | `auth-flow.md` §4.1 |
| Step-up TTL (po MFA prompt) | **5 min** | `multi-tenancy-security.md` §6 |
| Bulk step-up threshold | **> 50 záznamov** | `rbac.md` §6.1 bulk action + `multi-tenancy-security.md` §6 |
| Reopen time-box (requester own ticket) | **7 dní** od `resolve_date` | `rbac.md` §6.1 (incident.reopen) |
| Bulk operation limit — agent_l1 | ≤ 50 rows | `rbac.md` §6.1 |
| Bulk operation limit — agent_l2 | ≤ 200 rows | `rbac.md` §6.1 |
| Audit log retention — `auth`, `authz`, `security`, `sensitive` | **1 rok** | §5 nižšie |
| Audit log retention — `data` category | **3 roky** | §5 nižšie |
| Reverse proxy access log retention | 90 dní | §5 |
| Sentry / Frontend errors retention | 90 dní | §5 |
| CSP violation reports retention | 30 dní | §5 |
| BFF role re-fetch interval | 60 s | `owasp-mitigations.md` A01, `auth-flow.md` §0 |
| Session ID entropy | ≥ 256 bits (`crypto.randomBytes(32)`) | `owasp-mitigations.md` A04 |
| `correlationId` formát | UUID v4 (default; ULID acceptable per 04 ADR 09 `correlation-id-spec` flag) | 04 ADR 09 §3 |

> Tieto hodnoty sú **konkrétne MVP defaults**. Finálna autorita = compliance /
> legal stakeholder; per-tenant config môže prepnúť idle timeout bez code change.

## 1. Vrstvy audit logu

CA SDM 17.4 má **vlastný audit trail** (`audlog` factory, view `View_*_Act_Log`).
Tento dokument popisuje **ďalšie vrstvy**, ktoré pridáva nový FE stack:

| Vrstva | Vlastník | Žije v | Zdroj pravdy pre |
|---|---|---|---|
| **CA SDM `audlog`** | CA SDM | `audlog` table | Doménové zmeny ticketov, changes, KB articles. Status transitions, assignments, attachment uploads. |
| **BFF audit log** | BFF process | structured JSON log → SIEM | Auth events, session events, tenant switches, RBAC decisions, sensitive operations (cross-tenant, admin). |
| **Frontend telemetry** | SPA (Sentry / equiv.) | Sentry org project | Render errors, unhandled rejections, performance. **Žiadny audit-grade data.** |
| **Reverse proxy access log** | Reverse proxy | log shipping → SIEM | All HTTP requests, status codes, response times, source IP. |

> **Audit-grade** znamená tamper-evident, signed/append-only storage with
> retention guarantees. Frontend logs **nie sú** audit-grade — sú diagnostické.
> Pre forensics sa použije BFF audit log + reverse proxy + CA SDM `audlog`.

## 2. BFF audit log — event taxonomy

Každý event je JSON line s povinnou base štruktúrou:

```typescript
interface AuditEvent {
  schemaVersion: "1.0";
  ts: string;                       // ISO 8601 with millisecond precision
  correlationId: string;            // X-Correlation-Id, traces across services
  category: AuditCategory;
  event: string;                    // canonical event name
  actor: {
    userId: string | null;          // null for unauthenticated events
    cntId: string | null;           // CA SDM cnt.id
    sessionId: string | null;       // hashed (SHA256 first 8B) — never raw sid
    uiRole: UIRole | null;
    isServiceProvider: boolean;
  };
  tenant: {
    activeTenantId: string | null;
    sourceTenantId?: string;        // for cross-tenant operations
    targetTenantId?: string;
  };
  request: {
    method: string;
    path: string;                   // route template, not raw URL with IDs
    ip: string;                     // IPv4/IPv6
    userAgent: string;              // truncated to 200 chars
    appOrigin: "portal" | "workspace" | "unknown";
  };
  result: "success" | "failure" | "denied";
  resultCode?: number;              // HTTP status or domain code
  reason?: string;                  // for denied/failure
  details?: Record<string, unknown>; // event-specific
}
```

### 2.1 Auth events (`category: "auth"`)

| Event | When | Required `details` |
|---|---|---|
| `login.initiated` | SPA → BFF `/auth/login` | `redirectUri` |
| `login.callback.success` | BFF received valid IdP callback | `iss`, `aud`, `sub` |
| `login.callback.failure` | State/nonce mismatch, code exchange failed | `failureReason` |
| `login.completed` | Session created, SDM access bootstrapped | `bootstrapMethod` (`eem_artifact` / `bopsid` / `service_account`) |
| `login.sdm.failure` | CA SDM rest_access returned 401 | `sdmStatus`, `sdmCode` |
| `logout.initiated` | SPA → BFF `/auth/logout` | – |
| `logout.completed` | All revocations done | `revoked: { sdm, idp, session }` |
| `logout.partial` | One of revocations failed (still proceeds) | `failedSteps` |
| `session.heartbeat` | Periodic | `idleSeconds` |
| `session.idle.expired` | Idle timeout reached | `idleSeconds` |
| `session.absolute.expired` | 8h hard limit | – |
| `session.invalidated.server` | Forced (role change, admin terminate) | `reason` |
| `step_up.requested` | Sensitive op without recent step-up | `targetOperation` |
| `step_up.completed` | MFA prompt succeeded | – |
| `step_up.failed` | MFA failed or canceled | `reason` |

### 2.2 Authorization events (`category: "authz"`)

| Event | When | Required `details` |
|---|---|---|
| `permission.denied` | RBAC check failed at BFF | `requiredPermission`, `attemptedAction`, `resourceType`, `resourceId` (hashed if sensitive) |
| `tenant.switch.success` | Successful active tenant change | `fromTenantId`, `toTenantId`, `newRoleId` |
| `tenant.switch.denied` | Forged or not-allowed tenant | `attemptedTenantId`, `reason` |
| `cross_tenant.view.enabled` | SP toggled cross-tenant view | – |
| `cross_tenant.view.disabled` | SP toggled OFF | – |
| `cross_tenant.read` | Per-record cross-tenant access | `recordType`, `recordId` (hashed), `sourceTenantId` |
| `cross_tenant.write` | Per-record cross-tenant mutation | `recordType`, `recordId` (hashed), `sourceTenantId`, `operation` |
| `role.refreshed` | Periodic role re-fetch from CA SDM | `previousRoleId`, `newRoleId` |
| `role.changed.forced_relogin` | Role downgrade triggered re-login | `previousRoleId`, `newRoleId` |

### 2.3 Sensitive operation events (`category: "sensitive"`)

| Event | When |
|---|---|
| `admin.tenant.created` | New tenant provisioned (post-MVP) |
| `admin.tenant.suspended` | Tenant suspended |
| `admin.role.assigned` | New cnt_role created |
| `admin.role.revoked` | cnt_role deleted |
| `admin.user.impersonation.started` | Impersonation activated (post-MVP) |
| `admin.user.impersonation.ended` | – |
| `bulk.operation.executed` | Bulk update/delete > 10 rows |
| `export.audit.executed` | Audit log exported |
| `export.report.executed` | Report export |
| `attachment.download.large` | Attachment > 10 MB downloaded |

### 2.4 Security events (`category: "security"`)

| Event | When |
|---|---|
| `csrf.violation` | Mutating request without/with invalid CSRF token |
| `csp.violation.received` | `/csp-report` endpoint received report |
| `rate_limit.exceeded` | Per-IP or per-user rate limit hit |
| `ssrf.attempt.blocked` | Outbound URL blocked by whitelist |
| `tampered.cookie.detected` | Session ID invalid format or unknown |
| `replay.token.detected` | OIDC code re-used |

### 2.5 Data lifecycle events (`category: "data"`)

| Event | When |
|---|---|
| `pii.export` | Export of any record containing PII |
| `pii.read.bulk` | List endpoint returning > 100 records with PII |
| `gdpr.request.received` | User-initiated GDPR request (post-MVP UI) |
| `data.retention.purge` | Scheduled purge ran |

## 3. Sampling a noisy events

Niektoré eventy by inflačne zaťažili SIEM. Sample policy:

| Event | Sampling |
|---|---|
| `session.heartbeat` | 1 in 100 (alebo `idleSeconds > threshold` always) |
| `permission.denied` | 100% (security-relevant) |
| `tenant.switch.success` | 100% |
| `cross_tenant.read` | 100% |
| `csp.violation.received` | 100% — but per-pattern alert deduplication v SIEM |
| Read API calls (200) | 0% (covered by reverse proxy access log) |

## 4. Redaction rules

BFF logger MUSÍ scrub-núť tieto polia pred emit:

### 4.1 Hard-redacted (replaced with `[REDACTED]`)

- `password`, `pwd`, `pass`
- `accessKey`, `access_key`, `x-accesskey`
- `secretKey`, `secret_key`
- `refreshToken`, `refresh_token`, `id_token` (full), `access_token` (full)
- `authorization` header value
- `cookie` header value (raw)
- `x-csrf-token` header value
- `sessionId` — raw form (hashed form OK)

### 4.2 Pseudonymized (hashed SHA256 first 8 bytes, hex)

- `email` — only first 8B of SHA256 if logged
- `recordId` (ticket, KB, CI) — when in `category: "data"` audit events
- raw `sid` — log as `sid_hash`

### 4.3 Truncated

- `userAgent` → 200 chars
- query string in `path` → strip query params unless event-relevant
- Request body — never log full body for `/api/*`; log only metadata (size, content-type)

### 4.4 Implementation pattern

Logger pre-emit hook:

```ts
function redact(obj: unknown): unknown {
  // recursive walk, replace by key name
  // accept allowlist for known-safe nested objects
}

logger.audit = (event: AuditEvent) => {
  const redacted = redact(event);
  emit(JSON.stringify(redacted));
};
```

Unit tests verifikujú: no `password|token|key|cookie|secret` substring in any emitted line.

## 5. Retention & storage

| Vrstva | Retention | Storage | Justifikácia |
|---|---|---|---|
| CA SDM `audlog` | per CA SDM admin config | CA SDM DB | Vendor-managed, mimo nášho scope |
| BFF audit log — `auth`, `authz`, `security`, `sensitive` | **1 rok** (r2 finalized) | Append-only S3 / equivalent immutable storage | Forensic minimum; tenant compliance |
| BFF audit log — `data` category | **3 roky** (r2 finalized) | Same storage, separate retention class | GDPR Art. 30 records of processing |
| Reverse proxy access log | **90 dní** | SIEM hot tier; cold archive 1 rok | Operational debugging + incident response |
| Sentry frontend errors | **90 dní** | Sentry org default (alebo GlitchTip self-hosted per 04 ADR 09) | Diagnostic only, not audit-grade |
| CSP violation reports | **30 dní** | SIEM | Operational; spikes are real-time alerted |

> Hodnoty sú MVP defaults (r2 finalized). Per-tenant alebo per-compliance-region
> override je možný cez config (gating na `[?]` legal / DPO review). 1 rok pre
> auth a 3 roky pre data je v súlade s typickou EU compliance baseline (GDPR
> Art. 30 records of processing + LMA SK 18/2018 audit požiadavky).

## 6. GDPR — kľúčové ohraničenia

### 6.1 Categories of personal data

CA SDM tickets obsahujú:

| Field | GDPR category | Notes |
|---|---|---|
| `cnt.first_name`, `cnt.last_name` | Identifying | – |
| `cnt.email`, `cnt.phone_number` | Contact | – |
| `cnt.organization`, `cnt.location` | Affiliation | – |
| `cnt.userid` | Authentication | – |
| Ticket `description`, `comments` | Free-text — môže obsahovať čokoľvek | High risk — users posting passwords, IDs, health info |
| Activity log (`act_log`) | Audit trail of user actions | – |
| Attachment content | Variable | Files môžu obsahovať akúkoľvek PII |

### 6.2 Princípy aplikované v novom FE

| Princíp | Aplikácia |
|---|---|
| **Lawfulness, fairness, transparency** | Privacy notice v portal footer; cookie banner len ak používame analytics (mimo Sentry — Sentry funguje s legitimate interest pre error tracking, no cookies dropped). |
| **Purpose limitation** | BFF logy obsahujú minimal data potrebné pre forensics. Žiadne marketing tracking. |
| **Data minimization** | UI requestuje len fields, ktoré zobrazuje. Žiadne `SELECT *` cez `WC` (whitelist polí). |
| **Accuracy** | CA SDM je system of record. FE nepridáva derived data, ktoré by sa rozišli. |
| **Storage limitation** | Retention §5; purge job pre BFF log. |
| **Integrity, confidentiality** | Encryption at rest (audit log), HTTPS in transit, RBAC scope. |
| **Accountability** | Audit log of access events; controller designation v privacy notice. |

### 6.3 Data subject rights — operational impact

| Right | UI / process |
|---|---|
| **Access** (Art. 15) | Self-service na portal `/me/data` — exportuje vlastné ticket history. Post-MVP feature. CA SDM admin tooling postačí pre MVP. |
| **Rectification** (Art. 16) | User môže upraviť own profile fields v portal. Inak admin process. |
| **Erasure** (Art. 17) | Out of MVP scope. CA SDM admin policy. Audit log obsahuje **pseudonymizovaný** identifier (hash), nie raw email — tým je možný erasure user data bez zničenia audit trail. |
| **Restriction** (Art. 18) | Admin tooling. Mimo MVP UI scope. |
| **Portability** (Art. 20) | Export ticket history ako JSON / CSV. Self-service. Post-MVP. |
| **Object** (Art. 21) | n/a — žiadny automated decision-making, žiadne marketing. |
| **No automated decision** (Art. 22) | n/a — žiadne high-impact automated decisions. |

### 6.4 Cookies a tracking

| Cookie / mechanism | Purpose | Consent required |
|---|---|---|
| `__Host-sdm.sid` | Session | **No** — strictly necessary (login functionality) |
| `__Host-sdm.tenantVer` | Tenant version | **No** — strictly necessary |
| `__Host-sdm.csrf` (if used) | CSRF | **No** — strictly necessary |
| Sentry session-replay | Diagnostic | **Disabled by default in MVP** (would require consent banner). Only error capture enabled — legitimate interest. |
| Analytics (GA, Mixpanel, ...) | Marketing | **Out of MVP scope** |

> Žiadne tracking pixels, žiadne 3rd-party analytics v MVP. Privacy-first design.

### 6.5 Sub-processors

| Sub-processor | Purpose | Data shared |
|---|---|---|
| IdP (Azure AD / Keycloak corp) | Auth | username, email, group claims |
| Sentry (self-hosted or SaaS) | Error tracking | session id (hashed), correlationId, error stack, route template |
| SIEM / log storage | Audit | structured BFF logs |
| Cloud storage (S3 / Azure Blob) | Audit log archive | structured BFF logs |

Privacy notice musí explicitly listovať sub-processors a ich purpose.

### 6.6 Cross-border transfer

On-prem deployment je default — žiadne cross-border transfer. SaaS Sentry / IdP môžu vyžadovať DPA s standard contractual clauses. Žiadne customer PII do US-based services bez DPA + SCC.

## 7. Compliance reporting — automated outputs

BFF (alebo separate report runner) generuje pravidelné reporty pre compliance team:

| Report | Frequency | Audience |
|---|---|---|
| Audit log digest — `authz` denials per tenant | Týždenné | Tenant admins |
| Cross-tenant SP operations summary | Mesačné | Compliance + DPO |
| Step-up auth events | Mesačné | Security ops |
| Suspicious patterns (rapid 403, login failures) | Real-time alerts | Security ops |
| Retention compliance check | Mesačné | DPO |

## 8. Backups & DR

| Vrstva | Backup | RPO | RTO |
|---|---|---|---|
| BFF session store (Redis) | Snapshots if persistent | 1h | n/a — sessions are ephemeral, users re-login on DR |
| BFF audit log | Replicated immutable storage | 0 (write-time replication) | 1h |
| CA SDM | Vendor-managed | per CA SDM admin | per CA SDM admin |

> Session store **nemusí** mať backup — re-login je acceptable DR.
> Audit log MUSÍ mať replicated storage — strata audit trail je compliance breach.

## 9. Incident response — log-driven runbook

Pre security incident (suspected breach, leakage, account takeover):

1. **Capture** — snapshot BFF audit log od T-7 dní, reverse proxy log od T-7 dní, CA SDM audlog dump.
2. **Correlate** — `correlationId` cross-trace BFF → CA SDM.
3. **Identify** — affected `userId`, `tenantId`, `sessionId.hash`.
4. **Contain** — admin force-terminates affected session(s); rotate session secrets if needed.
5. **Notify** — DPO triggers GDPR Art. 33 (72h breach notification) if confirmed.
6. **Remediate** — patch identified vulnerability.
7. **Lessons learned** — update threat model + add test case.

Detail incident-response procedury je business / DevOps doc, mimo scope tohto artefaktu.

## 10. Reviewer's checklist — per feature security review

Inštrukcia pre `buddy:security-review` pri novej feature:

- [ ] Aké nové eventy v audit log? Su v taxonomii §2?
- [ ] Sú nové fields pseudonymizované / redacted ak sensitive?
- [ ] Retention class správna?
- [ ] Existujú nové sub-processors?
- [ ] Existuje nová PII collection?
- [ ] Privacy notice update potrebný?
- [ ] GDPR data subject rights — feature ich umožňuje?

## Otvorené závislosti

- `[04-architecture]` SIEM destinácia (Splunk / ELK / cloud provider) — voľba ovplyvní log forwarder config. Kontrakt eventov je destination-agnostic. Per 04 ADR 09 `log-aggregation` flag — DevOps decision.
- `[04-architecture]` Audit log storage backend (immutable S3 vs. WORM filesystem vs. dedicated audit DB) — DevOps decision.
- `[04-architecture]` Sentry hosting model — self-hosted GlitchTip (on-prem-friendly, no DPA needed) vs. Sentry.io SaaS (DPA required, EU region). Per 04 ADR 09 `error-tracking-product` flag — DevOps + Security spoluvyberajú.
- `[04-architecture]` `correlationId` formát — `[resolved-in-round-2]` UUID v4 default; ULID acceptable per 04 ADR 09 `correlation-id-spec` flag.
- `[08-devex-devops]` Log rotation, shipping, retention enforcement — `[resolved-in-round-2]` čiastočne: 08 `ci-cd.md` r2 publikuje security-audit job (npm audit + CodeQL/Snyk per 08 r2). Konkrétny cron/config pre log rotation zostáva DevOps detail.
- `[08-devex-devops]` Privacy notice content (legal text) — business / legal decision.
- `[02-ux-persona-analyst]` GDPR self-service UI (data export, profile edit) — post-MVP, but UX hint needed for v1 backlog.
- `[10-documentation-author]` Operational runbooks (incident response, GDPR request handling) — konsolidácia v doc handbook.
- `[?]` Retention values — `[resolved-in-round-2]` 1 rok pre auth, 3 roky pre data (r2 finalized; final autorita = legal / DPO review pred go-live).
- `[?]` Step-up TTL — `[resolved-in-round-2]` **5 min** (r2 finalized).
- `[?]` Idle timeout — `[resolved-in-round-2]` **30 min** default (r2 finalized).
- `[?]` Reopen time-box — `[resolved-in-round-2]` **7 dní** (r2 finalized).
- `[?]` Bulk step-up threshold — `[resolved-in-round-2]` **> 50** (r2 finalized).
- `[?]` Privacy notice owner — kto píše, kto schvaľuje (zostáva otvorené).
