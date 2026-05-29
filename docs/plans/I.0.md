# I.0 — LHCI graduation (MSW-in-LHCI)

> **Status**: 🔜 NEXT (Phase I entry chunk)
> **Branch**: `chunk/I.0-lhci-msw` > **PR**: TBD
> **Cieľ**: graduovať LHCI timing thresholds `warn` → `error` per všetkých H.X
> routes. Blocker = LHCI `staticDistDir` mode fails na `/config` 404 → bootstrap
> error fallback → LCP merá fragment, nie app. Riešenie: build SPAs s
> `VITE_USE_MOCKS=true` flag pre LHCI step, MSW worker bootstrap-uje
> `/config` + `/me` + `/me/tenants` z fixtures.

## Pivot vs ROADMAP

Phase H exit criterion #5 (per H.md §Phase H exit criteria) — `LHCI thresholds
zelené pre všetky realne navigovateľné routes (numeric TTI/LCP graduate-uje
z warn na error per route)` — bol NESPLNENÝ za H. I.0 to zatvára.

## Inputs

- **`docs/agents/architecture/performance.md` §2** — autoritatívne TTI/LCP/score thresholds per route + form factor.
- **`apps/{portal,workspace}/lighthouserc.json`** — H.0-H.15 nastavili `warn` pre timing, `_url_todo_phase_h` array obsahuje routes čakajúce na graduation.
- **`apps/{portal,workspace}/mocks/browser.ts`** — existing MSW worker bootstrap (E.1).
- **`scripts/lhci-collect.sh`** — G.4 LHCI runner script.
- **`.github/workflows/acceptance.yml`** — H.16 pattern pre `VITE_USE_MOCKS=true` build + `vite preview` serve.
- **`apps/{portal,workspace}/src/main.tsx`** — existing conditional MSW bootstrap pri `VITE_USE_MOCKS=true`.

## Outputs

```
scripts/lhci-collect.sh                          # MOD: build with VITE_USE_MOCKS=true + serve via vite preview + lhci collect --url=...
.github/workflows/ci.yml                         # MOD: LHCI step uses new collect script (no API change visible)
apps/portal/lighthouserc.json                    # GRADUATE: timing thresholds warn → error pre all H.X routes
apps/workspace/lighthouserc.json                 # GRADUATE: identicky pre workspace routes
docs/agents/architecture/performance.md          # OPTIONAL: §6 baseline section update s post-graduation values
docs/ROADMAP.md                                  # I.0 → ✅ DONE; Phase I ⏳ IN-FLIGHT
docs/plans/I.0.md                                # tento súbor → Status DONE
```

## Done-when

- [ ] `scripts/lhci-collect.sh` rozšírený: build SPAs s `VITE_USE_MOCKS=true`, štart `vite preview` na portu 5173/5175, `lhci collect --url=http://localhost:5173/...` per portal route + identicky workspace.
- [ ] CI workflow LHCI step funguje proti MSW-in-LHCI mode — `categories:performance` ≥ 0.9, `interactive` ≤ 1800 ms (portal `/`) ≤ 2500 ms (workspace `/queue`) etc. per `performance.md §2`.
- [ ] **Portal lighthouserc.json**: všetky routes `/`, `/new-incident`, `/tickets`, `/tickets/:id`, `/catalog`, `/catalog/:itemId`, `/kb`, `/kb/article/:id` v `url[]` (nie `_url_todo_phase_h[]`) s **error** thresholds (TTI ≤ 1.8 s mobile, LCP ≤ 1.5 s, score ≥ 0.9).
- [ ] **Workspace lighthouserc.json**: všetky routes `/queue`, `/tickets/:id`, `/changes`, `/changes/calendar`, `/changes/:id`, `/problems`, `/cmdb`, `/cmdb/ci/:id`, `/kb`, `/kb/article/:id` s **error** thresholds (TTI ≤ 2.5 s desktop, LCP ≤ 2.0 s, score ≥ 0.85). Heavy routes (calendar TTI ≤ 3.0 s, ci-detail s graph TTI ≤ 3.5 s) per `performance.md §2`.
- [ ] `_url_todo_phase_h` array v oboch súboroch je `[]` alebo deleted.
- [ ] `_comment_timing_thresholds` v oboch lighthouserc.json updated alebo deleted — graduation done.
- [ ] PR CI: LHCI workflow green s real timing thresholds.
- [ ] ROADMAP toggle: I.0 → ✅ DONE; Phase I → ⏳ IN-FLIGHT.

## Stratégia

### Fáza A — Verify MSW bootstrap works in staticDistDir mode

1. Lokálne: `cd apps/portal && VITE_USE_MOCKS=true pnpm build && pnpm preview`. Otvor `http://localhost:5173/`. Verify že `/config` MSW handler intercept-uje a app bootstrap-uje normálne (nie error fallback).
2. Identicky workspace. Ak MSW worker file (`public/mockServiceWorker.js`) nie je v `dist/` po build, fix Vite asset pipeline.

### Fáza B — Rozšíriť lhci-collect.sh

