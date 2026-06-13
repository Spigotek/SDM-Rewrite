import { useMemo } from "react";
import { useTranslation } from "@sdm/i18n";
import { Avatar, Select, StatusBadge, type TicketStatus } from "@sdm/design-system";
import type { UiTicketDetail, UiTicketType } from "@sdm/api-types";
import { usePatchTicket } from "../hooks";

/**
 * Ticket-detail header — K.3.E polish.
 *
 * - Ref rendered in mono 2xl (`--font-size-2xl`) per K.1 brief §10.2.
 * - Read-only `StatusBadge` (with lucide icon) sits next to the ref so the
 *   colour signal lands fast; the editable status `Select` stays in the meta
 *   row as the transition affordance.
 * - Customer avatar surfaces the requester face in the meta row.
 * - Opened-at + assignee meta render with `sdm-tabular`.
 */

const INCIDENT_STATUSES = ["OP", "WIP", "HLD", "AWU", "AWV", "ESC", "RES", "CL", "CD"];
const REQUEST_STATUSES = [
  "SUBMITTED",
  "APPR_PENDING",
  "APPROVED",
  "REJECTED",
  "IN_PROGRESS",
  "AWU",
  "DELIVERED",
  "CL",
  "CD",
];
const PROBLEM_STATUSES = ["OP", "WIP", "RES", "CL"];
const CHANGE_STATUSES = ["NEW", "APPR_PENDING", "APPROVED", "REJECTED", "IN_PROGRESS", "CL"];

const PRIORITIES = ["1", "2", "3", "4", "5"];

const CA_TO_TICKET_STATUS: Record<string, TicketStatus> = {
  OP: "open",
  WIP: "in_progress",
  HLD: "hold",
  AWU: "waiting_customer",
  AWV: "waiting_vendor",
  ESC: "in_progress",
  RES: "resolved",
  CL: "closed",
  CD: "cancelled",
  SUBMITTED: "new",
  APPR_PENDING: "approval_pending",
  APPROVED: "open",
  REJECTED: "rejected",
  IN_PROGRESS: "in_progress",
  DELIVERED: "resolved",
  NEW: "new",
};

function statusesFor(type: UiTicketType): ReadonlyArray<string> {
  switch (type) {
    case "incident":
      return INCIDENT_STATUSES;
    case "request":
      return REQUEST_STATUSES;
    case "problem":
      return PROBLEM_STATUSES;
    case "change":
      return CHANGE_STATUSES;
  }
}

function formatOpened(iso: string | null, locale?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export interface AgentTicketHeaderProps {
  readonly detail: UiTicketDetail;
}

export function AgentTicketHeader({ detail }: AgentTicketHeaderProps) {
  const { t, i18n } = useTranslation("workspace");
  const patch = usePatchTicket(detail.ticketType, detail.id);

  const statusOptions = useMemo(
    () =>
      statusesFor(detail.ticketType).map((code) => ({
        value: code,
        label: t(`ticketDetail.statusLabel.${code}`, { defaultValue: code }),
      })),
    [detail.ticketType, t],
  );

  const priorityOptions = useMemo(
    () =>
      PRIORITIES.map((code) => ({
        value: code,
        label: t(`ticketDetail.priorityLabel.${code}`, { defaultValue: code }),
      })),
    [t],
  );

  const onStatusChange = (next: string) => {
    if (next === detail.status?.code) return;
    patch.mutate({ status: next });
  };

  const onPriorityChange = (next: string) => {
    const n = Number(next);
    if (!Number.isFinite(n) || n === Number(detail.priority?.code ?? "")) return;
    patch.mutate({ priority: n });
  };

  const statusCode = detail.status?.code ?? "";
  const mappedStatus = CA_TO_TICKET_STATUS[statusCode] ?? "open";
  const customerName = detail.customer?.label ?? t("ticketDetail.header.anonymous");

  return (
    <header className="sdm-ticket-header" data-testid="ticket-header">
      <div className="sdm-ticket-header-title">
        <span className="sdm-ticket-header-ref sdm-tabular" data-testid="ticket-ref">
          #{detail.ref}
        </span>
        {detail.status ? (
          <StatusBadge status={mappedStatus} label={detail.status.label} withIcon />
        ) : null}
        <h1 className="sdm-ticket-header-summary" data-testid="ticket-summary">
          {detail.summary || t("ticketDetail.noSummary")}
        </h1>
      </div>

      <div className="sdm-ticket-header-meta">
        <div className="sdm-ticket-header-field" data-testid="ticket-status">
          <Select
            label={t("ticketDetail.fields.status")}
            options={statusOptions}
            value={detail.status?.code ?? ""}
            onValueChange={onStatusChange}
            disabled={patch.isPending}
          />
        </div>
        <div className="sdm-ticket-header-field" data-testid="ticket-priority">
          <Select
            label={t("ticketDetail.fields.priority")}
            options={priorityOptions}
            value={detail.priority?.code ?? ""}
            onValueChange={onPriorityChange}
            disabled={patch.isPending}
          />
        </div>
        <div className="sdm-ticket-header-field">
          <span className="sdm-ticket-header-label">{t("ticketDetail.header.customer")}</span>
          <span className="sdm-ticket-header-customer" data-testid="ticket-customer">
            <Avatar name={customerName} size="xs" />
            <span className="sdm-ticket-header-value">{customerName}</span>
          </span>
        </div>
        <div className="sdm-ticket-header-field">
          <span className="sdm-ticket-header-label">{t("ticketDetail.fields.assignee")}</span>
          <span className="sdm-ticket-header-value sdm-tabular" data-testid="ticket-assignee">
            {detail.assignee?.label ?? t("ticketDetail.fields.unassigned")}
          </span>
        </div>
        <div className="sdm-ticket-header-field">
          <span className="sdm-ticket-header-label">{t("ticketDetail.header.openedAt")}</span>
          <span className="sdm-ticket-header-value sdm-tabular" data-testid="ticket-opened-at">
            {formatOpened(detail.openedAt, i18n.language)}
          </span>
        </div>
      </div>
    </header>
  );
}
