import { useParams } from "react-router-dom";
import { useTranslation } from "@sdm/i18n";

export default function CmdbCiRoute() {
  const { t } = useTranslation("workspace");
  const { id } = useParams();
  return (
    <section data-testid="workspace-cmdb-ci">
      <h1>{t("placeholders.cmdbCiTitle", { id: id ?? "—" })}</h1>
      <p className="sdm-skeleton-hint">{t("placeholders.cmdbCi")}</p>
    </section>
  );
}
