import { useMemo } from "react";
import { useTranslation } from "@sdm/i18n";
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
 * Read-only timeline. Filtering is purely client-side over the already-loaded
 * `activity.items` list (per H.8.md §Done-when) — there is no extra BFF call.
 * The kind colour is encoded via a `data-kind` attribute styled in the CSS
 * module; we keep the markup minimal so screen readers announce one item at
 * a time.
 */
export function ActivityTimeline({ activity }: ActivityTimelineProps) {
  const { t, i18n } = useTranslation("workspace");
  const { filter, setFilter } = useTimelineFilter();

  const filtered = useMemo(() => filterEntries(activity.items, filter), [activity.items, filter]);

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
        <ol className="sdm-ticket-timeline-list">
          {filtered.map((entry) => (
            <li
              key={entry.id}
              className="sdm-ticket-timeline-item"
              data-kind={entry.kind}
              data-testid="ticket-timeline-item"
            >
              <header className="sdm-ticket-timeline-item-head">
                <span className="sdm-ticket-timeline-author">
                  {entry.author?.label ?? t(`ticketDetail.timeline.author.${entry.kind}`)}
                </span>
                <span className="sdm-ticket-timeline-meta">
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
