import { forwardRef } from "react";
import { Badge } from "../Badge";
import type { BadgeProps, BadgeVariant } from "../Badge";

export type TicketStatus =
  | "new"
  | "open"
  | "in_progress"
  | "hold"
  | "pending"
  | "resolved"
  | "closed"
  | "reopened";

export type TicketModule = "incident" | "request" | "problem" | "change" | "kb";

export interface StatusBadgeProps extends Omit<BadgeProps, "variant" | "children"> {
  status: TicketStatus;
  module?: TicketModule;
  /** Optional override for the visible label — defaults to a built-in SK string. */
  label?: string;
}

const STATUS_VARIANT: Record<TicketStatus, BadgeVariant> = {
  new: "info",
  open: "warning",
  in_progress: "warning",
  hold: "hold",
  pending: "hold",
  resolved: "success",
  closed: "neutral",
  reopened: "danger",
};

const STATUS_LABEL_SK: Record<TicketStatus, string> = {
  new: "Nový",
  open: "Otvorený",
  in_progress: "V riešení",
  hold: "Pozastavený",
  pending: "Čaká",
  resolved: "Vyriešený",
  closed: "Uzavretý",
  reopened: "Znovuotvorený",
};

/**
 * Status badge bound to the ticket lifecycle vocabulary. Picks colour + label
 * from the canonical mapping in `tokens.md §Status badge mapping`. The module
 * attribute is reserved for future per-module label variants (KB has a slightly
 * different vocabulary).
 */
export const StatusBadge = forwardRef<HTMLSpanElement, StatusBadgeProps>(
  function StatusBadge(props, ref) {
    const { status, module: ticketModule = "incident", label, ...rest } = props;
    const variant = STATUS_VARIANT[status];
    const text = label ?? STATUS_LABEL_SK[status];

    return (
      <Badge
        ref={ref}
        variant={variant}
        data-component="status-badge"
        data-status={status}
        data-module={ticketModule}
        {...rest}
      >
        {text}
      </Badge>
    );
  },
);
