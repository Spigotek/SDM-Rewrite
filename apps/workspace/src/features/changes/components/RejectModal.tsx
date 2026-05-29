import { useEffect, useRef, useState } from "react";
import { useTranslation } from "@sdm/i18n";
import { Button, TextArea } from "@sdm/design-system";
import type { ChangeDetail } from "../types";
import { useRejectChange } from "../hooks";

/**
 * CAB reject confirmation. Reason field is **required** per `microcopy.md §6
 * Zamietnuť CHG-503 — Musíš pridať komentár prečo`. Empty / whitespace-only
 * reasons disable the submit button and the BFF echoes a 400 if the FE is
 * bypassed.
 */
export interface RejectModalProps {
  readonly detail: ChangeDetail;
  readonly approverId: string;
  readonly onClose: () => void;
}

const MIN_REASON_LENGTH = 1;

export function RejectModal({ detail, approverId, onClose }: RejectModalProps) {
  const { t } = useTranslation("workspace");
  const reject = useRejectChange(detail.id);
  const [reason, setReason] = useState("");
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const trimmed = reason.trim();
  const isValid = trimmed.length >= MIN_REASON_LENGTH;

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
    if (!isValid) return;
    reject.mutate({ approverId, reason: trimmed }, { onSuccess: () => onClose() });
  };

  return (
    <div className="sdm-modal-overlay" role="presentation">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="cab-reject-modal-title"
        className="sdm-modal-dialog"
        data-testid="cab-reject-modal"
      >
        <h2 id="cab-reject-modal-title" className="sdm-modal-title">
          {t("changes.cab.rejectModal.title", { ref: detail.ref })}
        </h2>
        <p className="sdm-modal-body">{t("changes.cab.rejectModal.body")}</p>

        <TextArea
          label={t("changes.cab.rejectModal.reasonLabel")}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t("changes.cab.rejectModal.reasonPlaceholder")}
          required
          rows={4}
          data-testid="cab-reject-reason"
        />
        {!isValid && reason.length > 0 && (
          <p className="sdm-change-cab-error" role="alert" data-testid="cab-reject-reason-error">
            {t("changes.cab.rejectModal.reasonRequired")}
          </p>
        )}

        <div className="sdm-modal-actions">
          <Button
            ref={cancelRef}
            variant="secondary"
            onClick={onClose}
            data-testid="cab-reject-cancel"
          >
            {t("common.cancel")}
          </Button>
          <Button
            variant="destructive"
            onClick={onSubmit}
            loading={reject.isPending}
            disabled={!isValid}
            data-testid="cab-reject-submit"
          >
            {t("changes.cab.rejectModal.submit")}
          </Button>
        </div>
      </div>
    </div>
  );
}
