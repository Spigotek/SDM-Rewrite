import { Link } from "react-router-dom";
import { Card, EmptyState, StatusBadge } from "@sdm/design-system";
import { formatRelative, useLocale, useTranslation } from "@sdm/i18n";
import type { RecentActivityEvent } from "../types";
import { TicketRowSkeleton } from "./Skeletons";

/**
 * Recent-activity feed (K.1 mockup §10.1, row 6). Client-side synthesised
 * from `myAllTicketsQuery` — see `deriveRecentActivity` in `api.ts`. Each
 * row reads `Systém · <verb> <ticket-ref> · <relative-time>`; the verb is
 * derived from the ticket's current status (the BFF doesn't ship a real
 * change-log endpoint yet, so this is the cheapest placeholder feed).
 */
export interface RecentActivityProps {
  readonly events: ReadonlyArray<RecentActivityEvent>;
  readonly pending: boolean;
  readonly error: boolean;
}

export function RecentActivity({ events, pending, error }: RecentActivityProps) {
  const { t } = useTranslation("portal");
  const { locale } = useLocale("portal");

  return (
    <Card variant="surface" className="sdm-home-card" data-testid="home-recent-activity">
      <header className="sdm-home-card-head">
        <h2 className="sdm-home-card-title">{t("home.activity.title")}</h2>
      </header>
      {error ? (
        <p className="sdm-home-error" role="alert" data-testid="home-recent-activity-error">
          {t("home.activity.error")}
        </p>
      ) : pending ? (
        <ul
          className="sdm-home-activity-list"
          aria-busy="true"
          data-testid="home-recent-activity-loading"
        >
          <TicketRowSkeleton />
          <TicketRowSkeleton />
          <TicketRowSkeleton />
        </ul>
      ) : events.length === 0 ? (
        <EmptyState
          variant="compact"
          title={t("home.activity.emptyTitle")}
          description={t("home.activity.empty")}
          data-testid="home-recent-activity-empty"
        />
      ) : (
        <ul className="sdm-home-activity-list">
          {events.map((event) => (
            <li
              key={event.id}
              className="sdm-home-activity-row"
              data-testid={`home-activity-${event.ticketRef}`}
            >
              <span className="sdm-home-activity-dot" aria-hidden="true" />
              <span className="sdm-home-activity-actor">{t("home.activity.actorSystem")}</span>
              <span className="sdm-home-activity-verb">{t("home.activity.verbStatusChange")}</span>
              <Link
                to={`/tickets/${encodeURIComponent(event.ticketId)}`}
                className="sdm-home-activity-ref"
              >
                {event.ticketRef}
              </Link>
              <StatusBadge status={event.status} withIcon />
              <time className="sdm-home-activity-time" dateTime={event.timestamp}>
                {formatRelative(event.timestamp, locale)}
              </time>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
