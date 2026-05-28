import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { useTranslation } from "@sdm/i18n";
import { PriorityBadge, StatusBadge, type Severity, type TicketStatus } from "@sdm/design-system";
import type { ApprovalState, ChangeStatus, RiskLevel } from "@sdm/domain";
import type { ChangeRow } from "../types";

/**
 * Changes list table. Mirrors the dense queue pattern from H.7
 * (`features/queue/components/QueueTable.tsx`) — TanStack Table v8 headless
 * + hand-rolled `<table>` so the DOM matches the change-calendar wireframe
 * column ordering (ID / Risk / Status / Schedule / Type / Approver state).
 *
 * No sort UI in H.9 — server-side ordering covers the MVP (newest first by
 * `openedAt`). H.10 calendar lets the user reorder by `scheduledStartAt`.
 *
 * Rows are *single-click* navigation (not the queue's split-pane pattern).
 * The wireframe `03-change-calendar.md §UI prvky — change detail` calls out
 * a dedicated detail screen rather than a split pane, so a click swaps the
 * route to `/changes/:id`.
 */

const STATUS_MAP: Record<ChangeStatus, TicketStatus> = {
  RFC: "new",
  APPR_PENDING: "pending",
  APPROVED: "open",
  SCHEDULED: "open",
  IN_PROGRESS: "in_progress",
  VERIFICATION_IN_PROGRESS: "in_progress",
  VERIFIED: "resolved",
  REJECTED: "closed",
  CL: "closed",
  CD: "closed",
  EMG_RFC: "pending",
  EMG_IN_PROGRESS: "in_progress",
  EMG_RETROSPECTIVE: "pending",
};

const RISK_SEVERITY: Record<RiskLevel, Severity> = {
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
};

/** "2 / 4 approved" summary. PENDING means at least one APPROVED + ≥1 PENDING. */
function approverProgress(row: ChangeRow): { approved: number; total: number } {
  const approved = row.cabApprovers.filter((a) => a.decision === "APPROVED").length;
  return { approved, total: row.cabApprovers.length };
}

function formatScheduleWindow(startIso: string | null, endIso: string | null): string {
  if (!startIso) return "—";
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) return "—";
  const datePart = start.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
  });
  const startTime = start.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  if (!endIso) return `${datePart} · ${startTime}`;
  const end = new Date(endIso);
  if (Number.isNaN(end.getTime())) return `${datePart} · ${startTime}`;
  const endTime = end.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return `${datePart} · ${startTime}–${endTime}`;
}

export interface ChangesTableProps {
  readonly rows: ReadonlyArray<ChangeRow>;
}

export function ChangesTable({ rows }: ChangesTableProps) {
  const { t } = useTranslation("workspace");
  const navigate = useNavigate();

  const columns = useMemo<ColumnDef<ChangeRow>[]>(
    () => [
      {
        id: "ref",
        header: t("changes.columns.ref"),
        accessorKey: "ref",
        size: 130,
        cell: (info) => <span className="sdm-changes-cell-ref">#{info.row.original.ref}</span>,
      },
      {
        id: "risk",
        header: t("changes.columns.risk"),
        accessorKey: "risk",
        size: 100,
        cell: (info) => {
          const risk = info.row.original.risk;
          return <PriorityBadge severity={RISK_SEVERITY[risk]} label={t(`changes.risk.${risk}`)} />;
        },
      },
      {
        id: "status",
        header: t("changes.columns.status"),
        accessorKey: "status",
        size: 140,
        cell: (info) => {
          const code = info.row.original.status;
          return <StatusBadge status={STATUS_MAP[code]} label={t(`changes.statusLabel.${code}`)} />;
        },
      },
      {
        id: "schedule",
        header: t("changes.columns.schedule"),
        size: 200,
        cell: (info) => (
          <span className="sdm-changes-cell-schedule">
            {formatScheduleWindow(
              info.row.original.scheduledStartAt,
              info.row.original.scheduledEndAt,
            )}
          </span>
        ),
      },
      {
        id: "category",
        header: t("changes.columns.category"),
        accessorKey: "category",
        size: 110,
        cell: (info) => (
          <span className="sdm-changes-cell-category" data-category={info.row.original.category}>
            {t(`changes.category.${info.row.original.category}`)}
          </span>
        ),
      },
      {
        id: "approvals",
        header: t("changes.columns.approvals"),
        size: 130,
        cell: (info) => {
          const { approved, total } = approverProgress(info.row.original);
          const state: ApprovalState = info.row.original.approvalState;
          return (
            <span
              className="sdm-changes-cell-approvals"
              data-state={state}
              data-testid="changes-approval-state"
              title={t(`changes.approvalState.${state}`)}
            >
              {total > 0 ? `${approved}/${total}` : t("changes.approvalState.unset")}
            </span>
          );
        },
      },
      {
        id: "summary",
        header: t("changes.columns.summary"),
        accessorKey: "summary",
        size: 320,
        cell: (info) => (
          <span className="sdm-changes-cell-summary" title={info.row.original.summary}>
            {info.row.original.summary}
          </span>
        ),
      },
    ],
    [t],
  );

  const table = useReactTable<ChangeRow>({
    data: rows as ChangeRow[],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
  });

  const open = (id: string) => navigate(`/changes/${encodeURIComponent(id)}`);

  return (
    <table
      className="sdm-changes-table"
      data-testid="changes-table"
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
      <tbody>
        {table.getRowModel().rows.map((row) => (
          <tr
            key={row.id}
            data-row-id={row.original.id}
            data-testid="changes-row"
            tabIndex={0}
            className="sdm-changes-row"
            onClick={() => open(row.original.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                open(row.original.id);
              }
            }}
          >
            {row.getVisibleCells().map((cell) => (
              <td key={cell.id} data-col={cell.column.id}>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
