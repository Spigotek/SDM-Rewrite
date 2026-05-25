import { forwardRef } from "react";
import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../utils/cn";
import styles from "./Card.module.css";

export type CardVariant = "surface" | "outlined" | "interactive" | "subtle";

export interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  variant?: CardVariant;
  title?: ReactNode;
  meta?: ReactNode;
  footer?: ReactNode;
}

/**
 * Container primitive for related information. `interactive` variant adds a
 * hover lift + focus ring; caller is responsible for setting `role`/`tabIndex`
 * when used as a clickable surface.
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(props, ref) {
  const { variant = "surface", title, meta, footer, className, children, ...rest } = props;
  const hasHeader = title != null || meta != null;

  return (
    <div
      ref={ref}
      className={cn(styles.card, styles[variant], className)}
      data-component="card"
      data-variant={variant}
      {...rest}
    >
      {hasHeader && (
        <header className={styles.header} data-component="card-header">
          {title != null && <h3 className={styles.title}>{title}</h3>}
          {meta != null && <div className={styles.meta}>{meta}</div>}
        </header>
      )}
      <div className={styles.body} data-component="card-body">
        {children}
      </div>
      {footer != null && (
        <footer className={styles.footer} data-component="card-footer">
          {footer}
        </footer>
      )}
    </div>
  );
});
