import { useTranslation } from "@sdm/i18n";
import { PriorityBadge, StatusBadge, type Severity, type TicketStatus } from "@sdm/design-system";
import type { ChangeDetail } from "../types";

/**
 * Change-detail header — mirrors wireframe `03-change-calendar.md §Change
 * detail s approvals`. Top row: ref + summary; below it a two-line meta grid
 * with status / risk / category / schedule window. No action bar (CAB
 * approve / reject lives in H.11 ApprovalsTab footer).
 */

const STATUS_MAP: Record<string, TicketStatus> = {
  RFC: "new",
  APPR_PENDING: "pending",
  APPROVED: "open",
  SCHEDULED: "open",
  IN_PROGRESS: "in_progress",
  VERIFICATION_IN_PROGRESS: "in_progress",
  VERIFIED: "resolved",
  REJECTED: "closed",
  CL: "closed",
  CD: "closed",
  EMG_RFC: "pending",
  EMG_IN_PROGRESS: "in_progress",
  EMG_RETROSPECTIVE: "pending",
};

const RISK_SEVERITY: Record<string, Severity> = {
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
};

function formatDateRange(startIso: string | null, endIso: string | null): string {
  if (!startIso) return "—";
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) return "—";
  const startStr = start.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  if (!endIso) return startStr;
  const end = new Date(endIso);
  if (Number.isNaN(end.getTime())) return startStr;
  const endStr = end.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return `${startStr} – ${endStr}`;
}

export function ChangeHeader({ detail }: { readonly detail: ChangeDetail }) {
  const { t } = useTranslation("workspace");
  return (
    <header className="sdm-change-header" data-testid="change-header">
      <div className="sdm-change-header-title">
        <span className="sdm-change-header-ref">#{detail.ref}</span>
        <h1 className="sdm-change-header-summary">{detail.summary || t("changes.noSummary")}</h1>
      </div>
      <div className="sdm-change-header-meta">
        <div className="sdm-change-header-field">
          <span className="sdm-change-header-label">{t("changes.fields.status")}</span>
          <StatusBadge
            status={STATUS_MAP[detail.status] ?? "open"}
            label={t(`changes.statusLabel.${detail.status}`)}
            withIcon
          />
        </div>
        <div className="sdm-change-header-field">
          <span className="sdm-change-header-label">{t("changes.fields.risk")}</span>
          <PriorityBadge
            severity={RISK_SEVERITY[detail.risk] ?? "low"}
            label={t(`changes.risk.${detail.risk}`)}
          />
        </div>
        <div className="sdm-change-header-field">
          <span className="sdm-change-header-label">{t("changes.fields.category")}</span>
          <span data-testid="change-header-category" data-category={detail.category}>
            {t(`changes.category.${detail.category}`)}
          </span>
        </div>
        <div className="sdm-change-header-field">
          <span className="sdm-change-header-label">{t("changes.fields.schedule")}</span>
          <span data-testid="change-header-schedule">
            {formatDateRange(detail.scheduledStartAt, detail.scheduledEndAt)}
          </span>
        </div>
      </div>
    </header>
  );
}
