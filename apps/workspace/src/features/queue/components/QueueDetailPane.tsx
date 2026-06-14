import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { useTranslation } from "@sdm/i18n";
import {
  Avatar,
  Button,
  CA_SDM_TRANSITIONS,
  EmptyState,
  PriorityBadge,
  Skeleton,
  StatusBadge,
  type Severity,
  type TicketStatus,
} from "@sdm/design-system";
import type { UiActivityEntry, UiQueueItem, UiTicketDetail, UiTicketType } from "@sdm/api-types";
import { ticketDetailQuery } from "../../tickets/api";
import { caSdmCodeForType, transitionsForType } from "../hooks";
import { usePatchTicket } from "../../tickets/hooks";

/**
 * Right-pane lightweight ticket detail for `/queue` (Phase M.1.A — replaces
 * the H.8 placeholder).
 *
 * The pane reuses the canonical ticket-detail query/cache (`ticketDetailQuery`)
 * so opening the same ticket here and then via `/tickets/:id` shares one fetch
 * and one cache entry. Render is a 3-section card:
 *   1. Header — ref, transitionable `StatusBadge`, `PriorityBadge`, customer Avatar.
 *   2. Tabs   — Detail (description) | Activity (timeline preview, top 8) | Comments (public-only preview).
 *   3. Footer — primary "Otvoriť plný detail" routing CTA → `/tickets/:typedId`.
 *
 * Skeleton while pending, empty state when no row is selected.
 *
 * Status transitions reuse `usePatchTicket` (same optimistic + rollback wiring
 * the full-page header uses), so a transition fired here updates the cached
 * detail and the next full-page open sees the new state immediately.
 */

const CA_TO_TICKET_STATUS: Record<string, TicketStatus> = {
  NEW: "new",
  OP: "open",
  SUBMITTED: "new",
  APPR_PENDING: "approval_pending",
  APPROVED: "open",
  IN_PROGRESS: "in_progress",
  WIP: "in_progress",
  HLD: "hold",
  AWU: "waiting_customer",
  AWV: "waiting_vendor",
  RES: "resolved",
  DELIVERED: "resolved",
  CL: "closed",
  CD: "cancelled",
  REJECTED: "rejected",
  SCHEDULED: "scheduled",
  RFC: "new",
  VERIFIED: "resolved",
  IDENTIFIED: "new",
  KNOWN_ERROR: "in_progress",
  INVESTIGATION: "in_progress",
};

const PRIORITY_MAP: Record<string, Severity> = {
  "1": "critical",
  "2": "high",
  "3": "medium",
  "4": "low",
  "5": "low",
};

const TABS = ["detail", "activity", "comments"] as const;
type TabKey = (typeof TABS)[number];

function detailRouteFor(type: UiTicketType, id: string): string {
  // `parseTicketParam` in TicketDetailRoute defaults bare ids to `incident`, so
  // non-incident types must carry the `${type}:` prefix.
  return type === "incident" ? `/tickets/${id}` : `/tickets/${type}:${id}`;
}

