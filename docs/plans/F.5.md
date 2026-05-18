# F.5 — Cleanup MSW vs BFF (SPA prepnutie + shape align)

> **Status**: 🔜 (blokované na F.4 merge)
> **Branch**: `chunk/F.5-msw-cleanup` (od `main` po F.4 merge)
> **PR**: —

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

- [ ] `VITE_USE_MOCKS=true pnpm dev` aj `VITE_USE_MOCKS=false pnpm dev` (+ BFF) **oboje fungujú**
      identicky pre tenant switch + queue zobrazenie
- [ ] Login page funkčná v `VITE_USE_MOCKS=false` mode (mock mode skip login = auto-session)
- [ ] Idle modal sa zobrazí pri 29 min idle, klik "Pokračovať" predĺži, ignore + 30 min = redirect
- [ ] Cross-tab: prepnutie tenant v tabe A → tab B v ≤ 1s zobrazí nový tenant + refetch
- [ ] CSRF header injektuje sa na všetky mutating volania (vitest test)
- [ ] Browser-test scenár proti real BFF pass (manuálne, nie CI — BFF + 10.11.35.35 dostupný)
- [ ] `docs/dev-handbook.md` má how-to pre oba módy
- [ ] ROADMAP toggle Phase F → ✅ DONE; next-up = Phase G

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

## Open questions / risks

- **Login form scope**: portal login → potom redirect na portal home alebo na originally-requested
  URL? Per `auth-flow.md §2.4`: redirect na originally-requested. Implementácia: `?returnTo=...`
  query param.
- **Workspace login redirect**: workspace na other port. SSO cookie nepadne cez ports. Riešenia:
  (a) shared subdomain + cookie scope, (b) workspace má vlastnú login page, (c) login page v portal,
  workspace redirect → portal/login?app=workspace → po success redirect späť. Dev má rozdielne ports
  (5173/5175) — production má jeden host. Riešenie pre dev: same-origin cez Vite proxy alebo
  dedicated dev BFF cookie name.
- **MSW handler upgrade backwards-compat**: E.3 browser-test scenáre testujú aktuálny shape.
  Po F.5 ich treba migrate (testid-y ostávajú, shape sa mení v session loader-i). Risk: skip 1-2
  scenárov dočasne, fix v rámci F.5.
- **Failover doc**: BFF restart = session loss = re-login. Per `audit-and-compliance §8` acceptable
  v MVP. F.5 toto **dokumentuje**, nie rieši (Redis chunk by to riešil, ale ten je odložený).
