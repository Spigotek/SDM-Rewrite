import { useTranslation } from "@sdm/i18n";

export default function ChangesCalendarRoute() {
  const { t } = useTranslation("workspace");
  return (
    <section data-testid="workspace-changes-calendar">
      <h1>{t("placeholders.changesCalendarTitle")}</h1>
      <p className="sdm-skeleton-hint">{t("placeholders.changesCalendar")}</p>
    </section>
  );
}
