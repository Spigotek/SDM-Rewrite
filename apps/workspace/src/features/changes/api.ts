import type { QueryClient } from "@tanstack/react-query";
import type { TenantId } from "@sdm/domain";
import type { ChangeRow, ChangeDetail } from "./types";

/**
 * H.11: CAB approval actions. Three endpoints share the change-detail key so a
 * successful POST swaps the cache via `setQueryData` (mirrors H.8 ticket
 * mutations) — no extra refetch needed.
 *
 * Backward-compat: the MSW handler `/api/changes/:id/approve` already accepts
 * `{ decision: "approve" | "reject" }` (legacy contract from the read-only
 * H.9 baseline). H.11 augments MSW + BFF with a dedicated `/reject` path so the
 * payload is action-shaped — `comment` is approve-only and `reason` is
 * reject-only — and emits `data.change.write` per F.4 taxonomy server-side.
 */

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

// ── H.11 CAB approval actions ────────────────────────────────────────────────

export interface ApprovePayload {
  readonly approverId: string;
  readonly comment?: string;
}

export interface RejectPayload {
  readonly approverId: string;
  readonly reason: string;
}

export interface ReminderPayload {
  readonly approverId: string;
}

async function postJson<T>(path: string, body: unknown, op: string): Promise<T> {
  const resp = await fetch(path, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  return jsonOrThrow<T>(resp, op);
}

export function postApprove(id: string, payload: ApprovePayload): Promise<ChangeDetail> {
  return postJson<ChangeDetail>(
    `/api/changes/${encodeURIComponent(id)}/approve`,
    { decision: "approve", approverId: payload.approverId, comment: payload.comment ?? "" },
    "change-approve",
  );
}

export function postReject(id: string, payload: RejectPayload): Promise<ChangeDetail> {
  return postJson<ChangeDetail>(
    `/api/changes/${encodeURIComponent(id)}/reject`,
    { approverId: payload.approverId, reason: payload.reason },
    "change-reject",
  );
}

export interface ReminderAck {
  readonly ok: true;
  readonly approverId: string;
}

export function postReminder(id: string, payload: ReminderPayload): Promise<ReminderAck> {
  return postJson<ReminderAck>(
    `/api/changes/${encodeURIComponent(id)}/reminder`,
    { approverId: payload.approverId },
    "change-reminder",
  );
}
