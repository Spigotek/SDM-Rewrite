import { useNavigate } from "react-router-dom";
import { Tile } from "@sdm/design-system";
import type { CatalogItem } from "../types";

/**
 * Single catalog item rendered as a DS `Tile` (v1.2 K.3.E).
 *
 * The tile is a `<button>` that calls `navigate()` so we stay inside the
 * React Router boundary (Tile's anchor form would trigger a full reload).
 * The whole tile is the click target (mobile thumb target ≥ 44 px). The
 * SLA hint, when present, lives in the `meta` slot adjacent to the
 * trailing chevron.
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
  const navigate = useNavigate();
  const icon = CATEGORY_ICONS[item.category] ?? CATEGORY_ICONS.other;
  const accessibleName = `${item.name}, ${item.description}${item.sla ? `, ${item.sla}` : ""}`;
  return (
    <Tile
      variant="catalog"
      icon={<span aria-hidden="true">{icon}</span>}
      title={item.name}
      description={item.description}
      meta={item.sla ?? undefined}
      onClick={() => navigate(`/catalog/${encodeURIComponent(item.id)}`)}
      aria-label={accessibleName}
      data-component="service-catalog-item"
      data-testid={`catalog-featured-${item.id}`}
    />
  );
}
