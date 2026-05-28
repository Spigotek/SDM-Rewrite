/**
 * Portal TanStack Query client — server-state baseline per ADR-03.
 *
 * Defaults are conservative: 5-minute staleTime balances freshness with
 * network chatter, single retry catches transient blips without amplifying
 * outages, refetch-on-window-focus is OFF so a tenant switch / language
 * change doesn't trigger a stampede on every visible card.
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
