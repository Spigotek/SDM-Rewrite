/**
 * Loading placeholders rendered by the data-dependent home widgets while
 * their underlying queries are pending. Dimensions roughly match the real
 * rows so the layout doesn't shift when the data arrives (CLS budget 0.05
 * per `performance.md §2 portal /`).
 *
 * Pure CSS — no animation library, no extra runtime cost. Background colour
 * pulses via the keyframes in `home.css`, automatically off under
 * `prefers-reduced-motion`.
 */

export function TicketRowSkeleton() {
  return (
    <li className="sdm-home-ticket-row sdm-home-skeleton-row" aria-hidden="true">
      <span className="sdm-home-skeleton sdm-home-skeleton-ticket" />
    </li>
  );
}
