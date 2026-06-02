/**
 * I.0 perf fix — placeholder skeletons rendered while `useMyTickets` /
 * `useKbSuggestions` are pending. Dimensions roughly match the real rows so
 * the layout doesn't shift when the data arrives (CLS budget 0.05 per
 * `performance.md §2 portal /`).
 *
 * Pure CSS — no animation library, no extra runtime cost. Background color
 * pulses via `prefers-reduced-motion`-aware keyframes in `home.css`.
 */

export function TicketRowSkeleton() {
  return (
    <li className="sdm-home-ticket-row sdm-home-skeleton-row" aria-hidden="true">
      <span className="sdm-home-skeleton sdm-home-skeleton-ticket" />
    </li>
  );
}

export function KbCardSkeleton() {
  return (
    <li className="sdm-home-kb-item" aria-hidden="true">
      <span className="sdm-home-skeleton sdm-home-skeleton-kb" />
    </li>
  );
}
