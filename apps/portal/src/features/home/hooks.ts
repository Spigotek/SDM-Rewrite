import { useQuery } from "@tanstack/react-query";
import type { TenantId } from "@sdm/domain";
import { kbSuggestionsQuery, myTicketsQuery } from "./api";

/**
 * Thin `useQuery` wrappers — the loader has already populated the cache, so
 * these reads are synchronous on first render in the happy path. Both hooks
 * keep `staleTime` from the underlying query factory. The `enabled` flag is
 * threaded through so callers can keep the hook order stable while the
 * session bootstraps (rules of hooks) without triggering bogus fetches with
 * a placeholder tenant ID.
 */

export function useMyTickets(tenantId: TenantId, enabled: boolean) {
  return useQuery({ ...myTicketsQuery(tenantId), enabled });
}

export function useKbSuggestions(tenantId: TenantId, enabled: boolean) {
  return useQuery({ ...kbSuggestionsQuery(tenantId), enabled });
}
