import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "@sdm/i18n";
import { hasPermission } from "@sdm/domain";
import type { EventApi } from "@fullcalendar/core";
import FullCalendar from "@fullcalendar/react";
import {
  buildCalendarOptions,
  CALENDAR_VIEWS,
  changeToEvent,
  type CalendarViewName,
  type EventDropArg,
  type EventResizeDoneArg,
} from "../lib/full-calendar-config";
import type { ChangeRow } from "../types";
import { EventTooltip } from "./EventTooltip";
import { ConflictConfirmModal } from "./ConflictConfirmModal";
import { useReschedule } from "../hooks/useReschedule";
import { useSession } from "../../../shell/session-context";

/**
 * `<CalendarView>` — owns the FullCalendar instance, the view-switch tab
 * group, and the hover tooltip lifecycle.
 *
 * Imperative API surface (FullCalendar ref): used to drive view switches
 * without re-mounting the component — re-mount would re-create the
 * `vendor-calendar` runtime cost every switch.
 *
 * Tooltip wiring: FullCalendar gives `eventDidMount`/`eventWillUnmount`
 * callbacks per event element. We attach native `mouseenter`/`mouseleave`
 * listeners through those hooks instead of binding via `eventMouseEnter`
 * because the latter doesn't fire reliably across day/week/month view
 * switches (FullCalendar issue documented in their migration guide).
 *
 * J.6 drag-resize: `editable` is driven by the `change.schedule` permission
 * of the active session. On drop/resize the handler:
 *  1. Detects conflicts against the visible event set.
 *  2. Opens `<ConflictConfirmModal>` when overlaps exist.
 *  3. Calls `reschedule()` on confirm or directly when no conflict.
 *  4. Calls `info.revert()` on cancel or PATCH failure.
 */

export interface CalendarViewProps {
  readonly rows: ReadonlyArray<ChangeRow>;
  /**
   * I.5 — when true, events are color-coded by tenantId and the tooltip
   * surfaces the tenant name so sp_admin can spot cross-tenant conflicts.
   */
  readonly crossTenant?: boolean;
}

interface HoverState {
  readonly id: string;
  readonly anchor: DOMRect;
}

