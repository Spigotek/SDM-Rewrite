import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "react-router-dom";
import { useHotkeys } from "react-hotkeys-hook";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { UiQueuePage, UiQueueItem, UiTicketDetail, UiTicketType } from "@sdm/api-types";
import type { TicketStatus } from "@sdm/design-system";
import {
  readColumnConfigFromStorage,
  readSavedViewsFromStorage,
  subscribeSavedViews,
  writeColumnConfigToStorage,
  writeSavedViewsToStorage,
} from "./api";
import { patchTicket } from "../tickets/api";
import { ticketDetailQueryKey } from "../tickets/api";
import {
  DEFAULT_COLUMN_CONFIG,
  type QueueColumnConfig,
  type QueueColumnKey,
  type QueueFilters,
  type SavedView,
} from "./types";

/**
 * URL ↔ filter state. The URL is the source of truth so deep-links share the
 * exact view a user is looking at (per `01-queue.md §Filtre`). Multi-value
 * params encode as comma-separated tokens.
 */
const URL_KEY_STATUS = "status";
const URL_KEY_PRIORITY = "priority";
const URL_KEY_ASSIGNEE = "assignee";
const URL_KEY_TYPE = "type";
const URL_KEY_CUSTOMER = "customer";
const URL_KEY_SEARCH = "q";
const URL_KEY_SELECTED = "selected";

const TICKET_TYPES: ReadonlyArray<UiTicketType> = ["incident", "request", "problem", "change"];

