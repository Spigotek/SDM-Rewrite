import { useMemo } from "react";
import { useTranslation } from "@sdm/i18n";
import { Select } from "@sdm/design-system";
import type { UiTicketDetail, UiTicketType } from "@sdm/api-types";
import { usePatchTicket } from "../hooks";

/**
 * Top header — ref + summary + inline status/priority editors.
 *
 * Status transitions are driven by `STATUS_OPTIONS[type]` — the FE is the UX
 * affordance ("only the transitions a state machine permits"), the BFF is
 * authoritative and rejects illegal moves with 422. We keep the option lists
 * intentionally small per H.8 §Open questions; the spec lifecycle is per-type
 * but the workspace agent path is a strict subset.
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

export interface AgentTicketHeaderProps {
  readonly detail: UiTicketDetail;
}

export function AgentTicketHeader({ detail }: AgentTicketHeaderProps) {
  const { t } = useTranslation("workspace");
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

  return (
    <header className="sdm-ticket-header" data-testid="ticket-header">
      <div className="sdm-ticket-header-title">
        <span className="sdm-ticket-header-ref" data-testid="ticket-ref">
          #{detail.ref}
        </span>
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
          <span className="sdm-ticket-header-label">{t("ticketDetail.fields.assignee")}</span>
          <span className="sdm-ticket-header-value" data-testid="ticket-assignee">
            {detail.assignee?.label ?? t("ticketDetail.fields.unassigned")}
          </span>
        </div>
      </div>
    </header>
  );
}
