import { useEffect, useMemo, useRef } from "react";
import { useTranslation } from "@sdm/i18n";
import { staggerListRows } from "@sdm/design-system";
import type { UiActivityEntry, UiTicketDetailActivity } from "@sdm/api-types";
import { useTimelineFilter } from "../hooks";
import type { TimelineFilter } from "../types";

const FILTERS: ReadonlyArray<TimelineFilter> = ["all", "public", "internal", "system"];

export interface ActivityTimelineProps {
  readonly activity: UiTicketDetailActivity;
}

function formatTs(iso: string | null, locale: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function filterEntries(
  items: ReadonlyArray<UiActivityEntry>,
  filter: TimelineFilter,
): ReadonlyArray<UiActivityEntry> {
  if (filter === "all") return items;
  return items.filter((i) => i.kind === filter);
}

/**
 * Read-only timeline — K.3.E polish: entries carry `data-row` so
 * `staggerListRows` runs the 20 ms-per-row enter animation each time the
 * filter or item count changes. `aria-current` is set on the active filter
 * tab.
 */
export function ActivityTimeline({ activity }: ActivityTimelineProps) {
  const { t, i18n } = useTranslation("workspace");
  const { filter, setFilter } = useTimelineFilter();
  const listRef = useRef<HTMLOListElement | null>(null);

  const filtered = useMemo(() => filterEntries(activity.items, filter), [activity.items, filter]);

  useEffect(() => {
    if (filtered.length > 0) staggerListRows(listRef.current);
  }, [filtered.length, filter]);

  return (
    <section
      className="sdm-ticket-timeline"
      aria-label={t("ticketDetail.timeline.ariaLabel")}
      data-testid="ticket-timeline"
    >
      <div className="sdm-ticket-timeline-tabs" role="tablist">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={filter === f}
            aria-current={filter === f ? "true" : undefined}
            className="sdm-ticket-timeline-tab"
            data-active={filter === f || undefined}
            data-testid={`ticket-timeline-tab-${f}`}
            onClick={() => setFilter(f)}
          >
            {t(`ticketDetail.timeline.filter.${f}`)}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="sdm-ticket-timeline-empty" data-testid="ticket-timeline-empty">
          {t("ticketDetail.timeline.empty")}
        </p>
      ) : (
        <ol className="sdm-ticket-timeline-list" ref={listRef}>
          {filtered.map((entry) => (
            <li
              key={entry.id}
              className="sdm-ticket-timeline-item"
              data-row
              data-kind={entry.kind}
              data-testid="ticket-timeline-item"
            >
              <header className="sdm-ticket-timeline-item-head">
                <span className="sdm-ticket-timeline-author">
                  {entry.author?.label ?? t(`ticketDetail.timeline.author.${entry.kind}`)}
                </span>
                <span className="sdm-ticket-timeline-meta sdm-tabular">
                  {t(`ticketDetail.timeline.kindBadge.${entry.kind}`)} ·{" "}
                  {formatTs(entry.createdAt, i18n.language)}
                </span>
              </header>
              <p className="sdm-ticket-timeline-body">{entry.text}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
