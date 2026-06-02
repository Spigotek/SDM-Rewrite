/**
 * Kick the lazy route chunk for the current pathname before React mounts.
 *
 * Why: `routes.tsx` declares every child route via `lazy: () => import(...)`,
 * so the route module is fetched only AFTER React mounts and the router
 * resolves the match. On slow 4G that adds a serial round-trip after the
 * vendor chunks already finished. By firing the same dynamic `import()` from
 * `main.tsx` (before the bootstrap `Promise.all`) the module-graph request
 * runs in parallel with `loadConfig` / `bootstrapI18n` / `loadSession`. When
 * the router later resolves the match it reuses the in-flight module from
 * Vite's loader cache — no duplicate fetch.
 *
 * The match table mirrors `routes.tsx`. Any path that falls through is a
 * no-op; the router's `lazy:` then handles it on the original critical path.
 * Update when routes are added — failure mode is "no preload" (silent perf
 * regression, never a functional break).
 */
export function preloadRouteForPath(pathname: string): Promise<unknown> | undefined {
  // Trim trailing slash so `/` and `` are equivalent matches.
  const path = pathname.replace(/\/$/, "");
  if (path === "" || path === "/") {
    return import("../features/home/HomeRoute");
  }
  if (path === "/new-incident") {
    return import("../features/incidents/NewIncidentRoute");
  }
  if (path.startsWith("/tickets/")) {
    return import("../features/tickets/TicketDetailRoute");
  }
  if (path === "/catalog") {
    return import("../features/catalog/CatalogRoute");
  }
  if (path.startsWith("/catalog/")) {
    return import("../features/catalog/CatalogItemRoute");
  }
  if (path === "/kb") {
    return import("../features/kb/KbRoute");
  }
  if (path.startsWith("/kb/article/")) {
    return import("../features/kb/KbArticleRoute");
  }
  return undefined;
}
