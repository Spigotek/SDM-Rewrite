/**
 * Portal-only barrel that mirrors `@sdm/i18n`'s public API.
 *
 * I.0 Resolution 4 wires this file as a Vite `resolve.alias` target for
 * `@sdm/i18n` in portal builds. Effect:
 *
 *   - `useTranslation` is replaced with the critical-path shim from
 *     `./i18n-shim`. Static reachability from the entry graph no longer
 *     touches `react-i18next` → `vendor-i18n` becomes a lazy chunk fetched
 *     only via `bootstrap/i18n-late.ts`.
 *   - Every other named export (`bootstrapI18n`, `I18nProvider`, `useLocale`,
 *     `useDynamic`, `Trans`, formatters, types, …) is re-exported from the
 *     real `@sdm/i18n` so callers see the same surface they did before.
 *     Anything that imports `useLocale` (LanguageSwitcher) or `formatRelative`
 *     (MyRecentTickets) still pulls those — Vite tree-shakes them per-import,
 *     so eager `useLocale` use does NOT drag `vendor-i18n` into the entry
 *     chunk (verified per Part A acceptance: `grep -l react-i18next` against
 *     the entry chunk should print nothing).
 *
 * NOTE — this file uses the bare specifier `@sdm/i18n` but the Vite alias
 * MUST exclude this file (or use a sentinel) to avoid an infinite alias loop.
 * The alias is keyed on `@sdm/i18n` exactly, so importing the package by its
 * absolute workspace path here is the simplest way to bypass the rule.
 */

// Bypass the Vite alias self-reference. The bare `@sdm/i18n` specifier would
// loop here (Vite re-applies the alias on every resolve). `@sdm/i18n-real` is
// a sibling alias declared in `vite.config.ts` that bypasses the rewrite —
// see `tsconfig.json` `paths` for the matching tsc resolution rule.
export {
  I18nProvider,
  bootstrapI18n,
  changeLocale,
  i18next,
  __resetI18n,
  Trans,
  useLocale,
  useDynamic,
  dynamic,
  formatDate,
  formatNumber,
  formatRelative,
  detectLocale,
  persistLocale,
  loadCatalog,
  DEFAULT_LOCALE,
  FALLBACK_LOCALE,
  LOCALE_STORAGE_KEY,
  SUPPORTED_LOCALES,
  PACKAGE_NAME,
} from "@sdm/i18n-real";

export type {
  BootstrapOptions,
  I18nProviderProps,
  UseLocaleResult,
  DynamicValue,
  Locale,
  Namespace,
} from "@sdm/i18n-real";

// Override only `useTranslation` — the critical-path shim returns either the
// static dictionary value or proxies to `i18next.t()` once hydration completes.
export { useTranslation, promoteToHydrated, __resetI18nShim } from "./i18n-shim";
export type { UseTranslationResult } from "./i18n-shim";
