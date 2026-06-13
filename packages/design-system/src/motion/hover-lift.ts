/**
 * K.3.A — Hover-lift utility.
 *
 * Per K.1 brief §7: hover lift = `translateY(-2px)` + soft shadow + tinted
 * border on tiles and interactive cards. The transition is short
 * (`--motion-duration-fast` 120 ms) and uses `--motion-easing-out`.
 *
 * Card + Tile primitives already inline this style. This module exposes the
 * canonical CSS class name + inline-style helper so consumers outside the DS
 * (e.g. a future ad-hoc widget in a feature folder) can opt in to the same
 * visual without duplicating the rule.
 */

/** CSS class applied to consume the lift transitions defined in styles. */
export const HOVER_LIFT_CLASS_NAME = "sdm-hover-lift";

/**
 * Inline style object for callers that prefer style props over a class.
 * Mirrors the K.1 brief §7 CSS snippet. The component is responsible for
 * applying its own `:hover` selector — these styles only describe the base
 * transition.
 */
export const HOVER_LIFT_BASE_STYLE = {
  transition:
    "transform var(--motion-duration-fast) var(--motion-easing-standard), box-shadow var(--motion-duration-fast) var(--motion-easing-standard), border-color var(--motion-duration-fast) var(--motion-easing-standard)",
  willChange: "transform",
} as const;

/** Translate Y target for the lifted state (hover). */
export const HOVER_LIFT_TRANSLATE_Y = "-2px";
