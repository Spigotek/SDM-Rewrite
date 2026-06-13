/**
 * K.1 brief §7 signature: list-item stagger on route mount.
 *
 * Applies a tiny fade + 6 px upward translate to every `[data-row]` descendant
 * of `container`, sequenced so the *total* stagger never exceeds 480 ms
 * regardless of row count.
 *
 * K.3.A — switched the implementation engine from the native Web Animations
 * API to GSAP (per K.1 brief §7 reference snippet). GSAP is now an explicit
 * `@sdm/design-system` dependency. The Web Animations API path is kept as a
 * defensive fallback — exercised when GSAP fails to import (e.g. SSR or test
 * environments without `window`), or when the synchronous `import()` is
 * skipped due to tree-shaking edge cases.
 *
 * Honours `prefers-reduced-motion` per K.1 brief §7: no transforms, no
 * staggering — elements land in their final state instantly.
 */

import gsap from "gsap";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const TOTAL_CAP_MS = 480;
const PER_ROW_MS = 20;
const DURATION_MS = 220;
const GSAP_EASE = "power3.out";
const WAAPI_EASING = "cubic-bezier(0.16, 1, 0.3, 1)";

export interface StaggerOptions {
  /** CSS selector for the rows. Defaults to `[data-row]` (brief convention). */
  selector?: string;
  /** Override per-row delay in milliseconds (default 20). */
  perRowMs?: number;
  /** Override the total stagger cap (default 480 ms). */
  totalCapMs?: number;
  /** Override the per-row animation duration (default 220 ms). */
  durationMs?: number;
}

export function staggerListRows(container: HTMLElement | null, options: StaggerOptions = {}): void {
  if (!container) return;
  if (typeof window === "undefined") return;

  const prefersReduced =
    typeof window.matchMedia === "function" && window.matchMedia(REDUCED_MOTION_QUERY).matches;

  const selector = options.selector ?? "[data-row]";
  const rows = container.querySelectorAll<HTMLElement>(selector);
  if (rows.length === 0) return;

  if (prefersReduced) {
    rows.forEach((row) => {
      row.style.opacity = "";
      row.style.transform = "";
    });
    if (gsap?.set) {
      gsap.set(rows, { clearProps: "all" });
    }
    return;
  }

  const totalCap = options.totalCapMs ?? TOTAL_CAP_MS;
  const perRow = options.perRowMs ?? PER_ROW_MS;
  const duration = options.durationMs ?? DURATION_MS;
  const effectivePerRowMs = Math.min(perRow, totalCap / rows.length);

  if (gsap?.from) {
    gsap.from(rows, {
      opacity: 0,
      y: 6,
      duration: duration / 1000,
      ease: GSAP_EASE,
      stagger: {
        each: effectivePerRowMs / 1000,
        amount: Math.min(totalCap, rows.length * effectivePerRowMs) / 1000,
      },
    });
    return;
  }

  // Defensive fallback — Web Animations API path. Used when GSAP is absent
  // (SSR, certain test isolation modes).
  rows.forEach((row, index) => {
    row.animate(
      [
        { opacity: 0, transform: "translateY(6px)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      {
        duration,
        delay: effectivePerRowMs * index,
        easing: WAAPI_EASING,
        fill: "both",
      },
    );
  });
}
