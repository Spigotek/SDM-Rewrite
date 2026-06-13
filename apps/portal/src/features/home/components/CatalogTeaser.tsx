import { Link, useNavigate } from "react-router-dom";
import { Tile } from "@sdm/design-system";
import { useTranslation } from "@sdm/i18n";
import { CATEGORIES, type CatalogCategory } from "../../catalog/types";

/**
 * 4-up catalog teaser strip + "Všetko →" link (K.1 mockup §10.1 row 5).
 * Uses the canonical `CatalogCategory` set from the catalog feature so the
 * tile vocabulary stays in sync — clicking a tile lands on `/catalog`
 * (filter wiring is server-side in H.5; the teaser is a navigation entry
 * point, not a state-carrying control).
 *
 * Icons match `apps/portal/src/features/catalog/components/CategoryTiles.tsx`
 * — 4 emoji glyphs, no lucide dep.
 */

const ICONS: Record<CatalogCategory, string> = {
  hardware: "💻",
  software: "🔧",
  access: "🔑",
  other: "📋",
};

export function CatalogTeaser() {
  const { t } = useTranslation("portal");
  const navigate = useNavigate();

  return (
    <section className="sdm-home-catalog-teaser" data-testid="home-catalog-teaser">
      <header className="sdm-home-card-head">
        <h2 className="sdm-home-card-title">{t("home.catalog.title")}</h2>
        <Link to="/catalog" className="sdm-home-card-link" data-testid="home-catalog-all">
          {t("home.catalog.seeAll")}
        </Link>
      </header>
      <div className="sdm-home-catalog-grid">
        {CATEGORIES.map((cat) => (
          <Tile
            key={cat}
            variant="catalog"
            icon={<span aria-hidden="true">{ICONS[cat]}</span>}
            title={t(`catalogBrowse.categories.${cat}`)}
            onClick={() => navigate("/catalog")}
            data-testid={`home-catalog-${cat}`}
          />
        ))}
      </div>
    </section>
  );
}
