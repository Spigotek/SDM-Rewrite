import { Tile } from "@sdm/design-system";
import { useTranslation } from "@sdm/i18n";
import { CATEGORIES, type CatalogCategory } from "../types";

/**
 * Row of 4 clickable category tiles — Hardvér / Softvér / Prístupy / Iné.
 *
 * v1.2 redesign (K.3.E): each tile is the DS `<Tile variant="catalog">`
 * primitive rendered as a `<button>` (filter state — not a route change).
 * Selecting the same category twice clears the filter (toggle).
 *
 * Per `design-system/components.md §ServiceCatalogTile`: focus ring covers
 * the entire tile, the icon is decorative (`aria-hidden`), and the
 * accessible name = "<Label>, <N> položiek". `aria-pressed` + `aria-current`
 * communicate the active filter (no colour-only signal).
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
        const countLabel = t("catalogBrowse.categories.count", { count });
        const accessibleName = `${label}, ${countLabel}`;
        return (
          <li key={cat} data-row>
            <Tile
              variant="catalog"
              icon={<span aria-hidden="true">{ICONS[cat]}</span>}
              title={label}
              description={countLabel}
              onClick={() => onSelect(isActive ? null : cat)}
              aria-pressed={isActive}
              aria-current={isActive ? "page" : undefined}
              aria-label={accessibleName}
              className={
                isActive
                  ? "sdm-catalog-category-tile sdm-catalog-category-tile-active"
                  : "sdm-catalog-category-tile"
              }
              data-active={isActive ? "true" : undefined}
              data-testid={`catalog-category-${cat}`}
            />
          </li>
        );
      })}
    </ul>
  );
}
