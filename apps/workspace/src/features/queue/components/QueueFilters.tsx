import { useMemo } from "react";
import { Plus, X } from "lucide-react";
import { useTranslation } from "@sdm/i18n";
import type { TicketStatus } from "@sdm/design-system";
import type { UiQueueItem } from "@sdm/api-types";
import type { QueueFilters as QueueFiltersValue, SavedView } from "../types";
import { EMPTY_FILTERS } from "../types";

/**
 * Logical `TicketStatus` → SK label fallback for chips that come from URL
 * filters using logical names (left-rail items emit `?status=new` etc.). The
 * primary path remains `labelLookup` populated from row data; this kicks in
 * only when no row in the current page carries that logical value as a raw
 * code (i.e. the rail navigation set a filter that doesn't textually match
 * any visible row code).
 */
const LOGICAL_STATUS_LABEL_SK: Partial<Record<TicketStatus, string>> = {
  new: "Nový",
  open: "Otvorený",
  in_progress: "V riešení",
  hold: "Pozastavený",
  pending: "Čaká",
  waiting_customer: "Čaká na zákazníka",
  waiting_vendor: "Čaká na dodávateľa",
  resolved: "Vyriešený",
  closed: "Uzavretý",
  cancelled: "Zrušený",
  rejected: "Zamietnutý",
  approval_pending: "Čaká na schválenie",
  scheduled: "Naplánovaný",
};

/**
 * Saved-view selector + filter chip row (K.1 brief §10.2 row 2).
 *
 * - `<select>` lists built-in views ("Všetky otvorené incidenty", "Moja fronta",
 *   "Po SLA", "Dnes otvorené") plus any user-saved views (forwarded by parent).
 *   Changing the selection writes the matching filter set to the URL.
 * - Active filters render as removable chips ("Status: P2 ×"). The chip pulls
 *   its friendly label from the row dataset (same approach as `FilterBar`).
 * - "Iba moje" toggle button — when ON, the current user id is in
 *   `filters.assignee`. Toggling appends/removes the id from that axis.
 * - "+ Pridať filter" opens an inline placeholder menu (v1.1.4 stub).
 *
 * The existing `FilterBar` keeps the per-axis chip groups underneath this row;
 * this component owns the higher-level affordances only.
 */

interface BuiltInView {
  readonly id: string;
  readonly labelKey:
    | "queue.filters.viewAll"
    | "queue.filters.viewMine"
    | "queue.filters.viewOverdue"
    | "queue.filters.viewToday";
  readonly filters: QueueFiltersValue;
}

function buildBuiltInViews(currentUserId: string | null): ReadonlyArray<BuiltInView> {
  const mineAssignee = currentUserId ? [currentUserId] : [];
  return [
    {
      id: "all",
      labelKey: "queue.filters.viewAll",
      filters: { ...EMPTY_FILTERS, status: ["OP", "WIP"] },
    },
    {
      id: "mine",
      labelKey: "queue.filters.viewMine",
      filters: { ...EMPTY_FILTERS, assignee: mineAssignee, status: ["OP", "WIP"] },
    },
    // "Po SLA" + "Dnes" are placeholders — `UiQueueItem` carries no SLA flag
    // and "Dnes" is computed client-side from `openedAt`. We expose them as
    // saved-view shortcuts even though they cannot pre-filter on the URL.
    { id: "overdue", labelKey: "queue.filters.viewOverdue", filters: EMPTY_FILTERS },
    { id: "today", labelKey: "queue.filters.viewToday", filters: EMPTY_FILTERS },
  ];
}

export interface QueueFiltersProps {
  readonly filters: QueueFiltersValue;
  readonly rows: ReadonlyArray<UiQueueItem>;
  readonly currentUserId: string | null;
  readonly savedViews: ReadonlyArray<SavedView>;
  readonly onSelectView: (filters: QueueFiltersValue) => void;
  readonly onClearChip: (axis: keyof Omit<QueueFiltersValue, "search">, value: string) => void;
  readonly onToggleAssignedToMe: () => void;
}

interface ActiveChip {
  readonly axis: keyof Omit<QueueFiltersValue, "search">;
  readonly value: string;
  readonly label: string;
  readonly axisLabel: string;
}

function buildLabelLookup(rows: ReadonlyArray<UiQueueItem>) {
  const status = new Map<string, string>();
  const priority = new Map<string, string>();
  const assignee = new Map<string, string>();
  const customer = new Map<string, string>();
  for (const r of rows) {
    if (r.status) status.set(r.status.code, r.status.label);
    if (r.priority) priority.set(r.priority.code, r.priority.label);
    if (r.assignee) assignee.set(r.assignee.id, r.assignee.label);
    if (r.customer) customer.set(r.customer.code, r.customer.label);
  }
  return { status, priority, assignee, customer };
}

