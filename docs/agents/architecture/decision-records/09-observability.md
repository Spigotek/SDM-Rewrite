# ADR-09 — Observability vo FE a BFF

**Status**: accepted (FE error tracker finalizovaný v r2)
**Dátum**: 2026-05-15
**Autor**: 04-architecture agent (runId 20260508-192438, round 1+2)

## Changelog (round 2)

- 06 v `tech-stack-selector/libraries.md` zvolil **`@sentry/react`** (FE
  error tracking). GlitchTip zostáva ako alternatíva pre self-hosted variant
  (08 + 05 spoločne rozhodnú podľa customer security policy).
- 05 v `security/audit-and-compliance.md` definoval **~40 eventov v 5
  kategóriách** (`auth`, `authz`, `sensitive`, `security`, `data`) — táto
  taxonomia je teraz autoritatívna pre BFF audit logger.
- 08 destinácia logov: **JSON stdout (pino) → log aggregátor (ELK alebo
  Loki) cez DevOps** (per `security/audit-and-compliance.md`). SIEM connector
  post-MVP.
- Flag `error-tracking-product` `[resolved-in-round-2]` (Sentry primárne,
  GlitchTip ako self-hosted fallback v `risks.md` A-104).

## Kontext

GOAL §5 NFR: "štruktúrované logy v BFF (ak bude), error tracking (Sentry
alebo ekvivalent), real user monitoring nice-to-have".

Konkrétne potreby:
- **Error tracking** — capture JS exceptions, unhandled rejections, render
  errors. Stack trace. Source maps. Per-release fingerprint.
- **Audit trail v BFF** — kto, kedy, na čo, z ktorého tenantu. Bez PII.
- **Performance metrics** — Core Web Vitals (LCP, INP, CLS) pre TTI cieľ
  validáciu na portáli.
- **Correlation** — FE error → BFF request → CA SDM call. Spoločný
  `correlationId` cez celý stack.
- **Compliance** — GDPR, žiadne PII (mená, emaily) v error tracking platforme.

## Rozhodnutie

**Trojvrstvová observability**:

### 1. FE: Error tracking platforma

**Voľba**: **`@sentry/react`** (06 stack pick). GlitchTip zostáva ako
self-hosted Sentry-compatible alternatíva — vzhľadom na rovnaký DSN protokol
je prepnutie iba zmena `sentryDsn` v `config.json` (08 `runtime-config.md`).

Setup:
- `@sentry/react` v obidvoch SPA, init v `App Bootstrap` cez
  `Sentry.init({ dsn: config.observability.sentryDsn, ... })`.
- Capture: `errors`, `unhandledRejection`, React error boundary.
- Beforesend filter: striktne `details` field a PII z `extra` (mená, emaily
  cez allowlist regex).
- Source maps upload v CI (vlastný projekt per app — `portal-prod`,
  `workspace-prod`).
- Release fingerprint = git SHA, prepojené s GitHub releases.
- User context: len `userId` (pseudonymizovaný), `tenantId`, `locale`.
  **Žiadne user emaily ani mená.**

### 2. FE: Custom analytics (RUM)

MVP nice-to-have, **post-MVP must-have**:
- `web-vitals` library capture LCP, INP, CLS, FCP, TTFB.
- POST na BFF `/api/_telemetry` (sampling 10 %).
- BFF agreguje a posiela do `metrics` exporteru (Prometheus / iné — DevOps).

V MVP: Sentry už dáva basic performance metrics ak je session replay alebo
performance monitoring enabled. Štart s tým, RUM dedikovaný do v1.

### 3. BFF: Štruktúrované logy + traces

**Logger**: `pino` 9 (JSON Lines, stdout). Žiadny vlastný serializer; pino
schémy s `serializers.err` + `redact: ['req.headers.authorization', '*.password']`
sú dostatočné.

**Audit event taxonómia (autoritatívne — 05)**: BFF audit logger používa
kategórie a event names z `security/audit-and-compliance.md` § 2:
- `auth.*` (login, logout, session, MFA) — ~10 eventov
- `authz.*` (permission decisions, RBAC denies) — ~7 eventov
- `sensitive.*` (cross-tenant, admin operations, impersonation) — ~8 eventov
- `security.*` (rate-limit, CSP violations, suspicious activity) — ~6 eventov
- `data.*` (CRUD on regulated entities) — ~9 eventov

BFF v `audit` middleware vyfiltruje request → emit event s príslušným
`category.event` tagom. Sampling per `audit-and-compliance.md` § 3.

**Destinácia**: **JSON stdout → log shipper** (filebeat / vector / promtail
podľa DevOps voľby) → **ELK alebo Loki** (08 finalizuje konkrétny stack
v post-MVP topológii; obidva sú line-stream-compatible). **SIEM connector
(Splunk / QRadar / Sentinel) je post-MVP** — taxonómia eventov je
destination-agnostic, žiadny rework kontraktu.

