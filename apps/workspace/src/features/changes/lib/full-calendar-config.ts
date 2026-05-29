import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { CalendarOptions, EventInput } from "@fullcalendar/core";
import type { RiskLevel } from "@sdm/domain";
import type { ChangeRow } from "../types";

/**
 * FullCalendar 6 configuration for the change calendar route.
 *
 * Plugin set per `library-recommendation.md §Calendar` (r2 canonical):
 *  - `daygrid` — month view block grid.
 *  - `timegrid` — day + week views with time-of-day axis.
 *  - `interaction` — click/hover wiring (drag-resize is deferred to v1+ per
 *    H.10 plan §Open questions; we import the plugin but leave `editable`
 *    false so the drag handles never render).
 *
 * The Scheduler plugin is commercial and intentionally NOT used.
 *
 * Lazy boundary: this module is imported only from `CalendarView.tsx`, which
 * is itself lazy-loaded by `ChangeCalendarRoute.tsx`. The `vite.config.ts`
 * `manualChunks` rule groups every `@fullcalendar/*` package into a single
 * `vendor-calendar` chunk so the workspace initial bundle pays zero calendar
 * cost until `/changes/calendar` is visited.
 */

/** Risk → severity token mapping. Mirrors `ChangesTable` so list + calendar
 *  stay visually consistent. */
const RISK_COLOR: Record<RiskLevel, string> = {
  HIGH: "var(--color-severity-high)",
  MEDIUM: "var(--color-severity-medium)",
  LOW: "var(--color-severity-low)",
};

/**
 * Convert a `ChangeRow` to a FullCalendar `EventInput`. Returns `null` when
 * the row has no scheduled window (those changes don't belong on the
 * calendar — they're surfaced via the list view).
 *
 * The `extendedProps` payload carries everything the click handler + tooltip
 * need, so neither has to round-trip through the row store.
 */
export function changeToEvent(row: ChangeRow): EventInput | null {
  if (!row.scheduledStartAt) return null;
  const color = RISK_COLOR[row.risk];
  const event: EventInput = {
    id: row.id,
    title: `${row.ref} · ${row.summary}`,
    start: row.scheduledStartAt,
    backgroundColor: color,
    borderColor: color,
    textColor: "var(--color-text-on-severity, #fff)",
    extendedProps: {
      ref: row.ref,
      risk: row.risk,
      status: row.status,
      category: row.category,
      summary: row.summary,
      scheduledStartAt: row.scheduledStartAt,
      scheduledEndAt: row.scheduledEndAt,
    },
  };
  if (row.scheduledEndAt) event.end = row.scheduledEndAt;
  return event;
}

export type CalendarViewName = "timeGridDay" | "timeGridWeek" | "dayGridMonth";

export const CALENDAR_VIEWS: ReadonlyArray<CalendarViewName> = [
  "timeGridDay",
  "timeGridWeek",
  "dayGridMonth",
];

export interface BuildCalendarOptionsArgs {
  readonly events: ReadonlyArray<EventInput>;
  readonly initialView: CalendarViewName;
  readonly locale: "sk" | "en";
  readonly onEventClick: (id: string) => void;
  readonly onEventDidMount: (id: string, el: HTMLElement) => void;
  readonly onEventWillUnmount: (id: string) => void;
}

/**
 * Build the FullCalendar options object. Kept as a factory (not a static
 * const) because event lists + locale + click handlers are render-time
 * inputs.
 *
 * `editable: false` is the load-bearing flag — even though the interaction
 * plugin is loaded, MVP scope forbids drag-resize per H.10 open questions
 * resolution. The plugin still gives us reliable click/hover hooks.
 *
 * The header toolbar is intentionally minimal — the route owns the view
 * switcher (it lives in a route-level Tabs, not inside the FullCalendar
 * DOM, so it can use the design-system Tabs styling tokens).
 */
export function buildCalendarOptions(args: BuildCalendarOptionsArgs): CalendarOptions {
  return {
    plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
    initialView: args.initialView,
    locale: args.locale,
    firstDay: 1,
    weekNumbers: false,
    nowIndicator: true,
    editable: false,
    selectable: false,
    headerToolbar: {
      left: "prev,next today",
      center: "title",
      right: "",
    },
    height: "100%",
    events: args.events as EventInput[],
    eventClick(info) {
      info.jsEvent.preventDefault();
      args.onEventClick(info.event.id);
    },
    eventDidMount(info) {
      args.onEventDidMount(info.event.id, info.el);
    },
    eventWillUnmount(info) {
      args.onEventWillUnmount(info.event.id);
    },
  };
}
