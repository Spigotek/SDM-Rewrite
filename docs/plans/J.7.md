# J.7 — Mobile PWA offline mode (portal — read-only, no mutation queue)

> **Status**: 🔜 NEXT
> **Branch**: `chunk/J.7-portal-pwa-precache` > **Cieľ**: ship installable PWA + offline-read for the portal (Lucia persona, mobile-first).
> Workbox-generated service worker via `vite-plugin-pwa` (build-time dev dep). Manifest +
> icons + precache app shell + runtime cache strategies (stale-while-revalidate on `/api/*`
> GET; network-first on `/me` + `/config`). NO IndexedDB mutation queue — offline submit is
> v1.2+ scope per user decision 2026-06-04. Workspace stays non-PWA (desktop-first per H.10
> outcome; no PWA value).

## Pivot vs ROADMAP

J.md / ROADMAP J.7 entry + prompt §Open questions J.7 recommended full scope (precache +
IndexedDB ticket queue). User decision narrowed to MVP scope: precache + runtime cache only.
Mutation queue deferred until production mobile demand confirmed (J.0 cluster deferred =
zero mobile traffic today). CHANGELOG Known issues entry partially struck (read-only offline
shipped; offline submit stays deferred).

The scope reduction mirrors J.2 + J.4 N/A pattern, but instead of closing entirely, J.7
ships the installability + read-offline half which IS testable without production traffic.

## Inputs

- **`apps/portal/vite.config.ts`** — current Vite + Vitest + size-limit + manualChunks
  config. J.7 adds `VitePWA` plugin from `vite-plugin-pwa`.
- **`apps/portal/index.html`** — head section needs `<link rel="manifest">` reference (or
  auto-injected via `vite-plugin-pwa` — verify).
- **`apps/portal/src/main.tsx`** — bootstrap entry. J.7 adds conditional `virtual:pwa-register`
  call (skipped when `VITE_USE_MOCKS=true` to keep MSW SW the sole controller in dev).
- **`apps/portal/src/mocks/browser.ts`** — MSW SW bootstrap (E.1 / E.3 baseline). Confirms
  the `VITE_USE_MOCKS` gate exists; J.7 mirrors it.
- **`apps/portal/public/`** — currently `fonts/` + `mockServiceWorker.js`. J.7 adds
  `icons/{192,512}.png` + the auto-generated `manifest.webmanifest` (or hand-authored).
- **`docs/logo.svg`** — repo logo for icon generation.
- **`packages/design-system/src/tokens/`** — `--color-bg-base` / `--color-brand` token values
  to seed manifest `theme_color` + `background_color`.
- **`apps/portal/.size-limit.json`** — current 180 KB initial JS budget. J.7 must verify
  Workbox runtime doesn't bloat the entry bundle (SW runtime lives in `service-worker.js`,
  separate file, NOT counted toward entry budget).
- **`docs/CHANGELOG.md`** Known issues — existing "Mobile PWA offline mode" entry to refine.

## Outputs

```
apps/portal/package.json                            # MOD: + vite-plugin-pwa (devDependencies)
apps/portal/vite.config.ts                          # MOD: + VitePWA plugin config (manifest + workbox runtime caching)
apps/portal/index.html                              # MOD (if vite-plugin-pwa doesn't auto-inject): + <link rel="manifest"> + theme-color meta
apps/portal/src/main.tsx                            # MOD: conditional virtual:pwa-register call (skip when VITE_USE_MOCKS)
apps/portal/src/pwa/register-sw.ts                  # NEW: tiny helper wrapping virtual:pwa-register with `onNeedRefresh` / `onOfflineReady` hooks → optional toast for update available
apps/portal/public/icons/icon-192.png               # NEW: 192×192 PNG icon (generated from docs/logo.svg)
apps/portal/public/icons/icon-512.png               # NEW: 512×512 PNG icon
apps/portal/public/icons/icon-maskable-512.png      # NEW: 512×512 maskable icon (safe-zone padded)
apps/portal/public/icons/apple-touch-icon-180.png   # NEW: iOS home-screen icon

packages/i18n/catalogs/portal/{sk,en}.json          # +3 keys: pwa.offlineReady / pwa.updateAvailable / pwa.updateReload

apps/portal/tsconfig.json                           # MOD: add "vite-plugin-pwa/client" to compilerOptions.types for virtual:pwa-register types

tools/browser-test/scenarios/j7-portal-pwa-installable.spec.ts  # NEW: 2-3 cases (manifest reachable + valid; service worker registered after first load in prod build; offline navigation falls back to cached shell)

docs/CHANGELOG.md                                   # MOD: Known issues — "Mobile PWA offline mode" entry refined (read-only offline shipped, mutation queue v1.2+)
docs/agents/devex-devops/runtime-config.md          # MOD: + section "PWA / service worker" documenting conditional registration + MSW coexistence
docs/ROADMAP.md                                     # J.7 ⏳ → ✅ DONE
docs/plans/J.7.md                                   # Status NEXT → DONE; PR #
```

