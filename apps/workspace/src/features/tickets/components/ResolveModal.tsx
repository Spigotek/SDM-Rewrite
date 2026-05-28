import { useEffect, useRef, useState } from "react";
import { useTranslation } from "@sdm/i18n";
import { Button, Select, TextArea } from "@sdm/design-system";
import type { UiTicketDetail } from "@sdm/api-types";
import { useResolve } from "../hooks";

export interface ResolveModalProps {
  readonly detail: UiTicketDetail;
  readonly initialSolution: string;
  readonly onClose: () => void;
}

const RESOLUTION_CATEGORIES = [
  { value: "fixed", label: "Fixed" },
  { value: "workaround", label: "Workaround applied" },
  { value: "no-action", label: "No action required" },
  { value: "duplicate", label: "Duplicate" },
  { value: "user-error", label: "User error" },
];

/**
 * Resolve modal — Solution textarea (required) + Category select (per H.8.md
 * §Open questions). Submitting closes the ticket via
 * `POST /api/tickets/:type/:id/resolve`.
 */
export function ResolveModal({ detail, initialSolution, onClose }: ResolveModalProps) {
  const { t } = useTranslation("workspace");
  const resolve = useResolve(detail.ticketType, detail.id);
  const [solution, setSolution] = useState(initialSolution);
  const [category, setCategory] = useState<string>("fixed");
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
    if (!solution.trim()) return;
    resolve.mutate(
      { solution: solution.trim(), category },
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
        aria-labelledby="resolve-modal-title"
        className="sdm-modal-dialog"
        data-testid="ticket-resolve-modal"
      >
        <h2 id="resolve-modal-title" className="sdm-modal-title">
          {t("ticketDetail.resolveModal.title")}
        </h2>
        <p className="sdm-modal-body">{t("ticketDetail.resolveModal.body")}</p>

        <Select
          label={t("ticketDetail.resolveModal.category")}
          options={RESOLUTION_CATEGORIES}
          value={category}
          onValueChange={setCategory}
        />
        <TextArea
          label={t("ticketDetail.resolveModal.solution")}
          value={solution}
          onChange={(e) => setSolution(e.target.value)}
          placeholder={t("ticketDetail.resolveModal.solutionPlaceholder")}
          required
          rows={4}
          data-testid="ticket-resolve-solution"
        />

        <div className="sdm-modal-actions">
          <Button
            ref={cancelRef}
            variant="secondary"
            onClick={onClose}
            data-testid="ticket-resolve-cancel"
          >
            {t("common.cancel")}
          </Button>
          <Button
            variant="success"
            onClick={onSubmit}
            loading={resolve.isPending}
            disabled={!solution.trim()}
            data-testid="ticket-resolve-submit"
          >
            {t("ticketDetail.resolveModal.submit")}
          </Button>
        </div>
      </div>
    </div>
  );
}
