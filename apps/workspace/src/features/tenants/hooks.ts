/**
 * H.1 — `useActiveTenant()` mutation hook.
 *
 * - On success: prime the `["me"]` query with the new session shape and **nuke
 *   every other query** (predicate `q.queryKey[0] !== "me"`) so tenant-scoped
 *   caches are invalidated wholesale per ADR-04 r2. This is intentionally
 *   broad: surgical invalidation across the (eventually) ~30 feature query
 *   keys is brittle and a tenant switch is rare enough that the cold-cache
 *   cost is acceptable.
 * - On failure: surface a console error + dispatch a `sdm:tenant-switch-error`
 *   custom event so the toast layer (added later in H.2+) can pick it up.
 *   The session context is *not* mutated — the optimistic UI revert is
 *   handled by leaving the previous `["me"]` cache value untouched.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { TenantId } from "@sdm/domain";
import { switchTenantRequest } from "./api";
import { useSession } from "../../shell/session-context";
import type { SessionLoadResult } from "../../bootstrap/session";

const ME_QUERY_KEY = "me" as const;
const TENANT_SWITCH_ERROR_EVENT = "sdm:tenant-switch-error";

export interface TenantSwitchError {
  readonly tenantId: TenantId;
  readonly message: string;
}

export interface UseActiveTenantResult {
  readonly switchTenant: (tenantId: TenantId) => void;
  readonly isPending: boolean;
  readonly error: Error | null;
}

export function useActiveTenant(): UseActiveTenantResult {
  const queryClient = useQueryClient();
  const { applySwitchedSession } = useSession();

  const mutation = useMutation({
    mutationFn: (tenantId: TenantId) => switchTenantRequest(tenantId),
    onSuccess: (result: SessionLoadResult) => {
      // Prime /me cache so any consumer that reads it on the next render gets
      // the new session synchronously.
      queryClient.setQueryData([ME_QUERY_KEY], result);
      // Broad nuke — every non-/me query is removed so consumers refetch
      // against the new tenant. `removeQueries` (not `invalidateQueries`)
      // wipes the cached payload too, so a stale list never flashes before
      // the refetch lands.
      queryClient.removeQueries({
        predicate: (q) => q.queryKey[0] !== ME_QUERY_KEY,
      });
      applySwitchedSession(result);
    },
    onError: (err, tenantId) => {
      const detail: TenantSwitchError = {
        tenantId,
        message: err instanceof Error ? err.message : "tenant switch failed",
      };
      window.dispatchEvent(new CustomEvent(TENANT_SWITCH_ERROR_EVENT, { detail }));
    },
  });

  return {
    switchTenant: mutation.mutate,
    isPending: mutation.isPending,
    error: mutation.error,
  };
}

export { TENANT_SWITCH_ERROR_EVENT };
