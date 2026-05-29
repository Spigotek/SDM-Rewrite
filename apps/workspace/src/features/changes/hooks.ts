import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  changeDetailQueryKey,
  postApprove,
  postReject,
  postReminder,
  type ApprovePayload,
  type RejectPayload,
  type ReminderPayload,
} from "./api";
import { CHANGE_TABS, type ChangeTabKey, type ChangeDetail } from "./types";

const URL_KEY_TAB = "tab";

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