**Dep policy**:

- `vite-plugin-pwa` (devDependencies only) — build-time SW + manifest generation. Workbox
  runtime ships inside the generated `service-worker.js`. Per J.md D3 whitelist explicitly
  permits "Workbox — J.7 PWA offline mode".
- NO runtime deps added to `dependencies`.
- Icons are static assets (PNG); icon generation via `sharp` CLI ONE-TIME during this chunk's
  build (committed PNGs, NOT runtime dep). If `sharp` not available, fallback to any imaging
  tool the operator has (operator-script step, not a CI-required step).

## Done-when

- [ ] `vite-plugin-pwa` in `apps/portal/package.json` devDependencies.
- [ ] `apps/portal/vite.config.ts` configured with: - `VitePWA({ registerType: "autoUpdate", manifest: {...}, workbox: {...} })`. - Manifest: `name: "Service Desk"`, `short_name: "SDM"`, `description: "Self-service portal for incident requests, KB, and tickets"`, `theme_color: <design-system brand>`, `background_color: <design-system bg-base>`, `display: "standalone"`, `start_url: "/"`, `scope: "/"`, `icons: [192, 512, 512-maskable, apple-touch-180]`, `lang: "sk"`, `dir: "ltr"`. - Workbox: - `globPatterns: ["**/*.{js,css,html,svg,png,woff2,webmanifest}"]` for precache. - `runtimeCaching` entries: 1. `/api/.*` GET → `StaleWhileRevalidate`, cacheName `api-v1`, max 50 entries, 1 day expiration. 2. `/me` + `/config` → `NetworkFirst`, cacheName `session-v1`, timeout 5 s, fallback to cache. 3. `/api/attachments/kb/.*` GET → `CacheFirst`, cacheName `kb-attachments-v1`, max 200 entries, 30 day expiration (KB images are immutable per J.5 storage contract). - `navigateFallback: "/index.html"` — SPA route fallback. - `cleanupOutdatedCaches: true`.
- [ ] Conditional registration in `main.tsx`: - `if (import.meta.env.VITE_USE_MOCKS === "true") { /* skip */ }` - `else { registerPwa() }` from `apps/portal/src/pwa/register-sw.ts`.
- [ ] `register-sw.ts` calls `registerSW({ onNeedRefresh, onOfflineReady })` from `virtual:pwa-register`. Stub toasts (or use existing toast system if H.x provided one).
- [ ] Icons in `apps/portal/public/icons/`: - `icon-192.png` (192×192) - `icon-512.png` (512×512) - `icon-maskable-512.png` (512×512 with safe-zone) - `apple-touch-icon-180.png` (180×180)
- [ ] `apps/portal/index.html` head includes (if not auto-injected by plugin):
      `html
    <link rel="manifest" href="/manifest.webmanifest" />
    <meta name="theme-color" content="..." />
    <link rel="apple-touch-icon" href="/icons/apple-touch-icon-180.png" />
    `
