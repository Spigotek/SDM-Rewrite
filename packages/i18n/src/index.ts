/**
 * `@sdm/i18n` — public API.
 *
 * Adapter nad `i18next + react-i18next + i18next-icu` per ADR-07. Exports
 * vrstva pre apps (provider, hooks, formatters) + low-level helpers (dynamic,
 * detect/persist) pre testy a bootstrap.
 */

export const PACKAGE_NAME = "@sdm/i18n";

export { I18nProvider, bootstrapI18n, changeLocale, i18next, __resetI18n } from "./provider";
export type { BootstrapOptions, I18nProviderProps } from "./provider";

export { Trans } from "react-i18next";

export { useTranslation, useLocale, useDynamic } from "./hooks";
export type { UseLocaleResult } from "./hooks";

export { dynamic } from "./dynamic";
export { formatDate, formatNumber, formatRelative } from "./format";
export { detectLocale, persistLocale } from "./default-locale";
export { loadCatalog } from "./load";

export { DEFAULT_LOCALE, FALLBACK_LOCALE, LOCALE_STORAGE_KEY, SUPPORTED_LOCALES } from "./types";
export type { DynamicValue, Locale, Namespace } from "./types";
