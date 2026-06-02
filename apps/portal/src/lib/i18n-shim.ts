/**
 * `useTranslation` shim — replaces `@sdm/i18n`'s re-export of
 * `react-i18next.useTranslation` for portal builds only.
 *
 * Why this exists:
 *
 *   - I.0 Resolution 4 moves `vendor-i18n` (27 KB gz: i18next + react-i18next +
 *     intl-messageformat + @formatjs/icu-messageformat-parser) out of the
 *     critical bundle. The eager dependency chain previously rooted every
 *     `useTranslation` call directly at `react-i18next`, pulling the whole
 *     `vendor-i18n` chunk into the entry graph.
 *   - With this shim swapped in via a Vite resolve.alias, no portal source
 *     imports `react-i18next` directly. Static reachability from the entry
 *     terminates at this file, and Vite moves `vendor-i18n` into a chunk
 *     reachable only via the lazy `i18n-late` dynamic import.
 *
 * State machine:
 *
 *     critical (default at module init)
 *        │  components render with `criticalT()` (static dict, ~30 keys)
 *        │
 *        │  `bootstrap/i18n-late.ts` calls `hydrateI18n()` after
 *        │  `createRoot().render()` returns. That awaits the real
 *        │  `bootstrapI18n()` and calls `promoteToHydrated()`.
 *        ▼
 *     hydrated
 *           components re-render via `useSyncExternalStore` and `t()` now
 *           proxies to `i18next.t()` (full ICU formatting + plurals).
 *
 * Critical strings in `i18n-critical.ts` MUST match the post-hydration text
 * exactly (same Slovak/English text). Mismatches surface as a visible flicker
 * on first interaction.
 */

import { useSyncExternalStore } from "react";

import { criticalT, detectCriticalLocale } from "./i18n-critical";

/**
 * Structural typing for the i18next instance — only the bits the shim uses.
 * Loose by design so the real i18next instance (`TFunction` with conditional
 * generic overloads) flows through without forcing portal to add i18next as
 * a direct dependency. `bootstrapI18n` returns `Promise<i18n>` and that's
 * what `promoteToHydrated()` receives; the duck-typed surface here is
 * exactly what the shim needs.
 */
interface I18nInstance {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: (...args: any[]) => unknown;
  on: (event: "languageChanged", listener: () => void) => void;
  off: (event: "languageChanged", listener: () => void) => void;
}

type Status = "critical" | "hydrated";

interface Store {
  status: Status;
  i18n: I18nInstance | null;
  // Monotonically incremented on every store mutation OR `languageChanged`
  // event from i18next. `useSyncExternalStore` triggers a re-render whenever
  // the snapshot changes, so bumping this version forces every subscribed
  // component to re-resolve `t()`. Without it, a SK→EN locale switch fires
  // `languageChanged` but the snapshot (`status` string) would stay identical
  // and React would skip the re-render — freezing every translation.
  version: number;
}

const store: Store = { status: "critical", i18n: null, version: 0 };
const listeners = new Set<() => void>();

function emit(): void {
  store.version += 1;
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): number {
  return store.version;
}

// SSR snapshot — portal is SPA-only but `useSyncExternalStore` requires a
// stable server snapshot in case any test renders this off-DOM.
function getServerSnapshot(): number {
  return 0;
}

/**
 * Promote the store from `critical` to `hydrated` and trigger a re-render of
 * every subscribed component. Invoked by `bootstrap/i18n-late.ts` once the
 * real `bootstrapI18n()` resolves.
 */
export function promoteToHydrated(instance: I18nInstance): void {
  if (store.status === "hydrated") return;
  store.status = "hydrated";
  store.i18n = instance;
  emit();
  // Also subscribe to subsequent `languageChanged` events so the language
  // switcher updates components that read `t()` from the shim. Without this,
  // a SK→EN switch would only update components that read `useLocale()`
  // directly — every shell + home component would freeze in SK.
  instance.on("languageChanged", emit);
}

export interface UseTranslationResult {
  /** Returns the translation for `key`, optionally interpolating vars. */
  readonly t: (key: string, vars?: Record<string, string | number>) => string;
  /** Mirrors `react-i18next` — exposes the underlying instance once ready. */
  readonly i18n: I18nInstance | null;
  /** True once the real `vendor-i18n` chunk has been hydrated. */
  readonly ready: boolean;
}

/**
 * Drop-in replacement for `react-i18next`'s `useTranslation`. Accepts the same
 * namespace argument so call sites like `useTranslation("portal")` continue
 * to resolve keys against the right catalog after hydration.
 *
 * Before hydration: the critical dictionary is namespace-agnostic — every key
 * is stored with its catalog-relative path (`home.actions.newIncident.title`).
 * The `ns` arg is ignored on the critical path.
 *
 * After hydration: `ns` is forwarded to `i18next.t()` so the same namespace
 * resolution that `react-i18next.useTranslation` would have produced applies.
 */
export function useTranslation(ns?: string | readonly string[]): UseTranslationResult {
  // Subscribe via version counter — `useSyncExternalStore` re-renders only on
  // snapshot change, so a monotonically increasing version covers both the
  // critical→hydrated transition AND subsequent `languageChanged` events.
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (store.status === "hydrated" && store.i18n) {
    const i18n = store.i18n;
    return {
      t: (key, vars) => {
        // `react-i18next`'s `t()` returns the key on miss — match that
        // behaviour. ICU formatting (plurals, numbers, dates) flows through
        // the real i18next pipeline.
        const options: Record<string, unknown> = { ...(vars ?? {}) };
        if (ns !== undefined) options.ns = ns;
        return i18n.t(key, options) as string;
      },
      i18n,
      ready: true,
    };
  }

  return {
    t: (key, vars) => criticalT(key, vars),
    i18n: null,
    ready: false,
  };
}

/**
 * Test-only — reset the store between specs so each test starts in `critical`.
 */
export function __resetI18nShim(): void {
  if (store.i18n) {
    store.i18n.off("languageChanged", emit);
  }
  store.status = "critical";
  store.i18n = null;
  store.version = 0;
  listeners.clear();
}

// Re-export the locale detection helper so `i18n-critical.ts` remains the only
// place the locale is resolved before hydration.
export { detectCriticalLocale };
