/**
 * unDraw-inspired empty-state illustrations (K.3.D, K.1 brief §9).
 *
 * Every asset is monochrome `currentColor` so the host controls the accent
 * via CSS — the EmptyState primitive's `illustration` slot wraps these in an
 * `aria-hidden` container, so the embedded `<title>` is purely a fallback for
 * tools that bypass that wrapping.
 *
 * Imported via `vite-plugin-svgr`'s `?react` query — v4.5's `client.d.ts`
 * only types the `?react` form. Re-exported with stable named identifiers
 * so consumers don't depend on the underlying file name or transformer
 * convention.
 */

export { default as IllustrationNoOpenTickets } from "./01-no-open-tickets.svg?react";
export { default as IllustrationNoTicketsAssigned } from "./02-no-tickets-assigned.svg?react";
export { default as IllustrationNoKbArticles } from "./03-no-kb-articles.svg?react";
export { default as IllustrationNoCatalogItems } from "./04-no-catalog-items.svg?react";
export { default as IllustrationNoNotifications } from "./05-no-notifications.svg?react";
export { default as IllustrationNoSearchResults } from "./06-no-search-results.svg?react";
export { default as IllustrationNoRecentActivity } from "./07-no-recent-activity.svg?react";
export { default as IllustrationPermissionDenied } from "./08-permission-denied.svg?react";
export { default as IllustrationGenericError } from "./09-generic-error.svg?react";
export { default as IllustrationOffline } from "./10-offline.svg?react";
