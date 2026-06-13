import { useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { useTranslation } from "@sdm/i18n";
import { StatusBadge, staggerListRows, type TicketStatus } from "@sdm/design-system";
import type { ProblemStatus } from "@sdm/domain";
import type { ProblemRow } from "../types";

/**
 * Problems list table — K.3.E polish:
 *
 * - `StatusBadge withIcon` to surface the lucide glyph per K.1 brief §6.4.
 * - `tabular-nums` on ref + opened-at columns (utility class `.sdm-tabular`
 *   already baked into the badge primitives + applied here on cells).
 * - Each `<tr>` carries `data-row` so the shared `staggerListRows` from
 *   `@sdm/design-system` runs the 20 ms-per-row enter animation; the effect
 *   re-runs when the row count changes so freshly filtered sets stagger too.
 */

const STATUS_MAP: Record<ProblemStatus, TicketStatus> = {
  IDENTIFIED: "new",
  INVESTIGATION: "in_progress",
  ROOT_CAUSE_KNOWN: "in_progress",
  KNOWN_ERROR: "open",
  RESOLVED: "resolved",
  CL: "closed",
  CD: "closed",
};

function formatOpened(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "2-digit" });
}

export interface ProblemsTableProps {
  readonly rows: ReadonlyArray<ProblemRow>;
}

export function ProblemsTable({ rows }: ProblemsTableProps) {
  const { t } = useTranslation("workspace");
  const navigate = useNavigate();
  const bodyRef = useRef<HTMLTableSectionElement | null>(null);

  const columns = useMemo<ColumnDef<ProblemRow>[]>(
    () => [
      {
        id: "ref",
        header: t("problems.columns.ref"),
        accessorKey: "ref",
        size: 120,
        cell: (info) => (
          <span className="sdm-problems-cell-ref sdm-tabular">#{info.row.original.ref}</span>
        ),
      },
      {
        id: "status",
        header: t("problems.columns.status"),
        accessorKey: "status",
        size: 180,
        cell: (info) => {
          const code = info.row.original.status;
          return (
            <StatusBadge
              status={STATUS_MAP[code]}
              label={t(`problems.statusLabel.${code}` as const)}
              withIcon
            />
          );
        },
      },
      {
        id: "summary",
        header: t("problems.columns.summary"),
        accessorKey: "summary",
        size: 360,
        cell: (info) => (
          <span className="sdm-problems-cell-summary" title={info.row.original.summary}>
            {info.row.original.summary || t("problems.noSummary")}
          </span>
        ),
      },
      {
        id: "rootCause",
        header: t("problems.columns.rootCause"),
        size: 240,
        cell: (info) => {
          const rc = info.row.original.rootCause;
          return rc ? (
            <span className="sdm-problems-cell-rootcause" title={rc}>
              {rc}
            </span>
          ) : (
            <span className="sdm-problems-cell-rootcause">—</span>
          );
        },
      },
      {
        id: "assignee",
        header: t("problems.columns.assignee"),
        size: 140,
        cell: (info) => info.row.original.assigneeId ?? t("problems.fields.unassigned"),
      },
      {
        id: "openedAt",
        header: t("problems.columns.openedAt"),
        size: 120,
        cell: (info) => (
          <span className="sdm-problems-cell-date sdm-tabular">
            {formatOpened(info.row.original.openedAt)}
          </span>
        ),
      },
    ],
    [t],
  );

  const table = useReactTable<ProblemRow>({
    data: rows as ProblemRow[],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
  });

  useEffect(() => {
    staggerListRows(bodyRef.current);
  }, [rows.length]);

  const open = (id: string) => navigate(`/problems/${encodeURIComponent(id)}`);

  return (
    <table
      className="sdm-problems-table"
      data-testid="problems-table"
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
        {table.getRowModel().rows.map((row) => (
          <tr
            key={row.id}
            data-row
            data-row-id={row.original.id}
            data-testid="problems-row"
            tabIndex={0}
            className="sdm-problems-row"
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
