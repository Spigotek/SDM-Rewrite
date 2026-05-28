import { useEffect, useRef, useState } from "react";
import { useTranslation } from "@sdm/i18n";
import { Button, Select, TextArea } from "@sdm/design-system";
import type { UiTicketDetail } from "@sdm/api-types";
import { useEscalate } from "../hooks";

export interface EscalateModalProps {
  readonly detail: UiTicketDetail;
  readonly onClose: () => void;
}

const ASSIGNMENT_GROUPS = [
  { value: "l2-support", label: "L2 Support" },
  { value: "infra", label: "Infrastructure" },
  { value: "network", label: "Network ops" },
  { value: "vendor", label: "Vendor escalation" },
];

/**
 * Escalate modal — requires a note + assignment group select per
 * `02-ticket-detail.md §Action bar`. Submit calls `useEscalate` which fires
 * `POST /api/tickets/:type/:id/escalate`.
 */
export function EscalateModal({ detail, onClose }: EscalateModalProps) {
  const { t } = useTranslation("workspace");
  const escalate = useEscalate(detail.ticketType, detail.id);
  const [note, setNote] = useState("");
  const [group, setGroup] = useState<string>("l2-support");
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
    if (!note.trim()) return;
    escalate.mutate(
      { note: note.trim(), group },
      {
        onSuccess: () => onClose(),
      },
    );
  };

  return (
    <div className="sdm-modal-overlay" role="presentation">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="escalate-modal-title"
        className="sdm-modal-dialog"
        data-testid="ticket-escalate-modal"
      >
        <h2 id="escalate-modal-title" className="sdm-modal-title">
          {t("ticketDetail.escalateModal.title")}
        </h2>
        <p className="sdm-modal-body">{t("ticketDetail.escalateModal.body")}</p>

        <Select
          label={t("ticketDetail.escalateModal.group")}
          options={ASSIGNMENT_GROUPS}
          value={group}
          onValueChange={setGroup}
        />
        <TextArea
          label={t("ticketDetail.escalateModal.note")}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t("ticketDetail.escalateModal.notePlaceholder")}
          required
          rows={4}
          data-testid="ticket-escalate-note"
        />

        <div className="sdm-modal-actions">
          <Button
            ref={cancelRef}
            variant="secondary"
            onClick={onClose}
            data-testid="ticket-escalate-cancel"
          >
            {t("common.cancel")}
          </Button>
          <Button
            variant="destructive"
            onClick={onSubmit}
            loading={escalate.isPending}
            disabled={!note.trim()}
            data-testid="ticket-escalate-submit"
          >
            {t("ticketDetail.escalateModal.submit")}
          </Button>
        </div>
      </div>
    </div>
  );
}
