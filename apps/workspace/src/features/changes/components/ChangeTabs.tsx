import type { KeyboardEvent } from "react";
import { useTranslation } from "@sdm/i18n";
import { CHANGE_TABS, type ChangeTabKey } from "../types";

/**
 * Change-detail tab bar — WAI-ARIA tabs pattern per
 * `components.md §Tabs`. Mirrors the segmented look of the H.8 composer
 * but applied at page level instead of inside a composer card.
 *
 * Keyboard nav (←/→/Home/End) lives on the tab buttons themselves so the
 * `role="tablist"` wrapper stays non-interactive (focus management follows
 * WAI-ARIA: only the active tab is tab-stop; arrow keys cycle).
 */
export interface ChangeTabsProps {
  readonly active: ChangeTabKey;
  readonly onSelect: (next: ChangeTabKey) => void;
}

export function ChangeTabs({ active, onSelect }: ChangeTabsProps) {
  const { t } = useTranslation("workspace");

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const idx = CHANGE_TABS.indexOf(active);
    if (idx === -1) return;
    let nextIdx: number | null = null;
    if (e.key === "ArrowRight") nextIdx = (idx + 1) % CHANGE_TABS.length;
    else if (e.key === "ArrowLeft") nextIdx = (idx - 1 + CHANGE_TABS.length) % CHANGE_TABS.length;
    else if (e.key === "Home") nextIdx = 0;
    else if (e.key === "End") nextIdx = CHANGE_TABS.length - 1;
    if (nextIdx === null) return;
    e.preventDefault();
    const next = CHANGE_TABS[nextIdx] as ChangeTabKey;
    onSelect(next);
    // Move focus to the newly active tab on the next paint.
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLButtonElement>(`[data-testid="change-tab-${next}"]`);
      el?.focus();
    });
  };

  return (
    <div
      role="tablist"
      aria-label={t("changes.tabs.ariaLabel")}
      className="sdm-change-tabs"
      data-testid="change-tabs"
    >
      {CHANGE_TABS.map((key) => {
        const isActive = key === active;
        return (
          <button
            key={key}
            type="button"
            role="tab"
            id={`change-tab-${key}`}
            aria-selected={isActive}
            aria-controls={`change-tabpanel-${key}`}
            tabIndex={isActive ? 0 : -1}
            data-active={isActive || undefined}
            data-testid={`change-tab-${key}`}
            className="sdm-change-tab"
            onClick={() => onSelect(key)}
            onKeyDown={handleKeyDown}
          >
            {t(`changes.tabs.${key}`)}
          </button>
        );
      })}
    </div>
  );
}
