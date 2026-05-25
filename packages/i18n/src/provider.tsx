/**
 * `<I18nProvider>` — wrap `react-i18next`'s `I18nextProvider` s pre-initovaným
 * `i18next` inštance.
 *
 * Bootstrap kontrakt:
 *
 *   1. App volá `await bootstrapI18n({ app, initialLocale? })` v `main.tsx`
 *      pred `createRoot().render()`. To natiahne shared + per-app catalog pre
 *      detected/default locale **synchrónne** (await) — žiadne FOUC s
 *      raw t() keyom v prvom frame.
 *   2. App renderuje `<I18nProvider app="portal">…</I18nProvider>`.
 *   3. Locale switch (LanguageSwitcher) → `i18n.changeLanguage("en")`. React
 *      i18next vie lazy-loadnúť cez `backend` plugin; my používame eager
 *      `addResourceBundle` pre simplicity, lebo druhý locale je drobný
 *      (< 5 KB gzip).
 *   4. `<html lang>` synchronizujeme cez `useEffect` v provideri.
 */

import { useEffect, type ReactNode } from "react";
import i18next, { type i18n as I18nInstance } from "i18next";
import ICU from "i18next-icu";
import { I18nextProvider, initReactI18next, useTranslation } from "react-i18next";

import { detectLocale, persistLocale } from "./default-locale";
import { loadCatalog } from "./load";
import { DEFAULT_LOCALE, FALLBACK_LOCALE, type Locale, type Namespace } from "./types";

export interface BootstrapOptions {
  /** Per-app namespace ktorý sa loaduje vždy popri `shared`. */
  readonly app: Extract<Namespace, "portal" | "workspace">;
  /** Explicit override — testy + SSR. Default: `detectLocale()`. */
  readonly initialLocale?: Locale;
}

let bootstrapped: Promise<I18nInstance> | null = null;

/**
 * Idempotentný bootstrap — opätovné volanie vráti rovnaký singleton (žiadny
 * re-init pri HMR).
 */
export function bootstrapI18n(opts: BootstrapOptions): Promise<I18nInstance> {
  if (bootstrapped) return bootstrapped;
  bootstrapped = doBootstrap(opts);
  return bootstrapped;
}

async function doBootstrap(opts: BootstrapOptions): Promise<I18nInstance> {
  const locale = opts.initialLocale ?? detectLocale();

  const [shared, app] = await Promise.all([
    loadCatalog("shared", locale),
    loadCatalog(opts.app, locale),
  ]);

  await i18next
    .use(ICU)
    .use(initReactI18next)
    .init({
      lng: locale,
      fallbackLng: FALLBACK_LOCALE,
      defaultNS: "shared",
      ns: ["shared", opts.app],
      supportedLngs: ["sk", "en"],
      resources: {
        [locale]: {
          shared,
          [opts.app]: app,
        },
      },
      interpolation: {
        // ICU handles all interpolation; vypneme i18next's natívny `{{var}}`.
        escapeValue: false,
      },
      returnNull: false,
    });

  if (typeof document !== "undefined") {
    document.documentElement.lang = locale;
  }

  return i18next;
}

/**
 * Načíta catalog pre druhý locale on-demand a prepne `i18next` na novú voľbu.
 * Volá sa z LanguageSwitcheru.
 */
export async function changeLocale(
  app: Extract<Namespace, "portal" | "workspace">,
  next: Locale,
): Promise<void> {
  if (!i18next.hasResourceBundle(next, "shared")) {
    const shared = await loadCatalog("shared", next);
    i18next.addResourceBundle(next, "shared", shared, true, true);
  }
  if (!i18next.hasResourceBundle(next, app)) {
    const appCatalog = await loadCatalog(app, next);
    i18next.addResourceBundle(next, app, appCatalog, true, true);
  }
  await i18next.changeLanguage(next);
  persistLocale(next);
}

export interface I18nProviderProps {
  readonly i18n?: I18nInstance;
  readonly children: ReactNode;
}

/**
 * Wrap aplikácie — drží `i18next` singleton + udržuje `<html lang>` synced.
 *
 * Provider musí byť rendered AFTER `bootstrapI18n()` resolved (inak `t()` vráti
 * raw key kým sa catalog načíta). App-vrstva to wireuje v `main.tsx`.
 */
export function I18nProvider({ i18n, children }: I18nProviderProps): ReactNode {
  const instance = i18n ?? i18next;

  useEffect(() => {
    function syncHtmlLang(lng: string): void {
      if (typeof document === "undefined") return;
      document.documentElement.lang = lng;
    }
    instance.on("languageChanged", syncHtmlLang);
    return () => {
      instance.off("languageChanged", syncHtmlLang);
    };
  }, [instance]);

  return <I18nextProvider i18n={instance}>{children}</I18nextProvider>;
}

/** Re-export pre testy + integráciu — vždy current singleton. */
export { i18next };
export { useTranslation };
export const DEFAULT_LOCALE_EXPORT: Locale = DEFAULT_LOCALE;

/** Test helper — resetni singleton pre fresh bootstrap medzi testami. */
export function __resetI18n(): void {
  bootstrapped = null;
}
