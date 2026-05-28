import { useParams } from "react-router-dom";
import { useTranslation } from "@sdm/i18n";

export default function ChangeDetailRoute() {
  const { t } = useTranslation("workspace");
  const { id } = useParams();
  return (
    <section data-testid="workspace-change-detail">
      <h1>{t("placeholders.changeDetailTitle", { id: id ?? "—" })}</h1>
      <p className="sdm-skeleton-hint">{t("placeholders.changeDetail")}</p>
    </section>
  );
}