export function QueueFilters(props: QueueFiltersProps) {
  const {
    filters,
    rows,
    currentUserId,
    savedViews,
    onSelectView,
    onClearChip,
    onToggleAssignedToMe,
  } = props;
  const { t } = useTranslation("workspace");

  const builtInViews = useMemo(() => buildBuiltInViews(currentUserId), [currentUserId]);
  const labelLookup = useMemo(() => buildLabelLookup(rows), [rows]);

  const activeChips = useMemo<ReadonlyArray<ActiveChip>>(() => {
    const out: ActiveChip[] = [];
    const pushAxis = (
      axis: keyof Omit<QueueFiltersValue, "search">,
      axisLabel: string,
      values: ReadonlyArray<string>,
      lookup?: Map<string, string>,
    ) => {
      for (const v of values) {
        out.push({ axis, value: v, label: lookup?.get(v) ?? v, axisLabel });
      }
    };
    // Status axis falls back to the logical-name dictionary so rail-set
    // filters like `?status=new` display "Stav: Nový" even when no current
    // row carries that exact value as a raw CA SDM code.
    for (const v of filters.status) {
      const direct = labelLookup.status.get(v);
      const logical = LOGICAL_STATUS_LABEL_SK[v as TicketStatus];
      out.push({
        axis: "status",
        value: v,
        label: direct ?? logical ?? v,
        axisLabel: t("queue.axis.status"),
      });
    }
    pushAxis("priority", t("queue.axis.priority"), filters.priority, labelLookup.priority);
    pushAxis("assignee", t("queue.axis.assignee"), filters.assignee, labelLookup.assignee);
    pushAxis("customer", t("queue.axis.assignee"), filters.customer, labelLookup.customer);
    for (const v of filters.ticketType) {
      out.push({
        axis: "ticketType",
        value: v,
        label: t(`queue.ticketType.${v}` as const),
        axisLabel: t("queue.axis.type"),
      });
    }
    return out;
  }, [filters, labelLookup, t]);

  const mineActive = currentUserId !== null && filters.assignee.includes(currentUserId);

  return (
    <div className="sdm-queue-filters" data-testid="queue-filters">
      <div className="sdm-queue-filters-row">
        <label className="sdm-queue-filters-saved">
          <span className="sdm-queue-filters-saved-label">{t("queue.filters.savedView")}</span>
          <select
            className="sdm-queue-filters-saved-select"
            data-testid="queue-filters-saved-view"
            defaultValue=""
            onChange={(e) => {
              const id = e.target.value;
              if (!id) return;
              const builtIn = builtInViews.find((v) => v.id === id);
              if (builtIn) {
                onSelectView(builtIn.filters);
                return;
              }
              const saved = savedViews.find((v) => v.id === id);
              if (saved) onSelectView(saved.filters);
            }}
          >
            <option value="" disabled>
              {t("queue.filters.savedViewPlaceholder")}
            </option>
            {builtInViews.map((v) => (
              <option key={v.id} value={v.id}>
                {t(v.labelKey)}
              </option>
            ))}
            {savedViews.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className={
            mineActive
              ? "sdm-queue-filters-mine sdm-queue-filters-mine--active"
              : "sdm-queue-filters-mine"
          }
          data-testid="queue-filters-mine"
          aria-pressed={mineActive}
          disabled={!currentUserId}
          onClick={onToggleAssignedToMe}
        >
          {t("queue.filters.assignedToMe")}
        </button>
      </div>

      <div
        className="sdm-queue-filters-chips"
        role="group"
        aria-label={t("queue.filters.activeAria")}
      >
        {activeChips.length === 0 ? (
          <span className="sdm-queue-filters-chips-empty">
            {t("queue.filters.noActiveFilters")}
          </span>
        ) : (
          activeChips.map((chip) => (
            <span
              key={`${chip.axis}-${chip.value}`}
              className="sdm-queue-filters-chip"
              data-testid={`queue-filter-chip-${chip.axis}-${chip.value}`}
            >
              <span className="sdm-queue-filters-chip-axis">{chip.axisLabel}:</span>
              <span className="sdm-queue-filters-chip-value">{chip.label}</span>
              <button
                type="button"
                className="sdm-queue-filters-chip-remove"
                aria-label={t("queue.filters.removeChip", {
                  axis: chip.axisLabel,
                  value: chip.label,
                })}
                onClick={() => onClearChip(chip.axis, chip.value)}
              >
                <X size={12} aria-hidden="true" />
              </button>
            </span>
          ))
        )}
        <button
          type="button"
          className="sdm-queue-filters-add"
          data-testid="queue-filters-add"
          onClick={() => {
            // v1.1.4 placeholder — the full filter menu lands with the command
            // palette in v1.2 (K-phase brief §6.10).
            console.info("[queue] Add-filter menu placeholder (v1.2)");
          }}
        >
          <Plus size={12} aria-hidden="true" />
          {t("queue.filters.addFilter")}
        </button>
      </div>
    </div>
  );
}
