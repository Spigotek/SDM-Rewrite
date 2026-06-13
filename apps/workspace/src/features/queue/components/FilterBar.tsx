import { useMemo, useRef } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { useTranslation } from "@sdm/i18n";
import { Button } from "@sdm/design-system";
import type { UiQueueItem, UiTicketType } from "@sdm/api-types";
import type { QueueFilters } from "../types";

/**
 * Filter chip bar — toggleable chips for status / priority / ticket type /
 * assignee, plus a text-search input. Available values are derived from the
 * actual row set so the bar never offers a filter that yields zero rows.
 *
 * Filter axes mirror the BFF schema (`status.code`, `priority.code`,
 * `assignee.id`); chip labels come from the FkRef the row already carries.
 * Customer filter is left as an axis but not exposed as a chip group in MVP —
 * with 100+ potential customers a chip strip would be unusable; the search
 * box covers customer name lookup.
 */

const TICKET_TYPE_ORDER: ReadonlyArray<UiTicketType> = ["incident", "request", "problem", "change"];

interface ChipOption {
  readonly code: string;
  readonly label: string;
  readonly count: number;
}

function collectOptions(
  rows: ReadonlyArray<UiQueueItem>,
  axis: "status" | "priority" | "assignee",
): ReadonlyArray<ChipOption> {
  const byCode = new Map<string, ChipOption>();
  for (const r of rows) {
    let key: { code: string; label: string } | null = null;
    if (axis === "status") key = r.status ?? null;
    else if (axis === "priority") key = r.priority ?? null;
    else key = r.assignee ?? null;
    if (!key) continue;
    const existing = byCode.get(key.code);
    if (existing) {
      byCode.set(key.code, { ...existing, count: existing.count + 1 });
    } else {
      byCode.set(key.code, { code: key.code, label: key.label, count: 1 });
    }
  }
  return Array.from(byCode.values()).sort((a, b) => b.count - a.count);
}

function collectTypeOptions(rows: ReadonlyArray<UiQueueItem>): ReadonlyArray<ChipOption> {
  const counts = new Map<UiTicketType, number>();
  for (const r of rows) {
    counts.set(r.ticketType, (counts.get(r.ticketType) ?? 0) + 1);
  }
  const out: ChipOption[] = [];
  for (const t of TICKET_TYPE_ORDER) {
    const n = counts.get(t);
    if (n) out.push({ code: t, label: t, count: n });
  }
  return out;
}

export interface FilterBarProps {
  readonly filters: QueueFilters;
  readonly rows: ReadonlyArray<UiQueueItem>;
  readonly totalCount: number;
  readonly visibleCount: number;
  readonly onToggle: (axis: keyof Omit<QueueFilters, "search">, value: string) => void;
  readonly onSearch: (value: string) => void;
  readonly onReset: () => void;
}

export function FilterBar(props: FilterBarProps) {
  const { filters, rows, totalCount, visibleCount, onToggle, onSearch, onReset } = props;
  const { t } = useTranslation("workspace");
  const searchRef = useRef<HTMLInputElement | null>(null);

  const statuses = useMemo(() => collectOptions(rows, "status"), [rows]);
  const priorities = useMemo(() => collectOptions(rows, "priority"), [rows]);
  const assignees = useMemo(() => collectOptions(rows, "assignee").slice(0, 6), [rows]);
  const types = useMemo(() => collectTypeOptions(rows), [rows]);

  const hasActive =
    filters.status.length +
      filters.priority.length +
      filters.assignee.length +
      filters.ticketType.length +
      filters.customer.length >
      0 || filters.search.length > 0;

  // `/` focuses the search input (per `01-queue.md §Klávesové skratky`).
  useHotkeys(
    "/",
    (e) => {
      e.preventDefault();
      searchRef.current?.focus();
    },
    { enableOnFormTags: false },
  );

  const typeLabel = (code: string): string => t(`queue.ticketType.${code}` as const);

  return (
    <div
      className="sdm-queue-filterbar"
      data-testid="filter-bar"
      role="group"
      aria-label={t("queue.filtersGroupLabel")}
    >
      <div className="sdm-queue-filterbar-row">
        <input
          ref={searchRef}
          className="sdm-queue-search"
          data-testid="queue-search"
          type="search"
          placeholder={t("queue.searchPlaceholder")}
          value={filters.search}
          onChange={(e) => onSearch(e.target.value)}
          aria-label={t("queue.searchPlaceholder")}
        />
        <span className="sdm-queue-result-count" data-testid="queue-result-count">
          {t("queue.resultCount", { visible: visibleCount, total: totalCount })}
        </span>
        {hasActive ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            data-testid="queue-reset-filters"
            onClick={onReset}
          >
            {t("queue.resetFilters")}
          </Button>
        ) : null}
      </div>

      {types.length > 0 ? (
        <ChipGroup
          label={t("queue.axis.type")}
          options={types}
          active={filters.ticketType}
          onToggle={(code) => onToggle("ticketType", code)}
          renderLabel={typeLabel}
        />
      ) : null}
      {statuses.length > 0 ? (
        <ChipGroup
          label={t("queue.axis.status")}
          options={statuses}
          active={filters.status}
          onToggle={(code) => onToggle("status", code)}
        />
      ) : null}
      {priorities.length > 0 ? (
        <ChipGroup
          label={t("queue.axis.priority")}
          options={priorities}
          active={filters.priority}
          onToggle={(code) => onToggle("priority", code)}
        />
      ) : null}
      {assignees.length > 0 ? (
        <ChipGroup
          label={t("queue.axis.assignee")}
          options={assignees}
          active={filters.assignee}
          onToggle={(code) => onToggle("assignee", code)}
        />
      ) : null}
    </div>
  );
}

interface ChipGroupProps {
  readonly label: string;
  readonly options: ReadonlyArray<ChipOption>;
  readonly active: ReadonlyArray<string>;
  readonly onToggle: (code: string) => void;
  readonly renderLabel?: (code: string) => string;
}

function ChipGroup(props: ChipGroupProps) {
  const { label, options, active, onToggle, renderLabel } = props;
  return (
    <div className="sdm-queue-chip-group" role="group" aria-label={label}>
      <span className="sdm-queue-chip-group-label">{label}</span>
      {options.map((o) => {
        const pressed = active.includes(o.code);
        return (
          <button
            key={o.code}
            type="button"
            className={pressed ? "sdm-queue-chip sdm-queue-chip--active" : "sdm-queue-chip"}
            aria-pressed={pressed}
            data-testid={`queue-chip-${o.code}`}
            onClick={() => onToggle(o.code)}
          >
            <span>{renderLabel ? renderLabel(o.code) : o.label}</span>
            <span className="sdm-queue-chip-count">{o.count}</span>
          </button>
        );
      })}
    </div>
  );
}
