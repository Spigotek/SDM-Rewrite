import type { UiTicketType } from "@sdm/api-types";

/**
 * Portal ticket-detail feature types.
 *
 * The portal exposes a single `/tickets/:id` route — the route param is the
 * fully-prefixed entity ID (`incident:10000`, `request:20012`, ...). The
 * BFF aggregator expects `:type` separately, so the route resolves the type
 * from the ID prefix.
 *
 * Per H.4 §Open questions the portal stays **read-only + public reply** — no
 * internal / resolution Composer tabs (workspace-only).
 */
export type PortalTicketType = UiTicketType;

export interface ParsedTicketParam {
  readonly type: PortalTicketType;
  readonly id: string;
}
