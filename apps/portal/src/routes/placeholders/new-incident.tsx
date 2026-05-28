import { useTranslation } from "@sdm/i18n";

export default function NewIncidentRoute() {
  const { t } = useTranslation("portal");
  return (
    <section data-testid="portal-new-incident">
      <h1>{t("placeholders.newIncidentTitle")}</h1>
      <p className="sdm-skeleton-hint">{t("placeholders.newIncident")}</p>
    </section>
  );
}
