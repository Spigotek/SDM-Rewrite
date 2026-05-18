# F.1 — BFF Auth module

> **Status**: 🔜 NEXT
> **Branch**: `chunk/F.1-bff-auth` (od `main`)
> **PR**: —

## Pivot vs ROADMAP

ROADMAP wording: _"Auth module — SSO callback (OIDC), session manager (Redis + in-memory adapter),
CA SDM access key broker."_

Po E.3 planning sa scope upravil:

- **OIDC out, Basic Auth in.** Reálny CA SDM B-E (`10.11.35.35:8050`) je k dispozícii s Basic Auth
  na `/caisd-rest/rest_access`. OIDC vyžaduje corp IdP, ktorý zatiaľ neexistuje. OIDC SSO ide do
  samostatného chunku post-MVP. Per `auth-flow.md §0` table, Basic Auth je canonical alternatíva,
  nie hack.
- **Redis out, in-memory only.** Per `F.md` D2 — `SessionStore` interface ready ako drop-in pre
  Redis, samotná Redis impl odložená.
- **CSRF middleware ostáva v F.1** (per `F.md` D5).
- **Audit logger plná taxonómia odložená do F.4** (per `F.md` D6) — F.1 píše basic structured logs
  s correlationId.

## Inputs (load do /clear)

- `docs/agents/security/auth-flow.md` — kompletný (canonical flow §2, token contract §4, mapping §5)
- `docs/agents/architecture/components/bff.md` §2.0–2.2 (Runtime stack, Gateway, Auth module)
- `apps/bff/src/index.ts` — existujúci Hono stub (rozšíriť, nie prepísať)
- `apps/bff/package.json` — current deps (`hono@4.6`, `pino@9`; chýbajú `zod`, http-client)
- `packages/auth/src/session.ts` — `Session` typ + `SessionStatus` (FE-side reference, BFF nech sa
  zarovná)
- `packages/domain/src/ids.ts` — branded IDs (`TenantId`, `UserId`, `ContactId`, `RoleId`)
- `packages/domain/src/permissions.ts` — `UIRole` taxonómia + `ROLE_PERMISSIONS` map
- `packages/api-mocks/src/handlers/{auth,users,tenants}.ts` — mock shape ako sanity reference

## Outputs

```
apps/bff/src/
├── config/
│   ├── schema.ts        # Zod-validated env config (oidc-deferred, casdm, session, bff)
│   └── load.ts          # process.env → typed RuntimeConfig
├── session/
│   ├── types.ts         # SessionPayload, SessionStore interface
│   ├── memory-store.ts  # in-memory Map<sid, payload> + setTimeout TTL cleanup
│   └── index.ts         # createSessionStore(config) factory
├── security/
│   ├── cookies.ts       # __Host-sdm.sid set/parse/clear utilities
│   └── csrf.ts          # Origin/Referer check middleware
├── auth/
│   ├── sdm-broker.ts    # CA SDM Access Key: POST /rest_access, refresh, DELETE
│   ├── routes.ts        # /auth/login, /auth/logout, /auth/heartbeat
│   └── correlation.ts   # X-Correlation-ID generation + propagation
├── aggregator/
│   └── me.ts            # /me (canonical §4.5 shape), /me/tenants, /me/active-tenant
├── index.ts             # wire all routes + middlewares
└── tests/
    ├── session-store.test.ts
    ├── csrf.test.ts
    ├── cookies.test.ts
    ├── sdm-broker.test.ts        # vitest + MSW Node mock real B-E
    └── auth-flow.integration.test.ts   # full login → /me → logout cez app.fetch

docs/agents/devex-devops/real-backend-contracts.md   # captured real B-E response shapes
```

## Done-when

- [ ] `pnpm -r typecheck` / `lint` / `build` / `test` zelené
- [ ] BFF unit testy: SessionStore CRUD + TTL expiry, CSRF Origin matrix, cookies parse/set,
      SDM broker happy + 401 expired + 401 forbidden + 500 network
- [ ] Integration test (vitest + Hono `app.fetch` + MSW Node): full `POST /auth/login` →
      `GET /me` → `POST /me/active-tenant` → `POST /auth/logout` flow
- [ ] **Live smoke** proti `10.11.35.35:8050`: `pnpm --filter @sdm/bff dev` + curl-script v
      `docs/agents/devex-devops/real-backend-contracts.md` produkuje valid access_key + zruší ho
- [ ] `/me` response shape matchuje `auth-flow.md §4.5` (vrátane `csrfToken`, `featureFlags={}`
      stub, `session.idleTimeoutSec`)
- [ ] ROADMAP toggle F.1 → ✅ DONE, status hlavičky v `F.1.md` aktualizovaný
- [ ] Plans pre F.2-F.5 si nevyžiadali úpravu (alebo úpravy commited v tom istom PR)

## Stratégia — paralelný research + scaffolding, potom sekvenčná integrácia

### Fáza A — 3 paralelné subagenty (1 message, 3 Agent tool-cally)

