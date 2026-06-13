import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  EmptyState,
  IllustrationNoCatalogItems,
  Skeleton,
  staggerListRows,
  usePageTransition,
} from "@sdm/design-system";
import { useTranslation } from "@sdm/i18n";
import { tenantId as toTenantId } from "@sdm/domain";
import { useSession } from "../../shell/session-context";
import { catalogItemsQuery } from "./api";
import { CategoryTiles } from "./components/CategoryTiles";
import { FeaturedItemCard } from "./components/FeaturedItemCard";
import { CATEGORIES, type CatalogCategory } from "./types";
import "./catalog.css";

/**
 * `/catalog` — Service Catalog browser (Lucia journey).
 *
 * v1.2 redesign (K.3.E):
 *   - Category strip + featured item grid both use the DS `Tile` primitive.
 *   - Tile grid: 4-up at `lg+`, 2-up at `md`, 1-up on mobile (CSS Grid).
 *   - Loading state renders 8 `Skeleton variant="block"` tiles so the layout
 *     reserves vertical space (CLS budget 0.05 per portal `/catalog`).
 *   - Empty state for "no items in this category" uses the hero `EmptyState`
 *     with the `IllustrationNoCatalogItems` glyph.
 *   - `staggerListRows` runs on each list mount; `usePageTransition` runs
 *     a crossfade on route entry. Both honour `prefers-reduced-motion`.
 *
 * Filter state is local (`useState`) — switching tenant nukes the underlying
 * react-query data by key, so we don't persist the active category across
 * tenants.
 */

const TENANT_PLACEHOLDER = toTenantId("__pending__");
const SKELETON_TILE_COUNT = 8;

export function CatalogRoute() {
  const { t } = useTranslation("portal");
  const { session } = useSession();
  const location = useLocation();
  const { ref: pageRef } = usePageTransition(location.pathname);

  const tenantId = session?.tenantId ?? TENANT_PLACEHOLDER;
  const enabled = session !== null;
  const query = useQuery({ ...catalogItemsQuery(tenantId), enabled });
  const [category, setCategory] = useState<CatalogCategory | null>(null);

  const items = useMemo(() => query.data ?? [], [query.data]);

  const counts = useMemo(() => {
    const next: Record<CatalogCategory, number> = {
      hardware: 0,
      software: 0,
      access: 0,
      other: 0,
    };
    for (const it of items) {
      if (CATEGORIES.includes(it.category)) next[it.category] += 1;
    }
    return next;
  }, [items]);

  const filtered = useMemo(() => {
    if (!category) return items;
    return items.filter((it) => it.category === category);
  }, [items, category]);

  // Featured grid: only when no category filter is active. With a filter the
  // user wants the full subset, not the "popular" cut.
  const featured = useMemo(
    () => (category ? filtered : filtered.filter((it) => it.featured === true)),
    [filtered, category],
  );

  // Stagger the tile grid on mount + whenever the row count changes (filter
  // toggle, new fetch). `data-row` on each `<li>` is the stagger selector.
  const gridRef = useRef<HTMLUListElement | null>(null);
  useEffect(() => {
    staggerListRows(gridRef.current);
  }, [featured.length, query.isLoading]);

  return (
    <div ref={pageRef} className="sdm-catalog" data-testid="portal-catalog">
      <header className="sdm-catalog-heading">
        <h1>{t("catalogBrowse.title")}</h1>
        <p className="sdm-catalog-heading-sub">{t("catalogBrowse.subtitle")}</p>
      </header>

      <CategoryTiles counts={counts} active={category} onSelect={setCategory} />

      <h2 className="sdm-catalog-section-title">
        {category
          ? t(`catalogBrowse.categories.${category}`)
          : t("catalogBrowse.list.featuredTitle")}
      </h2>

      {query.isError ? (
        <p role="alert" className="sdm-catalog-error" data-testid="catalog-list-error">
          {t("catalogBrowse.list.error")}
        </p>
      ) : query.isLoading ? (
        <ul className="sdm-catalog-featured" aria-busy="true" data-testid="catalog-list-loading">
          {Array.from({ length: SKELETON_TILE_COUNT }, (_, i) => (
            <li key={i} className="sdm-catalog-featured-skeleton" aria-hidden="true">
              <Skeleton variant="block" height={160} />
            </li>
          ))}
        </ul>
      ) : featured.length === 0 ? (
        <EmptyState
          variant="hero"
          illustration={<IllustrationNoCatalogItems />}
          title={t("catalogBrowse.list.emptyTitle")}
          description={t("catalogBrowse.list.empty")}
          data-testid="catalog-list-empty"
        />
      ) : (
        <ul ref={gridRef} className="sdm-catalog-featured" data-testid="catalog-list">
          {featured.map((item) => (
            <li key={item.id} data-row>
              <FeaturedItemCard item={item} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default CatalogRoute;