function formatTs(iso: string | null, locale: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export interface QueueDetailPaneProps {
  readonly row: UiQueueItem | null;
}

export function QueueDetailPane({ row }: QueueDetailPaneProps) {
  const { t, i18n } = useTranslation("workspace");

  if (!row) {
    return (
      <div className="sdm-queue-detail-pane" data-testid="queue-detail-pane" data-state="empty">
        <EmptyState
          variant="minimal"
          title={t("queue.detailPane.emptyTitle")}
          description={t("queue.detailPane.empty")}
          data-testid="queue-detail-pane-empty"
        />
      </div>
    );
  }

  return <QueueDetailPaneBody row={row} locale={i18n.language} t={t} />;
}

interface QueueDetailPaneBodyProps {
  readonly row: UiQueueItem;
  readonly locale: string;
  readonly t: ReturnType<typeof useTranslation>["t"];
}

function QueueDetailPaneBody({ row, locale, t }: QueueDetailPaneBodyProps) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabKey>("detail");

  const detailQuery = useQuery({
    ...ticketDetailQuery(row.ticketType, row.id),
    enabled: row.id.length > 0,
  });

  const patch = usePatchTicket(row.ticketType, row.id);

  const mappedStatus = useMemo<TicketStatus>(() => {
    const code = detailQuery.data?.status?.code ?? row.status?.code ?? "";
    return CA_TO_TICKET_STATUS[code] ?? "open";
  }, [detailQuery.data?.status?.code, row.status?.code]);

  const allowedTransitions = useMemo(
    () => transitionsForType(row.ticketType, CA_SDM_TRANSITIONS[mappedStatus] ?? []),
    [row.ticketType, mappedStatus],
  );

  const onStatusTransition = (next: TicketStatus) => {
    const code = caSdmCodeForType(row.ticketType, next);
    if (!code) return;
    patch.mutate({ status: code });
  };

  const handleOpenFull = () => navigate(detailRouteFor(row.ticketType, row.id));

  return (
    <div
      className="sdm-queue-detail-pane"
      data-testid="queue-detail-pane"
      data-state="loaded"
      data-ticket-type={row.ticketType}
    >
      <header className="sdm-queue-detail-pane-header">
        <div className="sdm-queue-detail-pane-header-row">
          <h2 className="sdm-queue-detail-pane-ref sdm-tabular" data-testid="queue-detail-pane-ref">
            #{row.ref}
          </h2>
          <StatusBadge
            status={mappedStatus}
            label={detailQuery.data?.status?.label ?? row.status?.label ?? ""}
            withIcon
            transitionable
            disabled={patch.isPending}
            menuLabel={t("status.transition.menuLabel")}
            allowedTransitions={allowedTransitions}
            onTransition={onStatusTransition}
            data-testid="queue-detail-pane-status-badge"
          />
          <PriorityBadge
            severity={PRIORITY_MAP[row.priority?.code ?? ""] ?? "none"}
            label={row.priority?.label ?? "—"}
          />
        </div>
        <p className="sdm-queue-detail-pane-summary" data-testid="queue-detail-pane-summary">
          {row.summary || t("ticketDetail.noSummary")}
        </p>
        <div className="sdm-queue-detail-pane-customer" data-testid="queue-detail-pane-customer">
          <Avatar name={row.customer?.label ?? t("ticketDetail.header.anonymous")} size="xs" />
          <span>{row.customer?.label ?? t("ticketDetail.header.anonymous")}</span>
        </div>
      </header>

      <div
        className="sdm-queue-detail-pane-tabs"
        role="tablist"
        aria-label={t("queue.detailPane.tabsAria")}
        data-testid="queue-detail-pane-tabs"
      >
        {TABS.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            id={`queue-detail-pane-tab-${key}`}
            aria-selected={tab === key}
            aria-controls={`queue-detail-pane-panel-${key}`}
            tabIndex={tab === key ? 0 : -1}
            data-active={tab === key || undefined}
            data-testid={`queue-detail-pane-tab-${key}`}
            className="sdm-queue-detail-pane-tab"
            onClick={() => setTab(key)}
          >
            {t(`queue.detailPane.tabs.${key}`)}
          </button>
        ))}
      </div>

      <section
        role="tabpanel"
        id={`queue-detail-pane-panel-${tab}`}
        aria-labelledby={`queue-detail-pane-tab-${tab}`}
        className="sdm-queue-detail-pane-panel"
        data-testid={`queue-detail-pane-panel-${tab}`}
      >
        {detailQuery.isPending ? (
          <div className="sdm-queue-detail-pane-skeleton" data-testid="queue-detail-pane-skeleton">
            <Skeleton variant="text" width="60%" height={14} />
            <Skeleton variant="text" width="100%" height={12} count={3} />
          </div>
        ) : detailQuery.isError || !detailQuery.data ? (
          <p
            role="alert"
            className="sdm-queue-detail-pane-error"
            data-testid="queue-detail-pane-error"
          >
            {t("queue.detailPane.error")}
          </p>
        ) : tab === "detail" ? (
          <DetailTab detail={detailQuery.data} locale={locale} t={t} />
        ) : tab === "activity" ? (
          <ActivityTab activity={detailQuery.data.activity.items} locale={locale} t={t} />
        ) : (
          <CommentsTab activity={detailQuery.data.activity.items} locale={locale} t={t} />
        )}
      </section>

      <footer className="sdm-queue-detail-pane-footer">
        <Button
          type="button"
          variant="primary"
          size="sm"
          data-testid="queue-detail-pane-open-full"
          trailingIcon={<ArrowRight size={14} aria-hidden="true" />}
          onClick={handleOpenFull}
        >
          {t("queue.detailPane.openFull")}
        </Button>
      </footer>
    </div>
  );
}

