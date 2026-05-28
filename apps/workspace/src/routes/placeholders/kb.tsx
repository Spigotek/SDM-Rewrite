import { useTranslation } from "@sdm/i18n";

export default function KbRoute() {
  const { t } = useTranslation("workspace");
  return (
    <section data-testid="workspace-kb">
      <h1>{t("placeholders.kbTitle")}</h1>
      <p className="sdm-skeleton-hint">{t("placeholders.kb")}</p>
    </section>
  );
}
