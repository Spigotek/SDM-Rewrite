import { PriorityBadge, StatusBadge, type Severity, type TicketStatus } from "@sdm/design-system";
import { formatRelative, useLocale, useTranslation } from "@sdm/i18n";
import type { UiTicketDetail } from "@sdm/api-types";

/**
 * Header card — large ticket ref (mono, 2xl), summary, inline status +
 * priority badges, opened/resolved dates. K.3.E v1.2 — ref upgraded from
 * `--font-size-sm` to `--font-size-2xl` to match the K.1 brief §10.
 *
 * The portal persona is read-only; status / priority badges are passive
 * here (workspace owns the transition UI per K.1 §6.4).
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

function normalisePriority(code: string | null | undefined): Severity | null {
  if (!code) return null;
  const norm = code.toUpperCase();
  if (norm === "P1" || norm === "1" || norm === "PRI:500" || norm === "CRITICAL") return "critical";
  if (norm === "P2" || norm === "2" || norm === "PRI:400" || norm === "HIGH") return "high";
  if (norm === "P3" || norm === "3" || norm === "PRI:300" || norm === "MEDIUM") return "medium";
  if (norm === "P4" || norm === "4" || norm === "PRI:200" || norm === "LOW") return "low";
  if (norm === "P5" || norm === "5" || norm === "PRI:100" || norm === "NONE") return "none";
  return null;
}

export function TicketHeader({ detail }: TicketHeaderProps) {
  const { t } = useTranslation("portal");
  const { locale } = useLocale("portal");
  const status = normaliseStatus(detail.status?.code);
  const priority = normalisePriority(detail.priority?.code);
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

      <div className="sdm-portal-ticket-header-badges">
        <StatusBadge
          withIcon
          {...(detail.status?.code ? { caCode: detail.status.code } : { status })}
          data-testid="portal-ticket-status-badge"
        />
        {priority ? (
          <PriorityBadge
            severity={priority}
            {...(priorityLabel ? { label: priorityLabel } : {})}
            data-testid="portal-ticket-priority"
          />
        ) : null}
      </div>

      <dl className="sdm-portal-ticket-header-meta">
        {detail.assignee?.label ? (
          <div className="sdm-portal-ticket-header-field">
            <dt>{t("ticketDetail.fields.assignee")}</dt>
            <dd data-testid="portal-ticket-assignee">{detail.assignee.label}</dd>
          </div>
        ) : null}
        {detail.openedAt ? (
          <div className="sdm-portal-ticket-header-field">
            <dt>{t("ticketDetail.fields.openedAt")}</dt>
            <dd data-testid="portal-ticket-opened-at">
              <time dateTime={detail.openedAt}>{formatRelative(detail.openedAt, locale)}</time>
            </dd>
          </div>
        ) : null}
        {detail.closedAt ? (
          <div className="sdm-portal-ticket-header-field">
            <dt>{t("ticketDetail.fields.closedAt")}</dt>
            <dd data-testid="portal-ticket-closed-at">
              <time dateTime={detail.closedAt}>{formatRelative(detail.closedAt, locale)}</time>
            </dd>
          </div>
        ) : null}
      </dl>
    </header>
  );
}
