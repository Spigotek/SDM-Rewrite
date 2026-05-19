import type { Hono } from "hono";
import type { RestProxyDeps } from "../api/rest-proxy";
import { createMeTenantsState, registerMeTenantsRoutes, type MeTenantsState } from "./me-tenants";
import { createQueueState, registerQueueRoutes, type QueueState } from "./queue";
import {
  createTicketDetailState,
  registerTicketDetailRoutes,
  type TicketDetailState,
} from "./ticket-detail";

export interface AggregatorState {
  readonly meTenants: MeTenantsState;
  readonly queue: QueueState;
  readonly ticketDetail: TicketDetailState;
}

export function createAggregatorState(): AggregatorState {
  return {
    meTenants: createMeTenantsState(),
    queue: createQueueState(),
    ticketDetail: createTicketDetailState(),
  };
}

export function registerAggregatorRoutes(
  app: Hono,
  deps: RestProxyDeps,
  state: AggregatorState = createAggregatorState(),
): void {
  registerMeTenantsRoutes(
    app,
    { config: deps.config, sessionStore: deps.sessionStore, log: deps.log },
    state.meTenants,
  );
  registerQueueRoutes(app, deps, state.queue);
  registerTicketDetailRoutes(app, deps, state.ticketDetail);
}