1. Replace `staticDistDir: "./dist"` collect mode s `vite preview` serve + `lhci collect --url=...`:

   ```bash
   #!/usr/bin/env bash
   set -e
   APP="$1"  # portal | workspace
   PORT="$2" # 5173 (portal) | 5175 (workspace)
   pnpm --filter "@sdm/$APP" build --mode mock
   pnpm --filter "@sdm/$APP" preview --port "$PORT" --strictPort &
   PREVIEW_PID=$!
   trap "kill $PREVIEW_PID" EXIT
   sleep 5  # wait for preview server ready
   pnpm exec lhci collect --config="apps/$APP/lighthouserc.json"
   pnpm exec lhci assert --config="apps/$APP/lighthouserc.json"
   pnpm exec lhci upload --config="apps/$APP/lighthouserc.json"
   ```

2. `lighthouserc.json` URLs use `http://localhost:5173/...` (portal) / `http://localhost:5175/...` (workspace) namiesto `http://localhost/index.html` placeholder.
3. `apps/{portal,workspace}/vite.config.ts` `--mode mock`: ensure `import.meta.env.VITE_USE_MOCKS = "true"` v build artifact (existing implementation per E.1 — verify).

### Fáza C — Graduate thresholds + verify CI

1. Per `apps/portal/lighthouserc.json`: move every URL from `_url_todo_phase_h` → `url`. Update all timing thresholds `warn` → `error` per `performance.md §2 portal`:
   - Mobile, `/`: TTI 1800 ms, LCP 1500 ms, score 0.9
   - Mobile, `/new-incident`: TTI 2000 ms, LCP 1700 ms, score 0.9
   - Mobile, `/tickets/:id`: TTI 1800 ms, LCP 1500 ms, score 0.88
   - Mobile, `/catalog`: TTI 2200 ms, LCP 1800 ms, score 0.88
   - Mobile, `/catalog/:itemId`: TTI 2400 ms, LCP 2000 ms, score 0.85
   - Mobile, `/kb`: TTI 1600 ms, LCP 1300 ms, score 0.92
   - Mobile, `/kb/article/:id`: TTI 1600 ms, LCP 1300 ms, score 0.92
2. Per `apps/workspace/lighthouserc.json`: identicky pre workspace routes per `performance.md §2 workspace`:
   - Desktop, `/queue`: TTI 2500 ms, LCP 2000 ms, score 0.85
   - Desktop, `/tickets/:id`: TTI 2000 ms, LCP 1700 ms, score 0.85
   - Desktop, `/changes`: TTI 2500 ms, LCP 2000 ms, score 0.85
   - Desktop, `/changes/calendar`: TTI 3000 ms, LCP 2500 ms, score 0.80 (heavy)
   - Desktop, `/changes/:id`: TTI 2000 ms, LCP 1700 ms, score 0.85
   - Desktop, `/problems`: TTI 2500 ms, LCP 2000 ms, score 0.85
   - Desktop, `/cmdb`: TTI 2500 ms, LCP 2000 ms, score 0.85
   - Desktop, `/cmdb/ci/:id`: TTI 3500 ms, LCP 2500 ms, score 0.80 (heavy s graph)
   - Desktop, `/kb`: TTI 2200 ms, LCP 1700 ms, score 0.88
   - Desktop, `/kb/article/:id`: TTI 2200 ms, LCP 1700 ms, score 0.88
3. Push branch + open PR. CI must show LHCI green s reálnymi timing thresholds.
4. Ak niektorá route fails timing — INSPECT trace, fix render perf (likely lazy chunk audit), opakuj. Žiadna threshold relaxation bez explicit `performance.md` update.

## Open questions / risks — recommended resolutions

- **MSW worker init timing**: MSW worker uses `await worker.start()` v `main.tsx` pred `createRoot().render()`. LHCI prvý audit pass môže zachytiť pre-render state. **Mitigation**: verify že LHCI `numberOfRuns: 3` + median calculation (per existing config) absorbuje to. Ak nie, increase `await new Promise(r => setTimeout(r, 200))` po worker start.
- **`/config` MSW handler shape**: musí matchnúť real BFF `/config` shape (per F.5 documentation). Existing E.1 handler je sufficient — verify.
- **`vite preview` SPA fallback**: bez SPA fallback non-root URLs return 404. Vite preview má `--host` + nepriamo `historyApiFallback`. Verify že `/tickets/incident:10001` deep-link funguje. Ak nie, pridať `--single` flag alebo Express wrapper.
- **CI duration**: LHCI step pred I.0 trval ~2 min. Po I.0 (build s mocks + preview server start + multi-URL audit) pravdepodobne ~5-8 min. Acceptable, nie blocking.
- **performance.md §6 baselines**: post-graduation values môžu update-ovať `performance.md §6` rolling baseline table. Optional, NIE blocking I.0.

## Notes pre subagenta

- Subagent dispatched cez Agent tool s `subagent_type: "general-purpose"`. Self-contained brief obsahuje:
  - **MSW + vite preview combo** je proven pattern z `acceptance.yml` (H.16) — reuse.
  - **`lhci collect --url=...`** funguje proti any HTTP server, nie len staticDistDir.
  - **Žiadna threshold relaxation** — ak route fails, fix render perf alebo report ako blocker.
- Subagent **NESMIE**:
  - Vypnúť `_comment_blocking` CLS / a11y / best-practices assertions.
  - Relaxovať thresholds (`performance.md §2` je autoritatívne).
  - Mergovať vlastný PR.
