import { useTranslation } from "@sdm/i18n";

export default function CatalogRoute() {
  const { t } = useTranslation("portal");
  return (
    <section data-testid="portal-catalog">
      <h1>{t("placeholders.catalogTitle")}</h1>
      <p className="sdm-skeleton-hint">{t("placeholders.catalog")}</p>
    </section>
  );
}
