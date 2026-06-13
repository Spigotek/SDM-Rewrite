/**
 * `ToastViewport` — fixed top-right container that positions and stacks toasts.
 *
 * Stateless: the caller owns the queue, dismissal, and ordering. The viewport
 * picks `aria-live="assertive"` whenever any child carries `intent="danger"`,
 * otherwise it falls back to `polite` (success/info/warning).
 */

import { Children, forwardRef, isValidElement } from "react";
import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../utils/cn";
import styles from "./Toast.module.css";
import type { ToastIntent } from "./Toast";

export interface ToastViewportProps extends Omit<HTMLAttributes<HTMLOListElement>, "aria-live"> {
  /** Force a specific live-region politeness. Defaults to derived-from-children. */
  ariaLive?: "polite" | "assertive";
  children?: ReactNode;
}

function hasDangerChild(children: ReactNode): boolean {
  let danger = false;
  Children.forEach(children, (child) => {
    if (danger) return;
    if (!isValidElement(child)) return;
    const intent = (child.props as { intent?: ToastIntent }).intent;
    if (intent === "danger") danger = true;
  });
  return danger;
}

export const ToastViewport = forwardRef<HTMLOListElement, ToastViewportProps>(
  function ToastViewport(props, ref) {
    const { ariaLive, className, children, ...rest } = props;
    const live = ariaLive ?? (hasDangerChild(children) ? "assertive" : "polite");

    return (
      <ol
        ref={ref}
        aria-live={live}
        aria-relevant="additions text"
        className={cn(styles.viewport, className)}
        data-component="toast-viewport"
        data-live={live}
        {...rest}
      >
        {Children.map(children, (child) =>
          isValidElement(child) ? <li className={styles.viewportItem}>{child}</li> : child,
        )}
      </ol>
    );
  },
);
