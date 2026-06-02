import { useEffect, useRef, useState } from "react";
import { useTranslation } from "@sdm/i18n";
import { Button, TextArea } from "@sdm/design-system";
import type { ChangeDetail } from "../types";
import { useApproveChange } from "../hooks";
import { useSession } from "../../../shell/session-context";
import { StepUpModal } from "./StepUpModal";

/**
 * CAB approve confirmation. Optional comment field per `microcopy.md §6` —
 * Approve is the affirmative path so we ship a permissive UX (no required
 * reason), but the audit emit (`data.change.write` server-side) still captures
 * actor + approverId so the trail is complete.
 *
 * I.1 step-up gate: when the change is `category === "EMERGENCY"` AND the
 * active tenant is flagged `environment === "production"`, the FE renders
 * `<StepUpModal>` first; on TOTP success the minted token is forwarded as
 * `X-Step-Up-Token` to the approve mutation. The BFF re-validates the token
 * server-side (`changes.ts` step-up gate) so the FE check is UX-only — a
 * forged client bypass still fails at the BFF.
 */
export interface ApproveModalProps {
  readonly detail: ChangeDetail;
  readonly approverId: string;
  readonly onClose: () => void;
}

export function ApproveModal({ detail, approverId, onClose }: ApproveModalProps) {
  const { t } = useTranslation("workspace");
  const { session, tenants } = useSession();
  const approve = useApproveChange(detail.id);
  const [comment, setComment] = useState("");
  const [stepUpToken, setStepUpToken] = useState<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement | null>(null);

  const activeTenant = session ? tenants.find((t_) => t_.id === session.tenantId) : undefined;
  const needsStepUp = detail.category === "EMERGENCY" && activeTenant?.environment === "production";
  const stepUpPending = needsStepUp && stepUpToken === null;

  useEffect(() => {
    if (stepUpPending) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, stepUpPending]);

  useEffect(() => {
    if (stepUpPending) return;
    cancelRef.current?.focus();
  }, [stepUpPending]);

  const onSubmit = () => {
    approve.mutate(
      {
        approverId,
        category: detail.category,
        ...(comment.trim() ? { comment: comment.trim() } : {}),
        ...(stepUpToken ? { stepUpToken } : {}),
      },
      { onSuccess: () => onClose() },
    );
  };

  if (stepUpPending) {
    return <StepUpModal onSuccess={setStepUpToken} onCancel={onClose} />;
  }

  return (
    <div className="sdm-modal-overlay" role="presentation">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="cab-approve-modal-title"
        className="sdm-modal-dialog"
        data-testid="cab-approve-modal"
      >
        <h2 id="cab-approve-modal-title" className="sdm-modal-title">
          {t("changes.cab.approveModal.title", { ref: detail.ref })}
        </h2>
        <p className="sdm-modal-body">{t("changes.cab.approveModal.body")}</p>

        <TextArea
          label={t("changes.cab.approveModal.commentLabel")}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={t("changes.cab.approveModal.commentPlaceholder")}
          rows={3}
          data-testid="cab-approve-comment"
        />

        <div className="sdm-modal-actions">
          <Button
            ref={cancelRef}
            variant="secondary"
            onClick={onClose}
            data-testid="cab-approve-cancel"
          >
            {t("common.cancel")}
          </Button>
          <Button
            variant="success"
            onClick={onSubmit}
            loading={approve.isPending}
            data-testid="cab-approve-submit"
          >
            {t("changes.cab.approveModal.submit")}
          </Button>
        </div>
      </div>
    </div>
  );
}
