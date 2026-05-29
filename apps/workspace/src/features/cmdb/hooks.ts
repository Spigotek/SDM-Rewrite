import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { CiClass, CiStatus } from "@sdm/domain";
import { CMDB_CI_TABS, type AttributeGroupKey, type CmdbCiTabKey } from "./types";

const URL_KEY_TAB = "tab";
const URL_KEY_SEARCH = "q";
const URL_KEY_CLASS = "class";
const URL_KEY_STATUS = "status";

function parseTab(raw: string | null): CmdbCiTabKey {
  if (raw && (CMDB_CI_TABS as ReadonlyArray<string>).includes(raw)) {
    return raw as CmdbCiTabKey;
  }
  return "detail";
}

/**
 * Active CI-detail tab persisted in the URL (`?tab=attributes`). Same contract
 * as `useChangeTab` so deep links from history badges, audit log entries, and
 * Marek's impact-analysis links land on the right tab.
 */
export interface UseCmdbCiTabResult {
  readonly tab: CmdbCiTabKey;
  readonly setTab: (next: CmdbCiTabKey) => void;
}

export function useCmdbCiTab(): UseCmdbCiTabResult {
  const [params, setParams] = useSearchParams();
  const tab = useMemo(() => parseTab(params.get(URL_KEY_TAB)), [params]);

  const setTab = useCallback(
    (next: CmdbCiTabKey) => {
      setParams(
        (prev) => {
          const out = new URLSearchParams(prev);
          if (next === "detail") {
            out.delete(URL_KEY_TAB);
          } else {
            out.set(URL_KEY_TAB, next);
          }
          return out;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  return { tab, setTab };
}

/**
 * URL-driven list filters — search box (free text), class chip (single-pick),
 * status chip (single-pick). Persisting filters in the URL is the same pattern
 * H.12 problems uses; deep links survive a refresh and copy-share workflows.
 */
export interface CmdbFilters {
  readonly search: string;
  readonly ciClass: CiClass | null;
  readonly status: CiStatus | null;
}

export interface UseCmdbFiltersResult {
  readonly filters: CmdbFilters;
  readonly setSearch: (value: string) => void;
  readonly setClass: (value: CiClass | null) => void;
  readonly setStatus: (value: CiStatus | null) => void;
  readonly reset: () => void;
}

export function useCmdbFilters(): UseCmdbFiltersResult {
  const [params, setParams] = useSearchParams();

  const filters = useMemo<CmdbFilters>(
    () => ({
      search: params.get(URL_KEY_SEARCH) ?? "",
      ciClass: (params.get(URL_KEY_CLASS) as CiClass | null) ?? null,
      status: (params.get(URL_KEY_STATUS) as CiStatus | null) ?? null,
    }),
    [params],
  );

  const updateParam = useCallback(
    (key: string, value: string | null) => {
      setParams(
        (prev) => {
          const out = new URLSearchParams(prev);
          if (value === null || value === "") out.delete(key);
          else out.set(key, value);
          return out;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  return {
    filters,
    setSearch: useCallback((v: string) => updateParam(URL_KEY_SEARCH, v), [updateParam]),
    setClass: useCallback((v: CiClass | null) => updateParam(URL_KEY_CLASS, v), [updateParam]),
    setStatus: useCallback((v: CiStatus | null) => updateParam(URL_KEY_STATUS, v), [updateParam]),
    reset: useCallback(() => {
      setParams(
        (prev) => {
          const out = new URLSearchParams(prev);
          out.delete(URL_KEY_SEARCH);
          out.delete(URL_KEY_CLASS);
          out.delete(URL_KEY_STATUS);
          return out;
        },
        { replace: true },
      );
    }, [setParams]),
  };
}

/**
 * Per-user collapse state for an attribute group. Persisted in localStorage as
 * `cmdbCiCollapse:{ciClass}.{group}` so Robert keeps Custom collapsed by
 * default while Marek (who lives in network details) keeps Network open. The
 * key intentionally scopes per CI class so the same group label ("Network")
 * can have different defaults across `NetworkServer` and `Router`.
 *
 * Falls back to the provided default when:
 *  - localStorage is unavailable (SSR / hardened browsers).
 *  - The stored value is malformed.
 *
 * The setter writes through to localStorage so the next visit reads the same
 * state without a round-trip; failures are swallowed (privacy mode, quota).
 */
const STORAGE_PREFIX = "cmdbCiCollapse";

function storageKey(ciClass: string, group: AttributeGroupKey): string {
  return `${STORAGE_PREFIX}:${ciClass}.${group}`;
}

function readCollapsed(ciClass: string, group: AttributeGroupKey, fallback: boolean): boolean {
  try {
    const raw = window.localStorage.getItem(storageKey(ciClass, group));
    if (raw === "true") return true;
    if (raw === "false") return false;
    return fallback;
  } catch {
    return fallback;
  }
}

function writeCollapsed(ciClass: string, group: AttributeGroupKey, value: boolean): void {
  try {
    window.localStorage.setItem(storageKey(ciClass, group), value ? "true" : "false");
  } catch {
    /* quota / private mode — best-effort */
  }
}

export interface UseCollapseResult {
  readonly collapsed: boolean;
  readonly toggle: () => void;
}

export function useAttributeGroupCollapse(
  ciClass: string,
  group: AttributeGroupKey,
  defaultCollapsed: boolean,
): UseCollapseResult {
  const [collapsed, setCollapsed] = useState<boolean>(() =>
    readCollapsed(ciClass, group, defaultCollapsed),
  );

  // Re-read whenever the CI changes class (drill-in to a different CI within
  // the same SPA session). Without this, the stored value for the *new* class
  // wouldn't take effect until a page refresh.
  useEffect(() => {
    setCollapsed(readCollapsed(ciClass, group, defaultCollapsed));
  }, [ciClass, group, defaultCollapsed]);

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      writeCollapsed(ciClass, group, next);
      return next;
    });
  }, [ciClass, group]);

  return { collapsed, toggle };
}
