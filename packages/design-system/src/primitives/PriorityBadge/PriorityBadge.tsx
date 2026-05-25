import { forwardRef } from "react";
import { Badge } from "../Badge";
import type { BadgeProps, BadgeVariant } from "../Badge";
import { cn } from "../../utils/cn";
import styles from "./PriorityBadge.module.css";

export type Severity = "critical" | "high" | "medium" | "low" | "none";

export interface PriorityBadgeProps
  extends Omit<BadgeProps, "variant" | "children" | "leadingIcon"> {
  severity: Severity;
  /** Override visible label. Default SK strings from `tokens.md §Priority mapping`. */
  label?: string;
}

const SEVERITY_VARIANT: Record<Severity, BadgeVariant> = {
  critical: "danger",
  high: "warning",
  medium: "warning",
  low: "success",
  none: "neutral",
};

const SEVERITY_LABEL_SK: Record<Severity, string> = {
  critical: "Kritická",
  high: "Vysoká",
  medium: "Stredná",
  low: "Nízka",
  none: "Žiadna",
};

const SEVERITY_DOT_CLASS: Record<Severity, string> = {
  critical: styles.dotCritical ?? "",
  high: styles.dotHigh ?? "",
  medium: styles.dotMedium ?? "",
  low: styles.dotLow ?? "",
  none: styles.dotNone ?? "",
};

/**
 * Priority badge — uses `color.severity.*` plus a coloured dot so the meaning is
 * never carried by colour alone (WCAG 1.4.1). The accessible name includes the
 * severity word so the dot is decorative.
 */
export const PriorityBadge = forwardRef<HTMLSpanElement, PriorityBadgeProps>(
  function PriorityBadge(props, ref) {
    const { severity, label, ...rest } = props;
    const text = label ?? SEVERITY_LABEL_SK[severity];
    const dot = (
      <span className={cn(styles.dot, SEVERITY_DOT_CLASS[severity])} aria-hidden="true" />
    );

    return (
      <Badge
        ref={ref}
        variant={SEVERITY_VARIANT[severity]}
        leadingIcon={dot}
        data-component="priority-badge"
        data-severity={severity}
        {...rest}
      >
        {text}
      </Badge>
    );
  },
);
