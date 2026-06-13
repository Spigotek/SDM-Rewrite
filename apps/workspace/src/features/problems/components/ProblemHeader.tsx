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

function formatDate(iso: string | null | undefined, locale?: string): string {
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

/**
 * Detail-header for `/problems/:id` — K.3.E polish. The ref is now rendered
 * in the `--font-size-2xl` mono treatment per K.1 brief §10.2, with the
 * summary as the H1 below. Meta grid keeps the 4-up shape but pulls
 * `StatusBadge withIcon` and `sdm-tabular` to align with the queue/changes
 * surfaces.
 */
export function ProblemHeader({ detail }: { readonly detail: ProblemDetail }) {
  const { t, i18n } = useTranslation("workspace");
  return (
    <header className="sdm-problem-header" data-testid="problem-header">
      <div className="sdm-problem-header-title">
        <span className="sdm-problem-header-ref sdm-tabular">#{detail.ref}</span>
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
            withIcon
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
          <span className="sdm-problem-header-value sdm-tabular">
            {formatDate(detail.openedAt, i18n.language)}
          </span>
        </div>
        <div className="sdm-problem-header-field">
          <span className="sdm-problem-header-label">{t("problems.fields.resolvedAt")}</span>
          <span className="sdm-problem-header-value sdm-tabular">
            {formatDate(detail.resolvedAt, i18n.language)}
          </span>
        </div>
      </div>
    </header>
  );
}
