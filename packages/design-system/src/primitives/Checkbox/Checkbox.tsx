import { forwardRef, useId } from "react";
import type { ReactNode } from "react";
import * as RadixCheckbox from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { cn } from "../../utils/cn";
import styles from "./Checkbox.module.css";

export type CheckedState = boolean | "indeterminate";

export interface CheckboxProps {
  label: ReactNode;
  checked?: CheckedState;
  defaultChecked?: CheckedState;
  onCheckedChange?: (state: CheckedState) => void;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  value?: string;
  id?: string;
  className?: string;
}

/**
 * Checkbox styled on top of Radix Checkbox primitive. Supports indeterminate
 * state via Radix's tristate model (`"indeterminate"`).
 */
export const Checkbox = forwardRef<HTMLButtonElement, CheckboxProps>(function Checkbox(props, ref) {
  const {
    label,
    checked,
    defaultChecked,
    onCheckedChange,
    disabled,
    required,
    name,
    value,
    id: providedId,
    className,
  } = props;

  const reactId = useId();
  const id = providedId ?? `checkbox-${reactId}`;

  return (
    <label
      htmlFor={id}
      className={cn(styles.row, className)}
      data-component="checkbox"
      data-disabled={disabled ? "" : undefined}
    >
      <RadixCheckbox.Root
        ref={ref}
        id={id}
        className={styles.root}
        {...(checked !== undefined && { checked })}
        {...(defaultChecked !== undefined && { defaultChecked })}
        {...(onCheckedChange !== undefined && { onCheckedChange })}
        {...(disabled !== undefined && { disabled })}
        {...(required !== undefined && { required })}
        {...(name !== undefined && { name })}
        {...(value !== undefined && { value })}
      >
        <RadixCheckbox.Indicator className={styles.indicator}>
          {checked === "indeterminate" ? (
            <span className={styles.indeterminateDash} aria-hidden="true" />
          ) : (
            <Check size={12} aria-hidden="true" />
          )}
        </RadixCheckbox.Indicator>
      </RadixCheckbox.Root>
      <span className={styles.label}>{label}</span>
    </label>
  );
});
