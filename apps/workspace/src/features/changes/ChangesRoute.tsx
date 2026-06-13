import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useTranslation } from "@sdm/i18n";
import {
  Button,
  EmptyState,
  IllustrationNoOpenTickets,
  usePageTransition,
} from "@sdm/design-system";
import { tenantId as toTenantId } from "@sdm/domain";
import { useSession } from "../../shell/session-context";
import { changesListQuery } from "./api";
import { ChangesTable } from "./components/ChangesTable";
import { ChangeStats } from "./components/ChangeStats";
import { ChangesFiltersBar, type ChangesFiltersValue } from "./components/ChangesFiltersBar";
import { ChangesTableSkeleton } from "./components/ChangesTableSkeleton";
import { useChangesFilters } from "./hooks";
import type { ChangeRow } from "./types";
import "./changes.css";

/**
 * `/changes` — Peter's CAB browse list (K.3.E v1.2 redesign).
 *
 *  Row 1 — H1 + `+ Nová zmena` action.
 *  Row 2 — `<ChangeStats>`          5-up KPI strip (Open / Pending / Today / CAB / Closed-week).
 *  Row 3 — `<ChangesFiltersBar>`    Status / Type / Risk chip groups.
 *  Row 4 — `<ChangesTable>`         dense 32-px row table with staggered mount.
 *
 *  Polling cadence (30 s) matches the queue. URL-driven single-axis filters
 *  preserve deep links.
 */
const EMPTY_ROWS: ReadonlyArray<ChangeRow> = [];

function applyFilters(
  rows: ReadonlyArray<ChangeRow>,
  f: ChangesFiltersValue,
): ReadonlyArray<ChangeRow> {
  return rows.filter((r) => {
    if (f.status !== null && r.status !== f.status) return false;
    if (f.category !== null && r.category !== f.category) return false;
    if (f.risk !== null && r.risk !== f.risk) return false;
    return true;
  });
}

export default function ChangesRoute() {
  const { t } = useTranslation("workspace");
  const { session } = useSession();
  const tenantId = session?.tenantId;
  const { ref } = usePageTransition("/changes");

  const { filters, setStatus, setCategory, setRisk, reset } = useChangesFilters();

  const queryTenantId = tenantId ?? toTenantId("__pending__");
  const query = useQuery({
    ...changesListQuery(queryTenantId),
    enabled: !!tenantId,
  });

  const rows: ReadonlyArray<ChangeRow> = useMemo(() => query.data ?? EMPTY_ROWS, [query.data]);
  const filtered = useMemo(() => applyFilters(rows, filters), [rows, filters]);

  return (
    <section ref={ref} data-testid="workspace-changes" className="sdm-changes-page">
      <header className="sdm-changes-page-header">
        <h1 className="sdm-changes-page-title">{t("changes.title")}</h1>
        <Button
          type="button"
          variant="primary"
          size="sm"
          data-testid="changes-new-change"
          leadingIcon={<Plus size={14} aria-hidden="true" />}
          onClick={() => {
            // K.3.E placeholder — composer arrives with the command palette in v1.2.
            console.info("[changes] New-change composer placeholder (v1.2)");
          }}
        >
          {t("changes.newChange")}
        </Button>
      </header>

      <ChangeStats rows={rows} isLoading={query.isPending} />

      <ChangesFiltersBar
        rows={rows}
        filters={filters}
        totalCount={rows.length}
        visibleCount={filtered.length}
        onSetStatus={setStatus}
        onSetCategory={setCategory}
        onSetRisk={setRisk}
        onReset={reset}
      />

      {query.isPending ? (
        <ChangesTableSkeleton />
      ) : query.isError ? (
        <p
          role="alert"
          className="sdm-changes-state sdm-changes-state--error"
          data-testid="changes-error"
        >
          {t("changes.error")}
        </p>
      ) : rows.length === 0 ? (
        <EmptyState
          variant="hero"
          illustration={<IllustrationNoOpenTickets />}
          title={t("changes.emptyTitle")}
          description={t("changes.empty")}
          className="sdm-changes-empty"
          data-testid="changes-empty"
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          variant="hero"
          illustration={<IllustrationNoOpenTickets />}
          title={t("changes.emptyFilteredTitle")}
          description={t("changes.emptyFiltered")}
          className="sdm-changes-empty"
          data-testid="changes-filtered-empty"
        />
      ) : (
        <ChangesTable rows={filtered} />
      )}
    </section>
  );
}
