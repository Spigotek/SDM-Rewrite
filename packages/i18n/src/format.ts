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

/**
 * Smart age formatter for dense table cells (M.1.C).
 *
 *   - `< 1h`            "~Nmin"  (e.g. `~5min`)
 *   - `1h–24h`          "~Nh"
 *   - `1–90d`           "Nd"     (tight short form, mirrors K.2 table density)
 *   - `> 90d`           full locale-aware phrase, e.g. "pred 3 mesiacmi" / "3 months ago"
 *
 * Falls back to `"—"` for null/invalid inputs so callers can pipe the cell
 * value directly without a null guard. The absolute ISO date is exposed via
 * `absolute()` so callers can wire a `title=` tooltip on the cell.
 */
export interface FormattedAge {
  readonly text: string;
  readonly absolute: string | null;
}

export function formatAge(input: string | number | Date | null, locale: Locale): FormattedAge {
  if (input === null || input === undefined) return { text: "—", absolute: null };
  const value = typeof input === "string" || typeof input === "number" ? new Date(input) : input;
  const then = value.getTime();
  if (!Number.isFinite(then)) return { text: "—", absolute: null };
  const diffMs = Date.now() - then;
  if (diffMs < 0) {
    return { text: "<1m", absolute: formatDate(value, locale, { dateStyle: "medium" }) };
  }
  const minutes = Math.round(diffMs / 60_000);
  const hours = Math.round(minutes / 60);
  const days = Math.round(hours / 24);
  let text: string;
  if (minutes < 1) text = "<1m";
  else if (hours < 1) text = `~${minutes}min`;
  else if (days < 1) text = `~${hours}h`;
  else if (days <= 90) text = `${days}d`;
  else
    text = formatDistanceToNowStrict(value, {
      addSuffix: true,
      locale: DATE_FNS_LOCALE[locale],
      unit: days > 365 ? "year" : "month",
      roundingMethod: "floor",
    });
  return { text, absolute: formatDate(value, locale, { dateStyle: "medium" }) };
}
