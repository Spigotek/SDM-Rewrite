import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@sdm/design-system/tokens.css";
import "@sdm/design-system/reset.css";
import "@sdm/design-system/fonts.css";
import { THEME_STORAGE_KEY, applyTheme, resolveTheme } from "@sdm/design-system";
import App from "./App";
import { loadConfig } from "./bootstrap/config";
import { initSentry } from "./bootstrap/sentry";
import { loadSession, UnauthorizedError, type SessionLoadResult } from "./bootstrap/session";
import { setPreloadedSession } from "./bootstrap/session-preload";
import { prefetchHome } from "./features/home/api";
import { queryClient } from "./lib/query-client";
import { preloadRouteForPath } from "./bootstrap/route-preload";
import { registerPwa } from "./pwa/register-sw";

/**
 * Bootstrap critical path — I.0 perf fix.
 *
 * Per `docs/agents/qa-test-strategy/performance.md §2 portal /`, the LCP +
 * TTI budget on Lucia's mobile slow-4G profile is 1.5 s / 1.8 s. The previous
 * shape ran `loadConfig` + `bootstrapI18n` in parallel and deferred the
 * session fetch into `SessionProvider`'s `useEffect`. That serialised `/me`
 * AFTER React mount → +500-800 ms of dead time on slow 4G that should have
 * overlapped with JS download / parse.
 *
 * Now: `loadSession()` joins the parallel block. The result is fed into the
 * `SessionProvider`'s initial state via a module-level handoff
 * (`session-preload`) so first render is `status: "ready"` with no extra
 * round-trip.
 *
 * `UnauthorizedError` short-circuits to `status: "anonymous"` — AppShell
 * shows the login form. Any other failure (5xx / network) falls back to
 * `status: "loading"` so `SessionProvider`'s `useEffect` retries on mount,
 * matching the pre-I.0 behaviour for the degraded path.
 *
 * Bonus: once `/me` lands and exposes an active tenant ID, the home feature's
 * data (`myTicketsQuery` + `myAllTicketsQuery`) is kicked off in parallel
 * with React mount. The `homeLoader` (React Router v6 data router) then sees
 * a warm cache and the Home shell's `<OpenTicketsCard>` + `<HeroStats>` +
 * `<RecentActivity>` paint without a second post-render fetch waterfall.
 *
 * I.0 Resolution 4 — `bootstrapI18n` is no longer on the critical path.
 * `useTranslation` is aliased to a tiny shim (`lib/i18n-shim.ts`) that ships
 * a 30-key static dictionary at FCP. The full `vendor-i18n` chunk is fetched
 * via `bootstrap/i18n-late.ts` AFTER `createRoot().render()` and components
 * re-render once `i18next` resolves. The prerender hero band in `index.html`
 * provides the LCP element; React handover removes it after first paint.
 */
