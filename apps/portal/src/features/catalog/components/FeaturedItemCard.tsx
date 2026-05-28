import { Link } from "react-router-dom";
import { useTranslation } from "@sdm/i18n";
import type { CatalogItem } from "../types";

/**
 * Single catalog item card — icon, title, description, optional SLA hint,
 * "Požiadať" CTA. Whole card is a router `<Link>` so the click area is
 * generous (mobile thumb target ≥ 44 px). The CTA is a visually-emphasised
 * inline element, not a nested button — nested interactive elements are an
 * a11y anti-pattern (focus order + announce).
 *
 * Per `design-system/components.md §ServiceCatalogItem`: SLA hint announced
 * via `aria-describedby` so the screen reader reads
 * "<title>, <description>, ~ 2 dni vybavenie".
 */

const CATEGORY_ICONS: Record<string, string> = {
  hardware: "💾",
  software: "🔧",
  access: "🔐",
  other: "📋",
};

export interface FeaturedItemCardProps {
  readonly item: CatalogItem;
}

export function FeaturedItemCard({ item }: FeaturedItemCardProps) {
  const { t } = useTranslation("portal");
  const slaId = item.sla ? `featured-${item.id}-sla` : undefined;
  return (
    <Link
      to={`/catalog/${encodeURIComponent(item.id)}`}
      className="sdm-catalog-featured-card"
      data-component="service-catalog-item"
      data-testid={`catalog-featured-${item.id}`}
      aria-describedby={slaId}
    >
      <span className="sdm-catalog-featured-icon" aria-hidden="true">
        {CATEGORY_ICONS[item.category] ?? "📋"}
      </span>
      <span className="sdm-catalog-featured-body">
        <span className="sdm-catalog-featured-title">{item.name}</span>
        <span className="sdm-catalog-featured-description">{item.description}</span>
        {item.sla ? (
          <span id={slaId} className="sdm-catalog-featured-sla">
            {item.sla}
          </span>
        ) : null}
      </span>
      <span className="sdm-catalog-featured-cta" aria-hidden="true">
        {t("catalogBrowse.list.request")} →
      </span>
    </Link>
  );
}
