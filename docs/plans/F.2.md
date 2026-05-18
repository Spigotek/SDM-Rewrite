# F.2 — BFF REST proxy

> **Status**: ✅ DONE (PR pending; stacked on `chunk/F.1-bff-auth` until F.1 PR #9 merges)
> **Branch**: `chunk/F.2-rest-proxy` (od `chunk/F.1-bff-auth`, rebase na `main` po F.1 merge)
> **PR**: —

## Pivot vs ROADMAP

ROADMAP: _"REST proxy — tenant scoping, X-Role injection, XML→JSON adapter, error shaper."_

Žiadny pivot. Drobné upresnenia:

- **Scope = MVP entity set**: `incidents` (CA SDM factory `in`), `requests` (`cr`), `problems`
  (`pr`), `changes` (`chg`), `kb_articles` (`kd`), `cis` (`nr`). Audit eventy zostávajú v F.1
  basic, plná taxonómia ide F.4.
- **XML→JSON**: CA SDM 17.4 default Content-Type je XML; preferujeme `Accept: application/json`
  s fallbackom na XML parsing. Knižnica: `fast-xml-parser` (zero deps, sync, akceptovateľná
  performance per bff.md §2.3).
- **Tenant scoping**: BFF **vždy** vloží tenant WC filter do read query, ak chýba (defensive in-depth
  per `multi-tenancy-security.md §3`). Mutating endpointy validujú `tenantId` v body proti session.

## Inputs

- `docs/agents/architecture/components/bff.md` §2.3 (REST proxy, Error shaper)
- `docs/agents/api-analyst/endpoints.md` — REST endpoint katalóg
- `docs/agents/api-analyst/multi-tenancy.md` — tenant scoping rules
- `docs/agents/architecture/decision-records/{08-error-handling,11-multi-tenancy}.md`
- `docs/agents/devex-devops/real-backend-contracts.md` — F.1 deliverable (real B-E shapes)
- `apps/bff/src/auth/sdm-broker.ts` — F.1 deliverable (access_key access)
- `apps/bff/src/aggregator/me.ts` — F.1 deliverable (session shape)
- `packages/api-client/src/errors.ts` — `AppError` taxonómia (FE-side, BFF replikuje)
- `packages/api-mocks/src/handlers/{incidents,requests,problems,changes,knowledge,cmdb}.ts` —
  current FE-facing shapes (BFF musí matchovať pre VITE_USE_MOCKS=false bez breakov)

## Outputs

```
apps/bff/src/api/
├── rest-proxy.ts         # generic REST proxy: inject X-AccessKey, X-Role, X-CA-SDM-Tenant, WC filter
├── tenant-scoping.ts     # WC filter injection + body tenant validation
├── xml-json.ts           # fast-xml-parser adapter (CA SDM XML → JSON)
├── error-shaper.ts       # CA SDM HTTP → AppError taxonomy (AUTH_EXPIRED vs AUTH_FORBIDDEN diff)
├── endpoints/
│   ├── incidents.ts      # POST/GET/PUT/DELETE /api/incidents/* → /caisd-rest/in/*
│   ├── requests.ts       # → /caisd-rest/cr/*
│   ├── problems.ts       # → /caisd-rest/pr/*
│   ├── changes.ts        # → /caisd-rest/chg/*
│   ├── kb.ts             # → /caisd-rest/kd/*
│   ├── cmdb.ts           # → /caisd-rest/nr/*
│   └── reference.ts      # priorities/statuses/severities (cache TTL 15 min)
├── cache.ts              # node-lru-cache wrapper, TTL by route
└── routes.ts             # register all endpoints to Hono app

apps/bff/src/tests/
├── rest-proxy.test.ts
├── tenant-scoping.test.ts
├── xml-json.test.ts
├── error-shaper.test.ts
└── endpoints/*.integration.test.ts   # vitest + MSW Node fake real B-E

docs/agents/devex-devops/real-backend-contracts.md  # extend s entity endpoints
```

## Done-when

- [x] `pnpm -r typecheck` / `lint` / `build` / `test` zelené (143 BFF tests, full workspace clean)
- [x] Unit testy: REST proxy header injection matrix (14), tenant WC filter missing/present/escape (15), XML→JSON (11, F.1 + F.2 fixtures), error shaper 400-expired vs 401-forbidden vs 409-as-NOT_FOUND vs 5xx (21)
- [x] Integration testy: každá entity endpoint CRUD happy + 1 error path cez MSW Node (21 tests in `api-endpoints.integration.test.ts` — incidents full CRUD + 409→404 quirk, requests `type=R` enforcement, problems numeric `@COMMON_NAME` handling, changes schema divergence, KB uppercase factory + UPPERCASE attrs, CMDB delete_flag soft-close + GUID PK, reference cache hit/miss + invalidation)
- [x] Live smoke proti real `10.11.35.35:8050` — `GET /api/incidents` (209 records, FK fields collapsed + epoch→ISO), `GET /api/incidents/:id`, `GET /api/changes` (schema divergence: `chg_ref_num`+`requestor`+`chgstat`), `GET /api/kb` (uppercase factory), `GET /api/reference/priorities` (cached on 2nd call), `GET /api/incidents/99999` → 404 NOT_FOUND. Bit-by-bit shape match with `@sdm/api-mocks` deferred to F.5 cleanup (per D4 cross-chunk).
- [x] Reference cache invalidation overená (vitest TTL + manual `POST /api/reference/_invalidate` smoke)
- [x] ROADMAP + F.2 status → ✅ DONE

## Stratégia

### Fáza A — 2 paralelné subagenty (ak F.1 dodal real B-E contracts)

| #   | Subagent          | Cieľ                                                                                                                                              |
| --- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | `Explore`         | Rozšíriť `real-backend-contracts.md` o entity endpoints (`in`, `cr`, `pr`, `chg`, `kd`, `nr`) — read query shape, mutating shape, error responses |
| A2  | `general-purpose` | XML→JSON adapter (`fast-xml-parser` wrapper) + unit testy s capture-ovanými XMLs                                                                  |

### Fáza B — main thread (sekvenčne)

1. `tenant-scoping.ts` — WC filter merger (parse existing WC + inject `tenant=U'<id>'`)
2. `error-shaper.ts` — CA SDM HTTP → `AppError` mapping
3. `rest-proxy.ts` — orchestruje: load session → inject headers → tenant scope → call CA SDM →
   XML→JSON → cache (pre reference) → shape error
4. `endpoints/<entity>.ts` — payload remap (CA SDM camelCase normalization per `@sdm/api-types`)
5. `routes.ts` — register

### Fáza C — verifikácia + PR

## Open questions / risks

- **Reference data scope**: ktoré factory sú reference (priorities, statuses, severities,
  impact, urgency, organization, ...)? Plný zoznam od api-analyst — overiť pri implementácii.
- **CA SDM camelCase**: niektoré factory majú `last_mod_dt`, iné `lastModDt`. `@sdm/api-types`
  by mal byť authoritative — sync s domain modeller-om ak shape divergencia.
- **Pagination**: CA SDM má `start=0&count=25` query params. BFF translates `page/size` → `start/count`.
  Per-endpoint, alebo generic? Riešenie: generic v `rest-proxy.ts`.
- **Body size limit**: attachment upload (multipart) má samostatný chunk (F.3 alebo ad-hoc). F.2
  pokrýva len JSON bodies, max 1 MB (Hono default → explicit limit).
