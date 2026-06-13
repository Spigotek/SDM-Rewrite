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

/**
 * K.1 brief §6.5 mapping:
 * - P1 / Critical → danger SOLID (filled bg + white fg, no dot)
 * - P2 / High     → warning subtle (+ dot)
 * - P3 / Medium   → info subtle    (+ dot)  ← changed from warning
 * - P4 / Low      → neutral subtle (+ dot)  ← changed from success
 * - None          → neutral subtle (+ dot)
 */
const SEVERITY_VARIANT: Record<Severity, BadgeVariant> = {
  critical: "danger",
  high: "warning",
  medium: "info",
  low: "neutral",
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
    const { severity, label, className, ...rest } = props;
    const text = label ?? SEVERITY_LABEL_SK[severity];
    const isSolid = severity === "critical";
    const dot = isSolid ? undefined : (
      <span className={cn(styles.dot, SEVERITY_DOT_CLASS[severity])} aria-hidden="true" />
    );

    return (
      <Badge
        ref={ref}
        variant={SEVERITY_VARIANT[severity]}
        leadingIcon={dot}
        className={cn(isSolid ? styles.criticalSolid : undefined, className)}
        data-component="priority-badge"
        data-severity={severity}
        {...rest}
      >
        {text}
      </Badge>
    );
  },
);
