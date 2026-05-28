import { useState } from "react";
import { useTranslation } from "@sdm/i18n";
import { Button } from "@sdm/design-system";
import type { QueueFilters } from "../types";

export interface SavedViewsManagerProps {
  readonly filters: QueueFilters;
  readonly onSave: (name: string) => void;
}

/**
 * Inline "Save current view" affordance. Empty filter set disables the save
 * button — saving an empty view is indistinguishable from "All tickets" which
 * is already a pseudo-view in the sidebar.
 */
export function SavedViewsManager(props: SavedViewsManagerProps) {
  const { filters, onSave } = props;
  const { t } = useTranslation("workspace");
  const [name, setName] = useState("");

  const hasFilters =
    filters.status.length +
      filters.priority.length +
      filters.assignee.length +
      filters.ticketType.length +
      filters.customer.length >
      0 || filters.search.length > 0;

  const trimmed = name.trim();
  const canSave = hasFilters && trimmed.length > 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    onSave(trimmed);
    setName("");
  }

  return (
    <form className="sdm-queue-save-view" onSubmit={handleSubmit} data-testid="queue-save-view">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t("queue.savedViewNamePlaceholder")}
        aria-label={t("queue.savedViewNameLabel")}
        data-testid="queue-save-view-name"
        className="sdm-queue-save-view-input"
      />
      <Button
        type="submit"
        variant="primary"
        size="sm"
        disabled={!canSave}
        data-testid="queue-save-view-submit"
      >
        {t("queue.saveView")}
      </Button>
    </form>
  );
}
