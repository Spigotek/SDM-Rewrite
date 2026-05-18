# F.4 — BFF Platform (audit, config, health, CSRF refinement)

> **Status**: 🔜 (paralelizovateľné s F.3, ale odporúča sa po F.3 merge pre stabilný integration surface)
> **Branch**: `chunk/F.4-platform` (od `main` po F.3 merge alebo paralelne)
> **PR**: —

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

- [ ] Audit eventy emit-ujú sa na: `auth.login.{success,failure}`, `auth.logout`, `auth.session.expired`,
      `auth.tenant.switched`, `authz.permission.denied`, `security.csrf.rejected`, `data.<entity>.{read,write,delete}`
- [ ] `/config` endpoint vracia plný shape per `runtime-config.md` (cache no-store, hot-reload pri file change)
- [ ] `/readyz` ping CA SDM s timeout 2s; ak fail → `503` + structured reason
- [ ] Vitest + integration testy zelené
- [ ] Live smoke: `curl /readyz` → 200 keď real B-E up, 503 keď down (simulujem cez network namespace alebo bad URL)
- [ ] ROADMAP + F.4 status → ✅ DONE

## Stratégia

### Fáza A — 3 paralelné subagenty

| #   | Subagent          | Cieľ                                                                                                                             |
| --- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| A1  | `general-purpose` | Audit module — events.ts taxonómia (extract z audit-and-compliance.md), emit.ts helper, unit testy + hook do existujúcich routes |
| A2  | `general-purpose` | Config module — full RuntimeConfig Zod schema (from runtime-config.md), file-watcher loader, endpoint handler, testy             |
| A3  | `general-purpose` | Health module — readyz CA SDM ping logic, timeout, structured response, testy                                                    |

### Fáza B — main thread

Integrácia subagent outputov: middleware order, register all routes, end-to-end test.

## Open questions / risks

- **Audit retention**: per `audit-and-compliance.md §5` 1 rok pre auth/authz/security, 3 roky pre
  data. F.4 emituje len stdout (pino) — log shipper konfiguráciu vlastní 08-devex-devops v
  separate chunku (kandidát: G.3 Observability). F.4 deklaruje **kontrakt**, neimplementuje retention.
- **PII redaction**: pino `redact` config už v F.1 stub-e. F.4 musí pridať: emails, full names,
  IP addresses (keep last octet hashed). Test-overiteľné v `audit-emit.test.ts`.
- **`/config` runtime reload**: file-watcher (chokidar?) má overhead. Alternative: lazy re-read
  na každý GET /config (cheap, no watcher). Odporúčanie: lazy re-read v MVP, watcher post-MVP.
- **Sampling**: per `audit-and-compliance.md §3` niektoré eventy sú 100%, iné 10%. F.4 implementuje
  config-driven sampling rate per event name.
