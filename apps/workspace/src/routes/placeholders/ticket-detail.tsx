import { useParams } from "react-router-dom";
import { useTranslation } from "@sdm/i18n";

export default function TicketDetailRoute() {
  const { t } = useTranslation("workspace");
  const { id } = useParams();
  return (
    <section data-testid="workspace-ticket-detail">
      <h1>{t("placeholders.ticketDetailTitle", { id: id ?? "—" })}</h1>
      <p className="sdm-skeleton-hint">{t("placeholders.ticketDetail")}</p>
    </section>
  );
}
