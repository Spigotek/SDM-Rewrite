import { useMemo } from "react";
import { useTranslation } from "@sdm/i18n";
import { Button } from "@sdm/design-system";
import type {
  KbBrowseRow,
  KbCategoryOption,
  KbFilters as KbFiltersState,
  KbLanguage,
} from "../types";

/**
 * Workspace KB filter strip — category dropdown + language toggle. Matches the
 * H.12 problems FilterBar shape (left = controls, right = result count +
 * reset). Categories are sourced from `/api/kb/categories` so the dropdown
 * stays in sync with what the tenant actually exposes (vs deriving from the
 * browse list, which may be paginated short).
 *
 * Language is "all / sk / en" — toggle chips because the fixture set is
 * mono-language today; the slot is wired for future EN-only KB content.
 */

const LANGUAGES: ReadonlyArray<KbLanguage> = ["sk", "en"];

export interface KbFiltersProps {
  readonly rows: ReadonlyArray<KbBrowseRow>;
  readonly categories: ReadonlyArray<KbCategoryOption>;
  readonly filters: KbFiltersState;
  readonly totalCount: number;
  readonly visibleCount: number;
  readonly onSelectCategory: (id: string | null) => void;
  readonly onSelectLanguage: (lang: KbLanguage | null) => void;
  readonly onReset: () => void;
}

export function KbFilters(props: KbFiltersProps) {
  const { rows, categories, filters, totalCount, visibleCount } = props;
  const { onSelectCategory, onSelectLanguage, onReset } = props;
  const { t } = useTranslation("workspace");

  // Per-category row counts so the dropdown can render "Networking (3)" — the
  // hint is computed from the unfiltered list so picking a category doesn't
  // collapse the option counts to its own slice (typical filter UX gotcha).
  const counts = useMemo(() => {
    const out = new Map<string, number>();
    for (const r of rows) {
      if (r.categoryId) out.set(r.categoryId, (out.get(r.categoryId) ?? 0) + 1);
    }
    return out;
  }, [rows]);

  const hasActive = filters.category !== null || filters.language !== null;

  return (
    <div
      className="sdm-kb-filterbar"
      data-testid="kb-filter-bar"
      role="group"
      aria-label={t("kb.filters.ariaLabel")}
    >
      <div className="sdm-kb-filterbar-row">
        <label className="sdm-kb-filter-label">
          <span>{t("kb.filters.categoryLabel")}</span>
          <select
            className="sdm-kb-filter-select"
            data-testid="kb-filter-category"
            value={filters.category ?? ""}
            onChange={(e) => onSelectCategory(e.target.value || null)}
            aria-label={t("kb.filters.categoryLabel")}
          >
            <option value="">{t("kb.filters.categoryAll")}</option>
            {categories.map((c) => {
              const count = counts.get(c.id) ?? 0;
              return (
                <option key={c.id} value={c.id}>
                  {t("kb.filters.categoryOption", { name: c.name, count })}
                </option>
              );
            })}
          </select>
        </label>

        <div
          className="sdm-kb-language-chips"
          role="group"
          aria-label={t("kb.filters.languageLabel")}
        >
          <span className="sdm-kb-language-chips-label">{t("kb.filters.languageLabel")}</span>
          <button
            type="button"
            className={
              filters.language === null
                ? "sdm-kb-language-chip sdm-kb-language-chip--active"
                : "sdm-kb-language-chip"
            }
            aria-pressed={filters.language === null}
            data-testid="kb-filter-language-all"
            onClick={() => onSelectLanguage(null)}
          >
            {t("kb.filters.languageAll")}
          </button>
          {LANGUAGES.map((lang) => {
            const pressed = filters.language === lang;
            return (
              <button
                key={lang}
                type="button"
                className={
                  pressed
                    ? "sdm-kb-language-chip sdm-kb-language-chip--active"
                    : "sdm-kb-language-chip"
                }
                aria-pressed={pressed}
                data-testid={`kb-filter-language-${lang}`}
                onClick={() => onSelectLanguage(lang)}
              >
                {t(`kb.filters.language.${lang}` as const)}
              </button>
            );
          })}
        </div>

        <span className="sdm-kb-result-count" data-testid="kb-result-count">
          {t("kb.filters.resultCount", { visible: visibleCount, total: totalCount })}
        </span>

        {hasActive ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            data-testid="kb-reset-filters"
            onClick={onReset}
          >
            {t("kb.filters.reset")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
