/**
 * `NotificationPopover` — dropdown anchored under a trigger button.
 *
 * L.1.B (v1.3) — primitive used by the top-bar notification bell. Unlike
 * `Toast` (transient) this is a click-to-open list of accumulated events.
 *
 * Behaviour rules:
 *   - Renders nothing when `open={false}`.
 *   - Anchored top-right under the supplied `anchorRef`. Position is computed
 *     once on open via `getBoundingClientRect()` (no resize observer — the
 *     popover closes on outside click/Escape so a stale anchor is unlikely).
 *   - Up to 10 entries are rendered. Same-ticket clusters of 3+ collapse to a
 *     single "+N more" summary keyed on the ticketRef.
 *   - GSAP fade/lift enter (180 ms ease-out). `prefers-reduced-motion` cuts
 *     duration to 0 and skips the transform.
 *   - Escape and outside-click are wired by the caller via `onClose`; this
 *     primitive does both via document-level listeners while open.
 *   - Mark-all-read is a button — the caller decides what that means.
 *
 * Routing / data-fetching belongs to the caller. The primitive only renders
 * the supplied events array and surfaces user intent as callbacks.
 */

import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode, RefObject } from "react";
import { Bell, CheckCheck } from "lucide-react";
import gsap from "gsap";
import { cn } from "../../utils/cn";
import { EmptyState } from "../EmptyState";
import styles from "./NotificationPopover.module.css";

export type NotificationSeverity = "info" | "warning" | "danger" | "success";

export interface NotificationEvent {
  /** Stable unique id — used as React key. */
  readonly id: string;
  /** ISO-8601 timestamp the event occurred at. */
  readonly occurredAt: string;
  /** Optional actor (name surfaces as initials in the row avatar). */
  readonly actor?: { readonly name: string };
  /** i18n-rendered short sentence ("changed status to In progress", …). */
  readonly verb: ReactNode;
  /** Optional ticket reference (`INC-1042`). Drives grouping. */
  readonly ticketRef?: string;
  /** Click-through target for the row. */
  readonly ticketHref?: string;
  /** Visual accent on the row's leading dot. */
  readonly severity?: NotificationSeverity;
}

export interface NotificationPopoverProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly events: ReadonlyArray<NotificationEvent>;
  readonly anchorRef: RefObject<HTMLElement | null>;
  /** Caller wires the actual `lastReadAt` write. */
  readonly onMarkAllRead?: () => void;
  /** Localised heading (defaults to "Notifications"). */
  readonly title?: ReactNode;
  /** Localised empty-state copy. */
  readonly emptyMessage?: ReactNode;
  /** Localised "mark all read" button label. */
  readonly markAllReadLabel?: ReactNode;
  /** Localised "view all" link label. */
  readonly viewAllLabel?: ReactNode;
  /** Optional `/notifications` route. When omitted the footer link hides. */
  readonly viewAllHref?: string;
}

const MAX_VISIBLE = 10;
const GROUP_COLLAPSE_THRESHOLD = 3;
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const ENTER_DURATION_S = 0.18;

interface GroupedEntry {
  readonly kind: "single" | "cluster";
  readonly key: string;
  readonly head: NotificationEvent;
  readonly extras: ReadonlyArray<NotificationEvent>;
}

/**
 * Collapse runs of 3+ same-ticket events into a single cluster entry. The
 * grouping is intentionally local (only contiguous same-ticket runs collapse)
 * so the timeline order users see matches the SSE stream order — a global
 * `groupBy` would shuffle older events on top of newer unrelated ones.
 */
