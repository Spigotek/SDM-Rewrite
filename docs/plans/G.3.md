# G.3 — Observability (Sentry + correlation ID)

> **Status**: 🔜 NEXT (blokované na G.2 merge)
> **Branch**: `chunk/G.3-observability` (od fresh `main` po G.2 merge)
> **PR**: TBD
> **Cieľ**: doplniť `@sentry/react` na FE side (portal + workspace), zaviazať
> cez bootstrap config DSN (env-driven), GDPR-friendly `beforeSend` filter
> (žiadne PII), source maps upload v CI. Verify end-to-end correlation ID flow:
> FE error → Sentry event (s `tags.correlationId`) → BFF pino log line s rovnakým
> ID → CA SDM call detail. BFF side je už hotová z F.1+F.4.

## Pivot vs ROADMAP

ROADMAP `G.3` bullet: _"Observability — Sentry SDK init + correlation ID propagation, BFF audit log shipping. Inputs: security/audit-and-compliance.md."_

BFF má F.4 audit taxonomy + F.1 `X-Correlation-ID` header propagation + pino
JSON logger. **Nezostáva nič v BFF**. G.3 je čistá FE chunk: Sentry init,
beforesend, source maps, ReactErrorBoundary wired do Sentry.

## Inputs

- **`docs/agents/architecture/decision-records/09-observability.md`** — trojvrstvová observability: FE error tracking (Sentry), FE RUM (post-MVP), BFF pino + audit taxonomy.
- **`docs/agents/security/audit-and-compliance.md` §2-§5** — audit taxonomy (canonical names) + sampling rates + retention. Reference iba pre G.3 verification, žiadna zmena v BFF.
- **`docs/agents/design-system/library-recommendation.md` §Per-feature canonical voľby`** — `@sentry/react` confirmed.
- **`apps/bff/src/auth/correlation.ts`** — existing `X-Correlation-ID` propagation (F.1). G.3 verifies FE side posiela ID + Sentry tag-uje events.
- **`apps/bff/src/platform/audit/`** — F.4 audit emit (events.ts, emit.ts, redact.ts).
- **`packages/api-client/src/`** — overuje že existujúci HTTP client posiela `X-Correlation-ID` header (ULID format per ADR-09 r2).
- **`apps/portal/src/bootstrap/config.ts`** + **`apps/workspace/src/bootstrap/config.ts`** — bootstrap config object kde DSN bude exposed (po F.5 canonical RuntimeConfig).

## Outputs

```
apps/portal/package.json                  # +deps: @sentry/react@8.x, @sentry/vite-plugin@2.x
apps/workspace/package.json               # same

apps/portal/src/bootstrap/sentry.ts       # initSentry(config: ObservabilityConfig): void
apps/workspace/src/bootstrap/sentry.ts    # identicky

apps/portal/src/main.tsx                  # initSentry(config.observability) pred React.render
apps/workspace/src/main.tsx               # same

apps/portal/src/shell/error-boundary.tsx  # NEW — Sentry.ErrorBoundary wrapper s fallback UI
apps/workspace/src/shell/error-boundary.tsx # same

apps/portal/src/shell/app-shell.tsx       # wrap children s <SentryErrorBoundary>
apps/workspace/src/shell/app-shell.tsx    # same

apps/portal/vite.config.ts                # +sentryVitePlugin (conditional: only when SENTRY_AUTH_TOKEN env present in CI)
apps/workspace/vite.config.ts             # same

packages/api-client/src/correlation.ts    # ensure ULID format (per ADR-09 r2 resolution)
packages/api-client/src/index.ts          # re-export

packages/api-mocks/src/handlers/config.ts # MSW returns observability.sentryDsn=null (no Sentry in mock mode)

.env.example                              # +SENTRY_DSN_PORTAL / SENTRY_DSN_WORKSPACE / SENTRY_AUTH_TOKEN

.github/workflows/ci.yml                  # +source maps upload step (vite build → sentry-cli releases new + files upload)

