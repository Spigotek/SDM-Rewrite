import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { useTranslation } from "@sdm/i18n";
import type { KbBrowseRow } from "../types";

/**
 * Workspace KB DataTable — category / title / helpfulness ratio / last
 * updated. Mirror of the H.9 ChangesTable shape (TanStack Table v8 headless +
 * hand-rolled `<table>`) so the row interactions (`click` + `Enter` → open)
 * stay consistent across the workspace list pages.
 *
 * Helpfulness ratio renders as a percentage with one decimal precision; `—`
 * when `viewCount == 0` (no signal yet). Sorting is left to a future chunk —
 * MVP ships the default order (server-side: descending by hits, MSW
 * `paginate` keeps insertion order today).
 */

function formatDate(iso: string, locale: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" });
}

function formatRatio(ratio: number | null, locale: string): string {
  if (ratio === null) return "—";
  return new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(ratio);
}

export interface KbBrowseListProps {
  readonly rows: ReadonlyArray<KbBrowseRow>;
}

export function KbBrowseList({ rows }: KbBrowseListProps) {
  const { t, i18n } = useTranslation("workspace");
  const navigate = useNavigate();

  const columns = useMemo<ColumnDef<KbBrowseRow>[]>(
    () => [
      {
        id: "category",
        header: t("kb.columns.category"),
        size: 160,
        cell: (info) => (
          <span className="sdm-kb-cell-category">{info.row.original.categoryName ?? "—"}</span>
        ),
      },
      {
        id: "title",
        header: t("kb.columns.title"),
        accessorKey: "title",
        size: 360,
        cell: (info) => (
          <span className="sdm-kb-cell-title" title={info.row.original.title}>
            {info.row.original.title}
          </span>
        ),
      },
      {
        id: "helpfulnessRatio",
        header: t("kb.columns.helpfulnessRatio"),
        size: 140,
        cell: (info) => (
          <span
            className="sdm-kb-cell-ratio"
            data-testid="kb-row-ratio"
            data-ratio={info.row.original.helpfulnessRatio ?? ""}
          >
            {formatRatio(info.row.original.helpfulnessRatio, i18n.language)}
          </span>
        ),
      },
      {
        id: "viewCount",
        header: t("kb.columns.viewCount"),
        size: 100,
        cell: (info) => (
          <span className="sdm-kb-cell-views">
            {new Intl.NumberFormat(i18n.language).format(info.row.original.viewCount)}
          </span>
        ),
      },
      {
        id: "lastUpdated",
        header: t("kb.columns.lastUpdated"),
        size: 140,
        cell: (info) => (
          <span className="sdm-kb-cell-updated">
            {formatDate(info.row.original.lastModifiedAt, i18n.language)}
          </span>
        ),
      },
    ],
    [t, i18n.language],
  );

  const table = useReactTable<KbBrowseRow>({
    data: rows as KbBrowseRow[],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
  });

  const open = (id: string) => navigate(`/kb/article/${encodeURIComponent(id)}`);

  return (
    <table
      className="sdm-kb-table"
      data-testid="kb-table"
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
            data-testid="kb-row"
            tabIndex={0}
            className="sdm-kb-row"
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
