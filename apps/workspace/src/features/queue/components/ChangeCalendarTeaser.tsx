import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar } from "lucide-react";
import { useTranslation } from "@sdm/i18n";
import { Card, Skeleton } from "@sdm/design-system";
import type { TenantId } from "@sdm/domain";
import { changesListQuery } from "../../changes/api";
import type { ChangeRow } from "../../changes/types";

/**
 * Compact teaser for upcoming scheduled changes (K.1 brief §10.2 row 4 right).
 *
 * Reuses the existing `changesListQuery` cache so the calendar route prefetch
 * pays for both surfaces. We fetch the tenant change list, drop anything with
 * no `scheduledStartAt` or a past start, and show the next `MAX_ENTRIES` rows.
 *
 * BFF range filtering is not yet implemented (see `changesInRangeQuery`
 * inline note) — client-side filtering matches the calendar route's current
 * behaviour and is cheap for the MVP volume.
 */

const MAX_ENTRIES = 5;
const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

function relativeFuture(ms: number, now: number): string {
  const diff = ms - now;
  if (diff <= 0) return "now";
  if (diff < HOUR_MS) return `${Math.max(1, Math.round(diff / MINUTE_MS))}m`;
  if (diff < DAY_MS) return `${Math.round(diff / HOUR_MS)}h`;
  return `${Math.round(diff / DAY_MS)}d`;
}

export interface ChangeCalendarTeaserProps {
  readonly tenantId: TenantId | undefined;
}

export function ChangeCalendarTeaser(props: ChangeCalendarTeaserProps) {
  const { tenantId } = props;
  const { t } = useTranslation("workspace");

  const baseQuery = changesListQuery(tenantId ?? ("__pending__" as TenantId));
  const query = useQuery({
    queryKey: baseQuery.queryKey,
    queryFn: baseQuery.queryFn,
    staleTime: baseQuery.staleTime,
    enabled: !!tenantId,
  });

  const upcoming = useMemo<ReadonlyArray<ChangeRow>>(() => {
    const all = query.data ?? [];
    const now = Date.now();
    return [...all]
      .filter((c) => {
        if (!c.scheduledStartAt) return false;
        const ms = Date.parse(c.scheduledStartAt);
        return Number.isFinite(ms) && ms >= now;
      })
      .sort(
        (a, b) =>
          (a.scheduledStartAt ? Date.parse(a.scheduledStartAt) : 0) -
          (b.scheduledStartAt ? Date.parse(b.scheduledStartAt) : 0),
      )
      .slice(0, MAX_ENTRIES);
  }, [query.data]);

  const now = Date.now();

  return (
    <Card variant="outlined" data-testid="change-calendar-teaser">
      <header className="sdm-queue-card-header">
        <h2 className="sdm-queue-card-title">{t("queue.changeCalendar.title")}</h2>
        <a className="sdm-queue-card-link" href="/changes/calendar">
          {t("queue.changeCalendar.openLink")} →
        </a>
      </header>
      {query.isPending && !!tenantId ? (
        // K-fix CLS — render Skeleton rows at the same shape as the resolved
        // list. A 5-row teaser averages ~120 px of list content; the
        // surrounding card + header puts it within the dashboard 15rem floor.
        <ul className="sdm-queue-calendar-list" aria-hidden="true">
          {Array.from({ length: MAX_ENTRIES }, (_, i) => (
            <li key={i} className="sdm-queue-calendar-row">
              <Skeleton variant="block" width={14} height={14} />
              <span className="sdm-queue-calendar-body">
                <Skeleton variant="text" width={48} height={14} />
                <Skeleton variant="text" width="60%" height={14} />
              </span>
              <Skeleton variant="text" width={24} height={12} />
            </li>
          ))}
        </ul>
      ) : upcoming.length === 0 ? (
        <p className="sdm-queue-card-empty">{t("queue.changeCalendar.empty")}</p>
      ) : (
        <ul className="sdm-queue-calendar-list">
          {upcoming.map((c) => {
            const startMs = c.scheduledStartAt ? Date.parse(c.scheduledStartAt) : 0;
            return (
              <li
                key={c.id}
                className="sdm-queue-calendar-row"
                data-testid="change-calendar-teaser-row"
              >
                <span className="sdm-queue-calendar-icon" aria-hidden="true">
                  <Calendar size={14} />
                </span>
                <span className="sdm-queue-calendar-body">
                  <span className="sdm-queue-calendar-ref">#{c.ref}</span>
                  <span className="sdm-queue-calendar-summary" title={c.summary ?? ""}>
                    {c.summary ?? t("changes.noSummary")}
                  </span>
                </span>
                <span className="sdm-queue-calendar-when">{relativeFuture(startMs, now)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
