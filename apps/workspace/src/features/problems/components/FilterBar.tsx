import { useMemo, useRef } from "react";
import { useTranslation } from "@sdm/i18n";
import { Button } from "@sdm/design-system";
import type { ProblemStatus } from "@sdm/domain";
import type { ProblemRow, ProblemFilters } from "../types";

/**
 * Filter chip bar for the problems list — search input + status chips. Status
 * is the only chip axis because problems carry a flat distribution across the
 * 7 statuses (vs queue's 4-axis filter), and L2 RCA flows mostly slice by
 * status (e.g. "show me all INVESTIGATION rows assigned to me").
 *
 * Search is full-text against ref + summary + rootCause; the L2 persona will
 * grep by ref-num (PR-00007) or by symptom phrase ("memory leak"), so we cover
 * both with one input rather than dedicated chips.
 */

interface StatusChip {
  readonly code: ProblemStatus;
  readonly count: number;
}

function collectStatuses(rows: ReadonlyArray<ProblemRow>): ReadonlyArray<StatusChip> {
  const counts = new Map<ProblemStatus, number>();
  for (const r of rows) counts.set(r.status, (counts.get(r.status) ?? 0) + 1);
  return Array.from(counts.entries()).map(([code, count]) => ({ code, count }));
}

export interface FilterBarProps {
  readonly rows: ReadonlyArray<ProblemRow>;
  readonly filters: ProblemFilters;
  readonly totalCount: number;
  readonly visibleCount: number;
  readonly onSearch: (value: string) => void;
  readonly onToggleStatus: (code: string) => void;
  readonly onReset: () => void;
}

export function FilterBar(props: FilterBarProps) {
  const { rows, filters, totalCount, visibleCount, onSearch, onToggleStatus, onReset } = props;
  const { t } = useTranslation("workspace");
  const searchRef = useRef<HTMLInputElement | null>(null);
  const statuses = useMemo(() => collectStatuses(rows), [rows]);

  const hasActive = filters.search.length > 0 || filters.status.length > 0;

  return (
    <div
      className="sdm-problems-filterbar"
      data-testid="problems-filter-bar"
      role="group"
      aria-label={t("problems.filters.ariaLabel")}
    >
      <div className="sdm-problems-filterbar-row">
        <input
          ref={searchRef}
          className="sdm-problems-search"
          data-testid="problems-search"
          type="search"
          placeholder={t("problems.filters.searchPlaceholder")}
          value={filters.search}
          onChange={(e) => onSearch(e.target.value)}
          aria-label={t("problems.filters.searchPlaceholder")}
        />
        <span className="sdm-problems-result-count" data-testid="problems-result-count">
          {t("problems.filters.resultCount", { visible: visibleCount, total: totalCount })}
        </span>
        {hasActive ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            data-testid="problems-reset-filters"
            onClick={onReset}
          >
            {t("problems.filters.reset")}
          </Button>
        ) : null}
      </div>

      {statuses.length > 0 ? (
        <div
          className="sdm-problems-chip-group"
          role="group"
          aria-label={t("problems.filters.statusFilterLabel")}
        >
          <span className="sdm-problems-chip-group-label">
            {t("problems.filters.statusFilterLabel")}
          </span>
          {statuses.map((s) => {
            const pressed = filters.status.includes(s.code);
            return (
              <button
                key={s.code}
                type="button"
                className={
                  pressed ? "sdm-problems-chip sdm-problems-chip--active" : "sdm-problems-chip"
                }
                aria-pressed={pressed}
                aria-current={pressed ? "true" : undefined}
                data-testid={`problems-chip-${s.code}`}
                onClick={() => onToggleStatus(s.code)}
              >
                <span>{t(`problems.statusLabel.${s.code}` as const)}</span>
                <span className="sdm-problems-chip-count sdm-tabular">{s.count}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
