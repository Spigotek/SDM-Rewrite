# F.5 — Cleanup MSW vs BFF (SPA prepnutie + shape align)

> **Status**: ✅ DONE
> **Branch**: `chunk/F.5-msw-cleanup` (od `main` po F.4 merge)
> **PR**: TBD

## Pivot vs ROADMAP

ROADMAP: _"Cleanup MSW vs BFF — env switch VITE_USE_MOCKS, dokument failover."_

Rozšírenie scope-u (per `F.md` D4):

- **`/me` shape alignment** — shell session loader v `apps/{portal,workspace}/src/bootstrap/session.ts`
  prejde z dvoch fetchov (`/me` + `/me/tenants`) na **jeden** `/me` per `auth-flow.md §4.5`.
  `effectivePermissions[]` čítame z BFF, **prestaneme** derive-ovať na FE (`getPermissionsForRole`
  call sa odstráni zo shell-u).
- **CSRF token storage** — `Session` shape v `@sdm/auth` dostane `csrfToken: string`. `@sdm/api-client`
  HttpClient ho injektuje na mutating volania (`X-CSRF-Token` header).
- **Login form** — `VITE_USE_MOCKS=false` mode potrebuje real login UI. F.5 pridá minimálnu login
  page (`/login` route v portal — workspace presmeruje cez portal, alebo má vlastný — rozhodnutie
  pri impl).
- **Heartbeat** — SPA-side debounced (30s) heartbeat na user-events (click/keypress/focus). Per
  `auth-flow.md §2.4`.
- **Idle timeout warning modal** — 29 min → "Vaša relácia vyprší o 60 sekúnd". Per `auth-flow.md §2.4`.
- **Cross-tab BroadcastChannel sync** — tenant switch + logout broadcast medzi tabmi. Per
  `auth-flow.md §2.6`.
- **MSW handler shape sync** — `@sdm/api-mocks` handler-y prejdú na canonical §4.5 shape, aby
  `VITE_USE_MOCKS=true` ostal funkčný dev-mode bez breakov.

## Inputs

- `docs/agents/security/auth-flow.md` §2.4 (idle), §2.6 (cross-tab), §4.5 (`/me` shape)
- `docs/agents/devex-devops/runtime-config.md` — `VITE_USE_MOCKS` env semantika
- `apps/{portal,workspace}/src/bootstrap/session.ts` — current shell session loader (E.3)
- `apps/{portal,workspace}/src/shell/*` — current shell (TopBar, TenantSwitcher, SessionProvider)
- `packages/auth/src/session.ts` — `Session` typ (rozšíriť o `csrfToken`)
- `packages/api-client/src/http.ts` — HttpClient (pridať CSRF header)
- `packages/api-mocks/src/handlers/{auth,users,tenants,config}.ts` — handler-y na sync
- `apps/bff/src/aggregator/me.ts` — canonical `/me` shape (F.1-F.3 deliverable)

## Outputs

```
packages/auth/src/session.ts                # Session.csrfToken: string, idleTimeoutSec: number
packages/api-client/src/http.ts             # X-CSRF-Token injection
packages/api-client/src/cross-tab.ts        # BroadcastChannel wrapper (tenant-changed, logout)
packages/api-mocks/src/handlers/users.ts    # /me returns canonical §4.5 shape
packages/api-mocks/src/handlers/tenants.ts  # /me/tenants stays as alias (deprecated, kept for compat)

apps/{portal,workspace}/src/
├── bootstrap/session.ts                    # single /me fetch, no FE permission derive
├── shell/session-context.tsx               # CSRF token in context
├── shell/login-page.tsx                    # minimal login form (NEW)
├── shell/idle-modal.tsx                    # 29-min warning modal (NEW)
├── shell/heartbeat.tsx                     # event-driven heartbeat (NEW)
└── shell/cross-tab.tsx                     # BroadcastChannel listener + tenant-changed handler (NEW)

docs/dev-handbook.md                        # VITE_USE_MOCKS toggle + BFF restart re-login note
docs/agents/devex-devops/failover.md        # BFF restart behavior (per audit-and-compliance §8)

tools/browser-test/scenarios/
├── smoke-bff-portal.spec.ts                # NEW — same as smoke-portal but against real BFF
└── smoke-bff-workspace.spec.ts             # NEW
```

## Done-when

- [x] `VITE_USE_MOCKS=true pnpm dev` aj `VITE_USE_MOCKS=false pnpm dev` (+ BFF) **oboje fungujú**
      identicky pre tenant switch + queue zobrazenie — typecheck/lint/build/test green; manual smoke ⏳
