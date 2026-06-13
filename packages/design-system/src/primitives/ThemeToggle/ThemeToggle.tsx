import { forwardRef, useMemo } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { Icon } from "../Icon";
import { IconButton } from "../IconButton";
import type { ThemeChoice } from "../../tokens/theme";
import { cn } from "../../utils/cn";
import styles from "./ThemeToggle.module.css";

export interface ThemeToggleProps {
  /** Current persisted choice. `"hc"` is reachable via storage but skipped by the cycle. */
  value: ThemeChoice;
  /** Fires with the next choice in the `system → light → dark → system` cycle. */
  onChange: (next: ThemeChoice) => void;
  /** Accessible label. Defaults to a sentence reflecting the current state. */
  "aria-label"?: string;
  className?: string;
}

const CYCLE: ReadonlyArray<Exclude<ThemeChoice, "hc">> = ["system", "light", "dark"];

function nextInCycle(value: ThemeChoice): ThemeChoice {
  // High-contrast is outside the toggle cycle — treat it as "system" for
  // cycle progression so users still have a path back to the default.
  if (value === "hc") return "system";
  const index = CYCLE.indexOf(value);
  return CYCLE[(index + 1) % CYCLE.length] ?? "system";
}

function defaultLabel(value: ThemeChoice): string {
  switch (value) {
    case "system":
      return "Theme: system (click to switch to light)";
    case "light":
      return "Theme: light (click to switch to dark)";
    case "dark":
      return "Theme: dark (click to switch to system)";
    case "hc":
      return "Theme: high contrast (click to reset to system)";
  }
}

/**
 * K.3.A — Theme cycle button. Renders one of three icons (Monitor/Sun/Moon)
 * depending on the current persisted choice, and cycles `system → light →
 * dark → system` on activation. The `hc` choice is reachable only via
 * `localStorage` (or future `useTheme().setChoice("hc")` direct calls) and
 * resets back to `system` when the user clicks the toggle.
 *
 * Built on top of the DS `IconButton` so focus rings, sizing, and ghost-bg
 * hover come for free.
 */
export const ThemeToggle = forwardRef<HTMLButtonElement, ThemeToggleProps>(
  function ThemeToggle(props, ref) {
    const { value, onChange, className } = props;
    const ariaLabel = props["aria-label"] ?? defaultLabel(value);

    const icon = useMemo(() => {
      switch (value) {
        case "light":
          return <Icon icon={Sun} size="sm" />;
        case "dark":
          return <Icon icon={Moon} size="sm" />;
        case "system":
        case "hc":
        default:
          return <Icon icon={Monitor} size="sm" />;
      }
    }, [value]);

    return (
      <IconButton
        ref={ref}
        size="sm"
        variant="ghost"
        aria-label={ariaLabel}
        className={cn(styles.toggle, className)}
        data-component="theme-toggle"
        data-value={value}
        onClick={() => onChange(nextInCycle(value))}
        icon={icon}
      />
    );
  },
);
