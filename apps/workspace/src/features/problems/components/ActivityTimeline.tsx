import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "@sdm/i18n";
import { staggerListRows } from "@sdm/design-system";
import type { UiActivityEntry, UiTicketDetail } from "@sdm/api-types";

/**
 * Read-only activity timeline for `/problems/:id`. Reuses the H.8 BFF
 * aggregator (`/api/tickets/problem/:id`) so the wire format matches the
 * incident / request / change timelines exactly. The H.8 `ActivityTimeline`
 * lives inside the tickets feature and depends on the composer/filter URL
 * state we don't want here, so this is a lighter version that just renders
 * the list with kind filters.
 *
 * `_unsupported: true` from the BFF branch maps to an explicit empty state
 * (rather than an error) because the activity surface is informational, not
 * load-bearing for RCA flow.
 */
type TimelineFilter = "all" | "public" | "internal" | "system";

const FILTERS: ReadonlyArray<TimelineFilter> = ["all", "public", "internal", "system"];

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

export interface ActivityTimelineProps {
  readonly problemId: string;
}

async function fetchProblemDetail(id: string): Promise<UiTicketDetail> {
  const resp = await fetch(`/api/tickets/problem/${encodeURIComponent(id)}`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (!resp.ok) {
    throw new Error(`[problem-activity] HTTP ${resp.status}`);
  }
  return (await resp.json()) as UiTicketDetail;
}

export function ActivityTimeline({ problemId }: ActivityTimelineProps) {
  const { t, i18n } = useTranslation("workspace");
  const [filter, setFilter] = useState<TimelineFilter>("all");
  const listRef = useRef<HTMLOListElement | null>(null);

  const query = useQuery({
    queryKey: ["problem-activity", problemId] as const,
    queryFn: () => fetchProblemDetail(problemId),
    staleTime: 15_000,
  });

  const activity = query.data?.activity;
  const items = useMemo(
    () => (activity ? filterEntries(activity.items, filter) : []),
    [activity, filter],
  );

  useEffect(() => {
    if (items.length > 0) staggerListRows(listRef.current);
  }, [items.length, filter]);

  if (query.isPending) {
    return (
      <section className="sdm-problem-section" data-testid="problem-timeline-loading">
        <h2 className="sdm-problem-section-title">{t("ticketDetail.timeline.ariaLabel")}</h2>
        <p className="sdm-problem-body-empty">{t("ticketDetail.loading")}</p>
      </section>
    );
  }
  if (query.isError || !activity) {
    return (
      <section className="sdm-problem-section" data-testid="problem-timeline-error">
        <h2 className="sdm-problem-section-title">{t("ticketDetail.timeline.ariaLabel")}</h2>
        <p className="sdm-problem-body-empty">{t("ticketDetail.timeline.empty")}</p>
      </section>
    );
  }

  return (
    <section
      className="sdm-ticket-timeline sdm-problem-section"
      aria-label={t("ticketDetail.timeline.ariaLabel")}
      data-testid="problem-timeline"
    >
      <h2 className="sdm-problem-section-title">{t("ticketDetail.timeline.ariaLabel")}</h2>
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
            data-testid={`problem-timeline-tab-${f}`}
            onClick={() => setFilter(f)}
          >
            {t(`ticketDetail.timeline.filter.${f}`)}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <p className="sdm-ticket-timeline-empty" data-testid="problem-timeline-empty">
          {t("ticketDetail.timeline.empty")}
        </p>
      ) : (
        <ol className="sdm-ticket-timeline-list" ref={listRef}>
          {items.map((entry) => (
            <li
              key={entry.id}
              className="sdm-ticket-timeline-item"
              data-row
              data-kind={entry.kind}
              data-testid="problem-timeline-item"
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
