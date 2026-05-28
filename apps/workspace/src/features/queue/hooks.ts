import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "react-router-dom";
import { useHotkeys } from "react-hotkeys-hook";
import type { UiTicketType } from "@sdm/api-types";
import {
  readColumnConfigFromStorage,
  readSavedViewsFromStorage,
  subscribeSavedViews,
  writeColumnConfigToStorage,
  writeSavedViewsToStorage,
} from "./api";
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
