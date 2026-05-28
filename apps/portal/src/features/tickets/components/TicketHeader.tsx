import { StatusBadge, type TicketStatus } from "@sdm/design-system";
import { formatRelative, useLocale, useTranslation } from "@sdm/i18n";
import type { UiTicketDetail } from "@sdm/api-types";

/**
 * Header — ref + summary + status + priority + opened-at relative time.
 *
 * Mirrors the wireframe top block (04-ticket-detail.md §Low-fi). Portal
 * persona reads ticket state; status / priority are NOT editable here
 * (workspace-only). Priority is rendered as a compact pill — we avoid the
 * full `<PriorityBadge>` because the portal CSS budget is tight and the
 * label is short.
 */
export interface TicketHeaderProps {
  readonly detail: UiTicketDetail;
}

function normaliseStatus(code: string | null | undefined): TicketStatus {
  switch (code) {
    case "OP":
      return "open";
    case "WIP":
    case "IN_PROGRESS":
      return "in_progress";
    case "HLD":
      return "hold";
    case "AWU":
    case "AWV":
    case "APPR_PENDING":
      return "pending";
    case "RES":
      return "resolved";
    case "CL":
    case "CD":
      return "closed";
    case "ESC":
      return "open";
    default:
      return "open";
  }
}

export function TicketHeader({ detail }: TicketHeaderProps) {
  const { t } = useTranslation("portal");
  const { locale } = useLocale("portal");
  const status = normaliseStatus(detail.status?.code);
  const priorityLabel = detail.priority?.label ?? null;

  return (
    <header className="sdm-portal-ticket-header" data-testid="portal-ticket-header">
      <div className="sdm-portal-ticket-header-title">
        <span className="sdm-portal-ticket-header-ref" data-testid="portal-ticket-ref">
          #{detail.ref}
        </span>
        <h1 className="sdm-portal-ticket-header-summary" data-testid="portal-ticket-summary">
          {detail.summary || t("ticketDetail.noSummary")}
        </h1>
      </div>

      <dl className="sdm-portal-ticket-header-meta">
        <div className="sdm-portal-ticket-header-field">
          <dt>{t("ticketDetail.fields.status")}</dt>
          <dd>
            <StatusBadge status={status} />
          </dd>
        </div>
        {priorityLabel ? (
          <div className="sdm-portal-ticket-header-field">
            <dt>{t("ticketDetail.fields.priority")}</dt>
            <dd data-testid="portal-ticket-priority">{priorityLabel}</dd>
          </div>
        ) : null}
        {detail.assignee?.label ? (
          <div className="sdm-portal-ticket-header-field">
            <dt>{t("ticketDetail.fields.assignee")}</dt>
            <dd data-testid="portal-ticket-assignee">{detail.assignee.label}</dd>
          </div>
        ) : null}
        {detail.openedAt ? (
          <div className="sdm-portal-ticket-header-field">
            <dt>{t("ticketDetail.fields.openedAt")}</dt>
            <dd data-testid="portal-ticket-opened-at">{formatRelative(detail.openedAt, locale)}</dd>
          </div>
        ) : null}
      </dl>
    </header>
  );
}
