import type { Hono } from "hono";
import { registerChangeRoutes } from "./endpoints/changes";
import { registerCmdbRoutes } from "./endpoints/cmdb";
import { registerIncidentRoutes } from "./endpoints/incidents";
import { registerKbRoutes } from "./endpoints/kb";
import { registerProblemRoutes } from "./endpoints/problems";
import {
  createReferenceState,
  registerReferenceRoutes,
  type ReferenceState,
} from "./endpoints/reference";
import { registerRequestRoutes } from "./endpoints/requests";
import type { RestProxyDeps } from "./rest-proxy";

export interface ApiRoutesState {
  readonly reference: ReferenceState;
}

export function createApiRoutesState(): ApiRoutesState {
  return { reference: createReferenceState() };
}

export function registerApiRoutes(
  app: Hono,
  deps: RestProxyDeps,
  state: ApiRoutesState = createApiRoutesState(),
): void {
  registerIncidentRoutes(app, deps);
  registerRequestRoutes(app, deps);
  registerProblemRoutes(app, deps);
  registerChangeRoutes(app, deps);
  registerKbRoutes(app, deps);
  registerCmdbRoutes(app, deps);
  registerReferenceRoutes(app, deps, state.reference);
}
