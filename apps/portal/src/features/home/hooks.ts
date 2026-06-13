import { useQuery } from "@tanstack/react-query";
import type { TenantId } from "@sdm/domain";
import { kbAutocompleteQuery, myAllTicketsQuery, myTicketsQuery } from "./api";

/**
 * Thin `useQuery` wrappers — the loader has already populated the cache, so
 * these reads are synchronous on first render in the happy path. Each hook
 * keeps `staleTime` from the underlying query factory. The `enabled` flag is
 * threaded through so callers can keep the hook order stable while the
 * session bootstraps (rules of hooks) without triggering bogus fetches with
 * a placeholder tenant ID.
 */

export function useMyTickets(tenantId: TenantId, enabled: boolean) {
  return useQuery({ ...myTicketsQuery(tenantId), enabled });
}

export function useMyAllTickets(tenantId: TenantId, enabled: boolean) {
  return useQuery({ ...myAllTicketsQuery(tenantId), enabled });
}

/**
 * Autocomplete dropdown query — driven by the (already debounced) search term
 * inside `KbSearchBar`. Disabled until the user has typed at least 2 chars
 * (the FE-side floor for "this is a meaningful search") to keep the BFF idle
 * during a single-keystroke pause.
 */
export function useKbAutocomplete(tenantId: TenantId, term: string, enabled: boolean) {
  return useQuery({
    ...kbAutocompleteQuery(tenantId, term),
    enabled: enabled && term.trim().length >= 2,
  });
}
