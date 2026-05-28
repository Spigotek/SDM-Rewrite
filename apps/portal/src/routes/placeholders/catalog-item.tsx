import { useParams } from "react-router-dom";
import { useTranslation } from "@sdm/i18n";

export default function CatalogItemRoute() {
  const { t } = useTranslation("portal");
  const { itemId } = useParams();
  return (
    <section data-testid="portal-catalog-item">
      <h1>{t("placeholders.catalogItemTitle", { id: itemId ?? "—" })}</h1>
      <p className="sdm-skeleton-hint">{t("placeholders.catalogItem")}</p>
    </section>
  );
}
