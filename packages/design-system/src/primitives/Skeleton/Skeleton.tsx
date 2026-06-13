import { forwardRef } from "react";
import type { CSSProperties, HTMLAttributes } from "react";
import { cn } from "../../utils/cn";
import styles from "./Skeleton.module.css";

export type SkeletonVariant = "text" | "block" | "circle" | "row";

export interface SkeletonProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: SkeletonVariant;
  width?: number | string;
  height?: number | string;
  /** Repeat the skeleton N times — useful for multi-line text placeholders. */
  count?: number;
}

const toCssLength = (v: number | string | undefined): string | undefined => {
  if (v === undefined) return undefined;
  return typeof v === "number" ? `${v}px` : v;
};

/**
 * Loading placeholder with the shared shimmer keyframe (`sdm-skeleton-shimmer`
 * declared in `tokens.css`). Variants follow K.1 brief §6.11: text / block /
 * circle / row. Reduced-motion honoured at the CSS layer.
 */
export const Skeleton = forwardRef<HTMLSpanElement, SkeletonProps>(function Skeleton(props, ref) {
  const {
    variant = "text",
    width,
    height,
    count = 1,
    className,
    style,
    "aria-hidden": ariaHidden = true,
    ...rest
  } = props;

  const inlineStyle: CSSProperties = {
    width: toCssLength(width),
    height: toCssLength(height),
    ...style,
  };

  if (count > 1) {
    return (
      <span ref={ref} className={cn(styles.stack, className)} aria-hidden={ariaHidden} {...rest}>
        {Array.from({ length: count }, (_, i) => (
          <span
            key={i}
            className={cn(styles.skeleton, styles[variant])}
            style={inlineStyle}
            data-component="skeleton"
            data-variant={variant}
          />
        ))}
      </span>
    );
  }

  return (
    <span
      ref={ref}
      className={cn(styles.skeleton, styles[variant], className)}
      style={inlineStyle}
      data-component="skeleton"
      data-variant={variant}
      aria-hidden={ariaHidden}
      {...rest}
    />
  );
});
