import { forwardRef, useId } from "react";
import type { ReactNode, TextareaHTMLAttributes } from "react";
import { cn } from "../../utils/cn";
import styles from "./TextArea.module.css";

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  srOnlyLabel?: boolean;
  helper?: ReactNode;
  error?: string;
  /** When set with `value`, a `X / N` counter is rendered. */
  maxLength?: number;
  required?: boolean;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  function TextArea(props, ref) {
    const {
      label,
      srOnlyLabel = false,
      helper,
      error,
      maxLength,
      id: providedId,
      required,
      value,
      className,
      rows = 4,
      ...rest
    } = props;

    const reactId = useId();
    const id = providedId ?? `text-area-${reactId}`;
    const helperId = helper != null ? `${id}-helper` : undefined;
    const errorId = error != null ? `${id}-error` : undefined;
    const counterId = maxLength != null ? `${id}-counter` : undefined;
    const describedBy = [helperId, errorId, counterId].filter(Boolean).join(" ") || undefined;

    const currentLength = typeof value === "string" ? value.length : 0;

    return (
      <div
        className={cn(styles.field, className)}
        data-component="text-area"
        data-state={error ? "error" : "default"}
      >
        <label htmlFor={id} className={cn(styles.label, srOnlyLabel && styles.srOnly)}>
          {label}
          {required && (
            <span className={styles.requiredMark} aria-label="povinné">
              *
            </span>
          )}
        </label>
        <textarea
          {...rest}
          ref={ref}
          id={id}
          rows={rows}
          className={cn(styles.textarea, error && styles.errorBorder)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          aria-required={required || undefined}
          required={required}
          maxLength={maxLength}
          value={value}
        />
        <div className={styles.helperRow}>
          {error != null ? (
            <span id={errorId} role="alert" className={styles.errorText}>
              {error}
            </span>
          ) : helper != null ? (
            <span id={helperId} className={styles.helper}>
              {helper}
            </span>
          ) : (
            <span />
          )}
          {maxLength != null && (
            <span id={counterId} className={styles.counter}>
              {currentLength} / {maxLength}
            </span>
          )}
        </div>
      </div>
    );
  },
);