function groupEvents(events: ReadonlyArray<NotificationEvent>): ReadonlyArray<GroupedEntry> {
  const limited = events.slice(0, MAX_VISIBLE);
  const out: GroupedEntry[] = [];
  let i = 0;
  while (i < limited.length) {
    const head = limited[i]!;
    if (!head.ticketRef) {
      out.push({ kind: "single", key: head.id, head, extras: [] });
      i += 1;
      continue;
    }
    let j = i + 1;
    while (j < limited.length && limited[j]!.ticketRef === head.ticketRef) j += 1;
    const run = limited.slice(i, j);
    if (run.length >= GROUP_COLLAPSE_THRESHOLD) {
      out.push({
        kind: "cluster",
        key: `cluster:${head.ticketRef}:${head.id}`,
        head,
        extras: run.slice(1),
      });
    } else {
      for (const event of run) {
        out.push({ kind: "single", key: event.id, head: event, extras: [] });
      }
    }
    i = j;
  }
  return out;
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

function computeAnchorPosition(anchor: HTMLElement | null): CSSProperties {
  if (!anchor || typeof window === "undefined") {
    return { top: 0, right: 0 };
  }
  const rect = anchor.getBoundingClientRect();
  // Anchor top-right of the popover to the trigger's right edge so a longer
  // popover never overflows the viewport on the right.
  return {
    top: Math.round(rect.bottom + 8),
    right: Math.round(window.innerWidth - rect.right),
  };
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "·";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

export const NotificationPopover = forwardRef<HTMLDivElement, NotificationPopoverProps>(
  function NotificationPopover(props, ref) {
    const {
      open,
      onClose,
      events,
      anchorRef,
      onMarkAllRead,
      title,
      emptyMessage,
      markAllReadLabel,
      viewAllLabel,
      viewAllHref,
    } = props;

    const rootRef = useRef<HTMLDivElement | null>(null);
    const [position, setPosition] = useState<CSSProperties>({ top: 0, right: 0 });

    // Recompute the anchor position whenever the popover opens. We don't
    // observe resize/scroll because the popover closes on outside click and
    // Escape — a stale anchor is acceptable for the open window's lifetime.
    useEffect(() => {
      if (!open) return;
      setPosition(computeAnchorPosition(anchorRef.current));
    }, [open, anchorRef]);

    // Outside click + Escape — document-level listeners only while open.
    useEffect(() => {
      if (!open) return;
      const handleKey = (event: KeyboardEvent): void => {
        if (event.key === "Escape") {
          event.preventDefault();
          onClose();
        }
      };
      const handleClick = (event: MouseEvent): void => {
        const target = event.target as Node | null;
        const root = rootRef.current;
        const anchor = anchorRef.current;
        if (!target) return;
        if (root && root.contains(target)) return;
        if (anchor && anchor.contains(target)) return;
        onClose();
      };
      document.addEventListener("keydown", handleKey);
      document.addEventListener("mousedown", handleClick);
      return () => {
        document.removeEventListener("keydown", handleKey);
        document.removeEventListener("mousedown", handleClick);
      };
    }, [open, onClose, anchorRef]);

    // GSAP enter — runs once per open transition. Cleanup kills the tween.
    useEffect(() => {
      if (!open) return;
      const node = rootRef.current;
      if (!node) return;
      const reduced = prefersReducedMotion();
      let tween: gsap.core.Tween | null = null;
      try {
        tween = gsap.fromTo(
          node,
          { opacity: 0, y: reduced ? 0 : -4 },
          { opacity: 1, y: 0, duration: reduced ? 0 : ENTER_DURATION_S, ease: "power1.out" },
        );
      } catch {
        /* best-effort animation */
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

    const grouped = useMemo(() => groupEvents(events), [events]);

    if (!open) return null;

    const handleRootRef = (node: HTMLDivElement | null): void => {
      rootRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) (ref as { current: HTMLDivElement | null }).current = node;
    };

    return (
      <div
        ref={handleRootRef}
        className={styles.root}
        data-component="notification-popover"
        data-testid="notif-popover"
        role="dialog"
        aria-label={typeof title === "string" ? title : "Notifications"}
        style={position}
      >
        <header className={styles.header}>
          <span className={styles.title}>{title ?? "Notifications"}</span>
          {events.length > 0 && onMarkAllRead && (
            <button
              type="button"
              className={styles.markAll}
              onClick={onMarkAllRead}
              data-testid="notif-mark-all-read"
            >
              <CheckCheck size={14} aria-hidden="true" />
              <span>{markAllReadLabel ?? "Mark all as read"}</span>
            </button>
          )}
        </header>

        {events.length === 0 ? (
          <div className={styles.emptyWrap}>
            <EmptyState
              variant="compact"
              illustration={<Bell size={28} aria-hidden="true" />}
              title={emptyMessage ?? "No new notifications"}
            />
          </div>
        ) : (
          <ul className={styles.list} data-testid="notif-list">
            {grouped.map((entry) => (
              <NotificationRow key={entry.key} entry={entry} />
            ))}
          </ul>
        )}

        {viewAllHref && (
          <footer className={styles.footer}>
            <a
              href={viewAllHref}
              className={styles.viewAll}
              data-testid="notif-view-all"
              onClick={onClose}
            >
              {viewAllLabel ?? "View all"}
            </a>
          </footer>
        )}
      </div>
    );
  },
);

interface NotificationRowProps {
  readonly entry: GroupedEntry;
}

function NotificationRow({ entry }: NotificationRowProps) {
  const { head, kind, extras } = entry;
  const severity = head.severity ?? "info";

  const content = (
    <>
      <span
        className={cn(styles.dot, styles[`dot_${severity}` as const])}
        aria-hidden="true"
        data-severity={severity}
      />
      {head.actor && (
        <span className={styles.avatar} aria-hidden="true">
          {initialsOf(head.actor.name)}
        </span>
      )}
      <div className={styles.body}>
        <div className={styles.verb}>{head.verb}</div>
        <div className={styles.meta}>
          {head.ticketRef && <span className={styles.ticketRef}>{head.ticketRef}</span>}
          <time className={styles.time} dateTime={head.occurredAt}>
            {head.occurredAt}
          </time>
          {kind === "cluster" && (
            <span className={styles.moreCount} data-testid="notif-cluster-count">
              +{extras.length} more
            </span>
          )}
        </div>
      </div>
    </>
  );

  return (
    <li className={styles.row} data-component="notification-row" data-kind={kind}>
      {head.ticketHref ? (
        <a className={styles.rowLink} href={head.ticketHref}>
          {content}
        </a>
      ) : (
        <div className={styles.rowStatic}>{content}</div>
      )}
    </li>
  );
}
