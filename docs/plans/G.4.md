# G.4 — Performance budgets (LHCI + size-limit + manualChunks)

> **Status**: ✅ DONE
> **Branch**: `chunk/G.4-perf-budgets` (merged + deleted)
> **PR**: #23 (squash-merged 2026-05-25)
> **Cieľ**: zaviazať Lighthouse CI proti per-route thresholds z `performance.md §2`,
> `size-limit` budgets z §3 (portal 180 KB / workspace 350 KB initial JS),
> `manualChunks` tuning vo Vite configu pre route-level code split. Performance
> gates v CI = block merge pri regression.

## Pivot vs ROADMAP

ROADMAP `G.4` bullet: _"Performance budgets — LHCI, size-limit, manualChunks tuning. Inputs: qa-test-strategy/performance.md."_

Bundle dnes ide do `dist/` bez budget enforcement. G.1 + G.5 + G.2 + G.3 pridali
runtime deps (Radix, fonts loading, i18next, Sentry) ktoré sa **musia** zmestiť
do `performance.md §3` budgets. G.4 enforces tieto budgets v CI + nastavuje
Vite manualChunks aby vendor chunks (React, TanStack Query, Radix) boli stable
medzi releases (cache-friendly).

## Inputs

- **`docs/agents/qa-test-strategy/performance.md` §1-§3 + §5-§6** — LHCI config, per-route thresholds (8 portal pages + 9 workspace pages), bundle budgets, rolling baseline.
- **`docs/agents/architecture/decision-records/05-routing.md`** — React Router v6 lazy loading per route.
- **`docs/agents/design-system/library-recommendation.md` §Bundle size estimate`** — predicted bundle budget breakdown (React 44 KB, RHF+Zod 26 KB, Radix 15-35 KB, etc.).
- **`apps/portal/vite.config.ts`** + **`apps/workspace/vite.config.ts`** — current Vite config (no manualChunks tuning yet).
- **`apps/portal/dist/` + `apps/workspace/dist/`** — after `pnpm build`, baseline bundle structure pre size-limit setup.
- **`.github/workflows/ci.yml`** — current CI workflow (lint + typecheck + test + build + helm + BFF image).

## Outputs

```
apps/portal/.size-limit.json              # NEW: size-limit budget rules per chunk
apps/workspace/.size-limit.json           # NEW
apps/portal/package.json                  # +devDeps: @lhci/cli, size-limit, @size-limit/preset-app, rollup-plugin-visualizer
apps/workspace/package.json               # same

apps/portal/vite.config.ts                # +manualChunks (react, tanstack-query, radix, sentry, i18next) + visualizer plugin
apps/workspace/vite.config.ts             # same

apps/portal/lighthouserc.json             # NEW: LHCI config (URLs, assertions, throttling)
apps/workspace/lighthouserc.json          # NEW

scripts/lhci-collect.sh                   # OR tools/lhci/run.sh — helper that builds + serves dist + runs LHCI

.github/workflows/ci.yml                  # +size-limit step (per PR), +lhci step (per PR, 4 critical routes)
.github/workflows/perf-nightly.yml        # NEW: full LHCI sweep nightly + main push (all 17 routes)

