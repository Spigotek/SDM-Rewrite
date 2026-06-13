/**
 * L.1.A — Count-up number ticker for KPI tiles.
 *
 * Drives `node.textContent` from `0` (or the previous value, if greater than
 * zero on a refresh) up to the target `value` over `durationMs`. Snaps to
 * integer steps via gsap's `snap: { textContent: 1 }` so the visible figure
 * never shows a decimal mid-tween — KPI counts are always whole numbers.
 *
 * Honours `prefers-reduced-motion: reduce`: the hook short-circuits and
 * stamps the final value directly onto the node, matching the rest of the DS
 * motion primitives (`usePageTransition`, `staggerListRows`, `Wordmark`).
 *
 * Defensive try/catch around the tween: if gsap throws (detached node,
 * mid-unmount, jsdom-style stub) the hook falls back to setting the final
 * value so the KPI tile is always readable.
 *
 * Usage:
 *
 *   const valueRef = useRef<HTMLSpanElement>(null);
 *   useCountUp(stats.open, { ref: valueRef });
 *   return <span ref={valueRef}>{stats.open}</span>;
 *
 * The initial JSX value is the fallback for environments where the effect
 * never runs (SSR, gsap absent) — once the effect lands, the hook owns
 * `textContent`.
 */

import { useEffect } from "react";
import type { RefObject } from "react";
import gsap from "gsap";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const DEFAULT_DURATION_MS = 600;

export interface UseCountUpOptions {
  /** Tween duration in milliseconds. Defaults to 600. */
  readonly durationMs?: number;
  /** Element whose `textContent` is driven by the tween. */
  readonly ref: RefObject<HTMLElement | null>;
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  if (typeof window.matchMedia !== "function") return false;
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

export function useCountUp(value: number, options: UseCountUpOptions): void {
  const { ref, durationMs = DEFAULT_DURATION_MS } = options;

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (!Number.isFinite(value)) {
      node.textContent = String(value);
      return;
    }

    if (prefersReducedMotion()) {
      node.textContent = String(value);
      return;
    }

    let tween: gsap.core.Tween | null = null;
    try {
      // `gsap.from({ textContent: 0 })` interpolates the numeric content from
      // 0 → current value (read from the DOM at tween start). We set the
      // final text first so gsap has a stable target, then animate "from" 0.
      node.textContent = String(value);
      const target = { count: 0 };
      tween = gsap.to(target, {
        count: value,
        duration: durationMs / 1000,
        ease: "power2.out",
        snap: { count: 1 },
        onUpdate: () => {
          node.textContent = String(Math.round(target.count));
        },
        onComplete: () => {
          // Guarantee the final value lands exactly, regardless of snap.
          node.textContent = String(value);
        },
      });
    } catch (error) {
      if (typeof console !== "undefined") {
        console.warn("[useCountUp] gsap tween failed, falling back to static value", error);
      }
      node.textContent = String(value);
    }

    return () => {
      if (tween !== null) {
        try {
          tween.kill();
        } catch {
          /* swallow — best-effort cleanup */
        }
      }
    };
  }, [value, durationMs, ref]);
}
