import { useMemo } from "react";
import { AlertTriangle, Calendar, Clock, Inbox, User } from "lucide-react";
import { useTranslation } from "@sdm/i18n";
import { Skeleton } from "@sdm/design-system";
import type { UiQueueItem } from "@sdm/api-types";

/**
 * KPI strip (K.1 brief §10.2 row 1). Five tiles derived client-side from the
 * already-fetched queue dataset so we don't double-roundtrip the BFF:
 *
 *  - Otvorené  — open + in_progress
 *  - Moje      — rows whose assignee.id === session.userId
 *  - Po SLA    — degraded to "—" (UiQueueItem carries no dueDate yet)
 *  - < 1h      — rows opened in the last 60 minutes
 *  - Dnes      — rows opened today (local timezone)
 *
 * Degraded SLA state is intentional and documented per the K-phase scope: the
 * BFF aggregator does not yet project `dueDate`/`slaState` onto `UiQueueItem`.
 * The tile renders an em-dash + "(no SLA)" subtitle until the field lands.
 */

const ONE_HOUR_MS = 60 * 60 * 1000;
const OPEN_STATUS_CODES: ReadonlySet<string> = new Set(["OP", "WIP", "NEW", "IN_PROGRESS", "HLD"]);

export interface QueueStatsProps {
  readonly rows: ReadonlyArray<UiQueueItem>;
  readonly currentUserId: string | null;
  readonly isLoading: boolean;
}

interface StatValue {
  readonly label: string;
  readonly value: string;
  readonly icon: React.ReactNode;
  readonly subtitle?: string;
  readonly testid: string;
}

function startOfTodayMs(now: Date): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function QueueStats(props: QueueStatsProps) {
  const { rows, currentUserId, isLoading } = props;
  const { t } = useTranslation("workspace");

  const tiles: ReadonlyArray<StatValue> = useMemo(() => {
    const now = Date.now();
    const todayStart = startOfTodayMs(new Date(now));

    let open = 0;
    let mine = 0;
    let lastHour = 0;
    let today = 0;

    for (const r of rows) {
      const code = r.status?.code ?? "";
      const isOpen = OPEN_STATUS_CODES.has(code);
      if (isOpen) open += 1;
      if (currentUserId && r.assignee?.id === currentUserId && isOpen) mine += 1;
      const opened = r.openedAt ? Date.parse(r.openedAt) : Number.NaN;
      if (Number.isFinite(opened)) {
        if (now - opened <= ONE_HOUR_MS) lastHour += 1;
        if (opened >= todayStart) today += 1;
      }
    }

    return [
      {
        label: t("queue.stats.open"),
        value: open.toString(),
        icon: <Inbox size={14} aria-hidden="true" />,
        testid: "queue-stat-open",
      },
      {
        label: t("queue.stats.mine"),
        value: mine.toString(),
        icon: <User size={14} aria-hidden="true" />,
        testid: "queue-stat-mine",
      },
      {
        label: t("queue.stats.overdue"),
        value: "—",
        icon: <AlertTriangle size={14} aria-hidden="true" />,
        subtitle: t("queue.stats.noSla"),
        testid: "queue-stat-overdue",
      },
      {
        label: t("queue.stats.lastHour"),
        value: lastHour.toString(),
        icon: <Clock size={14} aria-hidden="true" />,
        testid: "queue-stat-lasthour",
      },
      {
        label: t("queue.stats.today"),
        value: today.toString(),
        icon: <Calendar size={14} aria-hidden="true" />,
        testid: "queue-stat-today",
      },
    ];
  }, [rows, currentUserId, t]);

  return (
    <div
      className="sdm-queue-stats"
      data-testid="queue-stats"
      role="group"
      aria-label={t("queue.stats.ariaLabel")}
    >
      {tiles.map((tile) => (
        <div key={tile.testid} className="sdm-queue-stat" data-testid={tile.testid}>
          <span className="sdm-queue-stat-label">
            <span className="sdm-queue-stat-icon" aria-hidden="true">
              {tile.icon}
            </span>
            {tile.label}
          </span>
          {isLoading ? (
            <Skeleton variant="text" width={42} height={28} />
          ) : (
            <span className="sdm-queue-stat-value">{tile.value}</span>
          )}
          {tile.subtitle ? <span className="sdm-queue-stat-subtitle">{tile.subtitle}</span> : null}
        </div>
      ))}
    </div>
  );
}
