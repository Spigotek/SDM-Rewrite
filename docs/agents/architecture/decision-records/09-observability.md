# ADR-09 — Observability vo FE a BFF

**Status**: accepted
**Dátum**: 2026-05-15
**Autor**: 04-architecture agent (runId 20260508-192438, round 1)

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

**Voľba**: **Sentry** (alebo `GlitchTip` ako open-source self-hosted
alternatíva — DevOps + Security spolurozhodne).

Setup:
- `@sentry/browser` v obidvoch SPA, init v `App Bootstrap`.
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

**Format** (JSON Lines):
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

| # | Flag | Smer | Popis |
|---|---|---|---|
| 1 | `error-tracking-product` | → 05-security, 08-devex-devops | Sentry SaaS vs. GlitchTip self-hosted. Závisí od customer security policy. |
| 2 | `log-aggregation` | → 08-devex-devops | Kam BFF logy idú (stdout → Loki / ELK / Splunk). |
| 3 | `metrics-exporter` | → 08-devex-devops | Prometheus / iný — pre BFF / RUM metrics. |
| 4 | `gdpr-data-policy` | → 05-security | Plný DPIA pre Sentry / RUM — Security agent finalizuje. |
| 5 | `correlation-id-spec` | → 08-devex-devops | Formát (UUID v4 vs. ULID), header name (`X-Correlation-ID`), TTL. |
