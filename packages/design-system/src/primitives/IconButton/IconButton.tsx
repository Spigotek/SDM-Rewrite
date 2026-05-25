import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../../utils/cn";
import styles from "./IconButton.module.css";

export type IconButtonVariant = "ghost" | "solid" | "outline" | "danger";
export type IconButtonSize = "xs" | "sm" | "md" | "lg";

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  /** Accessible name — required because the button has no visible text. */
  "aria-label": string;
  icon: ReactNode;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  type?: "button" | "submit" | "reset";
}

/**
 * Square button with only an icon visible. `aria-label` is mandatory by type;
 * a tooltip is a supplement, never a substitute.
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(props, ref) {
    const { icon, variant = "ghost", size = "md", type = "button", className, ...rest } = props;

    return (
      <button
        ref={ref}
        type={type}
        className={cn(styles.iconButton, styles[size], styles[variant], className)}
        data-component="icon-button"
        data-variant={variant}
        data-size={size}
        {...rest}
      >
        {icon}
      </button>
    );
  },
);
