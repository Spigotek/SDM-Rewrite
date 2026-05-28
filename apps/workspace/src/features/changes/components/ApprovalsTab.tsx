import { useTranslation } from "@sdm/i18n";
import type { ApprovalDecision } from "@sdm/domain";
import type { ChangeDetail } from "../types";

/**
 * Approvals tab — read-only ApprovalChecklist per wireframe
 * `03-change-calendar.md §APPROVALS`. Each approver row shows decision icon
 * (✅ APPROVED / ⏳ PENDING / ❌ REJECTED), the approver id, and the decided
 * timestamp.
 *
 * **H.11 will replace the read-only list with action buttons** (Approve /
 * Reject / Send reminder). H.9 intentionally ships zero actions — per the
 * H.9 hard constraint "NO CAB approval actions" and "NO new audit event
 * names" (F.4 audit taxonomy stays frozen).
 */

const DECISION_ICON: Record<ApprovalDecision, string> = {
  APPROVED: "✅",
  PENDING: "⏳",
  REJECTED: "❌",
};

function formatIso(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ApprovalsTab({ detail }: { readonly detail: ChangeDetail }) {
  const { t } = useTranslation("workspace");
  const approvers = detail.cabApprovers;

  return (
    <section
      role="tabpanel"
      id="change-tabpanel-approvals"
      aria-labelledby="change-tab-approvals"
      data-testid="change-tabpanel-approvals"
      className="sdm-change-tabpanel"
    >
      <header className="sdm-change-approvals-header">
        <h2>{t("changes.approvals.title")}</h2>
        <span className="sdm-change-approvals-state" data-state={detail.approvalState}>
          {t(`changes.approvalState.${detail.approvalState}`)}
        </span>
      </header>
      {approvers.length === 0 ? (
        <p className="sdm-change-detail-empty" data-testid="change-approvals-empty">
          {t("changes.approvals.empty")}
        </p>
      ) : (
        <ul className="sdm-change-approvals-list" data-testid="change-approvals-list">
          {approvers.map((a) => (
            <li
              key={a.id}
              data-testid="change-approver-row"
              data-decision={a.decision}
              aria-label={t("changes.approvals.rowAriaLabel", {
                approver: a.approverId,
                decision: t(`changes.approvalDecision.${a.decision}`),
              })}
            >
              <span aria-hidden="true" className="sdm-change-approver-icon">
                {DECISION_ICON[a.decision]}
              </span>
              <span className="sdm-change-approver-id">{a.approverId}</span>
              <span className="sdm-change-approver-decision">
                {t(`changes.approvalDecision.${a.decision}`)}
              </span>
              <span className="sdm-change-approver-ts">{formatIso(a.decidedAt)}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="sdm-change-approvals-hint" data-testid="change-approvals-hint">
        {t("changes.approvals.actionsDeferred")}
      </p>
    </section>
  );
}