function parseList(value: string | null): ReadonlyArray<string> {
  if (!value) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseTicketTypes(value: string | null): ReadonlyArray<UiTicketType> {
  return parseList(value).filter((t): t is UiTicketType =>
    (TICKET_TYPES as ReadonlyArray<string>).includes(t),
  );
}

function filtersFromParams(params: URLSearchParams): QueueFilters {
  return {
    status: parseList(params.get(URL_KEY_STATUS)),
    priority: parseList(params.get(URL_KEY_PRIORITY)),
    assignee: parseList(params.get(URL_KEY_ASSIGNEE)),
    ticketType: parseTicketTypes(params.get(URL_KEY_TYPE)),
    customer: parseList(params.get(URL_KEY_CUSTOMER)),
    search: params.get(URL_KEY_SEARCH) ?? "",
  };
}

function writeFiltersToParams(params: URLSearchParams, filters: QueueFilters): URLSearchParams {
  const next = new URLSearchParams(params);
  setOrDelete(next, URL_KEY_STATUS, filters.status.join(","));
  setOrDelete(next, URL_KEY_PRIORITY, filters.priority.join(","));
  setOrDelete(next, URL_KEY_ASSIGNEE, filters.assignee.join(","));
  setOrDelete(next, URL_KEY_TYPE, filters.ticketType.join(","));
  setOrDelete(next, URL_KEY_CUSTOMER, filters.customer.join(","));
  setOrDelete(next, URL_KEY_SEARCH, filters.search);
  return next;
}

function setOrDelete(params: URLSearchParams, key: string, value: string): void {
  if (value && value.length > 0) {
    params.set(key, value);
  } else {
    params.delete(key);
  }
}

export interface UseQueueFiltersResult {
  readonly filters: QueueFilters;
  readonly setFilters: (next: QueueFilters) => void;
  readonly toggleFilterValue: (axis: keyof Omit<QueueFilters, "search">, value: string) => void;
  readonly setSearch: (value: string) => void;
  readonly resetFilters: () => void;
  readonly selectedId: string | null;
  readonly setSelectedId: (id: string | null) => void;
}

export function useQueueFilters(): UseQueueFiltersResult {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => filtersFromParams(searchParams), [searchParams]);
  const selectedId = searchParams.get(URL_KEY_SELECTED);

  const setFilters = useCallback(
    (next: QueueFilters) => {
      setSearchParams((prev) => writeFiltersToParams(prev, next), { replace: true });
    },
    [setSearchParams],
  );

  const toggleFilterValue = useCallback(
    (axis: keyof Omit<QueueFilters, "search">, value: string) => {
      setSearchParams(
        (prev) => {
          const current = filtersFromParams(prev);
          const list = current[axis] as ReadonlyArray<string>;
          const has = list.includes(value);
          const nextList = has ? list.filter((v) => v !== value) : [...list, value];
          return writeFiltersToParams(prev, {
            ...current,
            [axis]: nextList,
          } as QueueFilters);
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const setSearch = useCallback(
    (value: string) => {
      setSearchParams(
        (prev) => {
          const current = filtersFromParams(prev);
          return writeFiltersToParams(prev, { ...current, search: value });
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const resetFilters = useCallback(() => {
    setSearchParams(
      (prev) => {
        // Preserve `selected` so the open right pane survives a filter reset.
        const next = new URLSearchParams();
        const sel = prev.get(URL_KEY_SELECTED);
        if (sel) next.set(URL_KEY_SELECTED, sel);
        return next;
      },
      { replace: true },
    );
  }, [setSearchParams]);

  const setSelectedId = useCallback(
    (id: string | null) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (id) {
            next.set(URL_KEY_SELECTED, id);
          } else {
            next.delete(URL_KEY_SELECTED);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  return {
    filters,
    setFilters,
    toggleFilterValue,
    setSearch,
    resetFilters,
    selectedId,
    setSelectedId,
  };
}

// ─── Saved views (useSyncExternalStore) ──────────────────────────────────────

export interface UseSavedViewsResult {
  readonly views: ReadonlyArray<SavedView>;
  readonly saveView: (name: string, filters: QueueFilters) => SavedView;
  readonly deleteView: (id: string) => void;
}

export function useSavedViews(): UseSavedViewsResult {
  const views = useSyncExternalStore(
    subscribeSavedViews,
    readSavedViewsFromStorage,
    () => [] as ReadonlyArray<SavedView>,
  );

  const saveView = useCallback((name: string, filters: QueueFilters): SavedView => {
    const view: SavedView = {
      id: `view-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      name,
      filters,
    };
    const current = readSavedViewsFromStorage();
    writeSavedViewsToStorage([...current, view]);
    return view;
  }, []);

  const deleteView = useCallback((id: string) => {
    const current = readSavedViewsFromStorage();
    writeSavedViewsToStorage(current.filter((v) => v.id !== id));
  }, []);

  return { views, saveView, deleteView };
}

// ─── Column config ───────────────────────────────────────────────────────────

const ALL_COLUMN_KEYS: ReadonlyArray<QueueColumnKey> = [
  "ref",
  "ticketType",
  "status",
  "priority",
  "summary",
  "customer",
  "assignee",
  "age",
];

export interface UseColumnConfigResult {
  readonly config: QueueColumnConfig;
  readonly toggleColumn: (key: QueueColumnKey) => void;
  readonly resetColumns: () => void;
  readonly allColumns: ReadonlyArray<QueueColumnKey>;
}

export function useColumnConfig(): UseColumnConfigResult {
  const [visible, setVisible] = useState<ReadonlyArray<QueueColumnKey>>(() => {
    const stored = readColumnConfigFromStorage();
    if (!stored) return DEFAULT_COLUMN_CONFIG.visible;
    const filtered = stored.filter((k): k is QueueColumnKey =>
      (ALL_COLUMN_KEYS as ReadonlyArray<string>).includes(k),
    );
    return filtered.length > 0 ? filtered : DEFAULT_COLUMN_CONFIG.visible;
  });

  const toggleColumn = useCallback((key: QueueColumnKey) => {
    setVisible((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      writeColumnConfigToStorage(next);
      return next;
    });
  }, []);

  const resetColumns = useCallback(() => {
    setVisible(DEFAULT_COLUMN_CONFIG.visible);
    writeColumnConfigToStorage(DEFAULT_COLUMN_CONFIG.visible);
  }, []);

  const config = useMemo<QueueColumnConfig>(() => ({ visible }), [visible]);
  return { config, toggleColumn, resetColumns, allColumns: ALL_COLUMN_KEYS };
}

// ─── Keyboard navigation ─────────────────────────────────────────────────────

export interface UseQueueKeyboardNavOptions<T> {
  readonly rows: ReadonlyArray<T>;
  readonly getRowId: (row: T) => string;
  readonly selectedId: string | null;
  readonly onSelect: (id: string | null) => void;
  readonly onActivate: (id: string) => void;
  readonly enabled?: boolean;
}

/**
 * `j`/`↓` next, `k`/`↑` previous, `Enter` activate, `Esc` clear. Wraps around
 * the row list. When nothing is selected, `j`/`↓` selects the first row,
 * `k`/`↑` selects the last.
 */
export function useQueueKeyboardNav<T>(opts: UseQueueKeyboardNavOptions<T>): void {
  const { rows, getRowId, selectedId, onSelect, onActivate, enabled = true } = opts;
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  const move = useCallback(
    (delta: 1 | -1) => {
      const currentRows = rowsRef.current;
      if (currentRows.length === 0) return;
      const ids = currentRows.map(getRowId);
      const currentIdx = selectedId ? ids.indexOf(selectedId) : -1;
      let nextIdx: number;
      if (currentIdx === -1) {
        nextIdx = delta === 1 ? 0 : ids.length - 1;
      } else {
        nextIdx = (currentIdx + delta + ids.length) % ids.length;
      }
      const nextId = ids[nextIdx];
      if (nextId) onSelect(nextId);
    },
    [getRowId, onSelect, selectedId],
  );

  useHotkeys(
    "j,down",
    (e) => {
      e.preventDefault();
      move(1);
    },
    { enabled, enableOnFormTags: false },
  );

  useHotkeys(
    "k,up",
    (e) => {
      e.preventDefault();
      move(-1);
    },
    { enabled, enableOnFormTags: false },
  );

  useHotkeys(
    "enter",
    (e) => {
      if (!selectedId) return;
      e.preventDefault();
      onActivate(selectedId);
    },
    { enabled, enableOnFormTags: false },
  );

  useHotkeys(
    "escape",
    (e) => {
      if (!selectedId) return;
      e.preventDefault();
      onSelect(null);
    },
    { enabled, enableOnFormTags: false },
  );
}

// ─── L.1.C — inline status transitions on queue rows ─────────────────────────

/**
 * Reverse map: design-system `TicketStatus` → CA SDM code per `UiTicketType`.
 * Each entity uses its own status code vocabulary; the same logical state may
 * be different codes on `in` vs `cr` vs `pr` vs `chg`. When a target status
 * has no matching code for the row's type we drop the transition silently
 * (the badge omits it from the menu via `allowedTransitions`).
 *
 * Codes mirror `AgentTicketHeader.INCIDENT_STATUSES` / `REQUEST_STATUSES` /
 * `PROBLEM_STATUSES` / `CHANGE_STATUSES`.
 */
const TYPE_REVERSE_STATUS: Record<UiTicketType, Partial<Record<TicketStatus, string>>> = {
  incident: {
    open: "OP",
    in_progress: "WIP",
    hold: "HLD",
    waiting_customer: "AWU",
    waiting_vendor: "AWV",
    resolved: "RES",
    closed: "CL",
    cancelled: "CD",
  },
  request: {
    new: "SUBMITTED",
    open: "APPROVED",
    in_progress: "IN_PROGRESS",
    waiting_customer: "AWU",
    pending: "APPR_PENDING",
    resolved: "DELIVERED",
    closed: "CL",
    cancelled: "CD",
    rejected: "REJECTED",
  },
  problem: {
    new: "IDENTIFIED",
    open: "KNOWN_ERROR",
    in_progress: "INVESTIGATION",
    resolved: "RESOLVED",
    closed: "CL",
  },
  change: {
    new: "RFC",
    open: "APPROVED",
    pending: "APPR_PENDING",
    scheduled: "SCHEDULED",
    in_progress: "IN_PROGRESS",
    resolved: "VERIFIED",
    closed: "CL",
    cancelled: "CD",
    rejected: "REJECTED",
  },
};

/**
 * Build the `allowedTransitions` list for a queue row's badge by intersecting
 * the documented CA SDM lifecycle map (in the DS) with the codes this ticket
 * type actually understands. Returns the `TicketStatus[]` the badge accepts
 * via its `allowedTransitions` prop.
 */
export function transitionsForType(
  type: UiTicketType,
  candidates: ReadonlyArray<TicketStatus>,
): ReadonlyArray<TicketStatus> {
  const supported = TYPE_REVERSE_STATUS[type];
  return candidates.filter((s) => supported[s] !== undefined);
}

export function caSdmCodeForType(type: UiTicketType, status: TicketStatus): string | null {
  return TYPE_REVERSE_STATUS[type][status] ?? null;
}

/**
 * Forward map: CA SDM `status.code` → canonical `TicketStatus` (logical state).
 * Derived from `TYPE_REVERSE_STATUS` plus a small supplement for codes the
 * BFF emits but transitions don't reach (`NEW`, `ROOT_CAUSE_KNOWN`,
 * `KNOWN_ERROR`, `IDENTIFIED` on problems, etc.). The queue uses this to
 * resolve URL filters that come in as logical names (left-rail "Triáž" →
 * `?status=new`) against the CA SDM codes carried by `r.status.code`.
 *
 * The map is intentionally many-to-one: `OP` exists on incidents + changes
 * with the same logical meaning (`open`), `APPROVED` on requests + changes
 * also maps to `open`. Conflicts resolve to the first definition encountered.
 */
const CA_CODE_TO_LOGICAL: Record<string, TicketStatus> = (() => {
  const out: Record<string, TicketStatus> = {};
  for (const type of Object.keys(TYPE_REVERSE_STATUS) as ReadonlyArray<UiTicketType>) {
    const reverse = TYPE_REVERSE_STATUS[type];
    for (const [logical, code] of Object.entries(reverse) as ReadonlyArray<
      [TicketStatus, string]
    >) {
      if (!(code in out)) out[code] = logical;
    }
  }
  // Supplement: codes that exist in BFF row data but aren't transition targets
  // (so they never appear in `TYPE_REVERSE_STATUS`). Keep in sync with the
  // `STATUS_MAP` in `QueueTable.tsx` so the table badge and the rail filter
  // agree on what each row's logical status is.
  const SUPPLEMENT: Record<string, TicketStatus> = {
    NEW: "new",
    ROOT_CAUSE_KNOWN: "in_progress",
    KNOWN_ERROR: "in_progress",
    INVESTIGATION: "in_progress",
    IDENTIFIED: "new",
    ESC: "in_progress",
    RFC: "new",
    EMG_RFC: "new",
    EMG_IN_PROGRESS: "in_progress",
    EMG_RETROSPECTIVE: "in_progress",
    VERIFICATION_IN_PROGRESS: "in_progress",
    VERIFIED: "resolved",
  };
  for (const [code, logical] of Object.entries(SUPPLEMENT) as ReadonlyArray<
    [string, TicketStatus]
  >) {
    if (!(code in out)) out[code] = logical;
  }
  return out;
})();

/**
 * Returns true when the row's status matches any value in the active filter
 * list. The filter list may contain raw CA SDM codes (chip toggles in the
 * `FilterBar` use codes verbatim) or logical status names (left-rail items
 * use `new`/`in_progress`/...). Both are supported so the two affordances
 * compose without translation at the caller.
 */
export function statusMatchesFilter(
  rowCode: string | null | undefined,
  filterValues: ReadonlyArray<string>,
): boolean {
  if (filterValues.length === 0) return true;
  if (!rowCode) return false;
  if (filterValues.includes(rowCode)) return true;
  const logical = CA_CODE_TO_LOGICAL[rowCode];
  return logical !== undefined && (filterValues as ReadonlyArray<string>).includes(logical);
}

/**
 * Resolve a CA SDM `status.code` to its canonical `TicketStatus`. This is the
 * single source of truth shared by the filter (`statusMatchesFilter`) and the
 * queue table badge (`QueueTable`). Keeping both on this one map prevents the
 * M.2.A desync where the table rendered a row's badge under a different logical
 * status than the one the filter matched it on (e.g. `AWU` filtered as
 * `waiting_customer` but badged as `pending`, or `RESOLVED` filtered as
 * `resolved` but badged as the `"open"` fallback). Falls back to `"open"` for
 * codes outside the known vocabulary so the badge always renders.
 */
export function caLogicalStatus(rowCode: string | null | undefined): TicketStatus {
  if (!rowCode) return "open";
  return CA_CODE_TO_LOGICAL[rowCode] ?? "open";
}

export interface UseQueueStatusTransitionOptions {
  readonly tenantId: string;
  readonly onSuccess?: (label: string) => void;
  readonly onError?: (message: string) => void;
  readonly onUnsupported?: () => void;
}

/**
 * TanStack mutation factory for inline queue row status transitions.
 *
 * - Optimistic update on the queue list cache: swap the row's `status.code` /
 *   `status.label` immediately, roll back on failure.
 * - Reuses the existing `patchTicket` plumbing (PATCH /api/tickets/:type/:id)
 *   so the audit chain stays under `data.<scope>.write` with
 *   `details.op="status.transition"` server-side.
 * - When the backend rejects with a not-supported signal we surface the
 *   localised "Funkcia príde s v1.4" toast via the caller-supplied
 *   `onUnsupported` callback.
 */
export function useQueueStatusTransition(opts: UseQueueStatusTransitionOptions): {
  readonly transition: (input: {
    readonly id: string;
    readonly type: UiTicketType;
    readonly next: TicketStatus;
  }) => Promise<void>;
  readonly isPending: boolean;
} {
  const qc = useQueryClient();
  const queueKey = useMemo(() => ["queue", opts.tenantId] as const, [opts.tenantId]);

  const mutation = useMutation({
    mutationFn: async (input: {
      readonly id: string;
      readonly type: UiTicketType;
      readonly next: TicketStatus;
    }): Promise<UiTicketDetail> => {
      const code = caSdmCodeForType(input.type, input.next);
      if (!code) {
        // FE knows the BFF can't honour this transition for this type yet.
        const err = new Error("UNSUPPORTED_TRANSITION");
        (err as Error & { code?: string }).code = "UNSUPPORTED";
        throw err;
      }
      return patchTicket(input.type, input.id, { status: code });
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: queueKey });
      const previous = qc.getQueryData<UiQueuePage>(queueKey);
      if (previous) {
        const optimistic: UiQueuePage = {
          ...previous,
          data: previous.data.map((row): UiQueueItem => {
            if (row.id !== input.id) return row;
            const code = caSdmCodeForType(input.type, input.next);
            if (!code) return row;
            return {
              ...row,
              status: {
                id: row.status?.id ?? code,
                code,
                label: row.status?.label ?? code,
              },
            };
          }),
        };
        qc.setQueryData(queueKey, optimistic);
      }
      return { previous };
    },
    onError: (err, _input, ctx) => {
      const snapshot = (ctx as { previous?: UiQueuePage } | undefined)?.previous;
      if (snapshot) qc.setQueryData(queueKey, snapshot);
      if ((err as Error & { code?: string }).code === "UNSUPPORTED") {
        opts.onUnsupported?.();
        return;
      }
      opts.onError?.(err instanceof Error ? err.message : String(err));
    },
    onSuccess: (data, input) => {
      // Mirror the authoritative server state into the queue cache + detail cache.
      qc.setQueryData<UiQueuePage>(queueKey, (current) => {
        if (!current) return current;
        return {
          ...current,
          data: current.data.map((row) =>
            row.id === input.id
              ? {
                  ...row,
                  status: data.status,
                }
              : row,
          ),
        };
      });
      qc.setQueryData(ticketDetailQueryKey(input.type, input.id), data);
      opts.onSuccess?.(data.status?.label ?? input.next);
    },
  });

  const transition = useCallback(
    async (input: {
      readonly id: string;
      readonly type: UiTicketType;
      readonly next: TicketStatus;
    }) => {
      await mutation.mutateAsync(input).catch(() => {
        /* error surfaces via onError */
      });
    },
    [mutation],
  );

  return { transition, isPending: mutation.isPending };
}

// ─── M.1.B — view-mode toggle (table vs kanban) ──────────────────────────────

export type QueueViewMode = "table" | "kanban";

const VIEW_MODE_STORAGE_KEY = "sdm.workspace.queue.view";

function readViewModeFromStorage(): QueueViewMode {
  if (typeof window === "undefined") return "table";
  try {
    const raw = window.localStorage.getItem(VIEW_MODE_STORAGE_KEY);
    return raw === "kanban" ? "kanban" : "table";
  } catch {
    return "table";
  }
}

function writeViewModeToStorage(mode: QueueViewMode): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
  } catch {
    /* swallow — quota / sandboxed iframe */
  }
}

export interface UseQueueViewModeResult {
  readonly mode: QueueViewMode;
  readonly setMode: (next: QueueViewMode) => void;
}

/**
 * Persists the user's table-vs-kanban choice in localStorage. The default is
 * `"table"` so existing users land on the dense list they already know.
 */
export function useQueueViewMode(): UseQueueViewModeResult {
  const [mode, setModeState] = useState<QueueViewMode>(readViewModeFromStorage);

  const setMode = useCallback((next: QueueViewMode) => {
    setModeState(next);
    writeViewModeToStorage(next);
  }, []);

  return { mode, setMode };
}

export { VIEW_MODE_STORAGE_KEY };

// ─── Page visibility (pollovanie tab-aktívne) ────────────────────────────────

/**
 * Tracks `document.visibilityState`. Not strictly needed for the queue (TanStack
 * Query's `refetchIntervalInBackground: false` default suffices), but exposed
 * for callers that want to render a "paused" badge while the tab is hidden.
 */
export function useDocumentVisible(): boolean {
  const [visible, setVisible] = useState(() =>
    typeof document === "undefined" ? true : document.visibilityState === "visible",
  );
  useEffect(() => {
    if (typeof document === "undefined") return;
    const onChange = () => setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);
  return visible;
}