| #   | Subagent type     | Cieľ                            | Rozsah                                                                                                                                                                                                                                                                                                                                       | Závislosti |
| --- | ----------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| A1  | `Explore`         | Real B-E contract discovery     | `curl -u vueuser:Vue@user123! http://10.11.35.35:8050/caisd-rest/...` pre `/rest_access`, `/cnt`, `/cnt_role`, `/tenant`, vybrané `/in` (1 query). Zachytiť JSON/XML shape, Content-Type negotiation, error responses (401 expired vs 401 no API role). Output: `docs/agents/devex-devops/real-backend-contracts.md` s reálnymi vzorkami.    | none       |
| A2  | `general-purpose` | Session store + cookie utils    | `apps/bff/src/session/{types,memory-store,index}.ts` per bff.md §2.2 interface + `apps/bff/src/security/cookies.ts` (`__Host-sdm.sid` set/parse/clear, SameSite=Lax, Secure, Max-Age=28800) + vitest unit testy. Žiadne externé deps mimo `hono`.                                                                                            | none       |
| A3  | `general-purpose` | Config loader + CSRF middleware | `apps/bff/src/config/{schema,load}.ts` (Zod schema pre `casdm.{baseUrl,basicAuthUser,basicAuthPass}`, `session.{idleSec,absoluteSec,cookieName}`, `bff.{port,trustedOrigins[]}`) + `apps/bff/src/security/csrf.ts` (Origin/Referer check pre POST/PUT/PATCH/DELETE, allow-list z `trustedOrigins`, audit log "csrf.rejected" hook) + vitest. | none       |

**Brief každého subagenta**: pošli mu `Inputs` paths + sekciu, ktorú má pokrývať + acceptance
criteria (file paths + vitest commands). Žiadny implicitný kontext.

### Fáza B — main thread (sekvenčné)

Závislé od Fázy A outputov (najmä A1 contract evidence):

1. **`auth/sdm-broker.ts`** — Basic Auth → access_key (z A1 contract), retry s exp backoff (3×),
   refresh keď `expiresAt - now < 60s`, `DELETE /rest_access/<id>` pri logoute, `AppError`
   taxonómia (`AUTH_EXPIRED` vs `AUTH_FORBIDDEN` per `bff.md §2.3` Error shaper diff).
2. **`auth/correlation.ts`** — `X-Correlation-ID` propagation middleware (ULID generator,
   echo header v response).
3. **`auth/routes.ts`** — `POST /auth/login {username, password}` (proxied na SDM broker, vytvorí
   session, set cookie), `POST /auth/logout` (revoke SDM key + clear cookie), `POST /auth/heartbeat`
   (touch session.lastSeenAt).
4. **`aggregator/me.ts`** — `GET /me` (canonical §4.5 shape: user + tenants embedded +
   activeTenant.effectivePermissions[] + csrfToken + featureFlags stub + i18n + session timing),
   `POST /me/active-tenant` (validate proti session.tenants[], rotate cookie ver, audit log
   `auth.tenant.switched`). `effectivePermissions[]` derive cez import `getPermissionsForRole`
   z `@sdm/domain`. UIRole mapping z CA SDM rola názvov (z A1 contract) — config-driven mapping
   table.
5. **`index.ts`** — wire middleware order: secureHeaders → cors (žiadny, same-origin) → logger
   → correlation → audit-stub → csrf (gated na mutating + cookie present) → routes.
6. **`tests/auth-flow.integration.test.ts`** — full flow proti MSW Node (mock 10.11.35.35).
7. **Live smoke script** — bash skript v `docs/agents/devex-devops/real-backend-contracts.md` ktorý
   ukáže reálny login + logout proti živému B-E (manuálne run, nie CI — CI nemá sieť do 10.11.35.35).

### Fáza C — verifikácia + PR

- `pnpm -r typecheck` / `lint` / `build` / `test`
- Manuálny live smoke: `pnpm --filter @sdm/bff dev` + curl pre login + /me
- Aktualizuj plan headers (F.1 → ✅ DONE) + ROADMAP next-up = F.2
- Push branch + `gh pr create`

## Open questions / risks

- **UIRole mapping**: CA SDM `cnt_role.role.sym` názvy môžu byť mimo našej 8-role taxonómie.
  Subagent A1 musí zachytiť reálne názvy. Riešenie: BFF env config `UI_ROLE_MAPPING_JSON` s
  table `{ "CA-rola-sym": "UIRole" }`. Default fallback = `requester`. Audit log
  `authz.role.unknown` keď nemáme mapping.
- **Tenant identifikácia v CA SDM**: nie všetky CA SDM 17.4 inštalácie majú multi-tenancy aktivované.
  Subagent A1 zistí, či `10.11.35.35:8050` má `tenant` factory + či `cnt_role` má `tenant` field.
  Ak nie, F.1 vytvorí single-tenant session s fiktívnym `tenantId="default"`. MSW shape ostáva,
  E.3 shell funguje.
- **Sieťový prístup**: vývojár potrebuje VPN / direct route na `10.11.35.35:8050`. Subagent A1
  zlyháva → fallback: vytvoriť plné upstream MSW Node mocky pre F.1 testy + odložiť live smoke
  do chunku, kde sa rieši sieťový prístup (pridať `[blocked-on-network]` flag do plánu).
- **Cookie domain**: `__Host-` prefix vyžaduje `Path=/` + bez `Domain=` attr + `Secure`. V dev
  bez HTTPS to nepôjde. F.1 v dev mode použije obyčajný `sdm.sid` name bez `__Host-` prefixu
  (`secure: false` keď `NODE_ENV !== "production"`). Audit log "cookie.dev-fallback" warning.

## Open questions for user (defer until they actually block work)

- **OIDC chunk timing**: kedy chce zaviesť reálne SSO? Vplyv: ak corp IdP príde v MVP, OIDC
  chunk sa zaradí pred Phase H. Ak post-MVP, ostáva v post-MVP backlogu.
- **MFA / step-up**: `auth-flow.md` spomína bulk step-up threshold 50, step-up TTL 5 min.
  V F.1 ignorujeme — žiadny MFA flow. Riešenie keď príde OIDC.
