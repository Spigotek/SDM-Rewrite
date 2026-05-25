/**
 * `@sdm/i18n` — types per ADR-07.
 *
 * Locale je uzavretý union "sk" | "en"; žiadne RTL, žiadne ďalšie jazyky v MVP.
 */

export type Locale = "sk" | "en";

export const SUPPORTED_LOCALES: readonly Locale[] = ["sk", "en"];
export const DEFAULT_LOCALE: Locale = "sk";
export const FALLBACK_LOCALE: Locale = "en";

/** Locale persistence kľúč v `localStorage`. */
export const LOCALE_STORAGE_KEY = "sdm.locale";

/**
 * Backend-dodávané dynamické labels — buď raw string (CA SDM passthrough)
 * alebo tagged object `{ sk?, en? }` (post-MVP nice-to-have).
 */
export type DynamicValue = string | { readonly sk?: string; readonly en?: string };

/** Catalog namespace — shared (common) + per-app (portal | workspace). */
export type Namespace = "shared" | "portal" | "workspace";
