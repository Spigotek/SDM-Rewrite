import { Suspense, lazy, useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LayoutGrid, Plus, Rows3 } from "lucide-react";
import { useTranslation } from "@sdm/i18n";
import {
  Button,
  EmptyState,
  IconButton,
  IllustrationNoTicketsAssigned,
  Skeleton,
  Toast,
  ToastViewport,
  type TicketStatus,
} from "@sdm/design-system";
import type { UiQueueItem } from "@sdm/api-types";
import { tenantId as toTenantId } from "@sdm/domain";
import { useSession } from "../../shell/session-context";
import { queueQuery } from "./api";
import {
  statusMatchesFilter,
  useColumnConfig,
  useQueueFilters,
  useQueueKeyboardNav,
  useQueueStatusTransition,
  useQueueViewMode,
} from "./hooks";
import { ChangeCalendarTeaser } from "./components/ChangeCalendarTeaser";
import { ColumnConfig } from "./components/ColumnConfig";
import { FilterBar } from "./components/FilterBar";
import { QueueDetailDrawer } from "./components/QueueDetailDrawer";
import { QueueFilters } from "./components/QueueFilters";
import { QueueStats } from "./components/QueueStats";
import { QueueTable } from "./components/QueueTable";
import { RecentActivityCard } from "./components/RecentActivityCard";
import type { QueueFilters as QueueFiltersValue, SavedView } from "./types";

// Kanban is opt-in — lazy so the dense table view (default) keeps shipping
// without the board layout + drag-and-drop wiring.
const QueueKanban = lazy(() =>
  import("./components/QueueKanban").then((m) => ({ default: m.QueueKanban })),
);
import "./queue.css";

/**
 * `/queue` — Anna's workspace home (K.1 brief §10.2, M.2.B layout clarity).
 *
 *  Row 1 — `<QueueStats>`           5-up KPI strip (Otvorené / Moje / Po SLA / <1h / Dnes)
 *  Row 2 — `<QueueFilters>`         active-filter chips + "Iba moje"
 *  Row 3 — `<QueueTable>`           dense 32-px row table, now full content width
 *  Row 4 — split: `<RecentActivityCard>` | `<ChangeCalendarTeaser>`
 *
 * M.2.B: the inner Queues/saved-views left column and the permanent right
 * split-pane were removed per owner feedback ("ukladanie pohľadov nepotrebujem
 * … radšej roztiahni stred"). The list spans full width; row selection opens
 * `<QueueDetailDrawer>` (a right-side drawer over the content).
 */
