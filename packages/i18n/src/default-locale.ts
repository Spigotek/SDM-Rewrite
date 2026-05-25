/**
 * Detekcia default locale per page load.
 *
 * Priorita:
 *   1. `localStorage.sdm.locale` — user-pinned voľba zo LanguageSwitcheru.
 *   2. `navigator.language` — keď začína na "sk" → "sk", inak "en".
 *   3. Hard fallback `"sk"` (per GOAL — primárna SK populácia).
 *
 * FOUC-safe: voláme **pred** React render-om v `bootstrap()` provider helperi.
 */

import { DEFAULT_LOCALE, LOCALE_STORAGE_KEY, SUPPORTED_LOCALES, type Locale } from "./types";

function isLocale(value: string | null): value is Locale {
  return value !== null && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export function detectLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;

  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isLocale(stored)) return stored;
  } catch {
    // localStorage môže byť disabled (private mode); fallback na navigator.
  }

  const nav = window.navigator?.language?.toLowerCase() ?? "";
  if (nav.startsWith("sk")) return "sk";
  if (nav.startsWith("en")) return "en";
  return DEFAULT_LOCALE;
}

export function persistLocale(locale: Locale): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Ignore — non-fatal, i18next state je in-memory authoritative.
  }
}