- [ ] `apps/portal/tsconfig.json` `compilerOptions.types` includes `"vite-plugin-pwa/client"`.
- [ ] i18n: +3 portal keys (`pwa.offlineReady`, `pwa.updateAvailable`, `pwa.updateReload`). SK + EN parity (`pnpm i18n:check` green).
- [ ] Browser test `j7-portal-pwa-installable.spec.ts`: - Case 1: After portal build + serve, `GET /manifest.webmanifest` returns 200 + valid JSON (name, start_url, icons). - Case 2: After first page load, `navigator.serviceWorker.getRegistration()` returns a registration with scope `/`. - Case 3: Offline navigation (Playwright `page.context().setOffline(true)`) to `/` falls back to precached `index.html` (no error page). - (Optional) Case 4: MSW dev mode (`VITE_USE_MOCKS=true`) does NOT register Workbox SW (verify via `getRegistrations()` returns only the MSW SW).
- [ ] Bundle budgets: portal initial JS ≤ 180 KB gzip (Workbox runtime lives in `service-worker.js` separate file; `virtual:pwa-register` adds ~1 KB to entry — verify).
- [ ] `pnpm typecheck` + `pnpm lint` + `pnpm test` green.
- [ ] CI green: ci.yml + acceptance.yml (the 18 MSW-mode acceptance journeys must STILL pass — MSW SW remains the sole controller in CI's dev/preview mode).

## Stratégia

### Fáza A — Plugin + manifest + icons

1. `pnpm add -D -F @sdm/portal vite-plugin-pwa` (devDependencies only).
2. Generate icons from `docs/logo.svg`:
   ```bash
   # Subagent: use `sharp` CLI if available, else `rsvg-convert`, else any tool.
   # If no tool available, ship hand-crafted placeholder PNGs (single-color square with "SDM" text).
   ```
   Place in `apps/portal/public/icons/`.
3. Configure `VitePWA` in `apps/portal/vite.config.ts`:

   ```ts
   import { VitePWA } from "vite-plugin-pwa";

   plugins: [
     react(),
     // ... existing plugins ...
     VitePWA({
       registerType: "autoUpdate",
       includeAssets: ["icons/*.png", "fonts/*.woff2"],
       manifest: {
         name: "Service Desk Management",
         short_name: "SDM",
         description: "Self-service portal for incidents, requests, knowledge base, and tickets.",
         theme_color: "#1f2937",            // verify against design-system --color-bg-base
         background_color: "#0f172a",       // verify against design-system tokens
         display: "standalone",
         start_url: "/",
         scope: "/",
         lang: "sk",
         dir: "ltr",
         icons: [
           { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
           { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
           { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
         ],
       },
       workbox: {
         globPatterns: ["**/*.{js,css,html,svg,png,woff2,webmanifest}"],
         navigateFallback: "/index.html",
         cleanupOutdatedCaches: true,
         runtimeCaching: [
           {
             urlPattern: /^https?:\/\/[^/]+\/api\/(?!attachments)/,
             handler: "StaleWhileRevalidate",
             options: { cacheName: "api-v1", expiration: { maxEntries: 50, maxAgeSeconds: 86400 } },
           },
           {
             urlPattern: /^https?:\/\/[^/]+\/(me|config)$/,
             handler: "NetworkFirst",
             options: { cacheName: "session-v1", networkTimeoutSeconds: 5 },
           },
           {
             urlPattern: /^https?:\/\/[^/]+\/api\/attachments\/kb\//,
             handler: "CacheFirst",
             options: { cacheName: "kb-attachments-v1", expiration: { maxEntries: 200, maxAgeSeconds: 2592000 } },
           },
         ],
       },
       devOptions: { enabled: false }, // SW disabled in `vite dev` to avoid MSW collision; only built SWs ship
     }),
   ],
   ```

### Fáza B — Conditional registration + helper

1. `apps/portal/src/pwa/register-sw.ts`:
   ```ts
   export async function registerPwa(): Promise<void> {
     if (import.meta.env.VITE_USE_MOCKS === "true") return; // MSW SW wins in dev/preview
     const { registerSW } = await import("virtual:pwa-register");
     registerSW({
       onNeedRefresh() {
         // Soft notification: "Update available — reload to apply"
         console.info("[pwa] update available");
       },
       onOfflineReady() {
         // Soft notification: "Offline ready — app cached"
         console.info("[pwa] offline ready");
       },
     });
   }
   ```
2. `apps/portal/src/main.tsx`: call `registerPwa()` _after_ React render mounts (so it doesn't block first paint).
3. `apps/portal/tsconfig.json`: add `"vite-plugin-pwa/client"` to `compilerOptions.types`.

### Fáza C — i18n + tests + docs

1. `packages/i18n/catalogs/portal/{sk,en}.json` +3 keys.
2. `tools/browser-test/scenarios/j7-portal-pwa-installable.spec.ts` 2-3 cases.
3. `docs/agents/devex-devops/runtime-config.md` + PWA section.
4. `docs/CHANGELOG.md` Known issues — refine entry:
   - Strike: "Mobile PWA offline mode — draft auto-save and service-worker cache planned for v1.1."
   - Replace with: "**Mobile PWA — installability + read-only offline shipped in v1.1 (portal only).** Offline mutation queue (draft auto-save + replay) deferred to v1.2+ — requires production mobile traffic signal."

### Fáza D — PR

1. PR `feat(portal): installable PWA + read-only offline (J.7)`.
2. Subagent reports, does NOT merge. Parent merges.

### Fáza E — Post-merge

Parent updates ROADMAP J.7 → ✅ DONE + J.8 NEXT + commit `docs(J.7): refresh PR # + status after merge`.

## Open questions / risks — recommended resolutions

- **MSW + Workbox coexistence** — only one SW per scope at a time. **Rec**: conditional
  registration — `VITE_USE_MOCKS=true` keeps MSW SW (dev / CI MSW-mode). Production builds
  (`VITE_USE_MOCKS` unset or "false") get Workbox SW. Document in `runtime-config.md`. Verify
  CI 18-journey acceptance still passes (MSW SW stays sole controller in CI).
- **`devOptions.enabled: false`** — vite-plugin-pwa supports SW in `vite dev` but it
  collides with MSW. Keep disabled; only built outputs (preview / production) get SW.
- **Icon generation** — `sharp` is a heavy native dep. **Rec**: subagent uses any tool
  available locally (sharp, ImageMagick `convert`, or hand-crafted PNGs via Inkscape /
  online tools). Place the resulting PNGs in `public/icons/` and commit. NO `sharp`/imaging
  dep added to repo deps.
- **Workspace exempted** — desktop-first per H.10; PWA adds no value. Confirmed scope:
  portal only. Don't add VitePWA to workspace vite.config.
- **Background sync** — out of scope (would be needed for the deferred IndexedDB queue).
- **Manifest `theme_color` / `background_color`** — values from G.1 design tokens.
  Subagent should grep `packages/design-system/src/tokens/colors.css` (or similar) for the
  actual hex values matching `--color-bg-base` / `--color-brand`. If unable to find exact
  values, ship plausible defaults (#0f172a / #1f2937) and flag in PR body for review.
- **Lighthouse PWA score** — vite-plugin-pwa default config passes most Lighthouse PWA
  audits, but a perfect score requires HTTPS in production. CI Lighthouse runs over HTTP
  (LHCI staticDistDir) — PWA install audit will fail there. **Rec**: don't gate on Lighthouse
  PWA score in this chunk; verify install criteria via the browser test (manifest reachable,
  SW registered, icons valid).
- **i18n locale on manifest** — manifest `lang: "sk"` is the default. SK + EN catalogs are
  shipped; manifest doesn't switch lang per locale (browsers cache manifest once). Document
  as v2.0 polish.

## Notes pre subagenta

- **Subagent NESMIE**:
  - Add IndexedDB mutation queue or any offline write path — out of scope per user decision.
  - Add background sync API hooks — coupled with the deferred queue.
  - Add PWA to workspace — portal only.
  - Add runtime dep (`workbox-*` packages should appear ONLY transitively via
    `vite-plugin-pwa`'s devDependencies; never add as runtime).
  - Add `sharp` / `vips` / `imagemin` as dep — icon generation is a one-time ops step.
  - Modify `apps/portal/src/main.tsx` to register Workbox SW unconditionally — must respect
    `VITE_USE_MOCKS` gate so CI's MSW-mode acceptance journeys still pass.
  - Disable / change MSW SW (`mockServiceWorker.js` in public/) — it's the controller in dev/CI.
  - Mergovať vlastný PR.
- **Subagent musí**:
  - Verify `pnpm --filter @sdm/portal build` succeeds and `dist/manifest.webmanifest` +
    `dist/sw.js` (or similar) are emitted.
  - Verify the 18 MSW-mode acceptance journeys still pass (`VITE_USE_MOCKS=true` build).
  - Verify portal initial JS ≤ 180 KB gzip (Workbox runtime lives in the SW file, not entry).
  - Confirm icons exist + are valid PNG (subagent: `file public/icons/*.png` should report
    PNG image data + correct dimensions).
  - Single squash-friendly PR commit `feat(portal): installable PWA + read-only offline (J.7)`.
- **READ FIRST** (subagent should read these before editing):
  - `docs/plans/J.7.md` (this file) end-to-end
  - `apps/portal/vite.config.ts` (current plugin chain + manualChunks)
  - `apps/portal/src/main.tsx` (bootstrap entry where SW registration goes)
  - `apps/portal/src/mocks/browser.ts` (MSW SW registration — your VITE_USE_MOCKS gate pattern reference)
  - `apps/portal/.size-limit.json` (180 KB budget)
  - `apps/portal/index.html` (head section)
  - `packages/design-system/src/tokens/` (theme colours)
  - [vite-plugin-pwa docs — Getting Started](https://vite-pwa-org.netlify.app/guide/) and [Workbox runtime caching reference](https://developer.chrome.com/docs/workbox/modules/workbox-strategies)
