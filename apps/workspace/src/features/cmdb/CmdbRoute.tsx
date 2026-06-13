import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import {
  Button,
  EmptyState,
  IllustrationNoCatalogItems,
  usePageTransition,
} from "@sdm/design-system";
import { useTranslation } from "@sdm/i18n";
import { tenantId as toTenantId } from "@sdm/domain";
import { useSession } from "../../shell/session-context";
import { cmdbListQuery } from "./api";
import { CmdbFilterBar } from "./components/FilterBar";
import { CmdbTable } from "./components/CmdbTable";
import { CmdbStats } from "./components/CmdbStats";
import { CmdbTableSkeleton } from "./components/CmdbTableSkeleton";
import { useCmdbFilters, type CmdbFilters } from "./hooks";
import type { CiRow } from "./types";
import "./cmdb.css";

/**
 * `/cmdb` — Robert's CMDB browse list (K.3.E v1.2 redesign).
 *
 *  Row 1 — H1 + `+ Nové CI` action.
 *  Row 2 — `<CmdbStats>`        5-up KPI strip (Total / Active / Inactive / Retired / Shared).
 *  Row 3 — `<CmdbFilterBar>`    search + class + status chips (existing).
 *  Row 4 — `<CmdbTable>`        dense 32-px row table with staggered mount.
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
  const { ref } = usePageTransition("/cmdb");

  const { filters, setSearch, setClass, setStatus, reset } = useCmdbFilters();

  const queryTenantId = tenantId ?? toTenantId("__pending__");
  const query = useQuery({
    ...cmdbListQuery(queryTenantId),
    enabled: !!tenantId,
  });

  const rows: ReadonlyArray<CiRow> = useMemo(() => query.data ?? EMPTY_ROWS, [query.data]);
  const filtered = useMemo(() => filterRows(rows, filters), [rows, filters]);

  return (
    <section ref={ref} data-testid="workspace-cmdb" className="sdm-cmdb-page">
      <header className="sdm-cmdb-page-header">
        <h1 className="sdm-cmdb-page-title">{t("cmdb.title")}</h1>
        <Button
          type="button"
          variant="primary"
          size="sm"
          data-testid="cmdb-new-ci"
          leadingIcon={<Plus size={14} aria-hidden="true" />}
          onClick={() => {
            // K.3.E placeholder — discovery / manual creation lands with v1.2 CMDB ops.
            console.info("[cmdb] New-CI placeholder (v1.2)");
          }}
        >
          {t("cmdb.newCi")}
        </Button>
      </header>

      <CmdbStats rows={rows} isLoading={query.isPending} />

      {query.isPending ? (
        <CmdbTableSkeleton />
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
          className="sdm-cmdb-empty"
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
            <EmptyState
              variant="hero"
              illustration={<IllustrationNoCatalogItems />}
              title={t("cmdb.emptyFilteredTitle")}
              description={t("cmdb.emptyFiltered")}
              className="sdm-cmdb-empty"
              data-testid="cmdb-filtered-empty"
            />
          ) : (
            <CmdbTable rows={filtered} />
          )}
        </>
      )}
    </section>
  );
}
