/**
 * React hooks — `useTranslation` (re-export), `useLocale` (current locale +
 * setter), `useDynamic` (BFF passthrough).
 */

import { useCallback, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";

import { changeLocale, i18next } from "./provider";
import { dynamic } from "./dynamic";
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  type DynamicValue,
  type Locale,
  type Namespace,
} from "./types";

function isLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

function subscribe(listener: () => void): () => void {
  i18next.on("languageChanged", listener);
  return () => {
    i18next.off("languageChanged", listener);
  };
}

function getSnapshot(): Locale {
  const lng = i18next.language ?? DEFAULT_LOCALE;
  return isLocale(lng) ? lng : DEFAULT_LOCALE;
}

export interface UseLocaleResult {
  readonly locale: Locale;
  readonly setLocale: (next: Locale) => Promise<void>;
}

/** Subscribe to current locale + expose change handler. */
export function useLocale(app: Extract<Namespace, "portal" | "workspace">): UseLocaleResult {
  const locale = useSyncExternalStore(subscribe, getSnapshot, () => DEFAULT_LOCALE);
  const setLocale = useCallback(
    async (next: Locale) => {
      if (next === locale) return;
      await changeLocale(app, next);
    },
    [app, locale],
  );
  return { locale, setLocale };
}

/** Resolve `string | { sk?, en? }` proti aktuálnemu locale. */
export function useDynamic(): (value: DynamicValue) => string {
  const locale = useSyncExternalStore(subscribe, getSnapshot, () => DEFAULT_LOCALE);
  return useCallback((value: DynamicValue) => dynamic(value, locale), [locale]);
}

export { useTranslation };
