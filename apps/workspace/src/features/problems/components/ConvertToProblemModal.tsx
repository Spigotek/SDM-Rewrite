import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "@sdm/i18n";
import { Button, TextArea } from "@sdm/design-system";
import { useConvertIncidentToProblem } from "../hooks";

/**
 * Convert-from-incident modal — opened from the H.8 ticket-detail ActionBar
 * "More" menu when the ticket is an incident. The modal seeds the problem
 * summary from the incident's summary so the agent has a head start.
 *
 * On success we navigate the agent to `/problems/:id` so they land directly
 * on the RCA surface they need to populate.
 */
export interface ConvertToProblemModalProps {
  readonly incidentId: string;
  readonly initialSummary: string;
  readonly onClose: () => void;
}

export function ConvertToProblemModal({
  incidentId,
  initialSummary,
  onClose,
}: ConvertToProblemModalProps) {
  const { t } = useTranslation("workspace");
  const navigate = useNavigate();
  const convert = useConvertIncidentToProblem();
  const [summary, setSummary] = useState(initialSummary);
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
    if (!summary.trim()) return;
    convert.mutate(
      { fromIncidentId: incidentId, summary: summary.trim() },
      {
        onSuccess: (result) => {
          onClose();
          navigate(`/problems/${encodeURIComponent(result.problem.id)}`);
        },
      },
    );
  };

  return (
    <div className="sdm-modal-overlay" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="convert-modal-title"
        className="sdm-modal-dialog"
        data-testid="problem-convert-modal"
      >
        <h2 id="convert-modal-title" className="sdm-modal-title">
          {t("problems.convertModal.title")}
        </h2>
        <p className="sdm-modal-body">{t("problems.convertModal.body")}</p>

        <TextArea
          label={t("problems.convertModal.summaryLabel")}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder={t("problems.convertModal.summaryPlaceholder")}
          rows={3}
          required
          data-testid="problem-convert-summary"
        />

        <div className="sdm-modal-actions">
          <Button
            ref={cancelRef}
            variant="secondary"
            onClick={onClose}
            data-testid="problem-convert-cancel"
          >
            {t("common.cancel")}
          </Button>
          <Button
            variant="primary"
            onClick={onSubmit}
            loading={convert.isPending}
            disabled={!summary.trim()}
            data-testid="problem-convert-submit"
          >
            {t("problems.convertModal.submit")}
          </Button>
        </div>
      </div>
    </div>
  );
}
