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

/**
 * Slim row returned by the autocomplete dropdown in `KbSearchBar`. Matches
 * the same `/api/kb` endpoint the KB route uses; the home autocomplete cares
 * only about the link target and a short label.
 */
export interface KbAutocompleteHit {
  readonly id: string;
  readonly title: string;
  readonly snippet: string;
}

/**
 * Aggregate of the user's active ticket buckets — drives the 3-up KPI strip
 * (`HeroStats`). Derived client-side from `myAllTicketsQuery` (top 50).
 */
export interface HomeStats {
  readonly open: number;
  readonly awaiting: number;
  readonly resolvedThisWeek: number;
}

/**
 * Synthesised timeline event displayed in `RecentActivity`. Built on the
 * client from the same `myAllTicketsQuery` payload — no dedicated activity
 * endpoint exists yet, and the K.1 brief explicitly accepts this fallback.
 */
export interface RecentActivityEvent {
  readonly id: string;
  readonly ticketId: string;
  readonly ticketRef: string;
  readonly status: TicketStatus;
  readonly timestamp: string;
}
