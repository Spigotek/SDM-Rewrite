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

/**
 * Category sentinel — the design-system `<Select>` is built on Radix, which
 * rejects empty-string option values (Radix reserves `""` for the cleared
 * state). We model "not selected yet" via the `__none` sentinel and treat it
 * as unselected in the close-block predicate.
 */
const CATEGORY_NONE = "__none";

const RESOLUTION_CATEGORIES = [
  { value: CATEGORY_NONE, label: "—" },
  { value: "fixed", label: "Fixed" },
  { value: "workaround", label: "Workaround applied" },
  { value: "no-action", label: "No action required" },
  { value: "duplicate", label: "Duplicate" },
  { value: "user-error", label: "User error" },
];

/**
 * Resolve modal — Solution textarea + Category select (per H.8.md
 * §Open questions). Submitting closes the ticket (status → CL) via
 * `POST /api/tickets/:type/:id/resolve`.
 *
 * I.1 required-field close block (journey-09): both Solution AND Category
 * must be non-empty before the close (status → CL) is allowed. Surfacing
 * the rule as an explicit inline error closes acceptance journey #9's
 * deferred "required-field block" criterion.
 */
export function ResolveModal({ detail, initialSolution, onClose }: ResolveModalProps) {
  const { t } = useTranslation("workspace");
  const resolve = useResolve(detail.ticketType, detail.id);
  const [solution, setSolution] = useState(initialSolution);
  const [category, setCategory] = useState<string>(CATEGORY_NONE);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const cancelRef = useRef<HTMLButtonElement | null>(null);

  const categoryUnset = !category || category === CATEGORY_NONE;
  const closeBlockError =
    !solution.trim() || categoryUnset
      ? t("ticketDetail.resolveModal.errors.solutionAndCategoryRequiredOnClose")
      : null;

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
    if (closeBlockError) {
      setSubmitAttempted(true);
      return;
    }
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
          required
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

        {submitAttempted && closeBlockError ? (
          <p role="alert" className="sdm-modal-error" data-testid="ticket-resolve-required-error">
            {closeBlockError}
          </p>
        ) : null}

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
            data-testid="ticket-resolve-submit"
          >
            {t("ticketDetail.resolveModal.submit")}
          </Button>
        </div>
      </div>
    </div>
  );
}
