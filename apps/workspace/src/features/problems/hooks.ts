import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ProblemFilters } from "./types";
import {
  convertIncidentToProblem as apiConvert,
  linkIncidents as apiLink,
  patchProblem as apiPatch,
  unlinkIncident as apiUnlink,
  linkedIncidentsQueryKey,
  problemDetailQueryKey,
  type ConvertIncidentBody,
  type LinkIncidentsResult,
} from "./api";
import type { ProblemDetail } from "./types";

/**
 * Filter state is URL-driven (`?search=…&status=…`) so deep links / browser
 * back work the same way as on `/queue`. URL is the source of truth — useState
 * would desync on a refresh + we want shareable filter links for triage runs.
 */
const URL_KEY_SEARCH = "search";
const URL_KEY_STATUS = "status";

export function useProblemFilters(): {
  readonly filters: ProblemFilters;
  readonly setSearch: (value: string) => void;
  readonly toggleStatus: (code: string) => void;
  readonly reset: () => void;
} {
  const [params, setParams] = useSearchParams();
  const search = params.get(URL_KEY_SEARCH) ?? "";
  const status = useMemo(() => {
    const raw = params.get(URL_KEY_STATUS);
    if (!raw) return [];
    return raw.split(",").filter(Boolean);
  }, [params]);

  const setSearch = useCallback(
    (value: string) => {
      setParams(
        (prev) => {
          const out = new URLSearchParams(prev);
          if (value) out.set(URL_KEY_SEARCH, value);
          else out.delete(URL_KEY_SEARCH);
          return out;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const toggleStatus = useCallback(
    (code: string) => {
      setParams(
        (prev) => {
          const out = new URLSearchParams(prev);
          const current = (out.get(URL_KEY_STATUS) ?? "").split(",").filter(Boolean);
          const next = current.includes(code)
            ? current.filter((c) => c !== code)
            : [...current, code];
          if (next.length === 0) out.delete(URL_KEY_STATUS);
          else out.set(URL_KEY_STATUS, next.join(","));
          return out;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const reset = useCallback(() => {
    setParams(
      (prev) => {
        const out = new URLSearchParams(prev);
        out.delete(URL_KEY_SEARCH);
        out.delete(URL_KEY_STATUS);
        return out;
      },
      { replace: true },
    );
  }, [setParams]);

  const filters = useMemo<ProblemFilters>(() => ({ search, status }), [search, status]);
  return { filters, setSearch, toggleStatus, reset };
}

// ── Mutations ────────────────────────────────────────────────────────────────

/**
 * Link / unlink mutations both return the full `LinkIncidentsResult` so a
 * successful round-trip primes both the linked-incidents list cache and the
 * parent problem detail in one shot (mirrors H.8 ticket-detail / H.11 CAB).
 */
export function useLinkIncidents(problemId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (incidentIds: ReadonlyArray<string>) => apiLink(problemId, incidentIds),
    onSuccess: (data) => primeCachesAfterLinkChange(qc, problemId, data),
  });
}

export function useUnlinkIncident(problemId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (incidentId: string) => apiUnlink(problemId, incidentId),
    onSuccess: (data) => primeCachesAfterLinkChange(qc, problemId, data),
  });
}

function primeCachesAfterLinkChange(
  qc: ReturnType<typeof useQueryClient>,
  problemId: string,
  data: LinkIncidentsResult,
): void {
  qc.setQueryData(linkedIncidentsQueryKey(problemId), data.incidents);
  qc.setQueryData(problemDetailQueryKey(problemId), data.problem);
}

export function useConvertIncidentToProblem() {
  return useMutation({
    mutationFn: (body: ConvertIncidentBody) => apiConvert(body),
  });
}

export function usePatchProblem(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: { readonly statusCode?: string }) => apiPatch(id, patch),
    onMutate: async () => {
      const key = problemDetailQueryKey(id);
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<ProblemDetail>(key);
      return { previous };
    },
    onSuccess: (data) => {
      qc.setQueryData(problemDetailQueryKey(id), data);
    },
    onError: (_err, _input, ctx) => {
      const snapshot = (ctx as { previous?: ProblemDetail } | undefined)?.previous;
      if (snapshot) qc.setQueryData(problemDetailQueryKey(id), snapshot);
    },
  });
}
