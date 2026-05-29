import type { QueryClient } from "@tanstack/react-query";
import type { CIRelationship, TenantId } from "@sdm/domain";
import type { CiDetail, CiHistoryEntry, CiRow, CiRelationshipsPayload } from "./types";

/**
 * CMDB data plumbing — `/api/ci` (list, paginated) + `/api/ci/:id` (detail) +
 * `/api/ci/:id/history` (read-only change log per spec/cmdb.md §audit-trail).
 *
 * MSW (`packages/api-mocks/src/handlers/cmdb.ts`) returns the domain `Ci`
 * shape directly for both list and detail. The BFF's `/api/cmdb` proxy
 * (`apps/bff/src/api/endpoints/cmdb.ts`) projects CA SDM `nr` into a thinner
 * shape (`CiRowFe`) — wiring the BFF version into the workspace lives behind
 * the same flag-flip that swaps MSW out for the real backend; for H.13 (still
 * MSW-first) the FE consumes `/api/ci`.
 *
 * `queryKey` includes `tenantId` so the H.1 cross-tab tenant switch
 * invalidation flush works the same as `/api/queue` and `/api/changes`.
 *
 * Polling cadence is slower than tickets (5 min vs 30 s) — CIs change on
 * discovery sweeps, not on the second-by-second triage loop.
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

const PAGE_SIZE = 200;

async function fetchCis(): Promise<ReadonlyArray<CiRow>> {
  const resp = await fetch(`/api/ci?page=0&size=${PAGE_SIZE}`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  const body = await jsonOrThrow<PageResponse<CiRow>>(resp, "cmdb-list");
  return body.results;
}

export function cmdbListQuery(tenantId: TenantId) {
  return {
    queryKey: ["cmdb-list", tenantId] as const,
    queryFn: fetchCis,
    refetchInterval: 5 * 60_000,
    staleTime: 60_000,
  };
}

export async function prefetchCmdbList(qc: QueryClient, tenantId: TenantId): Promise<void> {
  await qc.prefetchQuery(cmdbListQuery(tenantId));
}

export function ciDetailQueryKey(id: string): readonly unknown[] {
  return ["cmdb-detail", id] as const;
}

export function ciDetailQuery(id: string) {
  return {
    queryKey: ciDetailQueryKey(id),
    queryFn: async (): Promise<CiDetail> => {
      const resp = await fetch(`/api/ci/${encodeURIComponent(id)}`, {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      return jsonOrThrow<CiDetail>(resp, "cmdb-detail");
    },
    staleTime: 60_000,
  };
}

export function ciRelationshipsQueryKey(id: string): readonly unknown[] {
  return ["cmdb-relationships", id] as const;
}

/**
 * Fetch the CI's neighbour graph in a single round-trip — `relationships[]`
 * (edges) plus `neighbours[]` (target/source CIs we need to render as nodes).
 *
 * MSW (`packages/api-mocks/src/handlers/cmdb.ts`) returns both arrays so the
 * graph component can render without follow-up `/api/ci/:id` lookups. Once the
 * BFF projection lands (CA SDM brel queries), the same shape will be served
 * from `/api/cmdb/ci/:id/relationships`.
 */
export function ciRelationshipsQuery(id: string) {
  return {
    queryKey: ciRelationshipsQueryKey(id),
    queryFn: async (): Promise<CiRelationshipsPayload> => {
      const resp = await fetch(`/api/ci/${encodeURIComponent(id)}/relationships`, {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      const body = await jsonOrThrow<{
        readonly relationships: ReadonlyArray<CIRelationship>;
        readonly neighbours?: ReadonlyArray<CiRow>;
      }>(resp, "cmdb-relationships");
      return {
        relationships: body.relationships,
        neighbours: body.neighbours ?? [],
      };
    },
    staleTime: 60_000,
  };
}

export function ciHistoryQueryKey(id: string): readonly unknown[] {
  return ["cmdb-history", id] as const;
}

export function ciHistoryQuery(id: string) {
  return {
    queryKey: ciHistoryQueryKey(id),
    queryFn: async (): Promise<ReadonlyArray<CiHistoryEntry>> => {
      const resp = await fetch(`/api/ci/${encodeURIComponent(id)}/history`, {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      const body = await jsonOrThrow<{ entries: ReadonlyArray<CiHistoryEntry> }>(
        resp,
        "cmdb-history",
      );
      return body.entries;
    },
    staleTime: 60_000,
  };
}
