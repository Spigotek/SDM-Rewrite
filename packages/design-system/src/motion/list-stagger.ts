/**
 * K.1 brief §7 signature: list-item stagger on route mount.
 *
 * Applies a tiny fade + 6 px upward translate to every `[data-row]` descendant
 * of `container`, sequenced so the *total* stagger never exceeds 480 ms
 * regardless of row count. Brief calls for GSAP; this implementation uses the
 * native Web Animations API instead — zero new dependency, same visual
 * outcome. If we later want plugins (ScrollTrigger, MorphSVG) GSAP can be
 * adopted by swapping the body of this function; the public signature stays.
 *
 * Honours `prefers-reduced-motion` per K.1 brief §7: no transforms, no
 * staggering — elements land in their final state instantly.
 */

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const TOTAL_CAP_MS = 480;
const PER_ROW_MS = 20;
const DURATION_MS = 220;
const EASING = "cubic-bezier(0.16, 1, 0.3, 1)";

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
    return;
  }

  const totalCap = options.totalCapMs ?? TOTAL_CAP_MS;
  const perRow = options.perRowMs ?? PER_ROW_MS;
  const duration = options.durationMs ?? DURATION_MS;
  const effectivePerRow = Math.min(perRow, totalCap / rows.length);

  rows.forEach((row, index) => {
    row.animate(
      [
        { opacity: 0, transform: "translateY(6px)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      {
        duration,
        delay: effectivePerRow * index,
        easing: EASING,
        fill: "both",
      },
    );
  });
}
