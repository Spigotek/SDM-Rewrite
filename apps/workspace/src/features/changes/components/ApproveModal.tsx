import { useEffect, useRef, useState } from "react";
import { useTranslation } from "@sdm/i18n";
import { Button, TextArea } from "@sdm/design-system";
import type { ChangeDetail } from "../types";
import { useApproveChange } from "../hooks";

/**
 * CAB approve confirmation. Optional comment field per `microcopy.md §6` —
 * Approve is the affirmative path so we ship a permissive UX (no required
 * reason), but the audit emit (`data.change.write` server-side) still captures
 * actor + approverId so the trail is complete.
 *
 * Step-up auth (F.1 §13.2 microcopy): the design calls for re-auth on critical
 * production changes. F.1 has not implemented the step-up flow yet — we ship
 * Approve **without** the re-auth prompt (degraded UX, tracked as a Phase I.2
 * follow-up in the PR description). The audit emit still goes out, so SIEM
 * can flag emergency approves for compliance review.
 */
export interface ApproveModalProps {
  readonly detail: ChangeDetail;
  readonly approverId: string;
  readonly onClose: () => void;
}

export function ApproveModal({ detail, approverId, onClose }: ApproveModalProps) {
  const { t } = useTranslation("workspace");
  const approve = useApproveChange(detail.id);
  const [comment, setComment] = useState("");
  const cancelRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  const onSubmit = () => {
    approve.mutate(
      { approverId, ...(comment.trim() ? { comment: comment.trim() } : {}) },
      { onSuccess: () => onClose() },
    );
  };

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
