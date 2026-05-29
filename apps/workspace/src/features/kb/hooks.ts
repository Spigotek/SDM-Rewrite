import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import type { KbFilters, KbLanguage } from "./types";

/**
 * Filter state for `/kb` is URL-driven (`?category=…&language=…`) so deep
 * links survive refresh + page-back, matching the pattern used by `/problems`
 * (H.12) and `/cmdb` (H.13). The `attachToTicket` URL param is read by
 * `KbAttachIncidentAction` directly from `useSearchParams` — it does not
 * participate in filter normalization.
 */
const URL_KEY_CATEGORY = "category";
const URL_KEY_LANGUAGE = "language";

function normalizeLanguage(raw: string | null): KbLanguage | null {
  if (raw === "sk" || raw === "en") return raw;
  return null;
}

export function useKbFilters(): {
  readonly filters: KbFilters;
  readonly setCategory: (id: string | null) => void;
  readonly setLanguage: (lang: KbLanguage | null) => void;
  readonly reset: () => void;
} {
  const [params, setParams] = useSearchParams();
  const category = params.get(URL_KEY_CATEGORY);
  const language = normalizeLanguage(params.get(URL_KEY_LANGUAGE));

  const setCategory = useCallback(
    (id: string | null) => {
      setParams(
        (prev) => {
          const out = new URLSearchParams(prev);
          if (id) out.set(URL_KEY_CATEGORY, id);
          else out.delete(URL_KEY_CATEGORY);
          return out;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const setLanguage = useCallback(
    (lang: KbLanguage | null) => {
      setParams(
        (prev) => {
          const out = new URLSearchParams(prev);
          if (lang) out.set(URL_KEY_LANGUAGE, lang);
          else out.delete(URL_KEY_LANGUAGE);
          return out;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const reset = useCallback(() => {
    setParams(
      (prev) => {
        const out = new URLSearchParams(prev);
        out.delete(URL_KEY_CATEGORY);
        out.delete(URL_KEY_LANGUAGE);
        return out;
      },
      { replace: true },
    );
  }, [setParams]);

  const filters = useMemo<KbFilters>(
    () => ({ category: category || null, language }),
    [category, language],
  );
  return { filters, setCategory, setLanguage, reset };
}
