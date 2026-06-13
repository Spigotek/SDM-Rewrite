import { useMemo } from "react";
import { useTranslation } from "@sdm/i18n";
import { Avatar, Card } from "@sdm/design-system";
import type { UiQueueItem } from "@sdm/api-types";

/**
 * Recent activity feed scoped to the assignee (K.1 brief §10.2 row 4 left).
 *
 * v1.1.4 derives "activity" client-side from the queue dataset: the 10 most
 * recently opened or last-touched tickets where the current user is the
 * assignee. There is no dedicated activity stream endpoint yet — the BFF
 * `/api/activity` aggregator is on the v1.2 roadmap. Until then we render the
 * derived view so the dashboard slot is populated and the layout is locked in.
 */

const MAX_ENTRIES = 10;
const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

function timestampMs(r: UiQueueItem): number {
  const last = r.lastActivityAt ? Date.parse(r.lastActivityAt) : Number.NaN;
  if (Number.isFinite(last)) return last;
  const opened = r.openedAt ? Date.parse(r.openedAt) : Number.NaN;
  return Number.isFinite(opened) ? opened : 0;
}

function relativeAge(ms: number, now: number): string {
  const diff = Math.max(0, now - ms);
  if (diff < MINUTE_MS) return "<1m";
  if (diff < HOUR_MS) return `${Math.round(diff / MINUTE_MS)}m`;
  if (diff < DAY_MS) return `${Math.round(diff / HOUR_MS)}h`;
  return `${Math.round(diff / DAY_MS)}d`;
}

export interface RecentActivityCardProps {
  readonly rows: ReadonlyArray<UiQueueItem>;
  readonly currentUserId: string | null;
}

export function RecentActivityCard(props: RecentActivityCardProps) {
  const { rows, currentUserId } = props;
  const { t } = useTranslation("workspace");

  const entries = useMemo(() => {
    const scoped = currentUserId ? rows.filter((r) => r.assignee?.id === currentUserId) : rows;
    return [...scoped].sort((a, b) => timestampMs(b) - timestampMs(a)).slice(0, MAX_ENTRIES);
  }, [rows, currentUserId]);

  const now = Date.now();

  return (
    <Card variant="outlined" data-testid="queue-recent-activity">
      <header className="sdm-queue-card-header">
        <h2 className="sdm-queue-card-title">{t("queue.recentActivity.title")}</h2>
      </header>
      {entries.length === 0 ? (
        <p className="sdm-queue-card-empty">{t("queue.recentActivity.empty")}</p>
      ) : (
        <ul className="sdm-queue-activity-list">
          {entries.map((r) => {
            const ts = timestampMs(r);
            const actor = r.assignee?.label ?? t("queue.unassigned");
            return (
              <li
                key={r.id}
                className="sdm-queue-activity-row"
                data-testid="queue-recent-activity-row"
              >
                <Avatar size="sm" name={actor} />
                <span className="sdm-queue-activity-body">
                  <span className="sdm-queue-activity-actor">{actor}</span>
                  <span className="sdm-queue-activity-verb">
                    {t("queue.recentActivity.verbUpdated")}
                  </span>
                  <span className="sdm-queue-activity-ref">#{r.ref}</span>
                </span>
                <span className="sdm-queue-activity-age">{relativeAge(ts, now)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
