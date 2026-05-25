import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../../utils/cn";
import styles from "./Button.module.css";

export type ButtonVariant = "primary" | "secondary" | "tertiary" | "destructive" | "success";
export type ButtonSize = "xs" | "sm" | "md" | "lg";

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  variant: ButtonVariant;
  size?: ButtonSize;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  loading?: boolean;
  fullWidth?: boolean;
  type?: "button" | "submit" | "reset";
}

/**
 * Primary action button.
 *
 * - Native `<button type="button">` unless overridden.
 * - `loading` disables interaction and renders a spinner without changing width
 *   (CSS reserves the spinner's slot via `gap` token).
 * - Focus ring uses `--shadow-focus-brand` (`--shadow-focus-danger` for destructive).
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(props, ref) {
  const {
    variant,
    size = "md",
    leadingIcon,
    trailingIcon,
    loading = false,
    fullWidth = false,
    disabled,
    type = "button",
    className,
    children,
    ...rest
  } = props;

  const isDisabled = disabled || loading;

  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        styles.button,
        styles[variant],
        styles[size],
        fullWidth && styles.fullWidth,
        className,
      )}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      data-component="button"
      data-variant={variant}
      data-size={size}
      {...rest}
    >
      {loading ? (
        <span className={styles.spinner} aria-hidden="true" />
      ) : (
        leadingIcon && <span aria-hidden="true">{leadingIcon}</span>
      )}
      {children}
      {!loading && trailingIcon && <span aria-hidden="true">{trailingIcon}</span>}
    </button>
  );
});
