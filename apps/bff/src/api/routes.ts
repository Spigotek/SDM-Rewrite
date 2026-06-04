import type { Hono } from "hono";
import { registerAdminTenantsRoutes, type AdminTenantsRouteDeps } from "./admin-tenants";
import { registerCatalogRoutes } from "./endpoints/catalog";
import { registerChangeRoutes } from "./endpoints/changes";
import { registerCmdbRoutes } from "./endpoints/cmdb";
import { registerIncidentRoutes } from "./endpoints/incidents";
import { registerKbRoutes } from "./endpoints/kb";
import { registerKbAnalyticsRoutes } from "./endpoints/kb-analytics";
import { registerKbWriteRoutes } from "./endpoints/kb-write";
import { registerProblemRoutes } from "./endpoints/problems";
import {
  createReferenceState,
  registerReferenceRoutes,
  type ReferenceState,
} from "./endpoints/reference";
import { registerRequestRoutes } from "./endpoints/requests";
import { registerEventsRoute, type EventsRouteDeps } from "./events";
import type { RestProxyDeps } from "./rest-proxy";

export interface ApiRoutesState {
  readonly reference: ReferenceState;
}

export function createApiRoutesState(): ApiRoutesState {
  return { reference: createReferenceState() };
}

export type ApiRouteDeps = RestProxyDeps & EventsRouteDeps & AdminTenantsRouteDeps;

export function registerApiRoutes(
  app: Hono,
  deps: ApiRouteDeps,
  state: ApiRoutesState = createApiRoutesState(),
): void {
  // J.3 — SSE + admin endpoints registered first (specific paths take priority).
  registerEventsRoute(app, deps);
  registerAdminTenantsRoutes(app, deps);

  registerIncidentRoutes(app, deps);
  registerRequestRoutes(app, deps);
  registerProblemRoutes(app, deps);
  registerChangeRoutes(app, deps);
  // KB write + analytics MUST register BEFORE the entity proxy `registerKbRoutes`
  // so the specific `/api/kb/articles/...` and `/api/kb/analytics` paths win
  // over the generic `:id` fallback in the proxy.
  registerKbWriteRoutes(app, deps);
  registerKbAnalyticsRoutes(app, deps);
  registerKbRoutes(app, deps);
  registerCmdbRoutes(app, deps);
  registerReferenceRoutes(app, deps, state.reference);
  registerCatalogRoutes(app);
}
