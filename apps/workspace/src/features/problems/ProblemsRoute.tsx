import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "@sdm/i18n";
import { tenantId as toTenantId } from "@sdm/domain";
import { useSession } from "../../shell/session-context";
import { problemsListQuery } from "./api";
import { FilterBar } from "./components/FilterBar";
import { ProblemsTable } from "./components/ProblemsTable";
import { useProblemFilters } from "./hooks";
import type { ProblemFilters, ProblemRow } from "./types";
import "./problems.css";

/**
 * `/problems` route — Marek's L2 RCA list. Pattern mirrors `/changes` (H.9):
 *  - Tenant-scoped TanStack Query polled every 30 s.
 *  - FilterBar (search + status chips) + ProblemsTable (TanStack Table v8).
 *  - Click / Enter on a row navigates to `/problems/:id` (no split-pane —
 *    problems are deeper deep-dives than queue triage).
 *
 * Filter state is URL-driven (`?search=…&status=…`) so deep links shared
 * across L2 / L3 land on the same slice of work.
 */

const EMPTY_ROWS: ReadonlyArray<ProblemRow> = [];

function filterRows(rows: ReadonlyArray<ProblemRow>, f: ProblemFilters): ReadonlyArray<ProblemRow> {
  const needle = f.search.trim().toLowerCase();
  return rows.filter((r) => {
    if (f.status.length > 0 && !f.status.includes(r.status)) return false;
    if (needle) {
      const hay = [r.ref, r.summary, r.rootCause].filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });
}

export default function ProblemsRoute() {
  const { t } = useTranslation("workspace");
  const { session } = useSession();
  const tenantId = session?.tenantId;

  const { filters, setSearch, toggleStatus, reset } = useProblemFilters();

  const queryTenantId = tenantId ?? toTenantId("__pending__");
  const query = useQuery({
    ...problemsListQuery(queryTenantId),
    enabled: !!tenantId,
  });

  const rows: ReadonlyArray<ProblemRow> = useMemo(() => query.data ?? EMPTY_ROWS, [query.data]);
  const filtered = useMemo(() => filterRows(rows, filters), [rows, filters]);

  return (
    <section data-testid="workspace-problems" className="sdm-problems-page">
      <header className="sdm-problems-header">
        <h1 className="sdm-problems-title">{t("problems.title")}</h1>
        <span className="sdm-problems-tenant-hint">
          {t("placeholders.activeTenant")}{" "}
          <strong data-testid="active-tenant">{tenantId ?? ""}</strong>
        </span>
      </header>

      {query.isPending ? (
        <p className="sdm-problems-state" data-testid="problems-loading">
          {t("problems.loading")}
        </p>
      ) : query.isError ? (
        <p
          role="alert"
          className="sdm-problems-state sdm-problems-state--error"
          data-testid="problems-error"
        >
          {t("problems.error")}
        </p>
      ) : rows.length === 0 ? (
        <p className="sdm-problems-state" data-testid="problems-empty">
          {t("problems.empty")}
        </p>
      ) : (
        <>
          <FilterBar
            rows={rows}
            filters={filters}
            totalCount={rows.length}
            visibleCount={filtered.length}
            onSearch={setSearch}
            onToggleStatus={toggleStatus}
            onReset={reset}
          />
          {filtered.length === 0 ? (
            <p className="sdm-problems-state" data-testid="problems-filtered-empty">
              {t("problems.filters.noResults")}
            </p>
          ) : (
            <ProblemsTable rows={filtered} />
          )}
        </>
      )}
    </section>
  );
}
