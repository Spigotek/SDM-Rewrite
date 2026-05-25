/**
 * Theme detection + persistence helpers.
 *
 * - `THEME_STORAGE_KEY` — localStorage key used by the FOUC-safe inline script
 *   and any in-app theme switcher. Keep the literal in sync with `FOUC_SCRIPT`.
 * - `FOUC_SCRIPT` — string template suitable for inlining inside `<script>` tags
 *   in `index.html` (`<head>`) before any module script. Applies the chosen
 *   theme to `<html data-theme="...">` synchronously, avoiding flashes of
 *   incorrect colour scheme.
 *
 * Theming model is defined in `docs/agents/design-system/theming.md §5`.
 */

export type ThemeName = "light" | "dark" | "hc";
export type ThemeChoice = ThemeName | "system";

export const THEME_STORAGE_KEY = "sdm.theme";

/** Decides which concrete `[data-theme]` value should be applied. */
export function resolveTheme(
  stored: string | null,
  prefersDark: boolean,
  prefersContrast: boolean,
): ThemeName {
  if (stored === "dark" || stored === "light" || stored === "hc") return stored;
  if (prefersContrast) return "hc";
  if (prefersDark) return "dark";
  return "light";
}

/** Apply a resolved theme to the document root. Safe to call client-side only. */
export function applyTheme(theme: ThemeName, root: HTMLElement = document.documentElement): void {
  root.setAttribute("data-theme", theme);
}

/** Persist a user theme choice. `"system"` clears the override. */
export function persistThemeChoice(choice: ThemeChoice): void {
  if (choice === "system") {
    localStorage.removeItem(THEME_STORAGE_KEY);
    return;
  }
  localStorage.setItem(THEME_STORAGE_KEY, choice);
}

/**
 * Inline script body for `<script>{FOUC_SCRIPT}</script>` in `<head>`.
 * Reads localStorage + media queries and sets `<html data-theme="...">` before
 * React paints, eliminating FOUC when dark/hc themes are user-preferred.
 */
export const FOUC_SCRIPT = `(function(){try{var k='sdm.theme';var s=localStorage.getItem(k);var t;if(s==='dark'||s==='light'||s==='hc'){t=s;}else if(matchMedia('(prefers-contrast: more)').matches){t='hc';}else if(matchMedia('(prefers-color-scheme: dark)').matches){t='dark';}else{t='light';}document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','light');}})();`;