docs/ROADMAP.md                           # G.4 → ✅ DONE
docs/plans/G.4.md                         # tento súbor → Status DONE
```

## Done-when

- [ ] `size-limit` v `apps/portal` budgets:
  - `apps/portal/dist/assets/index-*.js` (initial JS): **180 KB gzipped** (per `performance.md §3`).
  - `apps/portal/dist/assets/index-*.css`: **30 KB gzipped**.
  - Lazy feature chunks (per modul, ak existujú v Phase G — incident-feature/, etc.): **80 KB gzipped** each.
- [ ] `size-limit` v `apps/workspace` budgets:
  - Initial JS: **350 KB gzipped**.
  - Initial CSS: **60 KB gzipped**.
  - Heavy lazy chunks (calendar, graph, kbeditor — neexistujú v Phase G, **placeholder rules** s comment "added in H.x"): **150 KB gzipped**.
- [ ] **Vite manualChunks** rozdelí vendor bundles na predictable groups:
  - `vendor-react`: react, react-dom, react-router (~58 KB gzipped)
  - `vendor-state`: @tanstack/react-query (~14 KB)
  - `vendor-ds`: @radix-ui/\* (per app, tree-shaken)
  - `vendor-i18n`: i18next, react-i18next, i18next-icu (~25 KB)
  - `vendor-observability`: @sentry/react (~26 KB, lazy idle import preferred)
  - `vendor-utils`: clsx, ulid, date-fns/\* (modular)
- [ ] `rollup-plugin-visualizer` produces `dist/stats.html` per app — committed v PR description ako attachment (alebo screenshot).
- [ ] **LHCI** assert proti `performance.md §2 thresholds`:
  - Portal `/` mobile: TTI ≤ 1.8 s, LCP ≤ 1.5 s, CLS ≤ 0.05, score ≥ 90.
  - Portal `/new-incident` mobile: TTI ≤ 2.0 s, LCP ≤ 1.7 s, CLS ≤ 0.05.
  - Workspace `/queue` desktop: TTI ≤ 2.5 s, LCP ≤ 2.0 s, CLS ≤ 0.05.
  - Workspace `/cmdb/ci/:id` desktop: TTI ≤ 3.5 s (placeholder route — bude reálna v Phase H).
- [ ] LHCI runs **3× per audit**, median reported (per `performance.md §1`).
- [ ] CI per-PR: 4 critical routes × 3 runs = manageable (~3 min). Nightly + main push: all 17 routes × 3 runs (~10 min, separate workflow).
- [ ] Bundle analyzer report posted ako PR komentár (cez bot — alebo manual screenshot ak bot setup je out of scope).
- [ ] `pnpm -r typecheck/lint/test/build` green.
- [ ] LHCI a size-limit CI gates **blokujú merge** ak threshold porušený.
- [ ] ROADMAP toggle: G.4 → ✅ DONE; Phase G celá → ✅ DONE.

## Stratégia

### Fáza A — Vite config tuning + bundle baseline

1. Install: `pnpm --filter @sdm/portal add -D rollup-plugin-visualizer size-limit @size-limit/preset-app @lhci/cli`. Identicky workspace.
2. `apps/portal/vite.config.ts`:
   ```ts
   import { visualizer } from "rollup-plugin-visualizer";
   export default defineConfig({
     plugins: [
       react(),
       visualizer({ filename: "dist/stats.html", gzipSize: true, brotliSize: true }),
     ],
     build: {
       sourcemap: true,
       rollupOptions: {
         output: {
           manualChunks: {
             "vendor-react": ["react", "react-dom", "react-router-dom"],
             "vendor-state": ["@tanstack/react-query"],
             "vendor-ds": ["@radix-ui/react-dropdown-menu", "@radix-ui/react-dialog" /* ... */],
             "vendor-i18n": ["i18next", "react-i18next", "i18next-icu"],
             "vendor-observability": ["@sentry/react"],
           },
         },
       },
     },
   });
   ```
3. Run `pnpm --filter @sdm/portal build` → inspect `dist/assets/` sizes. Use this as baseline pre size-limit budgets.
4. **Lazy chunks** — verify že `React.lazy()` per-route imports z F.5 (login-page, etc.) actually split.

### Fáza B — size-limit configs

1. `apps/portal/.size-limit.json`:
   ```json
   [
     {
       "name": "Portal — initial JS (uncompressed)",
       "path": "dist/assets/index-*.js",
       "limit": "180 KB",
       "gzip": true
     },
     {
       "name": "Portal — initial CSS",
       "path": "dist/assets/index-*.css",
       "limit": "30 KB",
       "gzip": true
     },
     {
       "name": "Portal — vendor-react chunk",
       "path": "dist/assets/vendor-react-*.js",
       "limit": "60 KB",
       "gzip": true
     }
     // ... per vendor chunk
   ]
   ```
2. `apps/portal/package.json` scripts:
   ```json
   "size": "size-limit",
   "size:why": "size-limit --why"
   ```
3. Workspace identicky s 350 KB initial JS.

### Fáza C — LHCI configs + CI integration + PR

1. `apps/portal/lighthouserc.json`:
   ```json
   {
     "ci": {
       "collect": {
         "url": ["http://localhost:5500/", "http://localhost:5500/new-incident"],
         "numberOfRuns": 3,
         "settings": { "preset": "mobile" }
       },
       "assert": {
         "assertions": {
           "categories:performance": ["error", { "minScore": 0.9 }],
           "interactive": ["error", { "maxNumericValue": 1800 }],
           "largest-contentful-paint": ["error", { "maxNumericValue": 1500 }],
           "cumulative-layout-shift": ["error", { "maxNumericValue": 0.05 }]
         }
       },
       "upload": { "target": "temporary-public-storage" }
     }
   }
   ```
2. `scripts/lhci-collect.sh`:
   ```bash
   #!/usr/bin/env bash
   set -euo pipefail
   pnpm --filter @sdm/portal build
   pnpm --filter @sdm/portal preview --port 5500 --strictPort &
   PREVIEW_PID=$!
   trap 'kill $PREVIEW_PID' EXIT
   sleep 3
   npx -p @lhci/cli@0.13 lhci collect --config=apps/portal/lighthouserc.json
   npx -p @lhci/cli@0.13 lhci assert --config=apps/portal/lighthouserc.json
   ```
3. `.github/workflows/ci.yml`:
   ```yaml
   - name: size-limit (portal)
     run: pnpm --filter @sdm/portal size
   - name: size-limit (workspace)
     run: pnpm --filter @sdm/workspace size
   - name: LHCI per PR (4 critical routes)
     run: ./scripts/lhci-collect.sh portal-critical
   ```
4. `.github/workflows/perf-nightly.yml`:
   ```yaml
   on:
     schedule: [{ cron: "0 2 * * *" }]
     push: { branches: [main] }
   jobs:
     lhci-full:
       runs-on: ubuntu-latest
       steps:
         # ...
         - run: ./scripts/lhci-collect.sh portal-all && ./scripts/lhci-collect.sh workspace-all
   ```
5. `pnpm -r typecheck/lint/test/build` green; PR per memory.

## Open questions / risks — recommended resolutions

- **Bundle budget reality check**: post-G.1+G.2+G.3, portal initial JS pravdepodobne **~150-170 KB** (Radix + i18next + Sentry + React Router + RHF + Zod). Headroom pre Phase H feature code ~10-30 KB. Ak budget fail-uje pri G.4 baseline, NIE relax budget — buď lazy-load Sentry (idle init) alebo tighten Radix imports.
- **LHCI infrastructure**: `temporary-public-storage` (Lighthouse default) je free hosted storage 7-day TTL pre HTML reports. Alternatíva: vlastný LHCI server (deferred post-MVP). Per ADR-08 r2.
- **Throttling**: `simulated slow 4G` (LHCI default) per `performance.md §1`. Konsistent s GOAL §5 "typická linka".
- **3 runs per audit**: median report, per `performance.md §1`. Hodnota variability mitigation.
- **Rolling baseline** (per `performance.md §6`): blocks merge if new score drops > 5 points vs 7-day baseline aj keď absolute threshold ešte platí. **Defer to post-G.4** — vyžaduje LHCI server pre baseline storage. G.4 implementuje len hard thresholds.
- **Vite manualChunks vs natural code split**: natural code split (via `React.lazy()`) je dôležitejšie ako manualChunks. manualChunks **iba** stabilizuje vendor chunk file names pre cache. Don't over-engineer — keep groups simple.
- **Sentry lazy init**: ak bundle budget tight, presunúť Sentry init do `requestIdleCallback`:
  ```ts
  if ("requestIdleCallback" in window) {
    requestIdleCallback(() => initSentry(config), { timeout: 2000 });
  } else {
    setTimeout(() => initSentry(config), 1000);
  }
  ```
  Trade-off: prvých 1-2s errors môžu byť missed (acceptable per `audit-and-compliance.md §3 sampling` philosophy).
- **CI duration impact**: size-limit ~20s, LHCI per-PR ~3 min. Total CI delta ~4 min — acceptable.
- **First LHCI run baseline**: prvý LHCI run po G.4 merge **NIE block** — používa sa ako initial baseline pre rolling avg.

## Notes pre subagenta

- Subagent dispatchovaný cez Agent tool s `subagent_type: "general-purpose"`. Self-contained brief obsahuje:
  - **Don't tweak `performance.md` thresholds** — sú authoritative. Ak G.1-G.3 deps presiahnu 180 KB, **fix bundle**, nemen budget.
  - **Sentry lazy init** je acceptable trade-off ak `vendor-observability` chunk push-ne over budget.
  - **LHCI test routes pre Phase G**: iba `/` (portal home) + `/login` (login page) + `/queue` (workspace queue) sú reálne navigovateľné. Ostatné routes (per `performance.md §2`) sú placeholder, LHCI assertion **iba pre existing routes** v G.4 PR; ostatné assertions sa pridajú per Phase H chunk pri implementácii každého route.
  - **Test gate**: ak LHCI fail-uje pri prvom run, **vyšetri prečo** (typically: chýbajúce preload, blocking CSS, oversized vendor chunk). Žiadny `--no-verify` ani relax budget.
- Subagent **NESMIE**:
  - Vynechať `size-limit` configy.
  - Pridať CI step ktorý skipne size check.
  - Pridať `[skip-perf]` PR label override (existuje v `performance.md §6` ako "slack budget", ale **NIE** v G.4 — ide do Phase I).
  - Mergovať vlastný PR (parent agent zavŕši).
