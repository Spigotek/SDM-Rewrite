import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ChangeCategory, ChangeStatus, RiskLevel } from "@sdm/domain";
import {
  changeDetailQueryKey,
  patchChangeStatus,
  postApprove,
  postReject,
  postReminder,
  type ApprovePayload,
  type RejectPayload,
  type ReminderPayload,
} from "./api";
import type { ChangeRow } from "./types";
import { CHANGE_TABS, type ChangeTabKey, type ChangeDetail } from "./types";
import { EMPTY_CHANGES_FILTERS, type ChangesFiltersValue } from "./components/ChangesFiltersBar";

const URL_KEY_TAB = "tab";
const URL_KEY_STATUS = "status";
const URL_KEY_CATEGORY = "category";
const URL_KEY_RISK = "risk";

const CHANGE_STATUSES_SET: ReadonlySet<string> = new Set([
  "RFC",
  "APPR_PENDING",
  "APPROVED",
  "SCHEDULED",
  "IN_PROGRESS",
  "VERIFICATION_IN_PROGRESS",
  "VERIFIED",
  "REJECTED",
  "CL",
  "CD",
  "EMG_RFC",
  "EMG_IN_PROGRESS",
  "EMG_RETROSPECTIVE",
]);
const CHANGE_CATEGORIES_SET: ReadonlySet<string> = new Set(["STANDARD", "NORMAL", "EMERGENCY"]);
const RISK_LEVELS_SET: ReadonlySet<string> = new Set(["HIGH", "MEDIUM", "LOW"]);

function parseStatus(raw: string | null): ChangeStatus | null {
  return raw && CHANGE_STATUSES_SET.has(raw) ? (raw as ChangeStatus) : null;
}
function parseCategory(raw: string | null): ChangeCategory | null {
  return raw && CHANGE_CATEGORIES_SET.has(raw) ? (raw as ChangeCategory) : null;
}
function parseRisk(raw: string | null): RiskLevel | null {
  return raw && RISK_LEVELS_SET.has(raw) ? (raw as RiskLevel) : null;
}

export interface UseChangesFiltersResult {
  readonly filters: ChangesFiltersValue;
  readonly setStatus: (value: ChangeStatus | null) => void;
  readonly setCategory: (value: ChangeCategory | null) => void;
  readonly setRisk: (value: RiskLevel | null) => void;
  readonly reset: () => void;
}

/**
 * URL-driven filter state for `/changes`. Each axis is single-select.
 */
