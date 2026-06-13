import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button, EmptyState, IllustrationNoOpenTickets, StatusBadge } from "@sdm/design-system";
import { useTranslation, useLocale, formatRelative } from "@sdm/i18n";
import { tenantId as toTenantId } from "@sdm/domain";
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

  const tickets = query.data ?? [];

  return (
    <section className="sdm-my-tickets" data-testid="portal-my-tickets">
      <header className="sdm-my-tickets-head">
        <h1 className="sdm-my-tickets-title">{t("myTickets.title")}</h1>
        {tickets.length > 0 ? (
          <p className="sdm-my-tickets-count" data-testid="portal-my-tickets-count">
            {t("myTickets.count", { n: tickets.length })}
          </p>
        ) : null}
      </header>
      {query.isError ? (
        <p className="sdm-home-error" role="alert" data-testid="portal-my-tickets-error">
          {t("myTickets.error")}
        </p>
      ) : session === null || query.isPending ? (
        <p className="sdm-skeleton-hint" data-testid="portal-my-tickets-loading">
          {t("myTickets.loading")}
        </p>
      ) : tickets.length === 0 ? (
        <EmptyState
          variant="hero"
          illustration={<IllustrationNoOpenTickets />}
          title={t("myTickets.emptyTitle")}
          description={t("myTickets.empty")}
          cta={
            <Link to="/new-incident">
              <Button type="button" variant="primary" size="md">
                {t("myTickets.emptyCta")}
              </Button>
            </Link>
          }
          data-testid="portal-my-tickets-empty"
        />
      ) : (
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
      )}
    </section>
  );
}

export default MyTicketsRoute;
