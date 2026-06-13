/**
 * K.3.A — Skeleton shimmer documentation re-export.
 *
 * The shimmer animation itself is CSS-driven — it lives in
 * `tokens.css` (`@keyframes sdm-skeleton-shimmer`) and is applied by
 * `Skeleton.module.css`. This module exposes the keyframe NAME + duration
 * constants so consumers (custom skeleton-like surfaces in feature code)
 * can reference the same animation without duplicating the keyframe.
 *
 * Reduced-motion fallback: `Skeleton.module.css` swaps the animation off
 * and holds `opacity: 0.7` per K.1 brief §6.11 / §7.
 */

/** `@keyframes` identifier declared in `tokens.css`. */
export const SKELETON_SHIMMER_KEYFRAME = "sdm-skeleton-shimmer";

/** Animation duration matching `Skeleton.module.css`. */
export const SKELETON_SHIMMER_DURATION_MS = 1600;

/** Animation timing function — linear loop. */
export const SKELETON_SHIMMER_EASING = "linear";

/**
 * Inline `animation` shorthand for ad-hoc skeleton surfaces. Use this on a
 * background-positioned element (`background-size: 200% 100%`).
 */
export const SKELETON_SHIMMER_ANIMATION = `${SKELETON_SHIMMER_KEYFRAME} ${SKELETON_SHIMMER_DURATION_MS}ms ${SKELETON_SHIMMER_EASING} infinite`;
