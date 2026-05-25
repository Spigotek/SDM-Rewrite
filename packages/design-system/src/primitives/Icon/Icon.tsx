import { forwardRef } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../../utils/cn";
import styles from "./Icon.module.css";

export type IconSize = "xs" | "sm" | "md" | "lg";

export interface IconProps {
  /** Lucide icon component reference. */
  icon: LucideIcon;
  /** Visual size — defaults to `md` (20 px). */
  size?: IconSize;
  /** Accessible label. Required when the icon is the only conveyor of meaning. */
  "aria-label"?: string;
  /** When true (default for decorative icons), the icon is hidden from AT. */
  "aria-hidden"?: boolean | "true" | "false";
  className?: string;
}

/**
 * Thin wrapper over `lucide-react` icons that pins the size to a token scale
 * and threads `data-component` + a11y attrs consistently.
 *
 * Decorative usage defaults to `aria-hidden="true"`. When the icon stands alone
 * as the meaning of the control, pass `aria-label` — that flips to `role="img"`.
 */
export const Icon = forwardRef<SVGSVGElement, IconProps>(function Icon(props, ref) {
  const { icon: LucideComponent, size = "md", className, ...rest } = props;
  const ariaLabel = rest["aria-label"];
  const ariaHidden = rest["aria-hidden"];
  const decorative = ariaLabel == null && ariaHidden !== "false" && ariaHidden !== false;

  return (
    <LucideComponent
      ref={ref}
      className={cn(styles.icon, styles[size], className)}
      aria-hidden={decorative ? true : (ariaHidden ?? false)}
      aria-label={ariaLabel}
      role={ariaLabel != null ? "img" : undefined}
      data-component="icon"
      data-size={size}
      focusable="false"
    />
  );
});
