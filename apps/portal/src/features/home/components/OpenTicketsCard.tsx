import { Link } from "react-router-dom";
import { Card, EmptyState, StatusBadge } from "@sdm/design-system";
import { formatRelative, useLocale, useTranslation } from "@sdm/i18n";
import type { MyTicketSummary } from "../types";
import { TicketRowSkeleton } from "./Skeletons";

/**
 * "Moje otvorené tickety" — left column of row 4 in the K.1 mockup. Up to
 * 5 ticket rows wrapped in a `Card`, header "Moje otvorené tickety" + link
 * to `/tickets`, `StatusBadge withIcon` on each row. Empty + loading +
 * error states share the same Card frame so the row height never collapses.
 */
export interface OpenTicketsCardProps {
  readonly tickets: ReadonlyArray<MyTicketSummary>;
  readonly pending: boolean;
  readonly error: boolean;
}

export function OpenTicketsCard({ tickets, pending, error }: OpenTicketsCardProps) {
  const { t } = useTranslation("portal");
  const { locale } = useLocale("portal");

  return (
    <Card variant="surface" className="sdm-home-card" data-testid="home-open-tickets">
      <header className="sdm-home-card-head">
        <h2 className="sdm-home-card-title">{t("home.myTickets.title")}</h2>
        <Link to="/tickets" className="sdm-home-card-link" data-testid="home-open-tickets-all">
          {t("home.myTickets.seeAll")}
        </Link>
      </header>
      {error ? (
        <p className="sdm-home-error" role="alert" data-testid="home-open-tickets-error">
          {t("home.myTickets.error")}
        </p>
      ) : pending ? (
        <ul
          className="sdm-home-ticket-list"
          aria-busy="true"
          data-testid="home-open-tickets-loading"
        >
          <TicketRowSkeleton />
          <TicketRowSkeleton />
          <TicketRowSkeleton />
        </ul>
      ) : tickets.length === 0 ? (
        <EmptyState
          variant="compact"
          title={t("home.myTickets.emptyTitle")}
          description={t("home.myTickets.empty")}
          data-testid="home-open-tickets-empty"
        />
      ) : (
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
                <StatusBadge status={ticket.status} withIcon />
                {ticket.updatedAt ? (
                  <span className="sdm-home-ticket-time">
                    {formatRelative(ticket.updatedAt, locale)}
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
