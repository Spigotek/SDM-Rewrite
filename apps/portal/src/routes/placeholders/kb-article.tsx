import { useParams } from "react-router-dom";
import { useTranslation } from "@sdm/i18n";

export default function KbArticleRoute() {
  const { t } = useTranslation("portal");
  const { id } = useParams();
  return (
    <section data-testid="portal-kb-article">
      <h1>{t("placeholders.kbArticleTitle", { id: id ?? "—" })}</h1>
      <p className="sdm-skeleton-hint">{t("placeholders.kbArticle")}</p>
    </section>
  );
}
