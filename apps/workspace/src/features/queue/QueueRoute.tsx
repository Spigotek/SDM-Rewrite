import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useTranslation } from "@sdm/i18n";
import { Button, EmptyState, IllustrationNoTicketsAssigned } from "@sdm/design-system";
import type { UiQueueItem } from "@sdm/api-types";
import { tenantId as toTenantId } from "@sdm/domain";
import { useSession } from "../../shell/session-context";
import { queueQuery } from "./api";
import { useColumnConfig, useQueueFilters, useQueueKeyboardNav, useSavedViews } from "./hooks";
import { ChangeCalendarTeaser } from "./components/ChangeCalendarTeaser";
import { ColumnConfig } from "./components/ColumnConfig";
import { FilterBar } from "./components/FilterBar";
import { QueueFilters } from "./components/QueueFilters";
import { QueueSidebar } from "./components/QueueSidebar";
import { QueueStats } from "./components/QueueStats";
import { QueueTable } from "./components/QueueTable";
import { RecentActivityCard } from "./components/RecentActivityCard";
import { SavedViewsManager } from "./components/SavedViewsManager";
import type { QueueFilters as QueueFiltersValue, SavedView } from "./types";
import "./queue.css";

/**
 * `/queue` — Anna's workspace home (K.1 brief §10.2, v1.1.4 redesign).
 *
 *  Row 1 — `<QueueStats>`           5-up KPI strip (Otvorené / Moje / Po SLA / <1h / Dnes)
 *  Row 2 — `<QueueFilters>`         saved-view selector + active-filter chips + "Iba moje"
 *  Row 3 — `<QueueTable>`           dense 32-px row table (the existing centrepiece)
 *  Row 4 — split: `<RecentActivityCard>` | `<ChangeCalendarTeaser>`
 *
 * The sidebar (`QueueSidebar`) and split-pane preview from H.7 are retained so
 * keyboard navigation, saved views, and ticket preview keep working; only the
 * dashboard widgets surround the table now.
 */
function filterRows(
  rows: ReadonlyArray<UiQueueItem>,
  f: QueueFiltersValue,
): ReadonlyArray<UiQueueItem> {
  const needle = f.search.trim().toLowerCase();
  return rows.filter((r) => {
    if (f.status.length > 0 && !(r.status && f.status.includes(r.status.code))) return false;
    if (f.priority.length > 0 && !(r.priority && f.priority.includes(r.priority.code)))
      return false;
    if (f.assignee.length > 0 && !(r.assignee && f.assignee.includes(r.assignee.id))) return false;
    if (f.ticketType.length > 0 && !f.ticketType.includes(r.ticketType)) return false;
    if (f.customer.length > 0 && !(r.customer && f.customer.includes(r.customer.code)))
      return false;
    if (needle) {
      const hay = [r.ref, r.summary, r.customer?.label, r.assignee?.label]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });
}

function filtersEqual(a: QueueFiltersValue, b: QueueFiltersValue): boolean {
  return (
    a.search === b.search &&
    sameArray(a.status, b.status) &&
    sameArray(a.priority, b.priority) &&
    sameArray(a.assignee, b.assignee) &&
    sameArray(a.customer, b.customer) &&
    sameArray(a.ticketType, b.ticketType)
  );
}

function sameArray(a: ReadonlyArray<string>, b: ReadonlyArray<string>): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}

const EMPTY_ROWS: ReadonlyArray<UiQueueItem> = [];

