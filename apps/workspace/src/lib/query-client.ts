/**
 * Workspace TanStack Query client — server-state baseline per ADR-03.
 *
 * Identical defaults to portal: 5-minute staleTime, retry x1, no refetch on
 * window focus, refetch on reconnect. Workspace gets the same per-tenant
 * cache scoping (queryKey factories arrive in H.1+).
 */

import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
  },
});
