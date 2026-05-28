import { useEffect, useMemo, useRef } from "react";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { useTranslation } from "@sdm/i18n";
import { PriorityBadge, StatusBadge, type Severity, type TicketStatus } from "@sdm/design-system";
import type { UiQueueItem } from "@sdm/api-types";
import type { QueueColumnKey } from "../types";

/**
 * Dense queue table. Uses TanStack Table v8 headless API + a hand-rolled
 * `<table>` so the DOM matches the wireframe (28-32 px rows, `aria-rowcount`,
 * `aria-colcount`, roving tabindex). Sorting is fixed to the BFF order (priority
 * desc, then openedAt desc) per `01-queue.md §Účel` — column sort UI is v1+.
 *
 * Status/Priority codes use the CA SDM vocabulary returned by the aggregator
 * (`OP`/`WIP`/...). The local mappers below collapse them onto the design-
 * system's `TicketStatus`/`Severity` enums so colour + label come from the
 * shared `StatusBadge`/`PriorityBadge` primitives.
 */

const STATUS_MAP: Record<string, TicketStatus> = {
  NEW: "new",
  OP: "open",
  SUBMITTED: "new",
  APPR_PENDING: "pending",
  APPROVED: "open",
  IN_PROGRESS: "in_progress",
  WIP: "in_progress",
  HLD: "hold",
  AWU: "pending",
  RES: "resolved",
  DELIVERED: "resolved",
  CL: "closed",
  ROOT_CAUSE_KNOWN: "in_progress",
  KNOWN_ERROR: "in_progress",
};

const PRIORITY_MAP: Record<string, Severity> = {
  "1": "critical",
  "2": "high",
  "3": "medium",
  "4": "low",
  "5": "low",
};

function relativeAge(iso: string | null): string {
  if (!iso) return "—";
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "—";
  const diffMs = Date.now() - then;
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "<1m";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  return `${days}d`;
}

export interface QueueTableProps {
  readonly rows: ReadonlyArray<UiQueueItem>;
  readonly visibleColumns: ReadonlyArray<QueueColumnKey>;
  readonly selectedId: string | null;
  readonly onRowSelect: (id: string) => void;
  readonly onRowActivate: (id: string) => void;
}

export function QueueTable(props: QueueTableProps) {
  const { rows, visibleColumns, selectedId, onRowSelect, onRowActivate } = props;
  const { t } = useTranslation("workspace");

  const columns = useMemo<ColumnDef<UiQueueItem>[]>(() => {
    const all: Record<QueueColumnKey, ColumnDef<UiQueueItem>> = {
      ref: {
        id: "ref",
        header: t("queue.columns.ref"),
        accessorKey: "ref",
        size: 110,
        cell: (info) => <span className="sdm-queue-cell-ref">#{info.row.original.ref}</span>,
      },
      ticketType: {
        id: "ticketType",
        header: t("queue.columns.type"),
        accessorKey: "ticketType",
        size: 80,
        cell: (info) => (
          <span className="sdm-queue-cell-type" data-type={info.row.original.ticketType}>
            {t(`queue.ticketType.${info.row.original.ticketType}`)}
          </span>
        ),
      },
      status: {
        id: "status",
        header: t("queue.columns.status"),
        accessorKey: "status",
        size: 110,
        cell: (info) => {
          const code = info.row.original.status?.code ?? "";
          const mapped = STATUS_MAP[code] ?? "open";
          return <StatusBadge status={mapped} label={info.row.original.status?.label ?? code} />;
        },
      },
      priority: {
        id: "priority",
        header: t("queue.columns.priority"),
        accessorKey: "priority",
        size: 90,
        cell: (info) => {
          const code = info.row.original.priority?.code ?? "";
          const severity = PRIORITY_MAP[code] ?? "none";
          return (
            <PriorityBadge severity={severity} label={info.row.original.priority?.label ?? "—"} />
          );
        },
      },
      summary: {
        id: "summary",
        header: t("queue.columns.summary"),
        accessorKey: "summary",
        size: 320,
        cell: (info) => (
          <span className="sdm-queue-cell-summary" title={info.row.original.summary}>
            {info.row.original.summary}
          </span>
        ),
      },
      customer: {
        id: "customer",
        header: t("queue.columns.customer"),
        accessorKey: "customer",
        size: 140,
        cell: (info) => info.row.original.customer?.label ?? "—",
      },
      assignee: {
        id: "assignee",
        header: t("queue.columns.assignee"),
        accessorKey: "assignee",
        size: 140,
        cell: (info) => info.row.original.assignee?.label ?? t("queue.unassigned"),
      },
      age: {
        id: "age",
        header: t("queue.columns.age"),
        accessorKey: "openedAt",
        size: 70,
        cell: (info) => (
          <span className="sdm-queue-cell-age">{relativeAge(info.row.original.openedAt)}</span>
        ),
      },
    };
    return visibleColumns.map((k) => all[k]);
  }, [visibleColumns, t]);

  const table = useReactTable<UiQueueItem>({
    data: rows as UiQueueItem[],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
  });

  const bodyRef = useRef<HTMLTableSectionElement | null>(null);

  // Scroll selected row into view (keyboard nav).
  useEffect(() => {
    if (!selectedId || !bodyRef.current) return;
    const el = bodyRef.current.querySelector<HTMLTableRowElement>(
      `tr[data-row-id="${CSS.escape(selectedId)}"]`,
    );
    if (el && typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ block: "nearest", behavior: "auto" });
    }
  }, [selectedId]);

  return (
    <table
      className="sdm-queue-table"
      data-testid="queue-table"
      aria-rowcount={rows.length}
      aria-colcount={columns.length}
    >
      <thead>
        {table.getHeaderGroups().map((hg) => (
          <tr key={hg.id}>
            {hg.headers.map((h) => (
              <th key={h.id} scope="col" style={{ width: h.getSize() }} data-col={h.column.id}>
                {flexRender(h.column.columnDef.header, h.getContext())}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody ref={bodyRef}>
        {table.getRowModel().rows.map((row) => {
          const isSelected = row.original.id === selectedId;
          return (
            <tr
              key={row.id}
              data-row-id={row.original.id}
              data-testid="queue-row"
              data-selected={isSelected ? "true" : "false"}
              aria-selected={isSelected}
              tabIndex={isSelected ? 0 : -1}
              className={isSelected ? "sdm-queue-row sdm-queue-row--selected" : "sdm-queue-row"}
              onClick={() => onRowSelect(row.original.id)}
              onDoubleClick={() => onRowActivate(row.original.id)}
              onKeyDown={(e) => {
                if (e.key === " ") {
                  e.preventDefault();
                  onRowActivate(row.original.id);
                }
              }}
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} data-col={cell.column.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
