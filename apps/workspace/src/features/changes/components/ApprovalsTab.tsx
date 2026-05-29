import { useState } from "react";
import { useTranslation } from "@sdm/i18n";
import { Button } from "@sdm/design-system";
import { Can } from "@sdm/auth";
import { hasPermission, type ApprovalDecision } from "@sdm/domain";
import type { ChangeDetail } from "../types";
import { useSession } from "../../../shell/session-context";
import { ApproveModal } from "./ApproveModal";
import { RejectModal } from "./RejectModal";
import { SendReminderModal } from "./SendReminderModal";

/**
 * Approvals tab — list of CAB approvers with per-row action buttons gated by
 * `<Can permission="cab.approve">`. Approve / Reject open confirm modals;
 * Reminder fires a POST and renders an inline announcement.
 *
 * Action visibility per approver row:
 *  - Approve / Reject: shown only when the row's decision is `PENDING` (a
 *    given approver can't re-vote after deciding).
 *  - Send reminder: shown only for `PENDING` rows AND only to a permission-
 *    holder who isn't that approver (no self-nags). The user's `contactId` is
 *    the approver-row identity comparator.
 *
 * Step-up auth for emergency/critical-prod changes (microcopy.md §13.2) is
 * tracked as a Phase I.2 follow-up — F.1 ships the documentation but not the
 * step-up flow. We render Approve / Reject unconditionally for permission-
 * holders today; SIEM picks up the `data.change.write` audit emit so any
 * emergency approval is reviewable.
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

type ModalState =
  | { readonly kind: "none" }
  | { readonly kind: "approve"; readonly approverId: string }
  | { readonly kind: "reject"; readonly approverId: string }
  | { readonly kind: "reminder"; readonly approverId: string };

export function ApprovalsTab({ detail }: { readonly detail: ChangeDetail }) {
  const { t } = useTranslation("workspace");
  const { session } = useSession();
  const approvers = detail.cabApprovers;
  const roles = session?.roles ?? [];
  const currentApproverId = session?.contactId ?? "";
  const [modal, setModal] = useState<ModalState>({ kind: "none" });
  const canApprove = hasPermission(roles, "cab.approve");

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
          {approvers.map((a) => {
            const isPending = a.decision === "PENDING";
            const isSelf = a.approverId === currentApproverId;
            return (
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
                {isPending && (
                  <Can roles={roles} permission="cab.approve">
                    <div
                      className="sdm-change-approver-actions"
                      data-testid="change-approver-actions"
                    >
                      <Button
                        variant="success"
                        size="sm"
                        onClick={() => setModal({ kind: "approve", approverId: a.approverId })}
                        data-testid="change-approver-approve"
                      >
                        {t("changes.cab.actions.approve")}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setModal({ kind: "reject", approverId: a.approverId })}
                        data-testid="change-approver-reject"
                      >
                        {t("changes.cab.actions.reject")}
                      </Button>
                      {!isSelf && (
                        <Button
                          variant="tertiary"
                          size="sm"
                          onClick={() => setModal({ kind: "reminder", approverId: a.approverId })}
                          data-testid="change-approver-reminder"
                        >
                          {t("changes.cab.actions.reminder")}
                        </Button>
                      )}
                    </div>
                  </Can>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {!canApprove && approvers.length > 0 && (
        <p className="sdm-change-approvals-hint" data-testid="change-approvals-hint">
          {t("changes.cab.deniedHint")}
        </p>
      )}

      {modal.kind === "approve" && (
        <ApproveModal
          detail={detail}
          approverId={modal.approverId}
          onClose={() => setModal({ kind: "none" })}
        />
      )}
      {modal.kind === "reject" && (
        <RejectModal
          detail={detail}
          approverId={modal.approverId}
          onClose={() => setModal({ kind: "none" })}
        />
      )}
      {modal.kind === "reminder" && (
        <SendReminderModal
          detail={detail}
          approverId={modal.approverId}
          onClose={() => setModal({ kind: "none" })}
        />
      )}
    </section>
  );
}
