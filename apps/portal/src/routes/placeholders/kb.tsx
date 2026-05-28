import { useTranslation } from "@sdm/i18n";

export default function KbRoute() {
  const { t } = useTranslation("portal");
  return (
    <section data-testid="portal-kb">
      <h1>{t("placeholders.kbTitle")}</h1>
      <p className="sdm-skeleton-hint">{t("placeholders.kb")}</p>
    </section>
  );
}
