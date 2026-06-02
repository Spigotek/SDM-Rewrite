/**
 * I.0 perf fix — single-shot module store for the session result fetched
 * during `main.tsx` bootstrap.
 *
 * `main.tsx` calls `setPreloadedSession(...)` after the parallel
 * `Promise.all([loadConfig, bootstrapI18n, loadSession])` resolves; the
 * `<SessionProvider>` reads + clears it during its mount (`useState`
 * initialiser). After that the provider owns the canonical session state in
 * React state — this module is dead code for the rest of the session.
 *
 * Why not a React Query cache entry: the cache only holds the happy-path
 * payload (`SessionLoadResult`). We also need to communicate the `anonymous`
 * (401) and `loading` (5xx / network → let the client retry) outcomes so the
 * provider can pick the right initial `status`. A 3-way discriminated union
 * is the simplest shape that covers all three.
 */

import type { SessionLoadResult } from "./session";

export type PreloadedSession =
  | { readonly status: "ready"; readonly result: SessionLoadResult }
  | { readonly status: "anonymous" }
  | { readonly status: "loading" };

let preloaded: PreloadedSession | null = null;

export function setPreloadedSession(next: PreloadedSession): void {
  preloaded = next;
}

/**
 * Consume the preload (mount-only). After the first call the slot is cleared
 * so a hot-reload + re-mount doesn't reuse a stale bootstrap result — the
 * provider falls back to its normal `useEffect → loadSession()` path.
 */
export function consumePreloadedSession(): PreloadedSession | null {
  const value = preloaded;
  preloaded = null;
  return value;
}
