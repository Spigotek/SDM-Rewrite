import { forwardRef } from "react";
import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../utils/cn";
import styles from "./Badge.module.css";

export type BadgeVariant = "neutral" | "info" | "success" | "warning" | "danger" | "brand" | "hold";
export type BadgeShape = "rounded" | "pill" | "square";
export type BadgeSize = "xs" | "sm" | "md";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  shape?: BadgeShape;
  size?: BadgeSize;
  leadingIcon?: ReactNode;
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(props, ref) {
  const {
    variant = "neutral",
    shape = "rounded",
    size = "sm",
    leadingIcon,
    className,
    children,
    ...rest
  } = props;

  return (
    <span
      ref={ref}
      className={cn(styles.badge, styles[variant], styles[shape], styles[size], className)}
      data-component="badge"
      data-variant={variant}
      data-shape={shape}
      data-size={size}
      {...rest}
    >
      {leadingIcon && (
        <span aria-hidden="true" data-component="badge-icon">
          {leadingIcon}
        </span>
      )}
      {children}
    </span>
  );
});
