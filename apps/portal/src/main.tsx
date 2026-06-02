import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@sdm/design-system/tokens.css";
import "@sdm/design-system/reset.css";
import "@sdm/design-system/fonts.css";
import { I18nProvider, bootstrapI18n } from "@sdm/i18n";
import App from "./App";
import { loadConfig } from "./bootstrap/config";
import { initSentry } from "./bootstrap/sentry";
import { loadSession, UnauthorizedError, type SessionLoadResult } from "./bootstrap/session";
import { setPreloadedSession } from "./bootstrap/session-preload";
import { prefetchHome } from "./features/home/api";
import { queryClient } from "./lib/query-client";

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
 * data (`myTicketsQuery` + `kbSuggestionsQuery`) is kicked off in parallel
 * with React mount. The `homeLoader` (React Router v6 data router) then sees
 * a warm cache and the Home shell's `<MyRecentTickets>` + `<KbSuggestions>`
 * paint without a second post-render fetch waterfall.
 */
async function bootstrap(): Promise<void> {
  if (import.meta.env.VITE_USE_MOCKS === "true") {
    const { startMockWorker } = await import("./mocks/browser");
    await startMockWorker({ quiet: false });
  }

  // `loadSession()` rejection branches are normalised here — we do NOT want
  // a 401 or 5xx on `/me` to blank the page (the post-render fallback in
  // `SessionProvider` covers that). We only consume the happy-path result.
  const sessionPromise: Promise<SessionLoadResult | UnauthorizedError | Error> = loadSession().then(
    (r) => r,
    (e: unknown) => (e instanceof Error ? e : new Error(String(e))),
  );

  const [config, , sessionOutcome] = await Promise.all([
    loadConfig(),
    bootstrapI18n({ app: "portal" }),
    sessionPromise,
  ]);
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

  createRoot(rootEl).render(
    <StrictMode>
      <I18nProvider>
        <App />
      </I18nProvider>
    </StrictMode>,
  );
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
