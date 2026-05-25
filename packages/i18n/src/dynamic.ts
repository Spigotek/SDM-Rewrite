/**
 * `dynamic()` adapter — per ADR-07 §Rozhodnutie.
 *
 * BFF dnes vracia raw EN strings z CA SDM (per F.1-F.4 captures). Pre future
 * BFF rozšírenie ktoré pošle `{ sk, en }` tagged label, helper dispatch-ne na
 * shape:
 *
 *   - `string` → passthrough (BFF má jediný zdroj pravdy, FE ho neprepíše).
 *   - `{ sk?, en? }` → pick podľa active locale, fallback chain `locale → en → sk`.
 */

import type { DynamicValue, Locale } from "./types";

export function dynamic(value: DynamicValue, locale: Locale): string {
  if (typeof value === "string") return value;
  const primary = value[locale];
  if (primary !== undefined) return primary;
  if (value.en !== undefined) return value.en;
  if (value.sk !== undefined) return value.sk;
  return "";
}
