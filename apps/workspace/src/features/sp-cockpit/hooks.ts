import { useQuery } from "@tanstack/react-query";
import { fetchSpTenants, type SpTenantRow } from "./api";

/**
 * SP cockpit tenant list — used by the cockpit landing and the cross-tenant
 * calendar overlay. Cached for 5 minutes (this list changes only when an admin
 * (re)assigns the sp_admin role, which is a rare operation).
 */
export function useSpTenants(enabled: boolean = true) {
  return useQuery<readonly SpTenantRow[]>({
    queryKey: ["sp-tenants"],
    queryFn: fetchSpTenants,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    enabled,
  });
}
