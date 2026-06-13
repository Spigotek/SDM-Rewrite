import { forwardRef } from "react";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ForwardedRef, ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "../../utils/cn";
import styles from "./Tile.module.css";

export type TileVariant = "quick-action" | "catalog" | "kb";

interface TileBaseProps {
  /** Icon node rendered inside the 40-px brand-tinted badge. Caller-provided (lucide icon, emoji, etc.). */
  icon?: ReactNode;
  /** Primary label — acts as the accessible name. */
  title: ReactNode;
  /** Single-line supporting text under the title. */
  description?: ReactNode;
  /** Optional meta slot (e.g. SLA chip) shown next to the trailing chevron. */
  meta?: ReactNode;
  /** Size hint — `quick-action` (default), `catalog`, or `kb`. */
  variant?: TileVariant;
}

export type TileAnchorProps = TileBaseProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "title"> & {
    /** When set, the Tile renders as an `<a>` anchor. */
    href: string;
  };

export type TileButtonProps = TileBaseProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "title"> & {
    href?: undefined;
    type?: "button" | "submit" | "reset";
  };

export type TileProps = TileAnchorProps | TileButtonProps;

/**
 * Large clickable surface for quick-actions, catalog items, and KB previews
 * (K.1 brief §6.3). Renders as `<a>` when `href` is provided, otherwise as a
 * native `<button type="button">`. The title is the accessible name; the
 * chevron is decorative.
 */
function TileImpl(props: TileProps, ref: ForwardedRef<HTMLAnchorElement | HTMLButtonElement>) {
  const { icon, title, description, meta, variant = "quick-action", className, ...rest } = props;

  const content = (
    <>
      <span className={styles.badge} aria-hidden="true">
        {icon}
      </span>
      <span className={styles.body}>
        <span className={styles.title}>{title}</span>
        {description != null && <span className={styles.description}>{description}</span>}
      </span>
      <span className={styles.trailing}>
        {meta != null && <span className={styles.meta}>{meta}</span>}
        <ChevronRight size={16} aria-hidden="true" className={styles.chevron} />
      </span>
    </>
  );

  const sharedClassName = cn(styles.tile, styles[variant], className);

  if (isAnchorProps(props)) {
    const { href, ...anchorRest } = rest as Omit<TileAnchorProps, keyof TileBaseProps>;
    return (
      <a
        ref={ref as ForwardedRef<HTMLAnchorElement>}
        href={href}
        className={sharedClassName}
        data-component="tile"
        data-variant={variant}
        {...anchorRest}
      >
        {content}
      </a>
    );
  }

  const { type = "button", ...buttonRest } = rest as Omit<TileButtonProps, keyof TileBaseProps>;
  return (
    <button
      ref={ref as ForwardedRef<HTMLButtonElement>}
      type={type}
      className={sharedClassName}
      data-component="tile"
      data-variant={variant}
      {...buttonRest}
    >
      {content}
    </button>
  );
}

function isAnchorProps(props: TileProps): props is TileAnchorProps {
  return typeof (props as TileAnchorProps).href === "string";
}

export const Tile = forwardRef<HTMLAnchorElement | HTMLButtonElement, TileProps>(TileImpl);
