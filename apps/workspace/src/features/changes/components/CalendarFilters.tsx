import { useTranslation } from "@sdm/i18n";
import type { RiskLevel, ChangeStatus } from "@sdm/domain";

/**
 * Calendar chips — risk tier + change-status filters.
 *
 * The "env" filter mentioned in the wireframe (`03-change-calendar.md` UI
 * prvky table) doesn't have a backing field on the domain `Change` shape —
 * environment is derived from affected CIs and the CMDB hierarchy ships in
 * H.13+. H.10 wires the chips that *can* be backed by domain data today
 * (risk + status) and leaves the env filter to a follow-up once `Ci.env` is
 * surfaced.
 *
 * Filters are single-select with an "all" sentinel — multi-select calendar
 * filters in the wireframe are advanced (v1+). KISS for MVP.
 */
export interface CalendarFiltersValue {
  readonly risk: RiskLevel | "ALL";
  readonly status: ChangeStatus | "ALL";
}

export interface CalendarFiltersProps {
  readonly value: CalendarFiltersValue;
  readonly onChange: (next: CalendarFiltersValue) => void;
}

const RISKS: ReadonlyArray<RiskLevel> = ["HIGH", "MEDIUM", "LOW"];
const STATUSES: ReadonlyArray<ChangeStatus> = [
  "RFC",
  "APPR_PENDING",
  "APPROVED",
  "SCHEDULED",
  "IN_PROGRESS",
];

export function CalendarFilters({ value, onChange }: CalendarFiltersProps) {
  const { t } = useTranslation("workspace");

  return (
    <div
      className="sdm-calendar-filters"
      data-testid="calendar-filters"
      role="toolbar"
      aria-label={t("changes.calendar.filtersAriaLabel")}
    >
      <fieldset className="sdm-calendar-filter-group">
        <legend>{t("changes.calendar.riskFilterLabel")}</legend>
        <button
          type="button"
          className="sdm-calendar-chip"
          data-active={value.risk === "ALL" || undefined}
          data-testid="calendar-filter-risk-ALL"
          onClick={() => onChange({ ...value, risk: "ALL" })}
        >
          {t("changes.calendar.filterAll")}
        </button>
        {RISKS.map((risk) => (
          <button
            key={risk}
            type="button"
            className="sdm-calendar-chip"
            data-active={value.risk === risk || undefined}
            data-risk={risk}
            data-testid={`calendar-filter-risk-${risk}`}
            onClick={() => onChange({ ...value, risk })}
          >
            {t(`changes.risk.${risk}`)}
          </button>
        ))}
      </fieldset>
      <fieldset className="sdm-calendar-filter-group">
        <legend>{t("changes.calendar.statusFilterLabel")}</legend>
        <button
          type="button"
          className="sdm-calendar-chip"
          data-active={value.status === "ALL" || undefined}
          data-testid="calendar-filter-status-ALL"
          onClick={() => onChange({ ...value, status: "ALL" })}
        >
          {t("changes.calendar.filterAll")}
        </button>
        {STATUSES.map((status) => (
          <button
            key={status}
            type="button"
            className="sdm-calendar-chip"
            data-active={value.status === status || undefined}
            data-testid={`calendar-filter-status-${status}`}
            onClick={() => onChange({ ...value, status })}
          >
            {t(`changes.statusLabel.${status}`)}
          </button>
        ))}
      </fieldset>
    </div>
  );
}