interface ConflictModalState {
  readonly conflicts: ReadonlyArray<ChangeRow>;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

/** Default event duration when `end` is missing — 1 hour. */
const DEFAULT_DURATION_MS = 60 * 60 * 1000;

/**
 * Detect conflicts for a moved/resized event against the full event set.
 * Excludes the dragged event itself. overlap = (other.start < newEnd) && (other.end > newStart).
 * Foreign-tenant events (in sp_admin overlay) are excluded from conflict
 * consideration because the active user cannot reschedule them.
 */
function detectConflicts(
  rows: ReadonlyArray<ChangeRow>,
  movedId: string,
  activeTenantId: string | undefined,
  newStart: Date,
  newEnd: Date,
): ReadonlyArray<ChangeRow> {
  return rows.filter((r) => {
    if (r.id === movedId) return false;
    // In sp_admin overlay mode, skip foreign-tenant events from conflict check.
    if (activeTenantId && r.tenantId !== activeTenantId) return false;
    if (!r.scheduledStartAt) return false;
    const otherStart = new Date(r.scheduledStartAt);
    const otherEnd = r.scheduledEndAt
      ? new Date(r.scheduledEndAt)
      : new Date(otherStart.getTime() + DEFAULT_DURATION_MS);
    return otherStart < newEnd && otherEnd > newStart;
  });
}

export function CalendarView({ rows, crossTenant = false }: CalendarViewProps) {
  const { t, i18n } = useTranslation("workspace");
  const navigate = useNavigate();
  const { session } = useSession();
  const calendarRef = useRef<FullCalendar | null>(null);
  const [view, setView] = useState<CalendarViewName>("timeGridWeek");
  const [hover, setHover] = useState<HoverState | null>(null);
  const [conflictModal, setConflictModal] = useState<ConflictModalState | null>(null);
  /** map of event id → element listener handles for clean unmount */
  const listenerMap = useRef<Map<string, () => void>>(new Map());
  /** row lookup for the tooltip */
  const rowMap = useMemo(() => {
    const m = new Map<string, ChangeRow>();
    for (const r of rows) m.set(r.id, r);
    return m;
  }, [rows]);

  const { reschedule } = useReschedule();

  // J.6 — permission gate (client-side defence-in-depth).
  const roles = useMemo(() => session?.roles ?? [], [session]);
  const canSchedule = useMemo(() => hasPermission(roles, "change.schedule"), [roles]);
  const activeTenantId = session?.tenantId ? String(session.tenantId) : undefined;

  const events = useMemo(() => {
    const out = [];
    for (const r of rows) {
      const ev = changeToEvent(r, crossTenant);
      if (ev) {
        // J.6 — per-event editable override: disable drag on foreign-tenant events
        // in sp_admin overlay mode to prevent accidental reschedule of another tenant's change.
        if (crossTenant && activeTenantId && r.tenantId !== activeTenantId) {
          out.push({ ...ev, editable: false });
        } else {
          out.push(ev);
        }
      }
    }
    return out;
  }, [rows, crossTenant, activeTenantId]);

  const openDetail = useCallback(
    (id: string) => navigate(`/changes/${encodeURIComponent(id)}`),
    [navigate],
  );

  const handleEventDidMount = useCallback((id: string, el: HTMLElement) => {
    el.setAttribute("data-testid", "calendar-event");
    el.setAttribute("data-change-id", id);
    const onEnter = () => setHover({ id, anchor: el.getBoundingClientRect() });
    const onLeave = () => setHover((h) => (h?.id === id ? null : h));
    el.addEventListener("mouseenter", onEnter);
    el.addEventListener("mouseleave", onLeave);
    listenerMap.current.set(id, () => {
      el.removeEventListener("mouseenter", onEnter);
      el.removeEventListener("mouseleave", onLeave);
    });
  }, []);

  const handleEventWillUnmount = useCallback((id: string) => {
    const cleanup = listenerMap.current.get(id);
    if (cleanup) {
      cleanup();
      listenerMap.current.delete(id);
    }
    setHover((h) => (h?.id === id ? null : h));
  }, []);

  // Cleanup any stragglers on full unmount (lazy chunk -> route swap).
  useEffect(() => {
    const map = listenerMap.current;
    return () => {
      for (const off of map.values()) off();
      map.clear();
    };
  }, []);

  /**
   * J.6 — shared handler for eventDrop + eventResize.
   * FullCalendar applies the move visually first (optimistic). We call
   * `info.revert()` on cancel or PATCH failure to roll back the visual state.
   */
  const handleEventChange = useCallback(
    (info: { event: EventApi; revert: () => void }) => {
      if (!canSchedule) {
        info.revert();
        return;
      }

      const newStart = info.event.start;
      if (!newStart) {
        info.revert();
        return;
      }
      const newEnd = info.event.end ?? new Date(newStart.getTime() + DEFAULT_DURATION_MS);

      // Client-side end-before-start guard (matches BFF zod refinement).
      if (newEnd <= newStart) {
        info.revert();
        return;
      }

      const newStartIso = newStart.toISOString();
      const newEndIso = newEnd.toISOString();

      const conflicts = detectConflicts(rows, info.event.id, activeTenantId, newStart, newEnd);

      const doReschedule = () => {
        reschedule(info.event.id, newStartIso, newEndIso).catch(() => {
          info.revert();
        });
      };

      if (conflicts.length > 0) {
        setConflictModal({
          conflicts,
          onConfirm: () => {
            setConflictModal(null);
            doReschedule();
          },
          onCancel: () => {
            setConflictModal(null);
            info.revert();
          },
        });
      } else {
        doReschedule();
      }
    },
    [canSchedule, rows, activeTenantId, reschedule],
  );

  const handleEventDrop = useCallback(
    (info: EventDropArg) => handleEventChange({ event: info.event, revert: info.revert }),
    [handleEventChange],
  );

  const handleEventResize = useCallback(
    (info: EventResizeDoneArg) => handleEventChange({ event: info.event, revert: info.revert }),
    [handleEventChange],
  );

  /**
   * I.2 a11y — FullCalendar renders the prev/next toolbar buttons with a child
   * `<span class="fc-icon fc-icon-chevron-{left,right}" role="img">` that has
   * no accessible name. axe flags this as `role-img-alt` serious. The parent
   * button already carries `aria-label="prev"/"next"` and `title`, so the
   * icons are decorative — strip the `role` so axe + assistive tech treat
   * them as presentational `<span>`s instead of empty images. We observe DOM
   * mutations because FullCalendar re-renders the toolbar on every view
   * switch + locale change.
   */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const root = document.querySelector(".sdm-calendar-container") as HTMLElement | null;
    if (!root) return;
    const patch = () => {
      for (const node of root.querySelectorAll<HTMLElement>('.fc-icon[role="img"]')) {
        node.removeAttribute("role");
        node.setAttribute("aria-hidden", "true");
      }
    };
    patch();
    const obs = new MutationObserver(patch);
    obs.observe(root, { subtree: true, childList: true });
    return () => obs.disconnect();
  }, []);

  const locale = (i18n.language === "en" ? "en" : "sk") as "en" | "sk";
  const options = useMemo(() => {
    const baseArgs = {
      events,
      initialView: view,
      locale,
      editable: canSchedule,
      onEventClick: openDetail,
      onEventDidMount: handleEventDidMount,
      onEventWillUnmount: handleEventWillUnmount,
    };
    if (canSchedule) {
      return buildCalendarOptions({
        ...baseArgs,
        onEventDrop: handleEventDrop,
        onEventResize: handleEventResize,
      });
    }
    return buildCalendarOptions(baseArgs);
  }, [
    events,
    view,
    locale,
    canSchedule,
    openDetail,
    handleEventDidMount,
    handleEventWillUnmount,
    handleEventDrop,
    handleEventResize,
  ]);

  const switchView = useCallback((next: CalendarViewName) => {
    setView(next);
    calendarRef.current?.getApi().changeView(next);
  }, []);

  const hoveredRow = hover ? rowMap.get(hover.id) : null;

  return (
    <div className="sdm-calendar-view" data-testid="calendar-view">
      <div
        className="sdm-calendar-view-switch"
        role="tablist"
        aria-label={t("changes.calendar.viewSwitchAriaLabel")}
      >
        {CALENDAR_VIEWS.map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={view === v}
            data-active={view === v || undefined}
            data-testid={`calendar-view-${v}`}
            className="sdm-calendar-view-btn"
            onClick={() => switchView(v)}
          >
            {t(`changes.calendar.view.${v}`)}
          </button>
        ))}
      </div>
      <div className="sdm-calendar-container">
        <FullCalendar ref={calendarRef} {...options} />
      </div>
      {hoveredRow && hover ? <EventTooltip row={hoveredRow} anchor={hover.anchor} /> : null}
      {conflictModal ? (
        <ConflictConfirmModal
          conflicts={conflictModal.conflicts}
          onConfirm={conflictModal.onConfirm}
          onCancel={conflictModal.onCancel}
        />
      ) : null}
    </div>
  );
}
