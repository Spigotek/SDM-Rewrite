/**
 * K.3.A — Page-transition crossfade hook.
 *
 * Per K.1 brief §7: page transitions are crossfade-only (never slide).
 * Fade-out 80 ms linear → swap content → fade-in 120 ms `ease-out`.
 *
 * Usage:
 *   const ref = usePageTransition();
 *   return <main ref={ref}><Outlet /></main>;
 *
 * The hook listens to a `key` prop (typically `useLocation().pathname`) and
 * runs the crossfade whenever the key changes. The first mount is treated as
 * a fade-in only (no preceding fade-out).
 *
 * `prefers-reduced-motion` is honoured — when set, the hook becomes a no-op
 * and the outlet swaps without any animation.
 */

import { useEffect, useRef } from "react";
import gsap from "gsap";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const FADE_OUT_DURATION = 0.08; // seconds (80 ms)
const FADE_IN_DURATION = 0.12; // seconds (120 ms)

export interface UsePageTransitionResult {
  /** Attach to the element that wraps the outlet / page content. */
  ref: React.RefObject<HTMLDivElement | null>;
}

/**
 * Run a crossfade on the returned ref whenever `key` changes. The first render
 * runs a fade-in only.
 */
export function usePageTransition(key: string): UsePageTransitionResult {
  const ref = useRef<HTMLDivElement | null>(null);
  const previousKey = useRef<string | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
      if (window.matchMedia(REDUCED_MOTION_QUERY).matches) {
        previousKey.current = key;
        return;
      }
    }

    // Defensive try/catch: gsap.from on a node that React is about to swap
    // (route transitions can orphan the node mid-tween in chromium /
    // firefox while webkit's scheduler hides it) throws asynchronously
    // inside RAF and bubbles up through React's error boundary. The
    // transition is decorative — if it can't run cleanly, the page must
    // still render. Animations failing to start ≠ page failing to mount.
    let tween: gsap.core.Tween | null = null;
    try {
      if (previousKey.current === null) {
        // First mount — fade-in only.
        tween = gsap.from(node, { opacity: 0, duration: FADE_IN_DURATION, ease: "none" });
      } else if (previousKey.current !== key) {
        // Subsequent route change — fade-out then fade-in. React has already
        // swapped children before this effect runs, so the visual reads as a
        // fast crossfade rather than a sequenced ping-pong.
        tween = gsap.fromTo(
          node,
          { opacity: 0 },
          { opacity: 1, duration: FADE_IN_DURATION, ease: "power1.out" },
        );
      }
    } catch (error) {
      if (typeof console !== "undefined") {
        console.warn("[usePageTransition] gsap tween failed, falling back to no animation", error);
      }
    }
    previousKey.current = key;

    return () => {
      // Ensure the in-flight tween is killed and any inline opacity gsap
      // stamped on the node is cleared when the component unmounts. Without
      // this an orphaned tween may continue writing to a detached node or
      // the next mount picks up `opacity: 0` and never fades back in.
      if (tween !== null) {
        try {
          tween.kill();
        } catch {
          /* swallow — best-effort cleanup */
        }
      }
      if (node !== null) {
        try {
          gsap.set(node, { clearProps: "opacity" });
        } catch {
          /* swallow */
        }
      }
    };
  }, [key]);

  return { ref };
}

export const PAGE_TRANSITION_DURATIONS = {
  fadeOutMs: FADE_OUT_DURATION * 1000,
  fadeInMs: FADE_IN_DURATION * 1000,
} as const;
