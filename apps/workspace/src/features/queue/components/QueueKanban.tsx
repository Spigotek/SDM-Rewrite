import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { useTranslation } from "@sdm/i18n";
import {
  Avatar,
  CA_SDM_TRANSITIONS,
  EmptyState,
  IllustrationNoTicketsAssigned,
  PriorityBadge,
  staggerListRows,
  type Severity,
  type TicketStatus,
} from "@sdm/design-system";
import type { UiQueueItem, UiTicketType } from "@sdm/api-types";
import { caLogicalStatus, transitionsForType } from "../hooks";

/**
 * Linear-style Kanban board for the workspace queue (M.1.B / v1.4.0).
 *
 * The board collapses the CA SDM lifecycle into four buckets so the agent can
 * scan workload at a glance. Drag-to-transition rides on top of v1.3's
 * `useQueueStatusTransition` mutation — the parent passes the same handler
 * that powers inline status changes in `QueueTable`, so the audit chain
 * (`data.<scope>.write` with `details.op="status.transition"`) stays identical.
 *
 * Native HTML5 drag-and-drop is used deliberately. `react-dnd` would more than
 * triple the lazy-chunk size for one screen of interaction, and the v1.4 brief
 * forbids new package deps.
 */

const PRIORITY_MAP: Record<string, Severity> = {
  "1": "critical",
  "2": "high",
  "3": "medium",
  "4": "low",
  "5": "low",
};

type ColumnId = "open" | "inProgress" | "waiting" | "resolved";

interface ColumnDef {
  readonly id: ColumnId;
  /** Logical statuses (DS `TicketStatus`) that route to this column. */
  readonly statuses: ReadonlyArray<TicketStatus>;
  /**
   * Canonical target status when a card is dropped on this column. Matches
   * the first allowed value the source row can transition to. The drop
   * handler walks `statuses` in order and picks the first that the row's
   * current status can transition into.
   */
  readonly dropTargets: ReadonlyArray<TicketStatus>;
}

const COLUMNS: ReadonlyArray<ColumnDef> = [
  {
    id: "open",
    statuses: ["new", "open", "reopened"],
    dropTargets: ["open", "reopened", "new"],
  },
  {
    id: "inProgress",
    statuses: ["in_progress"],
    dropTargets: ["in_progress"],
  },
  {
    id: "waiting",
    statuses: ["hold", "waiting_customer", "waiting_vendor", "pending"],
    dropTargets: ["hold", "waiting_customer", "waiting_vendor", "pending"],
  },
  {
    id: "resolved",
    statuses: ["resolved", "closed"],
    dropTargets: ["resolved", "closed"],
  },
];

const DRAG_MIME = "application/x-sdm-queue-card";

interface DragPayload {
  readonly id: string;
  readonly type: UiTicketType;
  readonly currentStatus: TicketStatus;
}

function mapRowStatus(row: UiQueueItem): TicketStatus {
  return caLogicalStatus(row.status?.code ?? "");
}

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

/**
 * Resolve which `TicketStatus` a drop on `column` should set, given the
 * source row's current status. Walks the column's `dropTargets` in order and
 * returns the first one allowed by `CA_SDM_TRANSITIONS` AND by the row's
 * ticket type. Returns `null` when no target is reachable — the parent then
 * silently rejects the drop.
 */
function resolveDropTarget(
  column: ColumnDef,
  currentStatus: TicketStatus,
  type: UiTicketType,
): TicketStatus | null {
  const allowed = CA_SDM_TRANSITIONS[currentStatus] ?? [];
  const typeAllowed = transitionsForType(type, allowed);
  for (const candidate of column.dropTargets) {
    if (typeAllowed.includes(candidate)) return candidate;
  }
  return null;
}

export interface QueueKanbanProps {
  readonly rows: ReadonlyArray<UiQueueItem>;
  readonly onStatusTransition: (input: {
    readonly id: string;
    readonly type: UiTicketType;
    readonly next: TicketStatus;
  }) => void | Promise<void>;
  /** Pushed when a drop targets a transition that's not in the allowed set. */
  readonly onTransitionForbidden?: () => void;
  readonly statusTransitionPending?: boolean;
}

export function QueueKanban(props: QueueKanbanProps) {
  const {
    rows,
    onStatusTransition,
    onTransitionForbidden,
    statusTransitionPending = false,
  } = props;
  const { t } = useTranslation("workspace");
  const navigate = useNavigate();

  const grouped = useMemo(() => {
    const buckets: Record<ColumnId, UiQueueItem[]> = {
      open: [],
      inProgress: [],
      waiting: [],
      resolved: [],
    };
    for (const row of rows) {
      const mapped = mapRowStatus(row);
      const column = COLUMNS.find((c) => c.statuses.includes(mapped));
      if (column) buckets[column.id].push(row);
    }
    return buckets;
  }, [rows]);

  return (
    <div
      className="sdm-queue-kanban"
      data-testid="queue-kanban"
      aria-label={t("queue.kanban.dragHint")}
    >
      {COLUMNS.map((column) => (
        <KanbanColumn
          key={column.id}
          column={column}
          rows={grouped[column.id]}
          onCardActivate={(id) => navigate(`/tickets/${id}`)}
          onStatusTransition={onStatusTransition}
          onTransitionForbidden={onTransitionForbidden}
          statusTransitionPending={statusTransitionPending}
          label={t(`queue.kanban.columns.${column.id}`)}
          emptyLabel={t("queue.kanban.empty")}
        />
      ))}
    </div>
  );
}

