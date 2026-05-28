import { useTranslation } from "@sdm/i18n";

export default function CmdbRoute() {
  const { t } = useTranslation("workspace");
  return (
    <section data-testid="workspace-cmdb">
      <h1>{t("placeholders.cmdbTitle")}</h1>
      <p className="sdm-skeleton-hint">{t("placeholders.cmdb")}</p>
    </section>
  );
}
