import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "@sdm/i18n";
import type { UiQueueItem } from "@sdm/api-types";
import { tenantId as toTenantId } from "@sdm/domain";
import { useSession } from "../../shell/session-context";
import { queueQuery } from "./api";
import { useColumnConfig, useQueueFilters, useQueueKeyboardNav, useSavedViews } from "./hooks";
import { ColumnConfig } from "./components/ColumnConfig";
import { FilterBar } from "./components/FilterBar";
import { QueueSidebar } from "./components/QueueSidebar";
import { QueueTable } from "./components/QueueTable";
import { SavedViewsManager } from "./components/SavedViewsManager";
import type { QueueFilters, SavedView } from "./types";
import "./queue.css";

/**
 * `/queue` route — Anna's default landing. Composes:
 *
 *  ┌─ Sidebar (saved views) ─┬─ Main column ─────────────────────────────────┐
 *  │                          │ FilterBar + ColumnConfig + SaveView          │
 *  │                          │ QueueTable                                   │
 *  └──────────────────────────┴────────────────┬─────────────────────────────┘
 *                                              │ Right pane (placeholder, H.8)
 *
 * Selection state lives in the URL (`?selected=:id`). H.7 ships a placeholder
 * right pane; H.8 fills it with the real ticket detail.
 */
function filterRows(rows: ReadonlyArray<UiQueueItem>, f: QueueFilters): ReadonlyArray<UiQueueItem> {
  const needle = f.search.trim().toLowerCase();
  return rows.filter((r) => {
    if (f.status.length > 0 && !(r.status && f.status.includes(r.status.code))) return false;
    if (f.priority.length > 0 && !(r.priority && f.priority.includes(r.priority.code)))
      return false;
    if (f.assignee.length > 0 && !(r.assignee && f.assignee.includes(r.assignee.code)))
      return false;
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

function filtersEqual(a: QueueFilters, b: QueueFilters): boolean {
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

  const selectedRow = selectedId ? (rows.find((r) => r.id === selectedId) ?? null) : null;

  return (
    <section data-testid="workspace-queue" className="sdm-queue-page">
      <header className="sdm-queue-header">
        <h1 className="sdm-queue-title">SDM Workspace</h1>
        <span className="sdm-queue-tenant-hint">
          {t("placeholders.activeTenant")}{" "}
          <strong data-testid="active-tenant">{tenantId ?? ""}</strong>
        </span>
      </header>

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
            <div
              className="sdm-queue-state sdm-queue-empty"
              role="status"
              data-testid="queue-empty"
            >
              <p>{rows.length === 0 ? t("queue.empty") : t("queue.emptyFiltered")}</p>
            </div>
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
    </section>
  );
}
