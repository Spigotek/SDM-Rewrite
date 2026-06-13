import { useEffect, useMemo, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Button,
  Card,
  EmptyState,
  IllustrationNoOpenTickets,
  PriorityBadge,
  Skeleton,
  StatusBadge,
  staggerListRows,
  usePageTransition,
} from "@sdm/design-system";
import { useTranslation, useLocale, formatRelative } from "@sdm/i18n";
import { tenantId as toTenantId } from "@sdm/domain";
import type { TicketStatus } from "@sdm/design-system";
import { useSession } from "../../shell/session-context";
import { myAllTicketsQuery } from "../home/api";
import type { MyTicketSummary } from "../home/types";
import "./my-tickets.css";

const TENANT_PLACEHOLDER = toTenantId("__pending__");
const MIN_ROWS_FOR_STAGGER = 3;

const OPEN_STATUSES: ReadonlyArray<TicketStatus> = ["new", "open", "in_progress", "reopened"];
const AWAITING_STATUSES: ReadonlyArray<TicketStatus> = [
  "pending",
  "waiting_customer",
  "waiting_vendor",
  "hold",
];
const RESOLVED_STATUSES: ReadonlyArray<TicketStatus> = ["resolved", "closed"];

interface SubheadCounts {
  readonly open: number;
  readonly awaiting: number;
  readonly resolved: number;
}

function deriveSubheadCounts(tickets: ReadonlyArray<MyTicketSummary>): SubheadCounts {
  let open = 0;
  let awaiting = 0;
  let resolved = 0;
  for (const ticket of tickets) {
    if (OPEN_STATUSES.includes(ticket.status)) open += 1;
    else if (AWAITING_STATUSES.includes(ticket.status)) awaiting += 1;
    else if (RESOLVED_STATUSES.includes(ticket.status)) resolved += 1;
  }
  return { open, awaiting, resolved };
}

function TicketRowSkeleton() {
  return (
    <li className="sdm-my-tickets-row sdm-my-tickets-row--skeleton" aria-hidden="true">
      <Skeleton variant="text" width="6ch" height={16} />
      <Skeleton variant="text" width="70%" height={16} />
      <Skeleton variant="text" width="8ch" height={20} />
    </li>
  );
}

/**
 * Portal `/tickets` route — v1.2 polish.
 *
 *   ┌─ Header: H1 "Moje tickety" + tabular-nums subhead ("3 otvorené, 1 čaká…")
 *   ├─ Skeleton rows while pending (no "Loading..." text)
 *   ├─ Empty state — illustration + "Vytvoriť nový" CTA
 *   └─ List — interactive `Card`-styled rows with status icon + priority badge,
 *             mono+tabular-nums ref, relative date, `staggerListRows` on mount.
 *
 * Page mount uses `usePageTransition` (crossfade only, reduced-motion safe).
 *
 * Optional v1.2 filter chips (Všetky / Otvorené / Vyriešené) deferred — see
 * report notes; the open/awaiting/resolved counts in the subhead carry the
 * same information for now.
 */
export function MyTicketsRoute() {
  const { t } = useTranslation("portal");
  const { locale } = useLocale("portal");
  const { session } = useSession();
  const tenantId = session?.tenantId ?? TENANT_PLACEHOLDER;
  const location = useLocation();
  const { ref: pageRef } = usePageTransition(location.pathname);
  const listRef = useRef<HTMLUListElement | null>(null);

  const query = useQuery({ ...myAllTicketsQuery(tenantId), enabled: session !== null });

  const tickets = useMemo(() => query.data ?? [], [query.data]);
  const counts = useMemo(() => deriveSubheadCounts(tickets), [tickets]);

  useEffect(() => {
    if (tickets.length >= MIN_ROWS_FOR_STAGGER) {
      staggerListRows(listRef.current);
    }
  }, [tickets.length]);

  return (
    <section ref={pageRef} className="sdm-my-tickets" data-testid="portal-my-tickets">
      <header className="sdm-my-tickets-head">
        <h1 className="sdm-my-tickets-title">{t("myTickets.title")}</h1>
        {tickets.length > 0 ? (
          <p className="sdm-my-tickets-subhead" data-testid="portal-my-tickets-subhead">
            <span className="sdm-my-tickets-count" data-testid="portal-my-tickets-count">
              {t("myTickets.subhead", {
                open: counts.open,
                awaiting: counts.awaiting,
                resolved: counts.resolved,
              })}
            </span>
          </p>
        ) : null}
      </header>
      {query.isError ? (
        <p className="sdm-my-tickets-error" role="alert" data-testid="portal-my-tickets-error">
          {t("myTickets.error")}
        </p>
      ) : session === null || query.isPending ? (
        <ul
          className="sdm-my-tickets-list"
          aria-busy="true"
          data-testid="portal-my-tickets-loading"
        >
          <TicketRowSkeleton />
          <TicketRowSkeleton />
          <TicketRowSkeleton />
        </ul>
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
        <ul ref={listRef} className="sdm-my-tickets-list" data-testid="portal-my-tickets-list">
          {tickets.map((ticket) => (
            <li key={ticket.id} className="sdm-my-tickets-row" data-row>
              <Link
                to={`/tickets/${encodeURIComponent(ticket.id)}`}
                className="sdm-my-tickets-link"
                data-testid={`my-ticket-${ticket.ref}`}
              >
                <Card variant="interactive" className="sdm-my-tickets-card">
                  <span className="sdm-my-tickets-ref">{ticket.ref}</span>
                  <span className="sdm-my-tickets-summary">{ticket.summary}</span>
                  <span className="sdm-my-tickets-badges">
                    <StatusBadge
                      withIcon
                      {...(ticket.statusCode
                        ? { caCode: ticket.statusCode }
                        : { status: ticket.status })}
                    />
                    {ticket.priority ? <PriorityBadge severity={ticket.priority} /> : null}
                  </span>
                  {ticket.updatedAt ? (
                    <time
                      className="sdm-my-tickets-time"
                      dateTime={ticket.updatedAt}
                      data-testid={`my-ticket-${ticket.ref}-time`}
                    >
                      {formatRelative(ticket.updatedAt, locale)}
                    </time>
                  ) : null}
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default MyTicketsRoute;
