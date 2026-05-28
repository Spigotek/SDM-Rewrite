import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
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
 * Layout (top → bottom, per wireframe `portal/03-service-catalog.md`):
 *   ┌─ Back link
 *   ├─ Title + subtitle
 *   ├─ <CategoryTiles>      Hardvér / Softvér / Prístupy / Iné (filters)
 *   └─ Item grid            Featured first, then filtered remainder
 *
 * Filter state is local (`useState`) — switching tenant nukes the underlying
 * react-query data by key, so we don't persist the active category across
 * tenants. Empty state surfaces if the filtered list is empty.
 */

const TENANT_PLACEHOLDER = toTenantId("__pending__");

export function CatalogRoute() {
  const { t } = useTranslation("portal");
  const { session } = useSession();
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

  return (
    <section className="sdm-catalog" data-testid="portal-catalog">
      <Link to="/" className="sdm-catalog-back" data-testid="catalog-back">
        {t("catalogBrowse.back")}
      </Link>
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
        <p className="sdm-catalog-loading" data-testid="catalog-list-loading">
          {t("catalogBrowse.list.loading")}
        </p>
      ) : featured.length === 0 ? (
        <p className="sdm-catalog-empty" data-testid="catalog-list-empty">
          {t("catalogBrowse.list.empty")}
        </p>
      ) : (
        <ul className="sdm-catalog-featured" data-testid="catalog-list">
          {featured.map((item) => (
            <li key={item.id}>
              <FeaturedItemCard item={item} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default CatalogRoute;
