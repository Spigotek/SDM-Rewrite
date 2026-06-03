import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "@sdm/i18n";
import { tenantId as toTenantId } from "@sdm/domain";
import { useSession } from "../../shell/session-context";
import { changesListAllTenantsQuery, changesListQuery } from "./api";
import type { ChangeRow } from "./types";
import { CalendarView } from "./components/CalendarView";
import { CalendarFilters, type CalendarFiltersValue } from "./components/CalendarFilters";
import "./changes.css";
import "../sp-cockpit/sp-cockpit.css";

/**
 * `/changes/calendar` — Peter's CAB calendar.
 *
 * Composition:
 *  - Loads the same tenant change list as `/changes` (cache shared via
 *    `staleTime` + identical `queryKey` prefix on the underlying fetch).
 *  - Applies client-side risk + status filters from the `CalendarFilters`
 *    chips.
 *  - Renders `<CalendarView>` which owns the FullCalendar instance, view
 *    switch, and hover tooltip lifecycle.
 *  - Below the lg breakpoint, shows a fallback banner pointing the user back
 *    to the list view — FullCalendar's time-grid is unusable on narrow
 *    viewports per the wireframe mobile branch (`03-change-calendar.md`).
 *
 * The route is lazy-loaded from `routes/index.tsx` so the FullCalendar
 * vendor chunk (~95–150 KB gzip) is never paid on the workspace initial
 * load.
 */
export default function ChangeCalendarRoute() {
  const { t } = useTranslation("workspace");
  const { session } = useSession();
  const tenantId = session?.tenantId;
  const roles = session?.roles ?? [];

  const [filters, setFilters] = useState<CalendarFiltersValue>({
    risk: "ALL",
    status: "ALL",
    crossTenant: false,
  });

  const queryTenantId = tenantId ?? toTenantId("__pending__");
  const baseQuery = filters.crossTenant
    ? changesListAllTenantsQuery(queryTenantId)
    : changesListQuery(queryTenantId);
  const query = useQuery({
    queryKey: baseQuery.queryKey,
    queryFn: baseQuery.queryFn,
    refetchInterval: baseQuery.refetchInterval,
    staleTime: baseQuery.staleTime,
    enabled: !!tenantId,
  });
  const [isMobile, setIsMobile] = useState(() =>
    typeof window === "undefined" ? false : window.matchMedia("(max-width: 900px)").matches,
  );

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const mq = window.matchMedia("(max-width: 900px)");
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const rows: ReadonlyArray<ChangeRow> = useMemo(() => {
    const all = query.data ?? [];
    return all.filter((c) => {
      if (filters.risk !== "ALL" && c.risk !== filters.risk) return false;
      if (filters.status !== "ALL" && c.status !== filters.status) return false;
      return true;
    });
  }, [query.data, filters]);

  if (isMobile) {
    return (
      <section
        data-testid="workspace-changes-calendar"
        className="sdm-calendar-page sdm-calendar-page--mobile"
      >
        <header className="sdm-calendar-header">
          <h1 className="sdm-calendar-title">{t("changes.calendar.title")}</h1>
        </header>
        <div
          role="status"
          className="sdm-calendar-mobile-banner"
          data-testid="calendar-mobile-banner"
        >
          <p>{t("changes.calendar.mobileFallback")}</p>
          <a className="sdm-calendar-mobile-link" href="/changes">
            {t("changes.calendar.mobileFallbackLink")}
          </a>
        </div>
      </section>
    );
  }

  return (
    <section data-testid="workspace-changes-calendar" className="sdm-calendar-page">
      <header className="sdm-calendar-header">
        <h1 className="sdm-calendar-title">{t("changes.calendar.title")}</h1>
        <span className="sdm-calendar-tenant-hint">
          {t("placeholders.activeTenant")}{" "}
          <strong data-testid="active-tenant">{tenantId ?? ""}</strong>
        </span>
      </header>

      <CalendarFilters value={filters} onChange={setFilters} roles={roles} />

      {query.isPending ? (
        <p className="sdm-calendar-state" data-testid="calendar-loading">
          {t("changes.calendar.loading")}
        </p>
      ) : query.isError ? (
        <p
          role="alert"
          className="sdm-calendar-state sdm-calendar-state--error"
          data-testid="calendar-error"
        >
          {t("changes.calendar.error")}
        </p>
      ) : (
        <CalendarView rows={rows} crossTenant={filters.crossTenant} />
      )}
    </section>
  );
}
