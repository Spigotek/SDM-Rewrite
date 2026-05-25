import { forwardRef, useId } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "../../utils/cn";
import styles from "./TextField.module.css";

export type TextFieldType = "text" | "email" | "password" | "number" | "search" | "tel" | "url";

export interface TextFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size"> {
  label: string;
  /** Visually hides the label but keeps it for assistive tech. */
  srOnlyLabel?: boolean;
  helper?: ReactNode;
  /** Error message — switches the field into `aria-invalid="true"` state. */
  error?: string;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  type?: TextFieldType;
  required?: boolean;
}

/**
 * Labeled single-line text input. Helper and error messages are wired via
 * `aria-describedby`; error toggles `aria-invalid` + visual emphasis.
 */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  function TextField(props, ref) {
    const {
      label,
      srOnlyLabel = false,
      helper,
      error,
      leadingIcon,
      trailingIcon,
      type = "text",
      id: providedId,
      required,
      disabled,
      className,
      ...rest
    } = props;

    const reactId = useId();
    const id = providedId ?? `text-field-${reactId}`;
    const helperId = helper != null ? `${id}-helper` : undefined;
    const errorId = error != null ? `${id}-error` : undefined;
    const describedBy = [helperId, errorId].filter(Boolean).join(" ") || undefined;

    return (
      <div
        className={cn(styles.field, className)}
        data-component="text-field"
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
        <div
          className={cn(styles.inputWrapper, error && styles.error, disabled && styles.disabled)}
        >
          {leadingIcon && (
            <span className={styles.adornment} aria-hidden="true">
              {leadingIcon}
            </span>
          )}
          <input
            {...rest}
            ref={ref}
            id={id}
            type={type}
            className={styles.input}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            aria-required={required || undefined}
            required={required}
            disabled={disabled}
          />
          {trailingIcon && (
            <span className={styles.adornment} aria-hidden="true">
              {trailingIcon}
            </span>
          )}
        </div>
        {helper != null && !error && (
          <span id={helperId} className={styles.helper}>
            {helper}
          </span>
        )}
        {error != null && (
          <span id={errorId} role="alert" className={styles.errorText}>
            {error}
          </span>
        )}
      </div>
    );
  },
);
