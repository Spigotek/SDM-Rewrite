import { forwardRef, useId } from "react";
import type { ReactNode } from "react";
import * as RadixSelect from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "../../utils/cn";
import styles from "./Select.module.css";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps {
  label: string;
  srOnlyLabel?: boolean;
  options: ReadonlyArray<SelectOption>;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  helper?: ReactNode;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  id?: string;
  className?: string;
}

/**
 * Wraps Radix Select primitive with our tokenised skin. WAI-ARIA listbox
 * behaviour is handled by Radix; we only theme the trigger, content, and items.
 */
export const Select = forwardRef<HTMLButtonElement, SelectProps>(function Select(props, ref) {
  const {
    label,
    srOnlyLabel = false,
    options,
    value,
    defaultValue,
    onValueChange,
    placeholder = "Vyber…",
    helper,
    error,
    disabled,
    required,
    name,
    id: providedId,
    className,
  } = props;

  const reactId = useId();
  const id = providedId ?? `select-${reactId}`;
  const helperId = helper != null ? `${id}-helper` : undefined;
  const errorId = error != null ? `${id}-error` : undefined;
  const describedBy = [helperId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div
      className={cn(styles.field, className)}
      data-component="select"
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
      <RadixSelect.Root
        {...(value !== undefined && { value })}
        {...(defaultValue !== undefined && { defaultValue })}
        {...(onValueChange !== undefined && { onValueChange })}
        {...(disabled !== undefined && { disabled })}
        {...(name !== undefined && { name })}
        {...(required !== undefined && { required })}
      >
        <RadixSelect.Trigger
          ref={ref}
          id={id}
          className={cn(styles.trigger, error && styles.errorBorder)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
        >
          <RadixSelect.Value placeholder={placeholder} />
          <RadixSelect.Icon className={styles.icon}>
            <ChevronDown size={16} aria-hidden="true" />
          </RadixSelect.Icon>
        </RadixSelect.Trigger>
        <RadixSelect.Portal>
          <RadixSelect.Content className={styles.content} position="popper" sideOffset={4}>
            <RadixSelect.Viewport className={styles.viewport}>
              {options.map((opt) => (
                <RadixSelect.Item
                  key={opt.value}
                  value={opt.value}
                  disabled={opt.disabled ?? false}
                  className={styles.item}
                  data-component="select-item"
                >
                  <RadixSelect.ItemIndicator className={styles.itemIndicator}>
                    <Check size={14} aria-hidden="true" />
                  </RadixSelect.ItemIndicator>
                  <RadixSelect.ItemText>{opt.label}</RadixSelect.ItemText>
                </RadixSelect.Item>
              ))}
            </RadixSelect.Viewport>
          </RadixSelect.Content>
        </RadixSelect.Portal>
      </RadixSelect.Root>
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
});
