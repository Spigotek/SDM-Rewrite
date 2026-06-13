import { useMemo, useRef } from "react";
import { useTranslation } from "@sdm/i18n";
import { Button } from "@sdm/design-system";
import type { CiClass, CiStatus } from "@sdm/domain";
import type { CiRow } from "../types";
import type { CmdbFilters } from "../hooks";

/**
 * Filter chip bar for the CMDB list — search input + class chip + status
 * chip. Single-pick semantics for chips: clicking the active chip clears it.
 * Class chips are restricted to the top 6 most-frequent classes in the
 * current page so the chip strip stays scannable; a "More" toggle (#future)
 * would expand to the full 23-class catalogue.
 *
 * Search hits `id`, `name`, `systemName`, and `serialNumber` so Robert can
 * grep by hostname (`srv-prod-db-01`) or serial (`D8K9X2L`) interchangeably.
 */

interface ChipCount<T extends string> {
  readonly code: T;
  readonly count: number;
}

function topClasses(rows: ReadonlyArray<CiRow>, n: number): ReadonlyArray<ChipCount<CiClass>> {
  const counts = new Map<CiClass, number>();
  for (const r of rows) counts.set(r.class as CiClass, (counts.get(r.class as CiClass) ?? 0) + 1);
  return Array.from(counts.entries())
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, n);
}

function collectStatuses(rows: ReadonlyArray<CiRow>): ReadonlyArray<ChipCount<CiStatus>> {
  const counts = new Map<CiStatus, number>();
  for (const r of rows) counts.set(r.status, (counts.get(r.status) ?? 0) + 1);
  return Array.from(counts.entries()).map(([code, count]) => ({ code, count }));
}

export interface CmdbFilterBarProps {
  readonly rows: ReadonlyArray<CiRow>;
  readonly filters: CmdbFilters;
  readonly totalCount: number;
  readonly visibleCount: number;
  readonly onSearch: (value: string) => void;
  readonly onSetClass: (value: CiClass | null) => void;
  readonly onSetStatus: (value: CiStatus | null) => void;
  readonly onReset: () => void;
}

export function CmdbFilterBar(props: CmdbFilterBarProps) {
  const { rows, filters, totalCount, visibleCount, onSearch, onSetClass, onSetStatus, onReset } =
    props;
  const { t } = useTranslation("workspace");
  const searchRef = useRef<HTMLInputElement | null>(null);
  const classChips = useMemo(() => topClasses(rows, 6), [rows]);
  const statusChips = useMemo(() => collectStatuses(rows), [rows]);

  const hasActive =
    filters.search.length > 0 || filters.ciClass !== null || filters.status !== null;

  return (
    <div
      className="sdm-cmdb-filterbar"
      data-testid="cmdb-filter-bar"
      role="group"
      aria-label={t("cmdb.filters.ariaLabel")}
    >
      <div className="sdm-cmdb-filterbar-row">
        <input
          ref={searchRef}
          className="sdm-cmdb-search"
          data-testid="cmdb-search"
          type="search"
          placeholder={t("cmdb.filters.searchPlaceholder")}
          value={filters.search}
          onChange={(e) => onSearch(e.target.value)}
          aria-label={t("cmdb.filters.searchPlaceholder")}
        />
        <span className="sdm-cmdb-result-count" data-testid="cmdb-result-count">
          {t("cmdb.filters.resultCount", { visible: visibleCount, total: totalCount })}
        </span>
        {hasActive ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            data-testid="cmdb-reset-filters"
            onClick={onReset}
          >
            {t("cmdb.filters.reset")}
          </Button>
        ) : null}
      </div>

      {classChips.length > 0 ? (
        <div
          className="sdm-cmdb-chip-group"
          role="group"
          aria-label={t("cmdb.filters.classFilterLabel")}
        >
          <span className="sdm-cmdb-chip-group-label">{t("cmdb.filters.classFilterLabel")}</span>
          {classChips.map((c) => {
            const pressed = filters.ciClass === c.code;
            return (
              <button
                key={c.code}
                type="button"
                className={pressed ? "sdm-cmdb-chip sdm-cmdb-chip--active" : "sdm-cmdb-chip"}
                aria-pressed={pressed}
                aria-current={pressed ? "true" : undefined}
                data-testid={`cmdb-chip-class-${c.code}`}
                onClick={() => onSetClass(pressed ? null : c.code)}
              >
                <span>{t(`cmdb.class.${c.code}`, { defaultValue: c.code })}</span>
                <span className="sdm-cmdb-chip-count">{c.count}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      {statusChips.length > 0 ? (
        <div
          className="sdm-cmdb-chip-group"
          role="group"
          aria-label={t("cmdb.filters.statusFilterLabel")}
        >
          <span className="sdm-cmdb-chip-group-label">{t("cmdb.filters.statusFilterLabel")}</span>
          {statusChips.map((s) => {
            const pressed = filters.status === s.code;
            return (
              <button
                key={s.code}
                type="button"
                className={pressed ? "sdm-cmdb-chip sdm-cmdb-chip--active" : "sdm-cmdb-chip"}
                aria-pressed={pressed}
                aria-current={pressed ? "true" : undefined}
                data-testid={`cmdb-chip-status-${s.code}`}
                onClick={() => onSetStatus(pressed ? null : s.code)}
              >
                <span>{t(`cmdb.statusLabel.${s.code}`)}</span>
                <span className="sdm-cmdb-chip-count">{s.count}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