interface KanbanColumnProps {
  readonly column: ColumnDef;
  readonly rows: ReadonlyArray<UiQueueItem>;
  readonly label: string;
  readonly emptyLabel: string;
  readonly onCardActivate: (id: string) => void;
  readonly onStatusTransition: QueueKanbanProps["onStatusTransition"];
  readonly onTransitionForbidden: QueueKanbanProps["onTransitionForbidden"];
  readonly statusTransitionPending: boolean;
}

function KanbanColumn(props: KanbanColumnProps) {
  const {
    column,
    rows,
    label,
    emptyLabel,
    onCardActivate,
    onStatusTransition,
    onTransitionForbidden,
    statusTransitionPending,
  } = props;

  const [dragOver, setDragOver] = useState(false);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  // Re-run the stagger animation when the rows in this column change.
  useEffect(() => {
    staggerListRows(bodyRef.current);
  }, [rows.length]);

  const onDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      if (statusTransitionPending) return;
      if (!e.dataTransfer.types.includes(DRAG_MIME)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (!dragOver) setDragOver(true);
    },
    [dragOver, statusTransitionPending],
  );

  const onDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    // Only clear when the cursor leaves the column wrapper itself, not when
    // it crosses into a descendant card.
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setDragOver(false);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOver(false);
      const raw = e.dataTransfer.getData(DRAG_MIME);
      if (!raw) return;
      let payload: DragPayload;
      try {
        payload = JSON.parse(raw) as DragPayload;
      } catch {
        return;
      }
      // Same column → drop is a no-op; avoid a useless mutation round-trip.
      if (column.statuses.includes(payload.currentStatus)) return;
      const target = resolveDropTarget(column, payload.currentStatus, payload.type);
      if (!target) {
        onTransitionForbidden?.();
        return;
      }
      void onStatusTransition({ id: payload.id, type: payload.type, next: target });
    },
    [column, onStatusTransition, onTransitionForbidden],
  );

  return (
    <div
      className={`sdm-queue-kanban-column${dragOver ? " sdm-queue-kanban-column--dragover" : ""}`}
      data-testid={`queue-kanban-column-${column.id}`}
      data-column={column.id}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <header className="sdm-queue-kanban-column-header">
        <span className="sdm-queue-kanban-column-label">{label}</span>
        <span
          className="sdm-queue-kanban-column-count"
          data-testid={`queue-kanban-count-${column.id}`}
        >
          {rows.length}
        </span>
        <button
          type="button"
          className="sdm-queue-kanban-column-add"
          aria-label={label}
          onClick={() => {
            // v1.4 placeholder — "create in this status" composer lands later.
            console.info("[queue] Kanban create-in-column placeholder", column.id);
          }}
        >
          <Plus size={14} aria-hidden="true" />
        </button>
      </header>
      <div className="sdm-queue-kanban-column-body" ref={bodyRef}>
        {rows.length === 0 ? (
          <EmptyState
            variant="compact"
            illustration={<IllustrationNoTicketsAssigned />}
            title={emptyLabel}
            className="sdm-queue-kanban-empty"
          />
        ) : (
          rows.map((row) => (
            <KanbanCard key={row.id} row={row} onActivate={() => onCardActivate(row.id)} />
          ))
        )}
      </div>
    </div>
  );
}

interface KanbanCardProps {
  readonly row: UiQueueItem;
  readonly onActivate: () => void;
}

function KanbanCard(props: KanbanCardProps) {
  const { row, onActivate } = props;

  const priorityCode = row.priority?.code ?? "";
  const severity = PRIORITY_MAP[priorityCode] ?? "none";
  const customerLabel = row.customer?.label ?? "—";

  const onDragStart = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      const payload: DragPayload = {
        id: row.id,
        type: row.ticketType,
        currentStatus: mapRowStatus(row),
      };
      e.dataTransfer.setData(DRAG_MIME, JSON.stringify(payload));
      e.dataTransfer.effectAllowed = "move";
    },
    [row],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onActivate();
      }
    },
    [onActivate],
  );

  return (
    <div
      className="sdm-queue-kanban-card"
      data-component="card"
      data-variant="interactive"
      data-row
      data-testid="queue-kanban-card"
      data-row-id={row.id}
      role="button"
      tabIndex={0}
      draggable
      onClick={onActivate}
      onKeyDown={onKeyDown}
      onDragStart={onDragStart}
    >
      <div className="sdm-queue-kanban-card-top">
        <span className="sdm-queue-kanban-card-ref">#{row.ref}</span>
        <PriorityBadge severity={severity} label={row.priority?.label ?? "—"} />
      </div>
      <div className="sdm-queue-kanban-card-summary" title={row.summary}>
        {row.summary}
      </div>
      <div className="sdm-queue-kanban-card-footer">
        <Avatar name={customerLabel} size="xs" />
        <span className="sdm-queue-kanban-card-age">{relativeAge(row.openedAt)}</span>
      </div>
    </div>
  );
}

export default QueueKanban;
