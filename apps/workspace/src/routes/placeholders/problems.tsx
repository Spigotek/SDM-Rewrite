import { useTranslation } from "@sdm/i18n";

export default function ProblemsRoute() {
  const { t } = useTranslation("workspace");
  return (
    <section data-testid="workspace-problems">
      <h1>{t("placeholders.problemsTitle")}</h1>
      <p className="sdm-skeleton-hint">{t("placeholders.problems")}</p>
    </section>
  );
}
