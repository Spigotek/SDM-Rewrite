import { useTranslation } from "@sdm/i18n";
import { CATEGORIES, type CatalogCategory } from "../types";

/**
 * Row of 4 clickable category tiles — Hardvér / Softvér / Prístupy / Iné.
 *
 * Each tile is a `<button>` (filter state — not a route change). Selecting
 * the same category twice clears the filter (toggle). Counts are passed in
 * from the parent so the tile reflects the live filtered set.
 *
 * Per `design-system/components.md §ServiceCatalogTile`: focus ring covers
 * the entire tile, the icon is decorative (`aria-hidden`), and the
 * accessible name = "<Label>, <N> položiek".
 */

const ICONS: Record<CatalogCategory, string> = {
  hardware: "💻",
  software: "🔧",
  access: "🔑",
  other: "📋",
};

export interface CategoryTilesProps {
  readonly counts: Readonly<Record<CatalogCategory, number>>;
  readonly active: CatalogCategory | null;
  readonly onSelect: (category: CatalogCategory | null) => void;
}

export function CategoryTiles({ counts, active, onSelect }: CategoryTilesProps) {
  const { t } = useTranslation("portal");
  return (
    <ul className="sdm-catalog-categories" data-testid="catalog-categories">
      {CATEGORIES.map((cat) => {
        const isActive = active === cat;
        const label = t(`catalogBrowse.categories.${cat}`);
        const count = counts[cat] ?? 0;
        const accessibleName = `${label}, ${t("catalogBrowse.categories.count", { count })}`;
        return (
          <li key={cat}>
            <button
              type="button"
              className="sdm-catalog-category-tile"
              data-component="service-catalog-tile"
              data-active={isActive ? "true" : undefined}
              aria-pressed={isActive}
              aria-label={accessibleName}
              onClick={() => onSelect(isActive ? null : cat)}
              data-testid={`catalog-category-${cat}`}
            >
              <span className="sdm-catalog-category-icon" aria-hidden="true">
                {ICONS[cat]}
              </span>
              <span className="sdm-catalog-category-label">{label}</span>
              <span className="sdm-catalog-category-count">
                {t("catalogBrowse.categories.count", { count })}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
