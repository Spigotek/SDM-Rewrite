import { useTranslation } from "@sdm/i18n";
import { StatusBadge, type TicketStatus } from "@sdm/design-system";
import type { ProblemDetail } from "../types";

const STATUS_MAP: Record<string, TicketStatus> = {
  IDENTIFIED: "new",
  INVESTIGATION: "in_progress",
  ROOT_CAUSE_KNOWN: "in_progress",
  KNOWN_ERROR: "open",
  RESOLVED: "resolved",
  CL: "closed",
  CD: "closed",
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Detail-header for `/problems/:id`. Mirrors the H.9 `ChangeHeader` layout
 * (ref + summary stacked over a 4-field meta grid). The `isMajor` flag gets a
 * dedicated badge in the title row because L2 triage uses it as a routing
 * signal (major problems escalate to incident commander).
 */
export function ProblemHeader({ detail }: { readonly detail: ProblemDetail }) {
  const { t } = useTranslation("workspace");
  return (
    <header className="sdm-problem-header" data-testid="problem-header">
      <div className="sdm-problem-header-title">
        <span className="sdm-problem-header-ref">#{detail.ref}</span>
        <h1 className="sdm-problem-header-summary">{detail.summary || t("problems.noSummary")}</h1>
        {detail.isMajor ? (
          <span className="sdm-problem-header-major" data-testid="problem-header-major">
            {t("problems.fields.isMajor")}
          </span>
        ) : null}
      </div>
      <div className="sdm-problem-header-meta">
        <div className="sdm-problem-header-field">
          <span className="sdm-problem-header-label">{t("problems.fields.status")}</span>
          <StatusBadge
            status={STATUS_MAP[detail.status] ?? "open"}
            label={t(`problems.statusLabel.${detail.status}` as const)}
          />
        </div>
        <div className="sdm-problem-header-field">
          <span className="sdm-problem-header-label">{t("problems.fields.assignee")}</span>
          <span className="sdm-problem-header-value" data-testid="problem-header-assignee">
            {detail.assigneeId ?? t("problems.fields.unassigned")}
          </span>
        </div>
        <div className="sdm-problem-header-field">
          <span className="sdm-problem-header-label">{t("problems.fields.openedAt")}</span>
          <span className="sdm-problem-header-value">{formatDate(detail.openedAt)}</span>
        </div>
        <div className="sdm-problem-header-field">
          <span className="sdm-problem-header-label">{t("problems.fields.resolvedAt")}</span>
          <span className="sdm-problem-header-value">{formatDate(detail.resolvedAt)}</span>
        </div>
      </div>
    </header>
  );
}