**Format** (JSON Lines, pino default + náš `auditEvent` field):
```json
{
  "ts": "2026-05-15T10:33:21.412Z",
  "level": "info",
  "msg": "request completed",
  "requestId": "req_01HX...",
  "correlationId": "cor_01HX...",
  "userId": "u-abc123",
  "tenantId": "t-xyz789",
  "method": "GET",
  "path": "/api/tickets/incident/INC-1042",
  "status": 200,
  "latencyMs": 127,
  "casdm": {
    "calls": 4,
    "totalMs": 95,
    "errors": 0
  }
}
```

Levels: `debug`, `info`, `warn`, `error`. Default `info` v prod, `debug` v dev.

**Žiadne PII** — mená, emaily, raw ticket descriptions sa neloggujú.
`requestId` je per-request UUID; `correlationId` je per-trans-akcia
(prechádza viacerými requestmi pri redirect / refresh flows).

Trace context z FE: FE pošle header `X-Correlation-ID` (vygenerovaný v
`@sdm/api-client` raz per user action), BFF ho propagator.

Sentry events z FE majú `tags.correlationId` matching BFF log.

### 4. Health endpoints (BFF)

- `GET /health` — proces je hore (vždy 200).
- `GET /ready` — synthetic ping na CA SDM (`GET /caisd-rest/sevrty?size=1`
  cached 60 s), session store live.

## Dôsledky

**Pozitívne**:
1. **Fast triage** — FE error v Sentry → klik na `correlationId` → BFF log
   line → CA SDM call detail. End-to-end debug v sekundách.
2. **GDPR-friendly** — pseudonymizované ID, žiadne PII v error platforme
   ani logoch.
3. **Performance regression catch** — Core Web Vitals tracking dáva alarm
   ak TTI prekročí budget.
4. **Source maps** — readable stack traces v Sentry.
5. **Self-hostable** — GlitchTip alternatíva ak Sentry SaaS nie je vhodný
   pre customer security policy.

**Negatívne**:
1. **Sentry SaaS náklady** — pri väčšom volume nezanedbateľné. GlitchTip
   self-hosted ekv. má vlastné DevOps náklady.
2. **CorrelationId discipline** — každý API call v `@sdm/api-client` musí
   ho generovať. Vyriešené v jednom mieste (api-client interceptor).
3. **Sampling RUM** — 10 % sampling znamená rare events môže missnúť.
   Acceptable pre v1.

## Alternatívy

### A) Console.log + server-side journald

**Prečo zamietnuté**:
- Žiadny error tracking platform → debugging je archeology v gigabyte logov.

### B) Datadog / New Relic / Dynatrace

**Prečo nepreferované**:
- Enterprise APM tools s vyššími nákladmi. Pre náš scope Sentry / GlitchTip
  stačí. Re-evaluate v post-MVP ak customer požaduje konkrétny vendor.

### C) Vlastný logging stack (ELK / Loki + Grafana)

**Prečo nepreferované pre error tracking**:
- ELK rieši log aggregation, nie error tracking (žiadne fingerprinting,
  per-release issue management, release health). Použiteľné pre BFF logs
  (DevOps), ale nie ako error tracking platform.
- Možný hybrid: ELK / Loki pre logs + Sentry/GlitchTip pre errors. DevOps
  agent rozhodne.

## Otvorené závislosti

| # | Flag | Smer | Popis | Status |
|---|---|---|---|---|
| 1 | `error-tracking-product` | (vlastné) | `@sentry/react` (FE); GlitchTip self-hosted ako compatible swap (08 + 05 podľa security policy). | `[resolved-in-round-2]` |
| 2 | `log-aggregation` | → 08-devex-devops | JSON stdout → ELK alebo Loki (08 voľba); SIEM post-MVP. | `[resolved-in-round-2]` (stack-agnostic dest); konkrétne ELK/Loki vlastní 08. |
| 3 | `metrics-exporter` | → 08-devex-devops | Prometheus alebo Loki metrics. | open (post-MVP, RUM dedikovaný v1) |
| 4 | `gdpr-data-policy` | → 05-security | Pokryté `security/audit-and-compliance.md` retention table (§5) + Sentry `beforeSend` v r1. | `[resolved-in-round-2]` |
| 5 | `correlation-id-spec` | → 08-devex-devops | Formát: **ULID** (lexicograficky sortable v logoch), header `X-Correlation-ID`, TTL = request lifetime. | `[resolved-in-round-2]` (ULID + `X-Correlation-ID` rozhodnutie tu) |
