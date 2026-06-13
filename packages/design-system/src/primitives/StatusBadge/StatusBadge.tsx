import { forwardRef } from "react";
import {
  CalendarClock,
  CheckCircle2,
  Circle,
  CircleDot,
  Clock,
  LoaderCircle,
  PauseCircle,
  ShieldQuestion,
  ShieldX,
  XCircle,
  XOctagon,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "../Badge";
import type { BadgeProps, BadgeVariant } from "../Badge";

export type TicketStatus =
  | "new"
  | "open"
  | "in_progress"
  | "hold"
  | "pending"
  | "waiting_customer"
  | "waiting_vendor"
  | "resolved"
  | "closed"
  | "cancelled"
  | "rejected"
  | "approval_pending"
  | "approval_rejected"
  | "scheduled"
  | "reopened";

export type TicketModule = "incident" | "request" | "problem" | "change" | "kb";

/**
 * CA SDM 17.4 status code → canonical `TicketStatus` (K.1 brief §6.4).
 * Codes confirmed against `apps/bff/src/api/endpoints/` mappers; `SC`/`AP`/`AR`/`RJ`
 * still flagged for owner confirmation (open question #2 in K.1).
 */
const CA_SDM_CODE_MAP: Record<string, TicketStatus> = {
  OP: "open",
  WIP: "in_progress",
  HD: "hold",
  WC: "waiting_customer",
  WV: "waiting_vendor",
  RE: "resolved",
  CL: "closed",
  CN: "cancelled",
  RJ: "rejected",
  AP: "approval_pending",
  AR: "approval_rejected",
  SC: "scheduled",
};

export interface StatusBadgeProps extends Omit<BadgeProps, "variant" | "children" | "leadingIcon"> {
  status?: TicketStatus;
  /** Raw CA SDM status code (e.g. "WIP", "OP"). When set, takes precedence over `status`. */
  caCode?: string;
  module?: TicketModule;
  /** Optional override for the visible label — defaults to a built-in SK string. */
  label?: string;
  /** Render a leading lucide icon matched to the status family. Defaults to false. */
  withIcon?: boolean;
}

const STATUS_VARIANT: Record<TicketStatus, BadgeVariant> = {
  new: "info",
  open: "info",
  in_progress: "brand",
  hold: "warning",
  pending: "hold",
  waiting_customer: "warning",
  waiting_vendor: "warning",
  resolved: "success",
  closed: "neutral",
  cancelled: "neutral",
  rejected: "danger",
  approval_pending: "brand",
  approval_rejected: "danger",
  scheduled: "info",
  reopened: "danger",
};

const STATUS_LABEL_SK: Record<TicketStatus, string> = {
  new: "Nový",
  open: "Otvorený",
  in_progress: "V riešení",
  hold: "Pozastavený",
  pending: "Čaká",
  waiting_customer: "Čaká na zákazníka",
  waiting_vendor: "Čaká na dodávateľa",
  resolved: "Vyriešený",
  closed: "Uzavretý",
  cancelled: "Zrušený",
  rejected: "Zamietnutý",
  approval_pending: "Čaká na schválenie",
  approval_rejected: "Schválenie zamietnuté",
  scheduled: "Naplánovaný",
  reopened: "Znovuotvorený",
};

const STATUS_ICON: Record<TicketStatus, LucideIcon> = {
  new: CircleDot,
  open: CircleDot,
  in_progress: LoaderCircle,
  hold: PauseCircle,
  pending: Clock,
  waiting_customer: Clock,
  waiting_vendor: Clock,
  resolved: CheckCircle2,
  closed: Circle,
  cancelled: XCircle,
  rejected: XOctagon,
  approval_pending: ShieldQuestion,
  approval_rejected: ShieldX,
  scheduled: CalendarClock,
  reopened: CircleDot,
};

const ICON_PX = 12;

const resolveStatus = (
  caCode: string | undefined,
  status: TicketStatus | undefined,
): TicketStatus => {
  if (caCode) {
    const mapped = CA_SDM_CODE_MAP[caCode];
    if (mapped) return mapped;
  }
  return status ?? "new";
};

/**
 * Status badge bound to the ticket lifecycle vocabulary. K.1 brief §6.4 mapping
 * — 12 CA SDM codes resolve to canonical `TicketStatus` via `caCode`. The
 * existing `status` prop continues to drive UI-side state. Set `withIcon` to
 * render a leading lucide glyph matched to the status family.
 */
export const StatusBadge = forwardRef<HTMLSpanElement, StatusBadgeProps>(
  function StatusBadge(props, ref) {
    const { status, caCode, module: ticketModule = "incident", label, withIcon, ...rest } = props;
    const resolved = resolveStatus(caCode, status);
    const variant = STATUS_VARIANT[resolved];
    const text = label ?? STATUS_LABEL_SK[resolved];
    const Icon = withIcon ? STATUS_ICON[resolved] : null;

    return (
      <Badge
        ref={ref}
        variant={variant}
        leadingIcon={Icon ? <Icon size={ICON_PX} strokeWidth={2} /> : undefined}
        data-component="status-badge"
        data-status={resolved}
        data-module={ticketModule}
        {...(caCode ? { "data-ca-code": caCode } : {})}
        {...rest}
      >
        {text}
      </Badge>
    );
  },
);
