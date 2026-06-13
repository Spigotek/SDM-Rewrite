import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { EmptyState, IllustrationNoCatalogItems } from "@sdm/design-system";
import { useTranslation } from "@sdm/i18n";
import { tenantId as toTenantId } from "@sdm/domain";
import { useSession } from "../../shell/session-context";
import { cmdbListQuery } from "./api";
import { CmdbFilterBar } from "./components/FilterBar";
import { CmdbTable } from "./components/CmdbTable";
import { useCmdbFilters, type CmdbFilters } from "./hooks";
import type { CiRow } from "./types";
import "./cmdb.css";

/**
 * `/cmdb` — Robert's CMDB browse list. Pattern mirrors `/problems` (H.12):
 *  - Tenant-scoped TanStack Query, 5 min refetch (CIs change on discovery
 *    sweeps, not on the second-by-second triage loop).
 *  - FilterBar (search + class + status chips) + CmdbTable (TanStack Table v8).
 *  - Click / Enter on a row navigates to `/cmdb/ci/:id` (no split-pane).
 *
 * Filter state is URL-driven (`?q=&class=&status=`) so deep links shared
 * between Robert and Marek (pre-patch impact analysis) land on the same slice.
 */
const EMPTY_ROWS: ReadonlyArray<CiRow> = [];

function filterRows(rows: ReadonlyArray<CiRow>, f: CmdbFilters): ReadonlyArray<CiRow> {
  const needle = f.search.trim().toLowerCase();
  return rows.filter((r) => {
    if (f.ciClass && r.class !== f.ciClass) return false;
    if (f.status && r.status !== f.status) return false;
    if (needle) {
      const hay = [r.id, r.name, r.systemName ?? "", r.serialNumber ?? ""].join(" ").toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });
}

export default function CmdbRoute() {
  const { t } = useTranslation("workspace");
  const { session } = useSession();
  const tenantId = session?.tenantId;

  const { filters, setSearch, setClass, setStatus, reset } = useCmdbFilters();

  const queryTenantId = tenantId ?? toTenantId("__pending__");
  const query = useQuery({
    ...cmdbListQuery(queryTenantId),
    enabled: !!tenantId,
  });

  const rows: ReadonlyArray<CiRow> = useMemo(() => query.data ?? EMPTY_ROWS, [query.data]);
  const filtered = useMemo(() => filterRows(rows, filters), [rows, filters]);

  return (
    <section data-testid="workspace-cmdb" className="sdm-cmdb-page">
      <header className="sdm-cmdb-page-header">
        <h1 className="sdm-cmdb-page-title">{t("cmdb.title")}</h1>
        <span className="sdm-cmdb-tenant-hint">
          {t("placeholders.activeTenant")}{" "}
          <strong data-testid="active-tenant">{tenantId ?? ""}</strong>
        </span>
      </header>

      {query.isPending ? (
        <p className="sdm-cmdb-state" data-testid="cmdb-loading">
          {t("cmdb.loading")}
        </p>
      ) : query.isError ? (
        <p role="alert" className="sdm-cmdb-state sdm-cmdb-state--error" data-testid="cmdb-error">
          {t("cmdb.error")}
        </p>
      ) : rows.length === 0 ? (
        <EmptyState
          variant="hero"
          illustration={<IllustrationNoCatalogItems />}
          title={t("cmdb.emptyTitle")}
          description={t("cmdb.empty")}
          className="sdm-cmdb-state"
          data-testid="cmdb-empty"
        />
      ) : (
        <>
          <CmdbFilterBar
            rows={rows}
            filters={filters}
            totalCount={rows.length}
            visibleCount={filtered.length}
            onSearch={setSearch}
            onSetClass={setClass}
            onSetStatus={setStatus}
            onReset={reset}
          />
          {filtered.length === 0 ? (
            <p className="sdm-cmdb-state" data-testid="cmdb-filtered-empty">
              {t("cmdb.filters.noResults")}
            </p>
          ) : (
            <CmdbTable rows={filtered} />
          )}
        </>
      )}
    </section>
  );
}
