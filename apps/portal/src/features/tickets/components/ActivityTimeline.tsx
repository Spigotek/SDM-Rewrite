import { useMemo } from "react";
import { useTranslation } from "@sdm/i18n";
import type { UiActivityEntry, UiTicketDetailActivity } from "@sdm/api-types";

/**
 * Public + system activity feed for the requester.
 *
 * Internal entries (`kind === "internal"`) are **filtered out** — the portal
 * persona must not see private agent notes (security boundary; the BFF will
 * eventually enforce visibility, but the FE filter is defence-in-depth and
 * matches the H.4 spec).
 *
 * When the BFF marks the activity branch `_unsupported: true` we surface an
 * empty-state with a tooltip per the F.6 design contract.
 */
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

function filterRequesterVisible(
  items: ReadonlyArray<UiActivityEntry>,
): ReadonlyArray<UiActivityEntry> {
  return items.filter((e) => e.kind !== "internal");
}

export function ActivityTimeline({ activity }: ActivityTimelineProps) {
  const { t, i18n } = useTranslation("portal");
  const items = useMemo(() => filterRequesterVisible(activity.items), [activity.items]);

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
        <ol className="sdm-portal-ticket-timeline-list" role="feed">
          {items.map((entry) => (
            <li
              key={entry.id}
              className="sdm-portal-ticket-timeline-item"
              data-kind={entry.kind}
              data-testid="portal-ticket-timeline-item"
            >
              <header className="sdm-portal-ticket-timeline-item-head">
                <span className="sdm-portal-ticket-timeline-author">
                  {entry.author?.label ?? t(`ticketDetail.timeline.author.${entry.kind}`)}
                </span>
                <span className="sdm-portal-ticket-timeline-meta">
                  {formatTs(entry.createdAt, i18n.language)}
                </span>
              </header>
              <p className="sdm-portal-ticket-timeline-body">{entry.text}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
