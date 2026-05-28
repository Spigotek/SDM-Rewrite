import type { QueryClient } from "@tanstack/react-query";
import type { TenantId } from "@sdm/domain";
import type { ChangeRow, ChangeDetail } from "./types";

/**
 * Changes data plumbing — `/api/changes` (list) + `/api/changes/:id` (detail).
 *
 * Both endpoints return the domain `Change` shape directly:
 *  - MSW: `packages/api-mocks/src/handlers/changes.ts` returns `Change[]`
 *    paginated as `{ results, totalCount, start, size }`.
 *  - BFF: `apps/bff/src/api/endpoints/changes.ts` returns `ChangeRowFe[]` from
 *    CA SDM `chg` factory. Field shape is a superset of FE needs (FK refs
 *    instead of enum strings) — H.9 typing tolerates both via `ChangeRow`.
 *
 * `queryKey` includes `tenantId` so the H.1 cross-tab tenant switch
 * invalidation flush works the same as `/api/queue`.
 *
 * `staleTime` is shorter than the global default (5 min) so the list refreshes
 * after a CAB approval bounce-back (H.11+). Detail uses 15 s like ticket-detail.
 */

interface PageResponse<T> {
  readonly results: ReadonlyArray<T>;
  readonly totalCount: number;
  readonly start: number;
  readonly size: number;
}

async function jsonOrThrow<T>(resp: Response, op: string): Promise<T> {
  if (!resp.ok) {
    throw new Error(`[${op}] HTTP ${resp.status}`);
  }
  return (await resp.json()) as T;
}

const PAGE_SIZE = 100;

async function fetchChanges(): Promise<ReadonlyArray<ChangeRow>> {
  const resp = await fetch(`/api/changes?page=0&size=${PAGE_SIZE}`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  const body = await jsonOrThrow<PageResponse<ChangeRow>>(resp, "changes-list");
  return body.results;
}

export function changesListQuery(tenantId: TenantId) {
  return {
    queryKey: ["changes-list", tenantId] as const,
    queryFn: fetchChanges,
    refetchInterval: 30_000,
    staleTime: 15_000,
  };
}

export async function prefetchChangesList(qc: QueryClient, tenantId: TenantId): Promise<void> {
  await qc.prefetchQuery(changesListQuery(tenantId));
}

export function changeDetailQueryKey(id: string): readonly unknown[] {
  return ["change-detail", id] as const;
}

export function changeDetailQuery(id: string) {
  return {
    queryKey: changeDetailQueryKey(id),
    queryFn: async (): Promise<ChangeDetail> => {
      const resp = await fetch(`/api/changes/${encodeURIComponent(id)}`, {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      return jsonOrThrow<ChangeDetail>(resp, "change-detail");
    },
    staleTime: 15_000,
  };
}