docs/ROADMAP.md                           # G.3 → ✅ DONE
docs/plans/G.3.md                         # tento súbor → Status DONE
```

## Done-when

- [ ] `@sentry/react@8.x` installed v `apps/portal` + `apps/workspace`. Initialised cez `Sentry.init({ dsn, ... })` v `bootstrap/sentry.ts` pre každý SPA.
- [ ] DSN čítaná z runtime `config.observability.sentryDsn` (per F.5 canonical RuntimeConfig). `null` DSN = Sentry not initialised (graceful no-op).
- [ ] `beforeSend` filter striktný:
  - Strip `email`, `name`, `displayName`, `description`, `summary` (ticket bodies) z `extra` / `contexts`.
  - User context iba: `userId` (pseudonymized), `tenantId`, `locale`. **NIE** raw email / displayName.
  - Per ADR-09 §1 + audit-and-compliance §5 PII retention rules.
- [ ] **React Error Boundary** wrappuje shell tree v oboch SPA. Render error → `Sentry.captureException` + fallback UI (per `microcopy.md §3 errors`).
- [ ] **Correlation ID flow** end-to-end:
  - `@sdm/api-client` generuje ULID per request → posiela `X-Correlation-ID` header.
  - Sentry events tag-ované `correlationId` cez `Sentry.setTag()` per request scope.
  - BFF pino log line obsahuje rovnaký ID (verified per existing F.1 `correlation.ts`).
- [ ] **Source maps upload** v CI: `vite build` produkuje sourcemaps, `@sentry/vite-plugin` ich upload-ne pri `SENTRY_AUTH_TOKEN` v CI env. Conditional — local dev nepotrebuje token.
- [ ] **Release fingerprint** = git SHA, prepojené s GitHub releases v Sentry UI (per ADR-09 §1).
- [ ] MSW mode (`VITE_USE_MOCKS=true`): Sentry **disabled** (DSN=null v mock config), žiadne Sentry events emit pri dev s mocks.
- [ ] Unit testy:
  - `beforeSend` strip-uje PII (mock event in, assert clean event out).
  - Error boundary render fallback pri throw v child component.
  - ULID format v correlation header.
- [ ] Manual verification:
  - Throw test error v portal → Sentry event appears v test project (alebo lokálnu Sentry/GlitchTip self-hosted instance).
  - Network panel: každý XHR/fetch má `X-Correlation-ID: 01H...` (ULID).
  - BFF log v `~/.dex/dev-logs/electron.log` (alebo `pino`-pretty stream) ukazuje rovnaký ID per request.
- [ ] `pnpm -r typecheck/lint/test/build` green.
- [ ] Bundle delta: Sentry React + browser SDK gzip ~26-30 KB → toleruj `+25 KB initial JS budget` jednorazovo; G.4 LHCI budget naformuluje s týmto headroom.
- [ ] ROADMAP toggle: G.3 → ✅ DONE.

## Stratégia

### Fáza A — Sentry init + beforeSend

1. Install: `pnpm --filter @sdm/portal add @sentry/react@8` (workspace same). Vite plugin: `@sentry/vite-plugin@2` ako devDependency.
2. `bootstrap/sentry.ts` per app:
   ```ts
   import * as Sentry from "@sentry/react";
   import type { ObservabilityConfig } from "@sdm/api-types";
   export function initSentry(config: ObservabilityConfig): void {
     if (!config.sentryDsn) return; // no-op for mock mode / missing DSN
     Sentry.init({
       dsn: config.sentryDsn,
       release: import.meta.env.VITE_GIT_SHA ?? "dev",
       environment: config.environment,
       integrations: [Sentry.browserTracingIntegration()],
       tracesSampleRate: 0.1,
       beforeSend(event, hint) {
         return sanitizeEvent(event);
       },
     });
   }
   function sanitizeEvent(event: Sentry.Event): Sentry.Event | null {
     // strip PII per ADR-09 §1
     if (event.user) {
       const { id, ip_address, ...rest } = event.user;
       event.user = { id }; // drop email, username, name
     }
     // recursively strip "email" / "name" / "displayName" / "description" / "summary" keys
     event.extra = stripPiiDeep(event.extra);
     event.contexts = stripPiiDeep(event.contexts);
     return event;
   }
   ```
3. `main.tsx`: `initSentry(config.observability)` PRED `ReactDOM.createRoot(...).render(...)`.
4. Set user context po `/me` load:
   ```ts
   Sentry.setUser({ id: pseudonymize(user.id) }); // hash, not raw
   Sentry.setTag("tenantId", user.activeTenantId);
   Sentry.setTag("locale", user.locale);
   ```

### Fáza B — Error boundary + correlation ID

1. `shell/error-boundary.tsx`:
   ```tsx
   import * as Sentry from "@sentry/react";
   export const SentryErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => (
     <Sentry.ErrorBoundary fallback={<ErrorFallback />} showDialog={false}>
       {children}
     </Sentry.ErrorBoundary>
   );
   ```
2. `ErrorFallback` UI: dostatočne user-friendly (per `microcopy.md §3.2 server error`):
   ```
   "Niečo sa pokazilo. Skús refresh stránky."
   [Refresh] [Reportovať problém]
   ```
3. `packages/api-client/src/correlation.ts` — generate ULID per request, attach as `X-Correlation-ID` header, set Sentry tag pre current scope:
   ```ts
   import { ulid } from "ulid";
   export function createCorrelationId(): string {
     return ulid();
   }
   ```
4. ULID dependency: `pnpm --filter @sdm/api-client add ulid` (tiny, ~1 KB gzip).
5. Verify existing api-client interceptor pridáva header — ak nie, doplniť.

### Fáza C — Source maps + CI + verification + PR

1. Vite plugin v `vite.config.ts`:
   ```ts
   import { sentryVitePlugin } from "@sentry/vite-plugin";
   export default defineConfig({
     build: { sourcemap: true },
     plugins: [
       react(),
       process.env.SENTRY_AUTH_TOKEN &&
         sentryVitePlugin({
           org: process.env.SENTRY_ORG,
           project: "portal-prod",
           authToken: process.env.SENTRY_AUTH_TOKEN,
         }),
     ].filter(Boolean),
   });
   ```
2. `.github/workflows/ci.yml` build step získa `SENTRY_AUTH_TOKEN` z GitHub secrets (defer: secret musí byť pridaný do repo settings — out of G.3 PR scope, listed v Done-when as "follow-up").
3. Unit testy: `sanitizeEvent` strip test, ErrorBoundary fallback test, ULID format test.
4. Manual verification:
   - Lokálne: throw test error v Console (`window.__sentryTest = () => { throw new Error("test") }` → call from DevTools), Sentry UI dashboard shows event.
   - Network: XHR ma `X-Correlation-ID: 01HXXXXX...`.
   - BFF log: grep `correlationId` v pino log → matches FE event.
5. `pnpm -r typecheck/lint/test/build` green; PR per memory.

## Open questions / risks — recommended resolutions

- **Sentry SaaS vs GlitchTip**: G.3 implements `@sentry/react` (DSN-protocol compatible s oboma). Concrete back-end (SaaS Sentry.io vs self-hosted GlitchTip) ide do post-G.3 ops chunku per `G.md §Open questions`.
- **DSN exposure**: Sentry DSN je **public** (designed for client-side use), žiadny secret. Ale env-driven aby každý env (dev/staging/prod) mal vlastný projekt. Per F.5 RuntimeConfig: BFF posiela DSN cez `/config`.
- **PII filtering**: beforeSend musí byť **DEEP recursive** strip pre key names `email`, `name`, `displayName`, `description`, `summary`, `customer`, `analyst`. Test edge cases (nested arrays).
- **Pseudonymization**: `pseudonymize(userId)` cez SHA-256 + per-tenant salt (z config). Same approach ako BFF F.4 `redact.ts`. Reuse helper z `@sdm/api-client` alebo `@sdm/utils`.
- **Sample rate**: `tracesSampleRate: 0.1` (10%) pre performance traces; `1.0` pre errors (always capture). RUM (Real User Monitoring) integration je **post-MVP** per ADR-09 §2 — G.3 nepriváža.
- **Source maps in production**: uploaded to Sentry, **NOT** served from `public/`. Strip sourcemap reference comment from prod bundle (Vite default behavior with sourcemap: 'hidden').
- **Release artifact upload size**: source maps môžu byť 2-5 MB. Sentry deduplikuje per file hash, žiadny issue.
- **Replay (Session Replay)**: Sentry feature, **off** pre G.3 (privacy concerns + bundle weight). Re-evaluate v Phase I post-MVP hardening.
- **Profiling**: Sentry Browser Profiling SDK je separate package + alpha, **off** pre G.3.
- **API client interceptor**: existujúci `@sdm/api-client` v F.x už generuje correlation ID? **Overiť pri G.3 fáza B step 5**. Ak ÁNO, len verify ULID format; ak NIE, doplniť.

## Notes pre subagenta

- Subagent dispatchovaný cez Agent tool s `subagent_type: "general-purpose"`. Self-contained brief obsahuje:
  - **BFF audit + correlation infrastructure JE HOTOVÁ** z F.1+F.4 — nesmie subagent meniť `apps/bff/src/auth/correlation.ts` ani `apps/bff/src/platform/audit/`.
  - **DSN nikdy nesmie ísť do repo** — len `.env.example` placeholder; `localhost` dev = DSN=null = Sentry no-op.
  - **GitHub Secrets** pre `SENTRY_AUTH_TOKEN` musí pridať user manuálne (out of PR scope) — G.3 PR len pridáva CI workflow step ktorý token konzumuje. Note: pridať do PR description "BLOCKED on user adding SENTRY_AUTH_TOKEN to repo secrets".
  - **No Replay, No Profiling, No RUM** v G.3 scope (post-MVP).
- Subagent **NESMIE**:
  - Pridať Sentry SDK do BFF (`apps/bff/`) — BFF má pino + audit, žiaden Sentry.
  - Logovať raw user emails / mená / ticket bodies do Sentry (PII).
  - Pridať `@sentry/profiling-node` ani `@sentry/replay`.
  - Mergovať vlastný PR (parent agent zavŕši).
