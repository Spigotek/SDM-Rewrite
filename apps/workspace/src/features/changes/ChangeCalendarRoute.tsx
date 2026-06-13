import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "@sdm/i18n";
import { Card, Skeleton, usePageTransition } from "@sdm/design-system";
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
 * K.3.E polish: Card-wrapped calendar surface, skeleton loading placeholder,
 * page-transition crossfade. Drag-resize behaviour (J.6) and the
 * `<CalendarFilters>` chip toolbar (incl. the sp_admin cross-tenant overlay)
 * are preserved verbatim — the calendar drag-resize browser-test must keep
 * passing.
 */
export default function ChangeCalendarRoute() {
  const { t } = useTranslation("workspace");
  const { session } = useSession();
  const tenantId = session?.tenantId;
  const roles = session?.roles ?? [];
  const { ref } = usePageTransition("/changes/calendar");

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
        ref={ref}
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
    <section ref={ref} data-testid="workspace-changes-calendar" className="sdm-calendar-page">
      <header className="sdm-calendar-header">
        <h1 className="sdm-calendar-title">{t("changes.calendar.title")}</h1>
        <span className="sdm-calendar-tenant-hint">
          {t("placeholders.activeTenant")}{" "}
          <strong data-testid="active-tenant">{tenantId ?? ""}</strong>
        </span>
      </header>

      <CalendarFilters value={filters} onChange={setFilters} roles={roles} />

      <Card variant="outlined" className="sdm-calendar-card">
        {query.isPending ? (
          <div
            className="sdm-calendar-skeleton"
            data-testid="calendar-loading"
            aria-busy="true"
            aria-label={t("changes.calendar.loading")}
          >
            <Skeleton variant="block" width="100%" height={48} />
            <Skeleton variant="block" width="100%" height={420} />
          </div>
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
      </Card>
    </section>
  );
}
