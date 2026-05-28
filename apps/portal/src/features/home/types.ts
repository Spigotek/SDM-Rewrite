import type { TicketStatus } from "@sdm/design-system";

/**
 * FE-side projection used by the home dashboard. Normalises whichever paginated
 * shape lands on `/api/incidents` (BFF entity route `{ data, page }` vs. MSW
 * dev mode `{ results, totalCount }`) into one row type the components consume.
 */
export interface MyTicketSummary {
  readonly id: string;
  readonly ref: string;
  readonly summary: string;
  readonly status: TicketStatus;
  /** ISO-8601 timestamp used for the "updated/opened …" relative-time label. */
  readonly updatedAt: string | null;
}

export interface KbSuggestion {
  readonly id: string;
  readonly title: string;
  readonly excerpt: string;
}
