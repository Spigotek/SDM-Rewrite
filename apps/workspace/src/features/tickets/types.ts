import type { UiTicketType } from "@sdm/api-types";

export type ComposerTab = "public" | "internal" | "resolution";

export type TimelineFilter = "all" | "public" | "internal" | "system";

/**
 * Subset of `UiTicketType` that ships in H.8 — the workspace currently only
 * routes incidents/requests/problems through the unified detail. Change is
 * surfaced from H.10 and stays out of the H.8 split-view; the type alias keeps
 * the public API forward-compatible if H.10 reuses this feature shell.
 */
export type DetailTicketType = UiTicketType;

export interface ResolvePayload {
  readonly solution: string;
  readonly category: string | null;
}

export interface EscalatePayload {
  readonly note: string;
  readonly group: string | null;
}
