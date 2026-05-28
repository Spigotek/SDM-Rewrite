import { useTranslation } from "@sdm/i18n";

export default function MyTicketsRoute() {
  const { t } = useTranslation("portal");
  return (
    <section data-testid="portal-my-tickets">
      <h1>{t("placeholders.myTicketsTitle")}</h1>
      <p className="sdm-skeleton-hint">{t("placeholders.myTickets")}</p>
    </section>
  );
}
