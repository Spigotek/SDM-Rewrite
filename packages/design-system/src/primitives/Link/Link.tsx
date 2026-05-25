import { forwardRef } from "react";
import type { AnchorHTMLAttributes } from "react";
import { cn } from "../../utils/cn";
import styles from "./Link.module.css";

export type LinkVariant = "default" | "subtle" | "code";

export interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: LinkVariant;
  /** When the link points to a different origin, marks it as external automatically. */
  external?: boolean;
}

export const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link(props, ref) {
  const { variant = "default", external, className, children, ...rest } = props;
  const externalProps = external ? { target: "_blank", rel: "noopener noreferrer" } : null;

  return (
    <a
      ref={ref}
      className={cn(styles.link, styles[variant], className)}
      data-component="link"
      data-variant={variant}
      {...externalProps}
      {...rest}
    >
      {children}
    </a>
  );
});