export function useChangesFilters(): UseChangesFiltersResult {
  const [params, setParams] = useSearchParams();

  const filters = useMemo<ChangesFiltersValue>(
    () => ({
      status: parseStatus(params.get(URL_KEY_STATUS)),
      category: parseCategory(params.get(URL_KEY_CATEGORY)),
      risk: parseRisk(params.get(URL_KEY_RISK)),
    }),
    [params],
  );

  const setParam = useCallback(
    (key: string, value: string | null) => {
      setParams(
        (prev) => {
          const out = new URLSearchParams(prev);
          if (value === null) {
            out.delete(key);
          } else {
            out.set(key, value);
          }
          return out;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  return {
    filters,
    setStatus: useCallback((v) => setParam(URL_KEY_STATUS, v), [setParam]),
    setCategory: useCallback((v) => setParam(URL_KEY_CATEGORY, v), [setParam]),
    setRisk: useCallback((v) => setParam(URL_KEY_RISK, v), [setParam]),
    reset: useCallback(() => {
      setParams(
        (prev) => {
          const out = new URLSearchParams(prev);
          out.delete(URL_KEY_STATUS);
          out.delete(URL_KEY_CATEGORY);
          out.delete(URL_KEY_RISK);
          return out;
        },
        { replace: true },
      );
    }, [setParams]),
  };
}

export { EMPTY_CHANGES_FILTERS };

function parseTab(raw: string | null): ChangeTabKey {
  if (raw && (CHANGE_TABS as ReadonlyArray<string>).includes(raw)) {
    return raw as ChangeTabKey;
  }
  return "detail";
}

/**
 * Active tab persisted in the URL (`?tab=impact`) — supports deep-link from
 * a notification ("Open change impact") and survives a page refresh. Default
 * is `detail` when the param is missing or invalid.
 */
export interface UseChangeTabResult {
  readonly tab: ChangeTabKey;
  readonly setTab: (next: ChangeTabKey) => void;
}

export function useChangeTab(): UseChangeTabResult {
  const [params, setParams] = useSearchParams();
  const tab = useMemo(() => parseTab(params.get(URL_KEY_TAB)), [params]);

  const setTab = useCallback(
    (next: ChangeTabKey) => {
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

// ── H.11 CAB approval mutations ─────────────────────────────────────────────

/**
 * Shared mutation factory: snapshot the change-detail cache, call the API,
 * `setQueryData` on success with the authoritative server response (mirrors
 * H.8 `useDetailMutation`). On error we restore the snapshot so the UI never
 * sticks in a half-applied state.
 */
function useChangeDetailMutation<TInput, TResult extends ChangeDetail | { ok: true }>(
  id: string,
  fn: (input: TInput) => Promise<TResult>,
) {
  const qc = useQueryClient();
  const key = changeDetailQueryKey(id);
  return useMutation({
    mutationFn: fn,
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<ChangeDetail>(key);
      return { previous };
    },
    onSuccess: (data) => {
      // Reminder returns `{ ok: true }`; only swap when the response carries
      // the authoritative change shape (approve / reject).
      if ((data as ChangeDetail).id !== undefined) {
        qc.setQueryData(key, data as ChangeDetail);
      } else {
        // Reminder — refetch the detail so any server-side timestamp updates
        // (e.g. `lastReminderAt` if BFF tracks it) propagate to the UI.
        void qc.invalidateQueries({ queryKey: key });
      }
    },
    onError: (_err, _input, ctx) => {
      const snapshot = (ctx as { previous?: ChangeDetail } | undefined)?.previous;
      if (snapshot) qc.setQueryData(key, snapshot);
    },
  });
}

export function useApproveChange(id: string) {
  return useChangeDetailMutation<ApprovePayload, ChangeDetail>(id, (payload) =>
    postApprove(id, payload),
  );
}

export function useRejectChange(id: string) {
  return useChangeDetailMutation<RejectPayload, ChangeDetail>(id, (payload) =>
    postReject(id, payload),
  );
}

export function useSendReminder(id: string) {
  return useChangeDetailMutation<ReminderPayload, { ok: true; approverId: string }>(id, (payload) =>
    postReminder(id, payload),
  );
}

/**
 * L.1.C — Status PATCH for a change. Hits `/api/changes/:id` with a tiny
 * `{ statusCode }` body; the BFF doesn't expose this route in production yet,
 * so the caller surfaces an "unsupported" toast on failure. Optimistic update
 * is intentionally narrow — we only swap the `status` field, not the full
 * detail, so a server-side schedule normalisation doesn't clobber the row.
 */
export function usePatchChangeStatus(id: string) {
  const qc = useQueryClient();
  const key = changeDetailQueryKey(id);
  return useMutation({
    mutationFn: (statusCode: string): Promise<ChangeRow> => patchChangeStatus(id, statusCode),
    onMutate: async (statusCode) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<ChangeDetail>(key);
      if (previous) {
        qc.setQueryData<ChangeDetail>(key, {
          ...previous,
          status: statusCode as ChangeStatus,
        });
      }
      return { previous };
    },
    onError: (_err, _statusCode, ctx) => {
      const snapshot = (ctx as { previous?: ChangeDetail } | undefined)?.previous;
      if (snapshot) qc.setQueryData(key, snapshot);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: key });
    },
  });
}
