import { useEffect, useMemo, useRef } from "react";
import { Avatar, staggerListRows } from "@sdm/design-system";
import { formatRelative, useLocale, useTranslation } from "@sdm/i18n";
import type { UiActivityEntry, UiTicketDetailActivity } from "@sdm/api-types";

/**
 * Public + system activity feed for the requester.
 *
 * Internal entries (`kind === "internal"`) are **filtered out** — the portal
 * persona must not see private agent notes (security boundary; the BFF will
 * eventually enforce visibility, but the FE filter is defence-in-depth and
 * matches the H.4 spec).
 *
 * K.3.E v1.2: vertical timeline with `<Avatar>` per entry + relative
 * timestamps + `staggerListRows` so newly-arrived items animate in.
 */
export interface ActivityTimelineProps {
  readonly activity: UiTicketDetailActivity;
}

const MIN_ROWS_FOR_STAGGER = 3;

function filterRequesterVisible(
  items: ReadonlyArray<UiActivityEntry>,
): ReadonlyArray<UiActivityEntry> {
  return items.filter((e) => e.kind !== "internal");
}

export function ActivityTimeline({ activity }: ActivityTimelineProps) {
  const { t } = useTranslation("portal");
  const { locale } = useLocale("portal");
  const items = useMemo(() => filterRequesterVisible(activity.items), [activity.items]);
  const listRef = useRef<HTMLOListElement | null>(null);

  useEffect(() => {
    if (items.length >= MIN_ROWS_FOR_STAGGER) {
      staggerListRows(listRef.current);
    }
  }, [items.length]);

  if (activity._unsupported) {
    return (
      <section
        className="sdm-portal-ticket-timeline"
        aria-label={t("ticketDetail.timeline.ariaLabel")}
        data-testid="portal-ticket-timeline-unsupported"
      >
        <h2 className="sdm-portal-ticket-section-title">{t("ticketDetail.timeline.title")}</h2>
        <p
          className="sdm-portal-ticket-timeline-empty"
          title={t("ticketDetail.unsupportedTooltip")}
        >
          {t("ticketDetail.timeline.unsupported")}
        </p>
      </section>
    );
  }

  return (
    <section
      className="sdm-portal-ticket-timeline"
      aria-label={t("ticketDetail.timeline.ariaLabel")}
      data-testid="portal-ticket-timeline"
    >
      <h2 className="sdm-portal-ticket-section-title">{t("ticketDetail.timeline.title")}</h2>
      {items.length === 0 ? (
        <p className="sdm-portal-ticket-timeline-empty" data-testid="portal-ticket-timeline-empty">
          {t("ticketDetail.timeline.empty")}
        </p>
      ) : (
        <ol ref={listRef} className="sdm-portal-ticket-timeline-list" role="feed">
          {items.map((entry) => {
            const authorLabel =
              entry.author?.label ?? t(`ticketDetail.timeline.author.${entry.kind}`);
            return (
              <li
                key={entry.id}
                className="sdm-portal-ticket-timeline-item"
                data-kind={entry.kind}
                data-row
                data-testid="portal-ticket-timeline-item"
              >
                <span className="sdm-portal-ticket-timeline-avatar" aria-hidden="true">
                  <Avatar name={authorLabel} size="sm" />
                </span>
                <div className="sdm-portal-ticket-timeline-body-wrap">
                  <header className="sdm-portal-ticket-timeline-item-head">
                    <span className="sdm-portal-ticket-timeline-author">{authorLabel}</span>
                    {entry.createdAt ? (
                      <time className="sdm-portal-ticket-timeline-meta" dateTime={entry.createdAt}>
                        {formatRelative(entry.createdAt, locale)}
                      </time>
                    ) : null}
                  </header>
                  <p className="sdm-portal-ticket-timeline-body">{entry.text}</p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
