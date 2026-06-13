/**
 * L.1.A — Designed SDM wordmark for the top-bar / mobile-drawer brand slot.
 *
 * Visual: two overlapping rounded squares (indigo + indigo-darker, 4 px offset)
 * read as the "service desk" mark — a stack of work surfaces — followed by the
 * "SDM" wordmark in the design-system display sans with a tightened tracking
 * (Linear-style typography). The mark itself is the focal point; the wordmark
 * trails it as a textual anchor and is decorative (`aria-hidden`) because the
 * shell already announces "Service Desk Portal / Workspace" next to it.
 *
 * Animation: a first-mount GSAP timeline fades the whole svg in
 * (`opacity 0 → 1, scale 0.92 → 1`, 200 ms ease-out) and stagger-translates the
 * three wordmark letters from 6 px below their resting baseline (30 ms / letter).
 * Subsequent re-renders no-op — the entry is "play once".
 *
 * `prefers-reduced-motion: reduce` short-circuits the timeline and the
 * component renders in its final state without any tween, matching the rest of
 * the DS motion primitives (`usePageTransition`, `staggerListRows`).
 */

import { forwardRef, useEffect, useId, useRef } from "react";
import type { SVGAttributes } from "react";
import gsap from "gsap";

import { dataComponent } from "../utils/data-component";

export type WordmarkSize = "sm" | "md" | "lg";

export interface WordmarkProps extends Omit<SVGAttributes<SVGSVGElement>, "aria-label"> {
  /** Visual size — sm = 56×16, md = 80×24 (default), lg = 120×36. */
  size?: WordmarkSize;
  /** Render the mark in the current text color instead of brand indigo. */
  monochrome?: boolean;
  /** Overrides the accessible name. Defaults to "SDM". */
  "aria-label"?: string;
}

interface Dimensions {
  readonly width: number;
  readonly height: number;
  readonly markSize: number;
  readonly markOffset: number;
  readonly markRadius: number;
  readonly wordmarkFontSize: number;
  readonly wordmarkX: number;
  readonly wordmarkY: number;
}

const DIMENSIONS: Record<WordmarkSize, Dimensions> = {
  sm: {
    width: 56,
    height: 16,
    markSize: 11,
    markOffset: 3,
    markRadius: 2.5,
    wordmarkFontSize: 12,
    wordmarkX: 20,
    wordmarkY: 12,
  },
  md: {
    width: 80,
    height: 24,
    markSize: 16,
    markOffset: 4,
    markRadius: 3.5,
    wordmarkFontSize: 16,
    wordmarkX: 28,
    wordmarkY: 18,
  },
  lg: {
    width: 120,
    height: 36,
    markSize: 24,
    markOffset: 6,
    markRadius: 5,
    wordmarkFontSize: 24,
    wordmarkX: 42,
    wordmarkY: 27,
  },
};

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const LETTERS: readonly string[] = ["S", "D", "M"];

export const Wordmark = forwardRef<SVGSVGElement, WordmarkProps>(function Wordmark(
  { size = "md", monochrome = false, "aria-label": ariaLabel = "SDM", ...rest },
  forwardedRef,
) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const reactId = useId();
  const dims = DIMENSIONS[size];

  // Combine forwarded + internal refs so callers can still measure the node
  // while the animation effect keeps its own handle.
  const setRef = (node: SVGSVGElement | null) => {
    svgRef.current = node;
    if (typeof forwardedRef === "function") {
      forwardedRef(node);
    } else if (forwardedRef !== null) {
      forwardedRef.current = node;
    }
  };

  useEffect(() => {
    const node = svgRef.current;
    if (!node) return;

    if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
      if (window.matchMedia(REDUCED_MOTION_QUERY).matches) return;
    }

    // Defensive try/catch mirrors usePageTransition / staggerListRows: the
    // animation is decorative, so a gsap failure must never crash the shell.
    let tween: gsap.core.Timeline | null = null;
    try {
      const tl = gsap.timeline();
      tl.from(node, {
        opacity: 0,
        scale: 0.92,
        transformOrigin: "left center",
        duration: 0.2,
        ease: "power2.out",
      });
      const letters = node.querySelectorAll<SVGTextElement>("[data-wordmark-letter]");
      if (letters.length > 0) {
        tl.from(
          letters,
          {
            y: 6,
            opacity: 0,
            duration: 0.2,
            ease: "power2.out",
            stagger: 0.03,
          },
          "-=0.1",
        );
      }
      tween = tl;
    } catch (error) {
      if (typeof console !== "undefined") {
        console.warn("[Wordmark] gsap timeline failed, falling back to no animation", error);
      }
    }

    return () => {
      if (tween !== null) {
        try {
          tween.kill();
        } catch {
          /* swallow — best-effort cleanup */
        }
      }
      try {
        gsap.set(node, { clearProps: "opacity,transform" });
        const letters = node.querySelectorAll<SVGTextElement>("[data-wordmark-letter]");
        gsap.set(letters, { clearProps: "transform,opacity" });
      } catch {
        /* swallow */
      }
    };
  }, []);

  const markPrimaryColor = monochrome ? "currentColor" : "var(--color-primary-500, #6366f1)";
  const markSecondaryColor = monochrome ? "currentColor" : "var(--color-primary-700, #4338ca)";
  const markSecondaryOpacity = monochrome ? 0.7 : 1;
  const titleId = `${reactId}-wordmark-title`;

  return (
    <svg
      ref={setRef}
      role="img"
      aria-labelledby={titleId}
      aria-label={ariaLabel}
      width={dims.width}
      height={dims.height}
      viewBox={`0 0 ${dims.width} ${dims.height}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      data-size={size}
      data-monochrome={monochrome ? "true" : "false"}
      {...dataComponent("wordmark")}
      {...rest}
    >
      <title id={titleId}>{ariaLabel}</title>
      <rect
        data-wordmark-mark="back"
        x={dims.markOffset}
        y={dims.markOffset}
        width={dims.markSize}
        height={dims.markSize}
        rx={dims.markRadius}
        fill={markSecondaryColor}
        opacity={markSecondaryOpacity}
      />
      <rect
        data-wordmark-mark="front"
        x={0}
        y={0}
        width={dims.markSize}
        height={dims.markSize}
        rx={dims.markRadius}
        fill={markPrimaryColor}
      />
      <text
        x={dims.wordmarkX}
        y={dims.wordmarkY}
        fill="currentColor"
        fontFamily="var(--font-family-sans, 'Inter Variable', Inter, system-ui, sans-serif)"
        fontWeight={600}
        fontSize={dims.wordmarkFontSize}
        letterSpacing="-0.04em"
        aria-hidden="true"
      >
        {LETTERS.map((letter, index) => (
          <tspan
            key={letter}
            data-wordmark-letter={letter}
            // Spacing is handled by the font's metrics — explicit `dx` only
            // tightens letters that would otherwise sit too wide at small
            // sizes. The -1 px nudge on D/M reproduces the tracking spec.
            dx={index === 0 ? 0 : -1}
          >
            {letter}
          </tspan>
        ))}
      </text>
    </svg>
  );
});
