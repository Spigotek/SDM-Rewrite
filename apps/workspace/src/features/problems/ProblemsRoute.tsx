import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useTranslation } from "@sdm/i18n";
import { tenantId as toTenantId } from "@sdm/domain";
import {
  Button,
  Card,
  EmptyState,
  IllustrationNoSearchResults,
  Skeleton,
  usePageTransition,
} from "@sdm/design-system";
import { useSession } from "../../shell/session-context";
import { problemsListQuery } from "./api";
import { FilterBar } from "./components/FilterBar";
import { ProblemsTable } from "./components/ProblemsTable";
import { useProblemFilters } from "./hooks";
import type { ProblemFilters, ProblemRow } from "./types";
import "./problems.css";

/**
 * `/problems` route — K.3.E redesign:
 *
 * - Header carries the H1 + `+ Nový problém` primary CTA (placeholder navigate
 *   to /problems/new is owned by the future "create problem" wireframe — for
 *   now we surface a console hint identical to the queue "+ Nový" pattern).
 * - Dense 32-px row table (`ProblemsTable`) with `tabular-nums` on every
 *   numeric column; the table itself wires `data-row` + `staggerListRows`.
 * - `EmptyState variant="hero"` with the search/no-data illustration.
 * - Skeleton placeholder while the list query is pending.
 * - `usePageTransition` runs the 120 ms crossfade per K.1 brief §7.
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
  const location = useLocation();
  const navigate = useNavigate();
  const { ref: pageRef } = usePageTransition(location.pathname);

  const { filters, setSearch, toggleStatus, reset } = useProblemFilters();

  const queryTenantId = tenantId ?? toTenantId("__pending__");
  const query = useQuery({
    ...problemsListQuery(queryTenantId),
    enabled: !!tenantId,
  });

  const rows: ReadonlyArray<ProblemRow> = useMemo(() => query.data ?? EMPTY_ROWS, [query.data]);
  const filtered = useMemo(() => filterRows(rows, filters), [rows, filters]);

  return (
    <section
      data-testid="workspace-problems"
      className="sdm-problems-page"
      ref={pageRef as React.RefObject<HTMLElement>}
    >
      <header className="sdm-problems-header">
        <h1 className="sdm-problems-title">{t("problems.title")}</h1>
        <div className="sdm-problems-header-actions">
          <span className="sdm-problems-tenant-hint">
            {t("placeholders.activeTenant")}{" "}
            <strong data-testid="active-tenant">{tenantId ?? ""}</strong>
          </span>
          <Button
            type="button"
            variant="primary"
            size="sm"
            data-testid="problems-new"
            leadingIcon={<Plus size={14} aria-hidden="true" />}
            onClick={() => {
              // v1.2 placeholder — "New problem" composer lands with cmd+K.
              console.info("[problems] New-problem composer placeholder (v1.2)");
              navigate("/problems");
            }}
          >
            {t("problems.newProblem")}
          </Button>
        </div>
      </header>

      {query.isPending ? (
        <Card variant="surface" className="sdm-problems-skeleton" data-testid="problems-loading">
          <Skeleton variant="text" width="40%" height={18} />
          <Skeleton variant="text" width="100%" height={28} count={6} />
        </Card>
      ) : query.isError ? (
        <p
          role="alert"
          className="sdm-problems-state sdm-problems-state--error"
          data-testid="problems-error"
        >
          {t("problems.error")}
        </p>
      ) : rows.length === 0 ? (
        <EmptyState
          variant="hero"
          illustration={<IllustrationNoSearchResults />}
          title={t("problems.emptyTitle")}
          description={t("problems.emptyDescription")}
          className="sdm-problems-state"
          data-testid="problems-empty"
        />
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
            <EmptyState
              variant="compact"
              illustration={<IllustrationNoSearchResults />}
              title={t("problems.filters.noResults")}
              className="sdm-problems-state"
              data-testid="problems-filtered-empty"
            />
          ) : (
            <ProblemsTable rows={filtered} />
          )}
        </>
      )}
    </section>
  );
}
