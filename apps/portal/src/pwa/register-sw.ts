/**
 * PWA service worker registration helper.
 *
 * Lazy-imports `virtual:pwa-register` so the Workbox registration snippet
 * stays out of the entry bundle. Called from `main.tsx` AFTER React mounts
 * (no first-paint blocking).
 *
 * Skipped entirely when `VITE_USE_MOCKS=true` — MSW's service worker remains
 * the sole SW controller in dev and CI acceptance-test mode.
 */
export async function registerPwa(): Promise<void> {
  if (import.meta.env.VITE_USE_MOCKS === "true") return;

  const { registerSW } = await import("virtual:pwa-register");

  registerSW({
    onNeedRefresh() {
      // A new SW version is waiting. Inform the user non-intrusively; the
      // SW auto-updates on next navigation (`registerType: "autoUpdate"`).
      console.info("[pwa] update available — will activate on next navigation");
    },
    onOfflineReady() {
      console.info("[pwa] offline ready — app shell cached");
    },
  });
}
