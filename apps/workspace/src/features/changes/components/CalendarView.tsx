import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "@sdm/i18n";
import FullCalendar from "@fullcalendar/react";
import {
  buildCalendarOptions,
  CALENDAR_VIEWS,
  changeToEvent,
  type CalendarViewName,
} from "../lib/full-calendar-config";
import type { ChangeRow } from "../types";
import { EventTooltip } from "./EventTooltip";

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
 */

export interface CalendarViewProps {
  readonly rows: ReadonlyArray<ChangeRow>;
}

interface HoverState {
  readonly id: string;
  readonly anchor: DOMRect;
}

export function CalendarView({ rows }: CalendarViewProps) {
  const { t, i18n } = useTranslation("workspace");
  const navigate = useNavigate();
  const calendarRef = useRef<FullCalendar | null>(null);
  const [view, setView] = useState<CalendarViewName>("timeGridWeek");
  const [hover, setHover] = useState<HoverState | null>(null);
  /** map of event id → element listener handles for clean unmount */
  const listenerMap = useRef<Map<string, () => void>>(new Map());
  /** row lookup for the tooltip */
  const rowMap = useMemo(() => {
    const m = new Map<string, ChangeRow>();
    for (const r of rows) m.set(r.id, r);
    return m;
  }, [rows]);

  const events = useMemo(() => {
    const out = [];
    for (const r of rows) {
      const ev = changeToEvent(r);
      if (ev) out.push(ev);
    }
    return out;
  }, [rows]);

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

  const locale = i18n.language === "en" ? "en" : "sk";
  const options = useMemo(
    () =>
      buildCalendarOptions({
        events,
        initialView: view,
        locale,
        onEventClick: openDetail,
        onEventDidMount: handleEventDidMount,
        onEventWillUnmount: handleEventWillUnmount,
      }),
    [events, view, locale, openDetail, handleEventDidMount, handleEventWillUnmount],
  );

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
    </div>
  );
}
