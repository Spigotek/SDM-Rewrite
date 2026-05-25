/**
 * Locale-aware formatting helpers per ADR-07.
 *
 * `formatDate` / `formatNumber` používajú native `Intl` API (zero-dep, native
 * locale data). `formatRelative` používa `date-fns/formatDistanceToNowStrict`
 * lebo `Intl.RelativeTimeFormat` nemá automatic bucket selection.
 */

import { formatDistanceToNowStrict } from "date-fns";
import { enUS, sk } from "date-fns/locale";

import type { Locale } from "./types";

const DATE_FNS_LOCALE = {
  sk,
  en: enUS,
} as const;

const BCP47 = {
  sk: "sk-SK",
  en: "en-GB",
} as const;

export function formatDate(
  date: string | number | Date,
  locale: Locale,
  opts?: Intl.DateTimeFormatOptions,
): string {
  const value = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  return new Intl.DateTimeFormat(BCP47[locale], opts ?? { dateStyle: "long" }).format(value);
}

export function formatNumber(n: number, locale: Locale, opts?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(BCP47[locale], opts).format(n);
}

export function formatRelative(date: string | number | Date, locale: Locale): string {
  const value = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  return formatDistanceToNowStrict(value, {
    addSuffix: true,
    locale: DATE_FNS_LOCALE[locale],
  });
}
