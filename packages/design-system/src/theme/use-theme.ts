/**
 * K.3.A — `useTheme` React hook.
 *
 * Combines stored user choice (`localStorage[THEME_STORAGE_KEY]`) with the
 * two media-query system signals (`prefers-color-scheme`, `prefers-contrast`).
 * Subscribes to media-query change events so a system-level theme flip
 * reflects immediately without a page reload.
 *
 * Returns:
 *   - `choice`   — the user's persisted intent (`"system" | "light" | "dark" | "hc"`).
 *   - `applied`  — the concrete `ThemeName` currently painted on `<html data-theme>`.
 *   - `setChoice(next)` — persist + apply.
 *
 * SSR-safe: when `window` is undefined, the hook returns `{ choice: "system",
 * applied: "light", setChoice: noop }`. The first client-side `useEffect`
 * resolves the actual state.
 */

import { useCallback, useEffect, useState } from "react";
import {
  THEME_STORAGE_KEY,
  applyTheme,
  persistThemeChoice,
  resolveTheme,
  type ThemeChoice,
  type ThemeName,
} from "../tokens/theme";

const DARK_QUERY = "(prefers-color-scheme: dark)";
const CONTRAST_QUERY = "(prefers-contrast: more)";

export interface UseThemeResult {
  choice: ThemeChoice;
  applied: ThemeName;
  setChoice: (next: ThemeChoice) => void;
}

function readStored(): ThemeChoice {
  if (typeof localStorage === "undefined") return "system";
  const raw = localStorage.getItem(THEME_STORAGE_KEY);
  if (raw === "dark" || raw === "light" || raw === "hc") return raw;
  return "system";
}

function readApplied(stored: ThemeChoice): ThemeName {
  if (typeof window === "undefined") return "light";
  const storedConcrete = stored === "system" ? null : stored;
  const prefersDark =
    typeof window.matchMedia === "function" && window.matchMedia(DARK_QUERY).matches;
  const prefersContrast =
    typeof window.matchMedia === "function" && window.matchMedia(CONTRAST_QUERY).matches;
  return resolveTheme(storedConcrete, prefersDark, prefersContrast);
}

export function useTheme(): UseThemeResult {
  const [choice, setChoiceState] = useState<ThemeChoice>(() => {
    if (typeof window === "undefined") return "system";
    return readStored();
  });
  const [applied, setApplied] = useState<ThemeName>(() => {
    if (typeof window === "undefined") return "light";
    return readApplied(readStored());
  });

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;

    const dark = window.matchMedia(DARK_QUERY);
    const contrast = window.matchMedia(CONTRAST_QUERY);

    const reapply = (): void => {
      const stored = readStored();
      const next = readApplied(stored);
      setChoiceState(stored);
      setApplied(next);
      applyTheme(next);
    };

    // Initial sync — in case FOUC script ran with stale media-query state, or
    // an earlier render painted while SSR-shim values were active.
    reapply();

    dark.addEventListener("change", reapply);
    contrast.addEventListener("change", reapply);
    return () => {
      dark.removeEventListener("change", reapply);
      contrast.removeEventListener("change", reapply);
    };
  }, []);

  const setChoice = useCallback((next: ThemeChoice) => {
    persistThemeChoice(next);
    setChoiceState(next);
    const concrete = readApplied(next);
    setApplied(concrete);
    applyTheme(concrete);
  }, []);

  return { choice, applied, setChoice };
}