export default function QueueRoute() {
  const { t } = useTranslation("workspace");
  const { session } = useSession();
  const tenantId = session?.tenantId;
  const currentUserId = session?.userId ?? null;

  const {
    filters,
    setFilters,
    toggleFilterValue,
    setSearch,
    resetFilters,
    selectedId,
    setSelectedId,
  } = useQueueFilters();

  const { views, saveView, deleteView } = useSavedViews();
  const { config, toggleColumn, resetColumns, allColumns } = useColumnConfig();

  // `session.tenantId` is a branded `TenantId`; the empty placeholder is only
  // used until the session resolves, at which point `enabled` flips on.
  const queryTenantId = tenantId ?? toTenantId("__pending__");
  const query = useQuery({
    ...queueQuery(queryTenantId),
    enabled: !!tenantId,
  });

  const rows: ReadonlyArray<UiQueueItem> = useMemo(
    () => query.data?.data ?? EMPTY_ROWS,
    [query.data],
  );
  const filteredRows = useMemo(() => filterRows(rows, filters), [rows, filters]);

  useQueueKeyboardNav<UiQueueItem>({
    rows: filteredRows,
    getRowId: (r) => r.id,
    selectedId,
    onSelect: setSelectedId,
    onActivate: setSelectedId,
    enabled: filteredRows.length > 0,
  });

  const activeViewId = useMemo<string | null>(() => {
    const match = views.find((v) => filtersEqual(v.filters, filters));
    return match?.id ?? null;
  }, [views, filters]);

  const handleSelectView = (view: SavedView) => {
    setFilters(view.filters);
    setSelectedId(null);
  };

  const handleResetView = () => {
    resetFilters();
    setSelectedId(null);
  };

  const handleSaveView = (name: string) => {
    saveView(name, filters);
  };

  const handleSelectViewFilters = useCallback(
    (next: QueueFiltersValue) => {
      setFilters(next);
      setSelectedId(null);
    },
    [setFilters, setSelectedId],
  );

  const handleClearChip = useCallback(
    (axis: keyof Omit<QueueFiltersValue, "search">, value: string) => {
      toggleFilterValue(axis, value);
    },
    [toggleFilterValue],
  );

  const handleToggleAssignedToMe = useCallback(() => {
    if (!currentUserId) return;
    toggleFilterValue("assignee", currentUserId);
  }, [currentUserId, toggleFilterValue]);

  const selectedRow = selectedId ? (rows.find((r) => r.id === selectedId) ?? null) : null;

  return (
    <section data-testid="workspace-queue" className="sdm-queue-page">
      <header className="sdm-queue-page-header">
        <h1 className="sdm-queue-page-title">{t("queue.title")}</h1>
        <Button
          type="button"
          variant="primary"
          size="sm"
          data-testid="queue-new-ticket"
          leadingIcon={<Plus size={14} aria-hidden="true" />}
          onClick={() => {
            // v1.1.4 placeholder — "New ticket" composer lands with cmd+K in v1.2.
            console.info("[queue] New-ticket composer placeholder (v1.2)");
          }}
        >
          {t("queue.newTicket")}
        </Button>
      </header>

      <QueueStats rows={rows} currentUserId={currentUserId} isLoading={query.isPending} />

      <QueueFilters
        filters={filters}
        rows={rows}
        currentUserId={currentUserId}
        savedViews={views}
        onSelectView={handleSelectViewFilters}
        onClearChip={handleClearChip}
        onToggleAssignedToMe={handleToggleAssignedToMe}
      />

      <div className="sdm-queue-layout">
        <QueueSidebar
          views={views}
          activeViewId={activeViewId}
          onSelectView={handleSelectView}
          onResetView={handleResetView}
          onDeleteView={deleteView}
        />

        <div className="sdm-queue-main">
          <div className="sdm-queue-toolbar">
            <FilterBar
              filters={filters}
              rows={rows}
              totalCount={rows.length}
              visibleCount={filteredRows.length}
              onToggle={toggleFilterValue}
              onSearch={setSearch}
              onReset={resetFilters}
            />
            <div className="sdm-queue-toolbar-trailing">
              <SavedViewsManager filters={filters} onSave={handleSaveView} />
              <ColumnConfig
                visible={config.visible}
                all={allColumns}
                onToggle={toggleColumn}
                onReset={resetColumns}
              />
            </div>
          </div>

          {query.isPending ? (
            <p className="sdm-queue-state" data-testid="queue-loading">
              {t("queue.loading")}
            </p>
          ) : query.isError ? (
            <p
              role="alert"
              className="sdm-queue-state sdm-queue-state--error"
              data-testid="queue-error"
            >
              {t("queue.error")}
            </p>
          ) : filteredRows.length === 0 ? (
            <EmptyState
              variant="hero"
              illustration={<IllustrationNoTicketsAssigned />}
              title={rows.length === 0 ? t("queue.emptyTitle") : t("queue.emptyFilteredTitle")}
              description={rows.length === 0 ? t("queue.empty") : t("queue.emptyFiltered")}
              className="sdm-queue-state sdm-queue-empty"
              data-testid="queue-empty"
            />
          ) : (
            <QueueTable
              rows={filteredRows}
              visibleColumns={config.visible}
              selectedId={selectedId}
              onRowSelect={setSelectedId}
              onRowActivate={setSelectedId}
            />
          )}
        </div>

        <aside
          className="sdm-queue-split-pane"
          data-testid="queue-split-pane"
          aria-label={t("queue.splitPane.ariaLabel")}
        >
          {selectedRow ? (
            <div data-testid="queue-split-pane-placeholder" className="sdm-queue-split-placeholder">
              <p className="sdm-queue-split-ref">#{selectedRow.ref}</p>
              <p className="sdm-queue-split-summary">{selectedRow.summary}</p>
              <p className="sdm-queue-split-hint">{t("queue.splitPane.placeholder")}</p>
            </div>
          ) : (
            <div className="sdm-queue-split-placeholder">
              <p className="sdm-queue-split-hint">{t("queue.splitPane.empty")}</p>
            </div>
          )}
        </aside>
      </div>

      <div className="sdm-queue-dashboard-row">
        <RecentActivityCard rows={rows} currentUserId={currentUserId} isLoading={query.isPending} />
        <ChangeCalendarTeaser tenantId={tenantId} />
      </div>
    </section>
  );
}
