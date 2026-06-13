import { forwardRef } from "react";
import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from "react";
import { cn } from "../../utils/cn";
import styles from "./NavLink.module.css";

export type NavLinkVariant = "horizontal" | "vertical";

export interface NavLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  href: string;
  label: ReactNode;
  icon?: ReactNode;
  count?: number | string;
  variant?: NavLinkVariant;
  active?: boolean;
  disabled?: boolean;
}

/**
 * Router-agnostic nav item. Renders a native `<a>`; the caller wires it to
 * React Router (e.g. by spreading `NavLink` from `react-router-dom` props onto
 * this component, or by stacking it inside a router link). The component owns
 * presentation only — the `active` flag is caller-controlled because only the
 * caller knows route state.
 */
export const NavLink = forwardRef<HTMLAnchorElement, NavLinkProps>(function NavLink(props, ref) {
  const {
    href,
    label,
    icon,
    count,
    variant = "horizontal",
    active = false,
    disabled = false,
    className,
    onClick,
    ...rest
  } = props;

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (disabled) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    onClick?.(event);
  };

  const hasCount = count !== undefined && count !== null && count !== "";
  const countSrText = hasCount ? `, ${count} items` : null;

  return (
    <a
      ref={ref}
      href={disabled ? undefined : href}
      className={cn(
        styles.navLink,
        styles[variant],
        active && styles.active,
        disabled && styles.disabled,
        className,
      )}
      data-component="nav-link"
      data-variant={variant}
      data-active={active ? "true" : "false"}
      aria-current={active ? "page" : undefined}
      aria-disabled={disabled ? "true" : undefined}
      tabIndex={disabled ? -1 : undefined}
      onClick={handleClick}
      {...rest}
    >
      {icon ? (
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <span className={styles.label}>
        {label}
        {countSrText ? <span className={styles.srOnly}>{countSrText}</span> : null}
      </span>
      {hasCount ? (
        <span className={cn(styles.count, active && styles.countActive)} aria-hidden="true">
          {count}
        </span>
      ) : null}
    </a>
  );
});
