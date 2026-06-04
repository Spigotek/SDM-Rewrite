import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { CalendarOptions, EventInput, EventDropArg, EventApi } from "@fullcalendar/core";
import type { RiskLevel } from "@sdm/domain";
import { colorForTenant } from "../../sp-cockpit/components/CrossTenantCalendarOverlay";
import type { ChangeRow } from "../types";

/**
 * FullCalendar 6 configuration for the change calendar route.
 *
 * Plugin set per `library-recommendation.md §Calendar` (r2 canonical):
 *  - `daygrid` — month view block grid.
 *  - `timegrid` — day + week views with time-of-day axis.
 *  - `interaction` — drag-resize enabled when caller has `change.schedule`
 *    permission (J.6); `editable` is passed from the caller so non-schedule
 *    roles never see drag handles (client-side defence-in-depth on top of
 *    the BFF permission gate).
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
 *
 * I.5 cross-tenant overlay: when `crossTenant` is true, the event background
 * is the deterministic tenant color instead of the risk color so sp_admin can
 * scan across tenants visually. The risk colour is preserved on the border so
 * the conflict signal isn't lost.
 */
export function changeToEvent(row: ChangeRow, crossTenant: boolean = false): EventInput | null {
  if (!row.scheduledStartAt) return null;
  const riskColor = RISK_COLOR[row.risk];
  const tenantColor = crossTenant ? colorForTenant(row.tenantId) : riskColor;
  const event: EventInput = {
    id: row.id,
    title: crossTenant
      ? `${row.ref} · [${row.tenantId}] ${row.summary}`
      : `${row.ref} · ${row.summary}`,
    start: row.scheduledStartAt,
    backgroundColor: tenantColor,
    borderColor: riskColor,
    textColor: "var(--color-text-on-severity, #fff)",
    extendedProps: {
      ref: row.ref,
      risk: row.risk,
      status: row.status,
      category: row.category,
      summary: row.summary,
      scheduledStartAt: row.scheduledStartAt,
      scheduledEndAt: row.scheduledEndAt,
      tenantId: row.tenantId,
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

export type { EventDropArg };

/** Minimal interface for the resize-done callback. Only the properties the
 *  CalendarView handler actually accesses are declared here. FullCalendar 6
 *  exposes these through `CalendarOptions.eventResize`. */
export interface EventResizeDoneArg {
  readonly event: EventApi;
  readonly oldEvent: EventApi;
  readonly revert: () => void;
}

export interface BuildCalendarOptionsArgs {
  readonly events: ReadonlyArray<EventInput>;
  readonly initialView: CalendarViewName;
  readonly locale: "sk" | "en";
  /** J.6 — when true the interaction plugin renders drag handles. Pass false for
   *  users without `change.schedule` so the read-only view is unchanged. */
  readonly editable: boolean;
  readonly onEventClick: (id: string) => void;
  readonly onEventDidMount: (id: string, el: HTMLElement) => void;
  readonly onEventWillUnmount: (id: string) => void;
  readonly onEventDrop?: (info: EventDropArg) => void;
  readonly onEventResize?: (info: EventResizeDoneArg) => void;
}

export interface CalendarViewOptions {
  readonly crossTenant?: boolean;
}

/**
 * Build the FullCalendar options object. Kept as a factory (not a static
 * const) because event lists + locale + click handlers are render-time
 * inputs.
 *
 * `editable` is driven by the `change.schedule` permission of the active
 * session (J.6). The interaction plugin is always loaded (it's in the shared
 * `vendor-calendar` chunk per the vite.config manualChunks rule) — the flag
 * controls whether drag handles render on the event blocks.
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
    editable: args.editable,
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
    ...(args.onEventDrop ? { eventDrop: args.onEventDrop } : {}),
    ...(args.onEventResize ? { eventResize: args.onEventResize } : {}),
  };
}
