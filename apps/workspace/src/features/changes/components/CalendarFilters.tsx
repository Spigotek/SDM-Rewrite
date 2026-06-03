import { useTranslation } from "@sdm/i18n";
import { Can } from "@sdm/auth";
import type { RiskLevel, ChangeStatus, UIRole } from "@sdm/domain";

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
 *
 * I.5 — `crossTenant` toggle visible only to `sp_admin` via `<Can>`. When ON
 * the parent route swaps the data query to `?tenants=all` (cross-tenant
 * overlay per journey #12).
 */
export interface CalendarFiltersValue {
  readonly risk: RiskLevel | "ALL";
  readonly status: ChangeStatus | "ALL";
  readonly crossTenant: boolean;
}

export interface CalendarFiltersProps {
  readonly value: CalendarFiltersValue;
  readonly onChange: (next: CalendarFiltersValue) => void;
  readonly roles: readonly UIRole[];
}

const RISKS: ReadonlyArray<RiskLevel> = ["HIGH", "MEDIUM", "LOW"];
const STATUSES: ReadonlyArray<ChangeStatus> = [
  "RFC",
  "APPR_PENDING",
  "APPROVED",
  "SCHEDULED",
  "IN_PROGRESS",
];

export function CalendarFilters({ value, onChange, roles }: CalendarFiltersProps) {
  const { t } = useTranslation("workspace");

  return (
    <div
      className="sdm-calendar-filters"
      data-testid="calendar-filters"
      role="toolbar"
      aria-label={t("changes.calendar.filtersAriaLabel")}
    >
      <Can roles={roles} permission="change.read.calendar.cross-tenant">
        <fieldset className="sdm-calendar-filter-group">
          <legend>{t("sp.calendar.allMyTenants.label")}</legend>
          <label className="sdm-calendar-switch" data-testid="calendar-all-tenants-toggle">
            <input
              type="checkbox"
              checked={value.crossTenant}
              onChange={(e) => onChange({ ...value, crossTenant: e.target.checked })}
              aria-label={t("sp.calendar.allMyTenants.label")}
            />
            <span>{t("sp.calendar.allMyTenants.tooltip")}</span>
          </label>
        </fieldset>
      </Can>
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
