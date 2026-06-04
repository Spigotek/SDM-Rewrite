import { useEffect, useRef } from "react";
import { useTranslation } from "@sdm/i18n";
import { Button } from "@sdm/design-system";
import type { ChangeRow } from "../types";

/**
 * J.6 — Conflict confirmation dialog for calendar drag-resize.
 *
 * Shown when a drag or resize overlaps another visible change in the same
 * business window. Conflict detection is client-side against the currently
 * rendered event set — "visible changes only" is intentional MVP scope
 * (cross-filter detection is v2.0 with a BFF-side conflict query).
 *
 * On confirm → caller proceeds with the PATCH. On cancel → caller calls
 * `info.revert()` to roll the FullCalendar event back to its original position.
 */
export interface ConflictConfirmModalProps {
  readonly conflicts: ReadonlyArray<ChangeRow>;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

export function ConflictConfirmModal({
  conflicts,
  onConfirm,
  onCancel,
}: ConflictConfirmModalProps) {
  const { t } = useTranslation("workspace");
  const cancelRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  return (
    <div className="sdm-modal-overlay" role="presentation">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="conflict-modal-title"
        className="sdm-modal-dialog"
        data-testid="conflict-confirm-modal"
      >
        <h2 id="conflict-modal-title" className="sdm-modal-title">
          {t("changes.calendar.reschedule.conflictDetected")}
        </h2>
        <p className="sdm-modal-body">
          {t("changes.calendar.reschedule.conflictDescription", { count: conflicts.length })}
        </p>
        <ul className="sdm-conflict-list" data-testid="conflict-list">
          {conflicts.map((c) => (
            <li key={c.id} className="sdm-conflict-item">
              <strong>{c.ref}</strong>
              {c.summary ? ` — ${c.summary}` : ""}
            </li>
          ))}
        </ul>

        <div className="sdm-modal-actions">
          <Button
            ref={cancelRef}
            variant="secondary"
            onClick={onCancel}
            data-testid="conflict-cancel"
          >
            {t("changes.calendar.reschedule.keepOriginal")}
          </Button>
          <Button variant="primary" onClick={onConfirm} data-testid="conflict-confirm">
            {t("changes.calendar.reschedule.confirm")}
          </Button>
        </div>
      </div>
    </div>
  );
}
