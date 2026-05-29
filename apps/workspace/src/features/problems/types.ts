import type { Incident, Problem } from "@sdm/domain";

/**
 * FE projection of the workspace `/api/problems` payload. Both list and detail
 * routes consume the domain `Problem` shape directly (MSW returns it; the BFF
 * F.2 entity proxy projects compatible fields). H.12 adds a UI-only
 * `LinkedIncidentsView` so the LinkedIncidentsList component can render the
 * resolved incident rows alongside the parent problem without forcing a second
 * detail query for each.
 */
export type ProblemRow = Problem;
export type ProblemDetail = Problem;

export interface LinkedIncidentSummary {
  readonly id: Incident["id"];
  readonly ref: string;
  readonly summary: string;
  readonly status: Incident["status"];
}

export interface ProblemFilters {
  readonly search: string;
  readonly status: ReadonlyArray<string>;
}

export const EMPTY_PROBLEM_FILTERS: ProblemFilters = {
  search: "",
  status: [],
};