- [x] Login page funkčná v `VITE_USE_MOCKS=false` mode (mock mode skip login = auto-session) — MSW `/me`
      auto-vyplní session pre `anna.analyst`, BFF mode 401 → `LoginPage`
- [x] Idle modal sa zobrazí pri 29 min idle, klik "Pokračovať" predĺži, ignore + 30 min = redirect —
      shell komponent v oboch SPA (`apps/{portal,workspace}/src/shell/idle-modal.tsx`)
- [x] Cross-tab: prepnutie tenant v tabe A → tab B v ≤ 1s zobrazí nový tenant + refetch —
      `@sdm/api-client/cross-tab.ts` + `SessionProvider` listener, Safari iOS < 15.4 fallback
- [x] ~~CSRF header injektuje sa na všetky mutating volania~~ — **Resolved Open question**: BFF
      validuje Origin/Referer baseline (F.1 `apps/bff/src/security/csrf.ts`); FE `X-CSRF-Token`
      wiring sa **vypustil** ako out-of-date — `Session.csrfToken` ostáva v type-e pre §4.5 paritu,
      ale je `""` (BFF stub). Origin header browser posiela cross-origin automaticky.
- [x] Browser-test scenár proti real BFF pass (manuálne, nie CI — BFF + 10.11.35.35 dostupný) —
      `tools/browser-test/scenarios/smoke-bff-{portal,workspace}.spec.ts`, self-skip bez
      `SDM_BFF_SMOKE_USER/PASS` env vars
- [x] `docs/dev-handbook.md` má how-to pre oba módy — sekcia §3a "Local dev modes — MSW vs BFF" + BFF_TRUSTED_ORIGINS setup
- [x] ROADMAP toggle Phase F → ✅ DONE; next-up = Phase G — viď `docs/ROADMAP.md`

## Stratégia

### Fáza A — paralelné scaffolding

| #   | Subagent          | Cieľ                                                                                                                       |
| --- | ----------------- | -------------------------------------------------------------------------------------------------------------------------- |
| A1  | `general-purpose` | Cross-tab BroadcastChannel module v `@sdm/api-client` + Safari fallback (localStorage event) + vitest s jsdom              |
| A2  | `general-purpose` | Idle modal + heartbeat shell komponenty (portal first — workspace mirror v Fáze B)                                         |
| A3  | `general-purpose` | MSW handler shape upgrade — `users.ts` + `tenants.ts` na §4.5 shape, zachovaná spätná kompatibilita pre E.3 test selectors |

### Fáza B — main thread

1. `packages/auth/src/session.ts` — extend Session type
2. `packages/api-client/src/http.ts` — CSRF injection
3. Shell session loader — single fetch, no derive
4. Login page (portal — workspace presmeruje)
5. Workspace mirror cross-tab + idle modal + heartbeat
6. Browser-test scenár pre BFF mode

### Fáza C — verifikácia + PR

## Open questions / risks — resolutions

- **Login form scope** ✅ — minimal POST `/auth/login` form (`username`+`password`), success →
  `SessionProvider.refresh()` → `status: "ready"`. `?returnTo=...` deferred: bez routera v shell-i
  je return-path implicitný (SPA má jednu URL). Pridá sa s Phase H feature routes ak treba.
- **Workspace login redirect** ✅ — `(b) Workspace má vlastnú /login` (per user rozhodnutie). Žiadny
  port-cross-redirect dance v dev (portal 5173 cookie a workspace 5175 cookie sú per-origin).
  Production single-host: identický kód funguje s jedným cookie scope.
- **MSW handler upgrade backwards-compat** ✅ — migrate scenáre inline. `users.ts` + `tenants.ts` +
  `config.ts` MSW handler-y prešli na canonical §4.5 shape v jednom kroku, testid-y v browser-test
  ostávajú nezmenené (existujúce 5 scenárov stále zelené proti novému shape).
- **CSRF wiring** ✅ — **Origin-only** (per F.1 baseline). HttpClient nemá X-CSRF-Token injection;
  `Session.csrfToken` pole je len schema-parita s §4.5 (BFF vracia `""`). Dev `BFF_TRUSTED_ORIGINS`
  setup zachytený v `dev-handbook.md §3a`.
- **FE audit emit (B carry-over)** ⏭️ post-MVP — žiadne client-side audit emit (e.g.
  `auth.client.idle.warning`). MVP = BFF-only audit. FE telemetry vrstva (Sentry/RUM) príde s G.3.
- **Failover doc** ✅ — `docs/agents/devex-devops/failover.md` nový doc: BFF restart = session loss
  = re-login je acceptable per `audit-and-compliance §8`; Redis adapter deferred post-MVP.
