import { forwardRef, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import gsap from "gsap";
import {
  CalendarClock,
  CheckCircle2,
  ChevronDown,
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
import badgeStyles from "../Badge/Badge.module.css";
import { cn } from "../../utils/cn";
import styles from "./StatusBadge.module.css";

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

/**
 * L.1.C — documented CA SDM lifecycle map used as the fallback when a caller
 * opts the badge into `transitionable` but doesn't pass an explicit
 * `allowedTransitions` list. Terminal statuses map to empty arrays so the menu
 * surfaces "no next steps" instead of crashing.
 */
export const CA_SDM_TRANSITIONS: Record<TicketStatus, ReadonlyArray<TicketStatus>> = {
  new: ["open", "in_progress", "cancelled", "rejected"],
  open: ["in_progress", "hold", "waiting_customer", "waiting_vendor", "resolved", "cancelled"],
  in_progress: ["hold", "waiting_customer", "waiting_vendor", "resolved", "open"],
  hold: ["in_progress", "cancelled"],
  pending: ["in_progress", "cancelled"],
  waiting_customer: ["in_progress", "resolved", "cancelled"],
  waiting_vendor: ["in_progress", "resolved", "cancelled"],
  resolved: ["closed", "reopened"],
  closed: ["reopened"],
  cancelled: [],
  rejected: [],
  approval_pending: ["approval_rejected", "scheduled"],
  approval_rejected: [],
  scheduled: ["in_progress", "cancelled"],
  reopened: ["in_progress", "resolved"],
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
  /**
   * L.1.C — render the lozenge as a `<button>` that opens a transition popover.
   * Defaults to `false` so existing read-only callsites stay unchanged.
   */
  transitionable?: boolean;
  /**
   * Explicit list of allowed next statuses for the popover. When omitted, falls
   * back to `CA_SDM_TRANSITIONS[current]`. Ignored when `transitionable=false`.
   */
  allowedTransitions?: ReadonlyArray<TicketStatus>;
  /** Called when the user picks a target status from the menu. */
  onTransition?: (next: TicketStatus) => void | Promise<void>;
  /** Disables the trigger button (and prevents the popover from opening). */
  disabled?: boolean;
  /** Localised label for the popover (accessibility name + tooltip). */
  menuLabel?: string;
  /**
   * Localised label override per target status — falls back to the built-in SK
   * label when omitted. Used by callsites that want EN labels in the menu.
   */
  transitionLabel?: (next: TicketStatus) => string;
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
const CHEVRON_PX = 12;
const MENU_ICON_PX = 14;
const ENTER_DURATION_S = 0.14;
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

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

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

function computeMenuPosition(anchor: HTMLElement | null): CSSProperties {
  if (!anchor || typeof window === "undefined") return { top: 0, left: 0 };
  const rect = anchor.getBoundingClientRect();
  return {
    top: Math.round(rect.bottom + 4),
    left: Math.round(rect.left),
  };
}

/**
 * Status badge bound to the ticket lifecycle vocabulary. K.1 brief §6.4
 * mapping — 12 CA SDM codes resolve to canonical `TicketStatus` via `caCode`.
 * The existing `status` prop continues to drive UI-side state. Set `withIcon`
 * to render a leading lucide glyph matched to the status family.
 *
 * L.1.C — when `transitionable=true` the lozenge renders as a `<button>` and
 * opens a popover listing allowed next statuses. The transition list comes
 * from `allowedTransitions` (caller override) or `CA_SDM_TRANSITIONS` as the
 * documented fallback. Selecting an item calls `onTransition(next)`.
 */
export const StatusBadge = forwardRef<HTMLSpanElement, StatusBadgeProps>(
  function StatusBadge(props, ref) {
    const {
      status,
      caCode,
      module: ticketModule = "incident",
      label,
      withIcon,
      transitionable = false,
      allowedTransitions,
      onTransition,
      disabled = false,
      menuLabel,
      transitionLabel,
      className,
      ...rest
    } = props;

    const resolved = resolveStatus(caCode, status);
    const variant = STATUS_VARIANT[resolved];
    const text = label ?? STATUS_LABEL_SK[resolved];
    const Icon = withIcon ? STATUS_ICON[resolved] : null;

    if (!transitionable) {
      return (
        <Badge
          ref={ref}
          variant={variant}
          leadingIcon={Icon ? <Icon size={ICON_PX} strokeWidth={2} /> : undefined}
          data-component="status-badge"
          data-status={resolved}
          data-module={ticketModule}
          {...(caCode ? { "data-ca-code": caCode } : {})}
          {...(className ? { className } : {})}
          {...rest}
        >
          {text}
        </Badge>
      );
    }

    return (
      <TransitionableStatusBadge
        forwardedRef={ref}
        resolved={resolved}
        variant={variant}
        text={text}
        Icon={Icon}
        ticketModule={ticketModule}
        caCode={caCode}
        disabled={disabled}
        allowedTransitions={allowedTransitions}
        onTransition={onTransition}
        menuLabel={menuLabel}
        transitionLabel={transitionLabel}
        className={className}
        rest={rest}
      />
    );
  },
);

interface TransitionableProps {
  readonly forwardedRef: React.ForwardedRef<HTMLSpanElement>;
  readonly resolved: TicketStatus;
  readonly variant: BadgeVariant;
  readonly text: string;
  readonly Icon: LucideIcon | null;
  readonly ticketModule: TicketModule;
  readonly caCode: string | undefined;
  readonly disabled: boolean;
  readonly allowedTransitions: ReadonlyArray<TicketStatus> | undefined;
  readonly onTransition: ((next: TicketStatus) => void | Promise<void>) | undefined;
  readonly menuLabel: string | undefined;
  readonly transitionLabel: ((next: TicketStatus) => string) | undefined;
  readonly className: string | undefined;
  readonly rest: Record<string, unknown>;
}

function TransitionableStatusBadge(props: TransitionableProps) {
  const {
    forwardedRef,
    resolved,
    variant,
    text,
    Icon,
    ticketModule,
    caCode,
    disabled,
    allowedTransitions,
    onTransition,
    menuLabel,
    transitionLabel,
    className,
    rest,
  } = props;

  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<CSSProperties>({ top: 0, left: 0 });
  const [focusedIndex, setFocusedIndex] = useState(0);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();

  const transitions = useMemo<ReadonlyArray<TicketStatus>>(
    () => allowedTransitions ?? CA_SDM_TRANSITIONS[resolved] ?? [],
    [allowedTransitions, resolved],
  );

  const close = useCallback(() => {
    setOpen(false);
    setFocusedIndex(0);
  }, []);

  const handleSelect = useCallback(
    (next: TicketStatus) => {
      // Fire-and-forget — callers manage their own async state.
      const result = onTransition?.(next);
      if (result && typeof (result as Promise<unknown>).then === "function") {
        (result as Promise<unknown>).catch(() => {
          /* caller surfaces error */
        });
      }
      close();
    },
    [onTransition, close],
  );

  const onTriggerClick = useCallback(() => {
    if (disabled) return;
    setOpen((prev) => !prev);
  }, [disabled]);

  // Anchor position computed each time the menu opens.
  useEffect(() => {
    if (!open) return;
    setPosition(computeMenuPosition(buttonRef.current));
    setFocusedIndex(0);
  }, [open]);

  // Keyboard + outside-click handling while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        buttonRef.current?.focus();
        return;
      }
      if (transitions.length === 0) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setFocusedIndex((prev) => (prev + 1) % transitions.length);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setFocusedIndex((prev) => (prev - 1 + transitions.length) % transitions.length);
      } else if (event.key === "Home") {
        event.preventDefault();
        setFocusedIndex(0);
      } else if (event.key === "End") {
        event.preventDefault();
        setFocusedIndex(transitions.length - 1);
      } else if (event.key === "Enter" || event.key === " ") {
        // Only handle when focus is inside the menu — let the trigger handle its own.
        const active = document.activeElement;
        if (menuRef.current && active && menuRef.current.contains(active)) {
          event.preventDefault();
          const target = transitions[focusedIndex];
          if (target) handleSelect(target);
        }
      }
    };
    const onClickOutside = (event: MouseEvent): void => {
      const target = event.target as Node | null;
      if (!target) return;
      if (menuRef.current && menuRef.current.contains(target)) return;
      if (buttonRef.current && buttonRef.current.contains(target)) return;
      close();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClickOutside);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClickOutside);
    };
  }, [open, transitions, focusedIndex, handleSelect, close]);

  // Move keyboard focus to the selected item when index changes.
  useEffect(() => {
    if (!open) return;
    const node = menuRef.current?.querySelector<HTMLButtonElement>(
      `[data-menu-index="${focusedIndex}"]`,
    );
    if (node) {
      try {
        node.focus({ preventScroll: true });
      } catch {
        /* swallow */
      }
    }
  }, [open, focusedIndex]);

  // GSAP fade+lift enter for the popover.
  useEffect(() => {
    if (!open) return;
    const node = menuRef.current;
    if (!node) return;
    const reduced = prefersReducedMotion();
    let tween: gsap.core.Tween | null = null;
    try {
      tween = gsap.fromTo(
        node,
        { opacity: 0, y: reduced ? 0 : -2 },
        { opacity: 1, y: 0, duration: reduced ? 0 : ENTER_DURATION_S, ease: "power1.out" },
      );
    } catch {
      /* best-effort */
    }
    return () => {
      if (tween !== null) {
        try {
          tween.kill();
        } catch {
          /* swallow */
        }
      }
      try {
        gsap.set(node, { clearProps: "opacity,transform" });
      } catch {
        /* swallow */
      }
    };
  }, [open]);

  // Forwarded refs on the transitionable variant target the trigger button so
  // callers can still focus/measure the badge. The read-only variant continues
  // to forward a `HTMLSpanElement` ref to the underlying Badge `<span>`.
  const assignTriggerRef = (node: HTMLButtonElement | null): void => {
    buttonRef.current = node;
    // Cross-cast: callers using `<StatusBadge ref={spanRef}>` will receive the
    // button node when transitionable is on. The DOM types are different but
    // the contract is unchanged for read-only callsites (the only ones that
    // exist before L.1.C).
    if (typeof forwardedRef === "function") (forwardedRef as (n: HTMLElement | null) => void)(node);
    else if (forwardedRef)
      (forwardedRef as React.MutableRefObject<HTMLElement | null>).current = node;
  };

  const triggerClass = cn(
    badgeStyles.badge,
    badgeStyles[variant],
    badgeStyles.rounded,
    badgeStyles.sm,
    styles.trigger,
    className,
  );

  return (
    <>
      <button
        ref={assignTriggerRef}
        type="button"
        className={triggerClass}
        onClick={onTriggerClick}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={menuLabel ? `${text} — ${menuLabel}` : text}
        data-component="status-badge"
        data-status={resolved}
        data-variant={variant}
        data-module={ticketModule}
        data-transitionable="true"
        data-open={open ? "true" : "false"}
        {...(caCode ? { "data-ca-code": caCode } : {})}
        {...(rest as Record<string, unknown>)}
      >
        {Icon ? (
          <span aria-hidden="true" data-component="badge-icon">
            <Icon size={ICON_PX} strokeWidth={2} />
          </span>
        ) : null}
        <span>{text}</span>
        <span className={styles.chevron} aria-hidden="true">
          <ChevronDown size={CHEVRON_PX} strokeWidth={2} />
        </span>
      </button>
      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={menuLabel ?? text}
          className={styles.menu}
          style={position}
          data-component="status-badge-menu"
          data-testid="status-badge-menu"
        >
          {transitions.length === 0 ? (
            <div className={styles.empty} data-testid="status-badge-menu-empty">
              —
            </div>
          ) : (
            transitions.map((target, index) => {
              const targetVariant = STATUS_VARIANT[target];
              const TargetIcon = STATUS_ICON[target];
              const targetLabel = transitionLabel
                ? transitionLabel(target)
                : STATUS_LABEL_SK[target];
              return (
                <button
                  key={target}
                  type="button"
                  role="menuitem"
                  tabIndex={index === focusedIndex ? 0 : -1}
                  className={styles.menuItem}
                  data-menu-index={index}
                  data-status={target}
                  data-testid={`status-badge-menu-item-${target}`}
                  onClick={() => handleSelect(target)}
                  onMouseEnter={() => setFocusedIndex(index)}
                >
                  <span
                    aria-hidden="true"
                    className={cn(styles.menuItemDot, styles[`dot_${targetVariant}` as const])}
                  />
                  <span className={styles.menuItemIcon} aria-hidden="true">
                    <TargetIcon size={MENU_ICON_PX} strokeWidth={2} />
                  </span>
                  <span className={styles.menuItemLabel}>{targetLabel}</span>
                </button>
              );
            })
          )}
        </div>
      )}
    </>
  );
}
