/**
 * `Toast` — a single transient feedback notification (dumb-display primitive).
 *
 * This component (and its sibling `ToastViewport`) is intentionally stateless:
 * the queue, auto-dismiss timers, deduplication, and ordering are all the
 * caller's responsibility. The orchestration layer lives in
 * `apps/portal/src/shell/toasts.tsx` (per K.1 brief §6.9 — success/info auto-
 * dismiss 5 s, warning 8 s, danger sticky).
 *
 * Renders `role="status"` for `success`/`info` and `role="alert"` for
 * `warning`/`danger`. The dismiss button is always present; if `onDismiss` is
 * omitted it is rendered disabled so layout is consistent across intents.
 */

import { forwardRef } from "react";
import type { HTMLAttributes, ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { cn } from "../../utils/cn";
import styles from "./Toast.module.css";

export type ToastIntent = "success" | "info" | "warning" | "danger";

export interface ToastProps extends Omit<HTMLAttributes<HTMLDivElement>, "title" | "role"> {
  intent: ToastIntent;
  title: ReactNode;
  description?: ReactNode;
  onDismiss?: () => void;
  /** Caller-managed identifier — surfaced as `data-toast-id` for animation targeting. */
  id?: string;
}

const INTENT_ICON: Record<ToastIntent, typeof CheckCircle2> = {
  success: CheckCircle2,
  info: Info,
  warning: AlertTriangle,
  danger: XCircle,
};

const INTENT_ROLE: Record<ToastIntent, "status" | "alert"> = {
  success: "status",
  info: "status",
  warning: "alert",
  danger: "alert",
};

export const Toast = forwardRef<HTMLDivElement, ToastProps>(function Toast(props, ref) {
  const { intent, title, description, onDismiss, id, className, ...rest } = props;

  const Icon = INTENT_ICON[intent];
  const role = INTENT_ROLE[intent];

  return (
    <div
      ref={ref}
      role={role}
      className={cn(styles.toast, styles[intent], className)}
      data-component="toast"
      data-intent={intent}
      data-toast-id={id}
      {...rest}
    >
      <span className={styles.icon} aria-hidden="true" data-component="toast-icon">
        <Icon size={18} />
      </span>
      <div className={styles.body}>
        <div className={styles.title}>{title}</div>
        {description && <div className={styles.description}>{description}</div>}
      </div>
      <button
        type="button"
        className={styles.dismiss}
        onClick={onDismiss}
        disabled={!onDismiss}
        aria-label="Dismiss"
        data-component="toast-dismiss"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  );
});
