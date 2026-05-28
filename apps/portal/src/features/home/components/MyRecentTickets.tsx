import { Link } from "react-router-dom";
import { StatusBadge } from "@sdm/design-system";
import { formatRelative, useLocale, useTranslation } from "@sdm/i18n";
import type { MyTicketSummary } from "../types";

/**
 * "My active tickets" list — top 5 incidents where the active user is the
 * customer. Rows are full-width links to `/tickets/:id`; on mobile the
 * status badge wraps under the summary (controlled by `.sdm-home-ticket-row`).
 *
 * Empty state renders a single-paragraph hint per `microcopy.md §4`.
 */
export function MyRecentTickets({ tickets }: { tickets: ReadonlyArray<MyTicketSummary> }) {
  const { t } = useTranslation("portal");
  const { locale } = useLocale("portal");

  if (tickets.length === 0) {
    return (
      <section className="sdm-home-section" data-testid="home-my-tickets-empty">
        <h2 className="sdm-home-section-title">{t("home.myTickets.title")}</h2>
        <p className="sdm-home-empty">{t("home.myTickets.empty")}</p>
      </section>
    );
  }

  return (
    <section className="sdm-home-section" data-testid="home-my-tickets">
      <header className="sdm-home-section-head">
        <h2 className="sdm-home-section-title">{t("home.myTickets.title")}</h2>
        <Link to="/tickets" className="sdm-home-section-link" data-testid="home-my-tickets-all">
          {t("home.myTickets.seeAll")}
        </Link>
      </header>
      <ul className="sdm-home-ticket-list">
        {tickets.map((ticket) => (
          <li key={ticket.id} className="sdm-home-ticket-row">
            <Link
              to={`/tickets/${encodeURIComponent(ticket.id)}`}
              className="sdm-home-ticket-link"
              data-testid={`home-ticket-${ticket.ref}`}
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