async function bootstrap(): Promise<void> {
  // K.3.A — belt-and-braces theme apply. The inline FOUC script in
  // `index.html` already paints `<html data-theme>` before this runs; this
  // call is a safety net for environments where CSP blocks inline scripts
  // or the inline body throws (e.g. SSR-prerender pipelines). Calling
  // `applyTheme` twice with the same value is idempotent.
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    const prefersDark = matchMedia("(prefers-color-scheme: dark)").matches;
    const prefersContrast = matchMedia("(prefers-contrast: more)").matches;
    applyTheme(resolveTheme(stored, prefersDark, prefersContrast));
  } catch {
    applyTheme("light");
  }

  if (import.meta.env.VITE_USE_MOCKS === "true") {
    const { startMockWorker } = await import("./mocks/browser");
    await startMockWorker({ quiet: false });
  }

  // Kick off the lazy route chunk that matches the current pathname before
  // awaiting the bootstrap promises. Router's `lazy:` for the same path
  // dedupes against the in-flight module-graph request, so this collapses
  // what was a serial waterfall — entry → bootstrap → router → lazy chunk
  // → render — into parallel fetches. The match is path-prefix based and
  // covers the two LCP-critical routes (home and ticket detail). Anything
  // else falls through to the post-mount router path with no penalty.
  void preloadRouteForPath(window.location.pathname);

  // `loadSession()` rejection branches are normalised here — we do NOT want
  // a 401 or 5xx on `/me` to blank the page (the post-render fallback in
  // `SessionProvider` covers that). We only consume the happy-path result.
  const sessionPromise: Promise<SessionLoadResult | UnauthorizedError | Error> = loadSession().then(
    (r) => r,
    (e: unknown) => (e instanceof Error ? e : new Error(String(e))),
  );

  const [config, sessionOutcome] = await Promise.all([loadConfig(), sessionPromise]);
  // Sentry init runs BEFORE React render so render-time throws are captured.
  // No-op when DSN is missing (mock mode / dev without a Sentry project).
  initSentry({ observability: config.observability, appVersion: config.meta.appVersion });

  if (sessionOutcome instanceof UnauthorizedError) {
    setPreloadedSession({ status: "anonymous" });
  } else if (sessionOutcome instanceof Error) {
    // 5xx / network — let `SessionProvider`'s `useEffect` re-try.
    setPreloadedSession({ status: "loading" });
  } else {
    setPreloadedSession({ status: "ready", result: sessionOutcome });
    // Prime the `["me"]` cache key so `homeLoader` (and any feature that
    // reads /me from the cache) hits warm. Mirrors `useActiveTenant`'s
    // post-switch cache priming.
    queryClient.setQueryData(["me"], sessionOutcome);
    // Fire the home dashboard prefetch in parallel with React mount. We do
    // NOT await — the route loader will await the same `ensureQueryData`
    // call, so duplicate work dedupes and the only effect of awaiting here
    // would be to delay first paint.
    void prefetchHome(queryClient, sessionOutcome.session.tenantId).catch((err) => {
      // Prefetch failure is silent — the component-level error path in
      // `HomeRoute` will surface the user-facing message.
      console.warn("[portal] home prefetch failed", err);
    });
  }

  const rootEl = document.getElementById("root");
  if (!rootEl) throw new Error("[portal] root element #root not found in index.html");

  // The shim-aliased `<I18nProvider>` is intentionally NOT used here. Portal's
  // `useTranslation` is the critical-path shim — it reads from a module-level
  // store, not from `react-i18next`'s context. Skipping the provider keeps
  // `react-i18next` itself out of the entry graph.
  createRoot(rootEl).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );

  // Hydrate `vendor-i18n` AFTER first React paint. Dynamic import →
  // `i18n-late` chunk pulls i18next + react-i18next + ICU. On resolve the
  // shim promotes to `hydrated` and every subscribed component re-renders
  // with the real `i18next.t()`. Static dict already covered the FCP paint
  // so this swap is invisible (texts match exactly).
  //
  // Schedule with `requestIdleCallback` (Chrome) / fallback `setTimeout` so
  // it never competes with React's commit phase for main-thread time.
  const fireHydrate = () => {
    void import("./bootstrap/i18n-late").then((m) => m.hydrateI18n());
  };
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(fireHydrate, { timeout: 2000 });
  } else {
    setTimeout(fireHydrate, 0);
  }

  // Remove the static prerender from `index.html` once React has painted the
  // real shell. The DOM node lives outside `<div id="root">` so React never
  // touches it. We wait one frame to give React's commit phase room, then
  // remove the prerender — its job (a paint-able LCP target before JS
  // executes) is done.
  requestAnimationFrame(() => {
    document.getElementById("portal-prerender")?.remove();
  });

  // Register the Workbox service worker AFTER React mounts so it never
  // competes with first paint. Skipped when VITE_USE_MOCKS=true (MSW SW
  // remains the sole controller in dev + CI acceptance-test mode).
  void registerPwa();
}

bootstrap().catch((err: unknown) => {
  console.error("[portal] bootstrap failed", err);
  const root = document.getElementById("root");
  if (root) {
    const message = err instanceof Error ? err.message : String(err);
    const safe = message.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
    root.innerHTML = `<main role="alert" aria-live="assertive" style="padding:2rem;max-width:48rem;margin:0 auto;font-family:system-ui,sans-serif;color:#1f2937"><h1 style="font-size:1.5rem;margin:0 0 1rem">Aplikáciu sa nepodarilo načítať</h1><p style="margin:0 0 0.5rem">Portal nemohol kontaktovať server. Skús stránku obnoviť o chvíľu.</p><p style="margin:0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:#7f1d1d;background:#fee2e2;padding:0.75rem;border-radius:0.375rem;border:1px solid #fecaca">${safe}</p></main>`;
  }
});
