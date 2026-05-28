import { useTranslation } from "@sdm/i18n";

export default function ChangesRoute() {
  const { t } = useTranslation("workspace");
  return (
    <section data-testid="workspace-changes">
      <h1>{t("placeholders.changesTitle")}</h1>
      <p className="sdm-skeleton-hint">{t("placeholders.changes")}</p>
    </section>
  );
}