function filterRows(
  rows: ReadonlyArray<UiQueueItem>,
  f: QueueFiltersValue,
): ReadonlyArray<UiQueueItem> {
  const needle = f.search.trim().toLowerCase();
  return rows.filter((r) => {
    // Status filter accepts both raw CA SDM codes (chip toggles) and logical
    // names like `new` / `in_progress` (left-rail items) — `statusMatchesFilter`
    // normalises both inputs against the row's `r.status.code`.
    if (!statusMatchesFilter(r.status?.code ?? null, f.status)) return false;
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

const EMPTY_ROWS: ReadonlyArray<UiQueueItem> = [];
// Saved-views UI removed in M.2.B; the `QueueFilters` quick-filter dropdown now
// shows only built-in presets. A stable empty array keeps it referentially sound.
const EMPTY_VIEWS: ReadonlyArray<SavedView> = [];

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

  const { config, toggleColumn, resetColumns, allColumns } = useColumnConfig();
  const { mode: viewMode, setMode: setViewMode } = useQueueViewMode();

  // Local toast bus — keeps parity with KbEditorRoute. The transitionable
  // status badge in each row drives success/error/unsupported toasts.
  const [toasts, setToasts] = useState<
    ReadonlyArray<{
      readonly id: string;
      readonly intent: "success" | "info" | "warning" | "danger";
      readonly title: string;
    }>
  >([]);
  const pushToast = useCallback(
    (intent: "success" | "info" | "warning" | "danger", title: string) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev, { id, intent, title }]);
      setTimeout(() => setToasts((prev) => prev.filter((toast) => toast.id !== id)), 5000);
    },
    [],
  );
  const dismissToast = useCallback(
    (id: string) => setToasts((prev) => prev.filter((toast) => toast.id !== id)),
    [],
  );

  const queryTenantIdString = (tenantId ?? "__pending__") as string;
  const statusTransition = useQueueStatusTransition({
    tenantId: queryTenantIdString,
    onSuccess: (label) => pushToast("success", t("status.transition.success", { label })),
    onError: () => pushToast("danger", t("status.transition.error")),
    onUnsupported: () => pushToast("info", t("status.transition.unsupported")),
  });

  const onStatusTransition = useCallback(
    async (input: {
      readonly id: string;
      readonly type: UiQueueItem["ticketType"];
      readonly next: TicketStatus;
    }) => {
      await statusTransition.transition(input);
    },
    [statusTransition],
  );

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

  // v1.7.1 — force the list view to remount when the active filter set changes.
  // `@tanstack/react-table` v8 can return a STALE `getRowModel()` (a superset of
  // old + new rows) when `data` shrinks via filtering: the `<table>` reflects
  // the fresh `rows.length` (aria-rowcount) while the body still renders cached
  // Row objects, so the count and the rendered rows disagree (owner repro:
  // "click a status chip from the full list → wrong rows"; their workaround of
  // filtering to an empty list and back worked only because the empty state
  // unmounts the table). Keying the view on the filter signature gives it a
  // clean mount on every filter change — the same effect, deterministically.
  // The entrance stagger already re-runs on row-count changes, so this adds no
  // new animation cost.
  const filterViewKey = useMemo(
    () =>
      JSON.stringify([
        filters.status,
        filters.priority,
        filters.assignee,
        filters.ticketType,
        filters.customer,
        filters.search,
      ]),
    [filters],
  );

  useQueueKeyboardNav<UiQueueItem>({
    rows: filteredRows,
    getRowId: (r) => r.id,
    selectedId,
    onSelect: setSelectedId,
    onActivate: setSelectedId,
    enabled: filteredRows.length > 0,
  });

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
        <h1 className="sdm-queue-page-title sdm-heading-serif">{t("queue.title")}</h1>
        <div className="sdm-queue-page-actions">
          <div
            className="sdm-queue-view-toggle"
            role="group"
            aria-label={t("queue.view.toggleAria")}
          >
            <IconButton
              data-testid="queue-view-toggle-table"
              aria-label={t("queue.view.table")}
              title={t("queue.view.table")}
              size="sm"
              variant={viewMode === "table" ? "solid" : "ghost"}
              aria-pressed={viewMode === "table"}
              icon={<Rows3 size={14} aria-hidden="true" />}
              onClick={() => setViewMode("table")}
            />
            <IconButton
              data-testid="queue-view-toggle-kanban"
              aria-label={t("queue.view.kanban")}
              title={t("queue.view.kanban")}
              size="sm"
              variant={viewMode === "kanban" ? "solid" : "ghost"}
              aria-pressed={viewMode === "kanban"}
              icon={<LayoutGrid size={14} aria-hidden="true" />}
              onClick={() => setViewMode("kanban")}
            />
          </div>
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
        </div>
      </header>

      <QueueStats rows={rows} currentUserId={currentUserId} isLoading={query.isPending} />

      <QueueFilters
        filters={filters}
        rows={rows}
        currentUserId={currentUserId}
        savedViews={EMPTY_VIEWS}
        onSelectView={handleSelectViewFilters}
        onClearChip={handleClearChip}
        onToggleAssignedToMe={handleToggleAssignedToMe}
      />

      <div className="sdm-queue-layout">
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
          ) : viewMode === "kanban" ? (
            <Suspense
              fallback={
                <div className="sdm-queue-kanban-fallback" data-testid="queue-kanban-fallback">
                  <Skeleton variant="block" height="20rem" />
                </div>
              }
            >
              <QueueKanban
                key={filterViewKey}
                rows={filteredRows}
                onStatusTransition={onStatusTransition}
                onTransitionForbidden={() =>
                  pushToast("info", t("queue.kanban.transitionForbidden"))
                }
                statusTransitionPending={statusTransition.isPending}
              />
            </Suspense>
          ) : (
            <QueueTable
              key={filterViewKey}
              rows={filteredRows}
              visibleColumns={config.visible}
              selectedId={selectedId}
              onRowSelect={setSelectedId}
              onRowActivate={setSelectedId}
              onStatusTransition={onStatusTransition}
              statusTransitionPending={statusTransition.isPending}
            />
          )}
        </div>
      </div>

      <QueueDetailDrawer
        row={selectedRow}
        open={selectedId !== null}
        onClose={() => setSelectedId(null)}
      />

      <div className="sdm-queue-dashboard-row">
        <RecentActivityCard rows={rows} currentUserId={currentUserId} isLoading={query.isPending} />
        <ChangeCalendarTeaser tenantId={tenantId} />
      </div>

      <ToastViewport>
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            id={toast.id}
            intent={toast.intent}
            title={toast.title}
            onDismiss={() => dismissToast(toast.id)}
          />
        ))}
      </ToastViewport>
    </section>
  );
}
