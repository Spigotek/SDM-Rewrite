import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { useTranslation } from "@sdm/i18n";
import { StatusBadge, type TicketStatus } from "@sdm/design-system";
import type { CiStatus } from "@sdm/domain";
import type { CiRow } from "../types";

/**
 * CMDB CI list table. Mirrors the H.9 `ChangesTable` pattern — TanStack Table
 * v8 headless + hand-rolled `<table>`. Single-click navigates to
 * `/cmdb/ci/:id` (no split-pane — Robert opens CI detail as a full page like
 * Peter opens change detail).
 *
 * Columns per wireframe `05-cmdb-ci-detail.md §UI prvky` + spec/cmdb.md
 * §6.1 DataTable: ID / Name / Class / Status / Owner / Last sync. Owner shows
 * `primaryContactId` (UserId opaque) — H.13 doesn't resolve the user record;
 * the list view's purpose is scan-and-pick, not full owner lookup.
 */

const STATUS_MAP: Record<CiStatus, TicketStatus> = {
  ACTIVE: "open",
  INACTIVE: "pending",
  RETIRED: "closed",
  INVENTORY: "new",
};

function formatLastSync(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export interface CmdbTableProps {
  readonly rows: ReadonlyArray<CiRow>;
}

export function CmdbTable({ rows }: CmdbTableProps) {
  const { t } = useTranslation("workspace");
  const navigate = useNavigate();

  const columns = useMemo<ColumnDef<CiRow>[]>(
    () => [
      {
        id: "id",
        header: t("cmdb.columns.id"),
        accessorKey: "id",
        size: 140,
        cell: (info) => <span className="sdm-cmdb-cell-id">{info.row.original.id}</span>,
      },
      {
        id: "name",
        header: t("cmdb.columns.name"),
        accessorKey: "name",
        size: 240,
        cell: (info) => (
          <span className="sdm-cmdb-cell-name" title={info.row.original.name}>
            {info.row.original.name}
          </span>
        ),
      },
      {
        id: "class",
        header: t("cmdb.columns.class"),
        accessorKey: "class",
        size: 160,
        cell: (info) => (
          <span className="sdm-cmdb-cell-class" data-class={info.row.original.class}>
            {t(`cmdb.class.${info.row.original.class}`, {
              defaultValue: info.row.original.class,
            })}
          </span>
        ),
      },
      {
        id: "status",
        header: t("cmdb.columns.status"),
        accessorKey: "status",
        size: 120,
        cell: (info) => {
          const code = info.row.original.status;
          return <StatusBadge status={STATUS_MAP[code]} label={t(`cmdb.statusLabel.${code}`)} />;
        },
      },
      {
        id: "owner",
        header: t("cmdb.columns.owner"),
        size: 160,
        cell: (info) => (
          <span className="sdm-cmdb-cell-owner">
            {info.row.original.primaryContactId ?? t("cmdb.owner.unassigned")}
          </span>
        ),
      },
      {
        id: "lastSync",
        header: t("cmdb.columns.lastSync"),
        size: 130,
        cell: (info) => (
          <span className="sdm-cmdb-cell-last-sync">
            {formatLastSync(info.row.original.lastModifiedAt)}
          </span>
        ),
      },
    ],
    [t],
  );

  const table = useReactTable<CiRow>({
    data: rows as CiRow[],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
  });

  const open = (id: string) => navigate(`/cmdb/ci/${encodeURIComponent(id)}`);

  return (
    <table
      className="sdm-cmdb-table"
      data-testid="cmdb-table"
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
            data-testid="cmdb-row"
            tabIndex={0}
            className="sdm-cmdb-row"
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
