import type { UiQueuePage } from "@sdm/api-types";
import type { QueryClient } from "@tanstack/react-query";
import type { TenantId } from "@sdm/domain";
import type { SavedView } from "./types";

/**
 * Queue query — TanStack Query factory.
 *
 * - `queryKey` is `["queue", tenantId]`. Filters are NOT in the key because
 *   v0 filters client-side (MVP: max ~100 rows from F.3 fan-out buffer); a
 *   single fetch covers every filter permutation. Switching to server-side
 *   filtering will add the filter object as a third key segment.
 * - `refetchInterval: 30_000` — polls every 30 s when the tab is active.
 *   TanStack Query's default `refetchIntervalInBackground: false` pauses the
 *   poll when the document is hidden, matching `04 workspace.md §W-01`.
 * - `staleTime` is shorter than the global default (5 min) so the keyboard
 *   focus/refocus dance doesn't flash stale data.
 */
const PAGE_SIZE = 100;

async function fetchQueue(): Promise<UiQueuePage> {
  const response = await fetch(`/api/queue?page=0&size=${PAGE_SIZE}`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`[queue] /api/queue HTTP ${response.status}`);
  }
  return (await response.json()) as UiQueuePage;
}

export function queueQuery(tenantId: TenantId) {
  return {
    queryKey: ["queue", tenantId] as const,
    queryFn: fetchQueue,
    refetchInterval: 30_000,
    staleTime: 15_000,
  };
}

export async function prefetchQueue(queryClient: QueryClient, tenantId: TenantId): Promise<void> {
  await queryClient.prefetchQuery(queueQuery(tenantId));
}

// ─── Saved views (localStorage) ──────────────────────────────────────────────

const SAVED_VIEWS_STORAGE_KEY = "sdm.workspace.queue.savedViews";
const SAVED_VIEWS_EVENT = "sdm:queue-saved-views-changed";

// Snapshot cache — `useSyncExternalStore` requires a stable reference
// between calls when the underlying data hasn't changed. Without the
// cache `parsed.filter(isSavedView)` returns a fresh array on every call,
// which makes React think the store mutated and triggers infinite
// re-renders (React production error #185 — surfaced in H.16 acceptance
// CI which was the first time the workspace ran in build mode).
const EMPTY_VIEWS: ReadonlyArray<SavedView> = [];
let cachedRaw: string | null = null;
let cachedViews: ReadonlyArray<SavedView> = EMPTY_VIEWS;

export function readSavedViewsFromStorage(): ReadonlyArray<SavedView> {
  if (typeof window === "undefined") return EMPTY_VIEWS;
  try {
    const raw = window.localStorage.getItem(SAVED_VIEWS_STORAGE_KEY);
    if (raw === cachedRaw) return cachedViews;
    cachedRaw = raw;
    if (!raw) {
      cachedViews = EMPTY_VIEWS;
      return cachedViews;
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      cachedViews = EMPTY_VIEWS;
      return cachedViews;
    }
    cachedViews = parsed.filter(isSavedView);
    return cachedViews;
  } catch {
    cachedViews = EMPTY_VIEWS;
    return cachedViews;
  }
}

export function writeSavedViewsToStorage(views: ReadonlyArray<SavedView>): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SAVED_VIEWS_STORAGE_KEY, JSON.stringify(views));
  // Invalidate the snapshot cache so the next read picks up the new value.
  cachedRaw = null;
  window.dispatchEvent(new CustomEvent(SAVED_VIEWS_EVENT));
}

export function subscribeSavedViews(listener: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const onStorage = (e: StorageEvent) => {
    if (e.key === SAVED_VIEWS_STORAGE_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(SAVED_VIEWS_EVENT, listener);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(SAVED_VIEWS_EVENT, listener);
  };
}

function isSavedView(value: unknown): value is SavedView {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v["id"] === "string" && typeof v["name"] === "string" && !!v["filters"];
}

export { SAVED_VIEWS_STORAGE_KEY };

// ─── Column config (localStorage) ────────────────────────────────────────────

const COLUMN_CONFIG_STORAGE_KEY = "sdm.workspace.queue.columns";

export function readColumnConfigFromStorage(): ReadonlyArray<string> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(COLUMN_CONFIG_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed.filter((s) => typeof s === "string") as string[]) : null;
  } catch {
    return null;
  }
}

export function writeColumnConfigToStorage(visible: ReadonlyArray<string>): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(COLUMN_CONFIG_STORAGE_KEY, JSON.stringify(visible));
}

export { COLUMN_CONFIG_STORAGE_KEY };