interface PanelProps {
  readonly locale: string;
  readonly t: ReturnType<typeof useTranslation>["t"];
}

function DetailTab({ detail, locale, t }: PanelProps & { detail: UiTicketDetail }) {
  const opened = detail.openedAt
    ? new Date(detail.openedAt).toLocaleString(locale, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";
  return (
    <dl className="sdm-queue-detail-pane-dl">
      <div className="sdm-queue-detail-pane-dl-row">
        <dt>{t("queue.detailPane.fields.assignee")}</dt>
        <dd>{detail.assignee?.label ?? t("queue.unassigned")}</dd>
      </div>
      <div className="sdm-queue-detail-pane-dl-row">
        <dt>{t("queue.detailPane.fields.openedAt")}</dt>
        <dd className="sdm-tabular">{opened}</dd>
      </div>
      <div className="sdm-queue-detail-pane-dl-row sdm-queue-detail-pane-dl-row--block">
        <dt>{t("queue.detailPane.fields.description")}</dt>
        <dd>
          {detail.description.trim().length > 0
            ? detail.description
            : t("queue.detailPane.fields.descriptionEmpty")}
        </dd>
      </div>
    </dl>
  );
}

function ActivityTab({
  activity,
  locale,
  t,
}: PanelProps & { activity: ReadonlyArray<UiActivityEntry> }) {
  const items = activity.slice(0, 8);
  if (items.length === 0) {
    return (
      <p
        className="sdm-queue-detail-pane-empty-text"
        data-testid="queue-detail-pane-activity-empty"
      >
        {t("queue.detailPane.activity.empty")}
      </p>
    );
  }
  return (
    <ol className="sdm-queue-detail-pane-list">
      {items.map((entry) => (
        <li
          key={entry.id}
          className="sdm-queue-detail-pane-list-item"
          data-kind={entry.kind}
          data-testid="queue-detail-pane-activity-item"
        >
          <span className="sdm-queue-detail-pane-list-meta sdm-tabular">
            {formatTs(entry.createdAt, locale)}
          </span>
          <span className="sdm-queue-detail-pane-list-body">{entry.text}</span>
        </li>
      ))}
    </ol>
  );
}

function CommentsTab({
  activity,
  locale,
  t,
}: PanelProps & { activity: ReadonlyArray<UiActivityEntry> }) {
  const items = activity.filter((e) => e.kind === "public").slice(0, 8);
  if (items.length === 0) {
    return (
      <p
        className="sdm-queue-detail-pane-empty-text"
        data-testid="queue-detail-pane-comments-empty"
      >
        {t("queue.detailPane.comments.empty")}
      </p>
    );
  }
  return (
    <ol className="sdm-queue-detail-pane-list">
      {items.map((entry) => (
        <li
          key={entry.id}
          className="sdm-queue-detail-pane-list-item"
          data-kind="public"
          data-testid="queue-detail-pane-comment-item"
        >
          <span className="sdm-queue-detail-pane-list-meta sdm-tabular">
            {entry.author?.label ?? t("ticketDetail.timeline.author.public")} ·{" "}
            {formatTs(entry.createdAt, locale)}
          </span>
          <span className="sdm-queue-detail-pane-list-body">{entry.text}</span>
        </li>
      ))}
    </ol>
  );
}
