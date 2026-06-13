import { useMemo } from "react";
import { useTranslation } from "@sdm/i18n";
import { Button } from "@sdm/design-system";
import type { ChangeCategory, ChangeStatus, RiskLevel } from "@sdm/domain";
import type { ChangeRow } from "../types";

/**
 * Filter chip bar for `/changes`. Mirrors `QueueFilters` chip pattern but
 * single-select-per-axis (Status / Type / Risk). Clicking the active chip
 * clears that axis. Chip counts are derived from the visible row set so an
 * agent always sees how many rows each chip would surface.
 *
 * Axes:
 *  - Status — top 5 most-frequent change statuses in the current page.
 *  - Type   — STANDARD / NORMAL / EMERGENCY (full ChangeCategory enum).
 *  - Risk   — HIGH / MEDIUM / LOW (full RiskLevel enum).
 */

export interface ChangesFiltersValue {
  readonly status: ChangeStatus | null;
  readonly category: ChangeCategory | null;
  readonly risk: RiskLevel | null;
}

export const EMPTY_CHANGES_FILTERS: ChangesFiltersValue = {
  status: null,
  category: null,
  risk: null,
};

interface ChipCount<T extends string> {
  readonly code: T;
  readonly count: number;
}

function topStatuses(
  rows: ReadonlyArray<ChangeRow>,
  n: number,
): ReadonlyArray<ChipCount<ChangeStatus>> {
  const counts = new Map<ChangeStatus, number>();
  for (const r of rows) counts.set(r.status, (counts.get(r.status) ?? 0) + 1);
  return Array.from(counts.entries())
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, n);
}

const CATEGORIES: ReadonlyArray<ChangeCategory> = ["STANDARD", "NORMAL", "EMERGENCY"];
const RISKS: ReadonlyArray<RiskLevel> = ["HIGH", "MEDIUM", "LOW"];

function countBy<T>(rows: ReadonlyArray<ChangeRow>, pick: (r: ChangeRow) => T): Map<T, number> {
  const m = new Map<T, number>();
  for (const r of rows) {
    const k = pick(r);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

export interface ChangesFiltersBarProps {
  readonly rows: ReadonlyArray<ChangeRow>;
  readonly filters: ChangesFiltersValue;
  readonly totalCount: number;
  readonly visibleCount: number;
  readonly onSetStatus: (value: ChangeStatus | null) => void;
  readonly onSetCategory: (value: ChangeCategory | null) => void;
  readonly onSetRisk: (value: RiskLevel | null) => void;
  readonly onReset: () => void;
}

export function ChangesFiltersBar(props: ChangesFiltersBarProps) {
  const {
    rows,
    filters,
    totalCount,
    visibleCount,
    onSetStatus,
    onSetCategory,
    onSetRisk,
    onReset,
  } = props;
  const { t } = useTranslation("workspace");

  const statusChips = useMemo(() => topStatuses(rows, 5), [rows]);
  const categoryCounts = useMemo(() => countBy(rows, (r) => r.category), [rows]);
  const riskCounts = useMemo(() => countBy(rows, (r) => r.risk), [rows]);

  const hasActive = filters.status !== null || filters.category !== null || filters.risk !== null;

  return (
    <div
      className="sdm-changes-filterbar"
      data-testid="changes-filter-bar"
      role="group"
      aria-label={t("changes.filtersBar.ariaLabel")}
    >
      <div className="sdm-changes-filterbar-row">
        <span className="sdm-changes-result-count" data-testid="changes-result-count">
          {t("changes.filtersBar.resultCount", { visible: visibleCount, total: totalCount })}
        </span>
        {hasActive ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            data-testid="changes-reset-filters"
            onClick={onReset}
          >
            {t("changes.filtersBar.reset")}
          </Button>
        ) : null}
      </div>

      {statusChips.length > 0 ? (
        <div
          className="sdm-changes-chip-group"
          role="group"
          aria-label={t("changes.filtersBar.statusLabel")}
        >
          <span className="sdm-changes-chip-group-label">
            {t("changes.filtersBar.statusLabel")}
          </span>
          {statusChips.map((s) => {
            const pressed = filters.status === s.code;
            return (
              <button
                key={s.code}
                type="button"
                className={
                  pressed ? "sdm-changes-chip sdm-changes-chip--active" : "sdm-changes-chip"
                }
                aria-pressed={pressed}
                aria-current={pressed ? "true" : undefined}
                data-testid={`changes-chip-status-${s.code}`}
                onClick={() => onSetStatus(pressed ? null : s.code)}
              >
                <span>{t(`changes.statusLabel.${s.code}`)}</span>
                <span className="sdm-changes-chip-count">{s.count}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      <div
        className="sdm-changes-chip-group"
        role="group"
        aria-label={t("changes.filtersBar.typeLabel")}
      >
        <span className="sdm-changes-chip-group-label">{t("changes.filtersBar.typeLabel")}</span>
        {CATEGORIES.map((c) => {
          const pressed = filters.category === c;
          const count = categoryCounts.get(c) ?? 0;
          return (
            <button
              key={c}
              type="button"
              className={pressed ? "sdm-changes-chip sdm-changes-chip--active" : "sdm-changes-chip"}
              aria-pressed={pressed}
              aria-current={pressed ? "true" : undefined}
              data-testid={`changes-chip-category-${c}`}
              onClick={() => onSetCategory(pressed ? null : c)}
            >
              <span>{t(`changes.category.${c}`)}</span>
              <span className="sdm-changes-chip-count">{count}</span>
            </button>
          );
        })}
      </div>

      <div
        className="sdm-changes-chip-group"
        role="group"
        aria-label={t("changes.filtersBar.riskLabel")}
      >
        <span className="sdm-changes-chip-group-label">{t("changes.filtersBar.riskLabel")}</span>
        {RISKS.map((r) => {
          const pressed = filters.risk === r;
          const count = riskCounts.get(r) ?? 0;
          return (
            <button
              key={r}
              type="button"
              className={pressed ? "sdm-changes-chip sdm-changes-chip--active" : "sdm-changes-chip"}
              aria-pressed={pressed}
              aria-current={pressed ? "true" : undefined}
              data-testid={`changes-chip-risk-${r}`}
              onClick={() => onSetRisk(pressed ? null : r)}
            >
              <span>{t(`changes.risk.${r}`)}</span>
              <span className="sdm-changes-chip-count">{count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
