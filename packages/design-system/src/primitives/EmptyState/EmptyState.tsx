import { forwardRef } from "react";
import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../utils/cn";
import styles from "./EmptyState.module.css";

export type EmptyStateVariant = "hero" | "compact" | "minimal";

export interface EmptyStateProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  /**
   * Optional illustration node (unDraw SVG component, lucide icon, etc.).
   * Wrapped in an `aria-hidden` container so screen readers ignore it; the
   * heading must convey meaning on its own. Ignored by the `minimal` variant.
   */
  illustration?: ReactNode;
  /** Primary heading. Rendered as `<h2>`. */
  title: ReactNode;
  /** One-sentence supporting copy. */
  description?: ReactNode;
  /** Trailing CTA (typically a `<Button>` for hero/compact, link for minimal). */
  cta?: ReactNode;
  /** Visual density. Defaults to `compact`. */
  variant?: EmptyStateVariant;
}

/**
 * Empty-state primitive per K.1 design brief §6.8.
 *
 * - `hero` — full unDraw illustration (max 240 px), used on dedicated empty-state pages.
 * - `compact` — lucide icon in a 64×64 tinted circle, used inline; gets `role="status"`
 *    so screen readers announce when a list transitions to empty.
 * - `minimal` — heading + small description + link-style CTA, no illustration slot.
 */
export const EmptyState = forwardRef<HTMLDivElement, EmptyStateProps>(
  function EmptyState(props, ref) {
    const {
      illustration,
      title,
      description,
      cta,
      variant = "compact",
      className,
      ...rest
    } = props;

    const showIllustration = variant !== "minimal" && illustration != null;

    return (
      <div
        ref={ref}
        className={cn(styles.root, styles[variant], className)}
        data-component="empty-state"
        data-variant={variant}
        role={variant === "compact" ? "status" : undefined}
        {...rest}
      >
        {showIllustration && (
          <div
            className={cn(styles.illustration, variant === "compact" && styles.illustrationCircle)}
            aria-hidden="true"
            data-component="empty-state-illustration"
          >
            {illustration}
          </div>
        )}
        <h2 className={styles.title} data-component="empty-state-title">
          {title}
        </h2>
        {description != null && (
          <p className={styles.description} data-component="empty-state-description">
            {description}
          </p>
        )}
        {cta != null && (
          <div className={styles.footer} data-component="empty-state-footer">
            {cta}
          </div>
        )}
      </div>
    );
  },
);
