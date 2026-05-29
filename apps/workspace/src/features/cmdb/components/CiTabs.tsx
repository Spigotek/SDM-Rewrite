import type { KeyboardEvent } from "react";
import { useTranslation } from "@sdm/i18n";
import { CMDB_CI_TABS, type CmdbCiTabKey } from "../types";

/**
 * CI-detail tab bar — WAI-ARIA tabs pattern per `components.md §Tabs`. Mirrors
 * the H.9 `ChangeTabs` keyboard contract (←/→/Home/End cycle, only the active
 * tab is tab-stop).
 */
export interface CiTabsProps {
  readonly active: CmdbCiTabKey;
  readonly onSelect: (next: CmdbCiTabKey) => void;
}

export function CiTabs({ active, onSelect }: CiTabsProps) {
  const { t } = useTranslation("workspace");

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const idx = CMDB_CI_TABS.indexOf(active);
    if (idx === -1) return;
    let nextIdx: number | null = null;
    if (e.key === "ArrowRight") nextIdx = (idx + 1) % CMDB_CI_TABS.length;
    else if (e.key === "ArrowLeft") nextIdx = (idx - 1 + CMDB_CI_TABS.length) % CMDB_CI_TABS.length;
    else if (e.key === "Home") nextIdx = 0;
    else if (e.key === "End") nextIdx = CMDB_CI_TABS.length - 1;
    if (nextIdx === null) return;
    e.preventDefault();
    const next = CMDB_CI_TABS[nextIdx] as CmdbCiTabKey;
    onSelect(next);
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLButtonElement>(`[data-testid="cmdb-tab-${next}"]`);
      el?.focus();
    });
  };

  return (
    <div
      role="tablist"
      aria-label={t("cmdb.tabs.ariaLabel")}
      className="sdm-cmdb-tabs"
      data-testid="cmdb-tabs"
    >
      {CMDB_CI_TABS.map((key) => {
        const isActive = key === active;
        return (
          <button
            key={key}
            type="button"
            role="tab"
            id={`cmdb-tab-${key}`}
            aria-selected={isActive}
            aria-controls={`cmdb-tabpanel-${key}`}
            tabIndex={isActive ? 0 : -1}
            data-active={isActive || undefined}
            data-testid={`cmdb-tab-${key}`}
            className="sdm-cmdb-tab"
            onClick={() => onSelect(key)}
            onKeyDown={handleKeyDown}
          >
            {t(`cmdb.tabs.${key}`)}
          </button>
        );
      })}
    </div>
  );
}
