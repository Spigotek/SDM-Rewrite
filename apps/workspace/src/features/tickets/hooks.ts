import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { UiTicketDetail, UiTicketType } from "@sdm/api-types";
import {
  escalate as apiEscalate,
  patchTicket as apiPatch,
  postComment as apiPostComment,
  resolve as apiResolve,
  take as apiTake,
  ticketDetailQueryKey,
  watch as apiWatch,
} from "./api";
import type { ComposerTab, EscalatePayload, ResolvePayload, TimelineFilter } from "./types";

/**
 * Composer tab + timeline filter both live in `?tab=` / `?filter=` so deep
 * links share the agent's current draft posture. Defaults: `public` reply
 * and `all` timeline.
 */
const URL_KEY_TAB = "tab";
const URL_KEY_FILTER = "filter";

const TAB_VALUES: ReadonlyArray<ComposerTab> = ["public", "internal", "resolution"];
const FILTER_VALUES: ReadonlyArray<TimelineFilter> = ["all", "public", "internal", "system"];

function parseTab(value: string | null): ComposerTab {
  return (TAB_VALUES as ReadonlyArray<string>).includes(value ?? "")
    ? (value as ComposerTab)
    : "public";
}

function parseFilter(value: string | null): TimelineFilter {
  return (FILTER_VALUES as ReadonlyArray<string>).includes(value ?? "")
    ? (value as TimelineFilter)
    : "all";
}

export function useComposerTab(): {
  readonly tab: ComposerTab;
  readonly setTab: (next: ComposerTab) => void;
} {
  const [params, setParams] = useSearchParams();
  const tab = parseTab(params.get(URL_KEY_TAB));
  const setTab = useCallback(
    (next: ComposerTab) => {
      setParams(
        (prev) => {
          const out = new URLSearchParams(prev);
          if (next === "public") out.delete(URL_KEY_TAB);
          else out.set(URL_KEY_TAB, next);
          return out;
        },
        { replace: true },
      );
    },
    [setParams],
  );
  return { tab, setTab };
}

export function useTimelineFilter(): {
  readonly filter: TimelineFilter;
  readonly setFilter: (next: TimelineFilter) => void;
} {
  const [params, setParams] = useSearchParams();
  const filter = parseFilter(params.get(URL_KEY_FILTER));
  const setFilter = useCallback(
    (next: TimelineFilter) => {
      setParams(
        (prev) => {
          const out = new URLSearchParams(prev);
          if (next === "all") out.delete(URL_KEY_FILTER);
          else out.set(URL_KEY_FILTER, next);
          return out;
        },
        { replace: true },
      );
    },
    [setParams],
  );
  return { filter, setFilter };
}

// ─── Mutations ───────────────────────────────────────────────────────────────

/**
 * Each mutation hook follows the same pattern:
 *  1. Cancel in-flight detail fetches so a slow GET can't trample the optimistic write.
 *  2. Snapshot the previous cache so a 4xx can roll back.
 *  3. `mutationFn` calls the API helper; on success we `setQueryData` with the
 *     authoritative response (no extra refetch needed).
 *  4. On error we restore the snapshot and bubble the error to the caller.
 */
function useDetailMutation<TInput>(
  type: UiTicketType,
  id: string,
  fn: (input: TInput) => Promise<UiTicketDetail>,
) {
  const qc = useQueryClient();
  const key = ticketDetailQueryKey(type, id);
  return useMutation({
    mutationFn: fn,
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<UiTicketDetail>(key);
      return { previous };
    },
    onSuccess: (data) => {
      qc.setQueryData(key, data);
    },
    onError: (_err, _input, ctx) => {
      const snapshot = (ctx as { previous?: UiTicketDetail } | undefined)?.previous;
      if (snapshot) qc.setQueryData(key, snapshot);
    },
  });
}

export function useTake(type: UiTicketType, id: string) {
  return useDetailMutation<void>(type, id, () => apiTake(type, id));
}

export function useWatch(type: UiTicketType, id: string) {
  return useDetailMutation<void>(type, id, () => apiWatch(type, id));
}

export function useResolve(type: UiTicketType, id: string) {
  return useDetailMutation<ResolvePayload>(type, id, (payload) => apiResolve(type, id, payload));
}

export function useEscalate(type: UiTicketType, id: string) {
  return useDetailMutation<EscalatePayload>(type, id, (payload) => apiEscalate(type, id, payload));
}

export function usePatchTicket(type: UiTicketType, id: string) {
  return useDetailMutation<Partial<{ status: string; priority: number }>>(type, id, (patch) =>
    apiPatch(type, id, patch),
  );
}

export interface PostCommentInput {
  readonly text: string;
  readonly kind: "public" | "internal";
}

export function usePostComment(type: UiTicketType, id: string) {
  return useDetailMutation<PostCommentInput>(type, id, ({ text, kind }) =>
    apiPostComment(type, id, text, kind),
  );
}

// ─── Composer draft (per-tab localStorage) ───────────────────────────────────

/**
 * Drafts are scoped per ticket+tab. Survives navigation and refresh. localStorage
 * is enough — drafts are ephemeral and the agent reopens the same machine.
 */
const DRAFT_STORAGE_PREFIX = "sdm.workspace.ticketDetail.draft";

function draftKey(type: UiTicketType, id: string, tab: ComposerTab): string {
  return `${DRAFT_STORAGE_PREFIX}.${type}.${id}.${tab}`;
}

export function useComposerDraft(
  type: UiTicketType,
  id: string,
  tab: ComposerTab,
): { value: string; setValue: (v: string) => void; clear: () => void } {
  const key = useMemo(() => draftKey(type, id, tab), [type, id, tab]);
  const [value, setValueState] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(key) ?? "";
  });
  const setValue = useCallback(
    (v: string) => {
      setValueState(v);
      if (typeof window === "undefined") return;
      if (v) window.localStorage.setItem(key, v);
      else window.localStorage.removeItem(key);
    },
    [key],
  );
  const clear = useCallback(() => setValue(""), [setValue]);
  return { value, setValue, clear };
}
