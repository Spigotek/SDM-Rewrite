/**
 * M.2.B — drawer/panel slide-in.
 *
 * Slides a panel in from the right (`xPercent: 100 → 0`) while fading its
 * backdrop in (`opacity: 0 → 1`). Used by the workspace queue detail drawer so
 * GSAP stays confined to `@sdm/design-system` (the package that owns the gsap
 * dependency) — feature code consumes this helper instead of importing gsap.
 *
 * Mirrors `staggerListRows` / `usePageTransition`:
 *  - `prefers-reduced-motion: reduce` short-circuits to no animation (the panel
 *    is already in its final position via CSS, so nothing to reset).
 *  - Defensive try/catch — the animation is decorative; a throw on a detached
 *    node must not bubble to React's error boundary.
 *
 * Returns a cleanup function that kills the tween and clears the inline props
 * GSAP stamped, so an unmount mid-tween leaves no orphaned animation.
 */

import gsap from "gsap";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const DURATION_MS = 180;
const EASE = "power2.out";

export interface SlideInPanelOptions {
  /** The sliding panel element (translateX). */
  readonly panel: HTMLElement | null;
  /** The backdrop element (opacity). Optional. */
  readonly backdrop?: HTMLElement | null;
  /** Override the slide duration in milliseconds (default 180). */
  readonly durationMs?: number;
}

export function slideInPanel(options: SlideInPanelOptions): () => void {
  const { panel, backdrop, durationMs } = options;
  const noop = (): void => {};
  if (!panel) return noop;
  if (typeof window === "undefined") return noop;

  const prefersReduced =
    typeof window.matchMedia === "function" && window.matchMedia(REDUCED_MOTION_QUERY).matches;
  if (prefersReduced) return noop;

  const duration = (durationMs ?? DURATION_MS) / 1000;
  const targets = backdrop ? [backdrop, panel] : [panel];

  let tween: gsap.core.Tween | null = null;
  try {
    tween = gsap.fromTo(
      targets,
      (i: number) => (backdrop && i === 0 ? { opacity: 0 } : { xPercent: 100 }),
      { opacity: 1, xPercent: 0, duration, ease: EASE },
    );
  } catch (error) {
    if (typeof console !== "undefined") {
      console.warn("[slideInPanel] gsap tween failed, skipping animation", error);
    }
    return noop;
  }

  return () => {
    if (tween) {
      try {
        tween.kill();
      } catch {
        /* swallow — best-effort cleanup */
      }
    }
    try {
      gsap.set(targets, { clearProps: "opacity,transform" });
    } catch {
      /* swallow */
    }
  };
}
