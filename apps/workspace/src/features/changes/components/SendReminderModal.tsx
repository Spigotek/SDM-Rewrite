import { useEffect, useRef, useState } from "react";
import { useTranslation } from "@sdm/i18n";
import { Button } from "@sdm/design-system";
import type { ChangeDetail } from "../types";
import { useSendReminder } from "../hooks";

/**
 * Confirm dialog for sending a CAB reminder to a pending approver. No
 * additional fields — the click-to-send affordance is itself the consent.
 * On success we briefly render an inline confirmation (`aria-live="polite"`)
 * so screen readers announce the toast equivalent and dismiss the modal.
 */
export interface SendReminderModalProps {
  readonly detail: ChangeDetail;
  readonly approverId: string;
  readonly onClose: () => void;
}

export function SendReminderModal({ detail, approverId, onClose }: SendReminderModalProps) {
  const { t } = useTranslation("workspace");
  const reminder = useSendReminder(detail.id);
  const [sent, setSent] = useState(false);
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
    reminder.mutate(
      { approverId },
      {
        onSuccess: () => {
          setSent(true);
          window.setTimeout(onClose, 1200);
        },
      },
    );
  };

  return (
    <div className="sdm-modal-overlay" role="presentation">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="cab-reminder-modal-title"
        className="sdm-modal-dialog"
        data-testid="cab-reminder-modal"
      >
        <h2 id="cab-reminder-modal-title" className="sdm-modal-title">
          {t("changes.cab.reminderModal.title", { ref: detail.ref })}
        </h2>
        <p className="sdm-modal-body">
          {t("changes.cab.reminderModal.body", { approver: approverId })}
        </p>

        {sent && (
          <p
            className="sdm-change-cab-confirm"
            role="status"
            aria-live="polite"
            data-testid="cab-reminder-confirm"
          >
            {t("changes.cab.reminderModal.confirm")}
          </p>
        )}

        <div className="sdm-modal-actions">
          <Button
            ref={cancelRef}
            variant="secondary"
            onClick={onClose}
            data-testid="cab-reminder-cancel"
            disabled={reminder.isPending || sent}
          >
            {t("common.cancel")}
          </Button>
          <Button
            variant="primary"
            onClick={onSubmit}
            loading={reminder.isPending}
            disabled={sent}
            data-testid="cab-reminder-submit"
          >
            {t("changes.cab.reminderModal.submit")}
          </Button>
        </div>
      </div>
    </div>
  );
}
