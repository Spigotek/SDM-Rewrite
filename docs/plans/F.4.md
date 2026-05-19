# F.4 — BFF Platform (audit, config, health, CSRF refinement)

> **Status**: ✅ DONE
> **Branch**: `chunk/F.4-platform` (od `main` po F.3 merge)
> **PR**: pending

## Pivot vs ROADMAP

ROADMAP: _"Platform — pino audit logger, /config endpoint, /health + /readyz proper checks,
CSRF middleware."_

Drobné upresnenie:

- **CSRF middleware už v F.1** (per `F.md` D5). F.4 môže CSRF **rozšíriť** ak treba (napr. token
  rotation pri tenant switch), ale Origin/Referer baseline je z F.1. Možný F.4 prínos: audit
  log pre CSRF rejection (`security.csrf.rejected` event).
- **`/config` endpoint** = plný `RuntimeConfig` shape per `docs/agents/devex-devops/runtime-config.md`
  (nie minimalistický mock shape z E.1). FE už očakáva malý subset; F.4 ho rozšíri so spätnou
  kompatibilitou (default-y zachovajú aktuálny shape).
- **Audit logger** = 40-event taxonómia per `audit-and-compliance.md §2`. F.4 emituje eventy
  na key body v auth + tenant + api flows.

## Inputs

- `docs/agents/architecture/components/bff.md` §2.5 (Platform)
- `docs/agents/security/audit-and-compliance.md` §2 (event taxonómia), §3 (sampling), §5 (retention)
- `docs/agents/devex-devops/runtime-config.md` — full `RuntimeConfig` schema
- `docs/agents/security/owasp-mitigations.md` — CSRF refinement context
- `apps/bff/src/auth/routes.ts` + `apps/bff/src/aggregator/*` — F.1-F.3 deliverables (audit hook
  body points)

## Outputs

```
apps/bff/src/platform/
├── audit/
│   ├── events.ts         # canonical 40-event const map (auth.*, authz.*, sensitive.*, security.*, data.*)
│   ├── emit.ts           # auditEvent({ category, name, sensitivity, ... }) helper
│   └── middleware.ts     # per-request audit hook (already wired in F.1, F.4 fills in events)
├── config/
│   ├── types.ts          # RuntimeConfig + sub-schemas (per runtime-config.md)
│   ├── load.ts           # file-watcher based loader (process.cwd()/config.json)
│   └── endpoint.ts       # GET /config (no-cache headers)
└── health/
    ├── liveness.ts       # GET /health (current stub)
    ├── readiness.ts      # GET /readyz — CA SDM ping (GET /caisd-rest/sevrty?size=1)
    └── routes.ts

apps/bff/src/tests/platform/
├── audit-emit.test.ts
├── config-load.test.ts
├── readiness.test.ts
└── csrf-audit.integration.test.ts
```

## Done-when

- [x] Audit eventy: `auth.login.{success,failure}`, `auth.logout`, `auth.session.heartbeat`
      (sampled 1:100), `auth.session.{idle,absolute}.expired`, `authz.tenant.switch.{success,denied}`,
      `security.csrf.violation`, `data.<entity>.{write,delete}` (reads = 0 % sampling per §3,
      reverse proxy handle-uje). `authz.permission.denied` framework-ready (no RBAC at BFF MVP).
- [x] `/config` vracia plný `RuntimeConfig` shape per `runtime-config.md` s
      `Cache-Control: no-store`. Lazy re-read na každý GET (žiadny chokidar watcher v MVP per
      Open questions). Env overrides pre `meta.*` + `auth.bffOrigin` (deploy-injected).
- [x] `/readyz` 2-step probe: cached broker bootstrap (5 min refresh threshold) + `GET /pri?size=1`
      s 2 s timeout. 200 ready / 503 not_ready + structured `checks` + `reason`.
- [x] Vitest + integration testy zelené (27 nových platform testov, repo total 192 BFF testov).
- [x] Live smoke `scripts/smoke-f4.sh` zelený: /config + /readyz (200 ready) proti real
      `10.11.35.35:8050`, negative path overený s wrong creds (503 + reason).
- [x] ROADMAP + F.4 status → ✅ DONE

## Stratégia (executed)

Main-thread sequenced (per F.4 retrospective — riziko subagent merge konfliktov na shared
touchpoints `auth/routes.ts`, `security/csrf.ts`, `index.ts` bolo neúmerné času ušetrenému
paralelizmom). Poradie:

1. Audit modul (`events.ts` taxonómia + `redact.ts` PII scrubbing + `emit.ts` Hono-context-aware helper)
2. Hook emits do existing routes (auth/me/csrf/entity-routes — `audit?: AuditEmitter` ako optional
   field na shared deps interfaces, wired in `buildApp`)
3. Config modul (Zod schema + file loader + env overrides + endpoint handler)
4. Health modul (cached broker bootstrap + `/pri?size=1` probe s 2 s timeout)
5. Wire all v `index.ts`, register order: secureHeaders → correlation → logger → CSRF (with audit)
   → health → config → auth → me → api → aggregator

## Open questions / risks (resolved)

- **Audit retention**: per `audit-and-compliance.md §5` 1 rok pre auth/authz/security, 3 roky pre
  data. F.4 emituje len stdout (pino) — log shipper konfiguráciu vlastní 08-devex-devops v
  separate chunku (kandidát: G.3 Observability). F.4 deklaruje **kontrakt**, neimplementuje retention.
- **PII redaction**: implemented v `platform/audit/redact.ts` — hard-redact (passwords, tokens,
  cookies, access keys, sid raw) + SHA256 pseudonymize (email, recordId, sessionId) + userAgent
  truncate to 200 chars. Test `audit-redact.test.ts` overuje "no banned substring v serialised line".
  IP redaction (last octet hash) odložené — IP zachytávame ako `unknown` v MVP keď nie je
  reverse-proxy header (X-Forwarded-For prvé políčko sa berie).
- **`/config` runtime reload**: lazy re-read na každý GET — žiadny chokidar watcher (per MVP
  recommendation; ENOENT fallback to defaults v dev, fail-loud v prod cez `BFF_REQUIRE_CONFIG_FILE=true`).
- **Sampling**: `samplingRate(eventName)` v `events.ts`; aktuálne hardcoded (session.heartbeat = 0.01,
  rest = 1.0). Config-driven sampling rate per event name → ak treba (G.3 Observability chunk).
- **`authz.permission.denied`** — Done-when wording mentions it, ale BFF v MVP nemá RBAC enforce
  (FE permission checks). Event name + framework ready; emit site príde keď BFF dostane explicit
  RBAC middleware (post-MVP). Marker v `events.ts AUDIT_EVENTS.authz.PERMISSION_DENIED`.
