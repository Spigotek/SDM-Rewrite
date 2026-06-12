import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { StatusBadge } from "@sdm/design-system";
import { useTranslation, useLocale, formatRelative } from "@sdm/i18n";
import { toTenantId } from "@sdm/domain";
import { useSession } from "../../shell/session-context";
import { myAllTicketsQuery } from "../home/api";
import "../home/home.css";
import "./my-tickets.css";

const TENANT_PLACEHOLDER = toTenantId("__pending__");

/**
 * Portal `/tickets` route — full list of the active user's tickets.
 * Replaces the chunk-1-era `placeholders/my-tickets.tsx` stub. Reuses the
 * home dashboard's `myAllTicketsQuery` (fetches up to 50 incidents where
 * `customer = me`) and the row markup styled by `home.css`.
 */
export function MyTicketsRoute() {
  const { t } = useTranslation("portal");
  const { locale } = useLocale("portal");
  const { session } = useSession();
  const tenantId = session?.tenantId ?? TENANT_PLACEHOLDER;
  const query = useQuery({ ...myAllTicketsQuery(tenantId), enabled: session !== null });

  if (query.isError) {
    return (
      <section className="sdm-my-tickets" data-testid="portal-my-tickets-error" role="alert">
        <h1 className="sdm-my-tickets-title">{t("myTickets.title")}</h1>
        <p className="sdm-home-error">{t("myTickets.error")}</p>
      </section>
    );
  }

  if (session === null || query.isPending) {
    return (
      <section className="sdm-my-tickets" data-testid="portal-my-tickets-loading">
        <h1 className="sdm-my-tickets-title">{t("myTickets.title")}</h1>
        <p className="sdm-skeleton-hint">{t("myTickets.loading")}</p>
      </section>
    );
  }

  const tickets = query.data ?? [];

  if (tickets.length === 0) {
    return (
      <section className="sdm-my-tickets" data-testid="portal-my-tickets-empty">
        <h1 className="sdm-my-tickets-title">{t("myTickets.title")}</h1>
        <p className="sdm-home-empty">{t("myTickets.empty")}</p>
      </section>
    );
  }

  return (
    <section className="sdm-my-tickets" data-testid="portal-my-tickets">
      <header className="sdm-my-tickets-head">
        <h1 className="sdm-my-tickets-title">{t("myTickets.title")}</h1>
        <p className="sdm-my-tickets-count" data-testid="portal-my-tickets-count">
          {t("myTickets.count", { n: tickets.length })}
        </p>
      </header>
      <ul className="sdm-home-ticket-list">
        {tickets.map((ticket) => (
          <li key={ticket.id} className="sdm-home-ticket-row">
            <Link
              to={`/tickets/${encodeURIComponent(ticket.id)}`}
              className="sdm-home-ticket-link"
              data-testid={`my-ticket-${ticket.ref}`}
            >
              <span className="sdm-home-ticket-ref">{ticket.ref}</span>
              <span className="sdm-home-ticket-summary">{ticket.summary}</span>
              <StatusBadge status={ticket.status} />
              {ticket.updatedAt ? (
                <span className="sdm-home-ticket-time">
                  {formatRelative(ticket.updatedAt, locale)}
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default MyTicketsRoute;
