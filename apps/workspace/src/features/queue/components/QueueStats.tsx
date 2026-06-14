import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Calendar, Clock, Inbox, User } from "lucide-react";
import { useTranslation } from "@sdm/i18n";
import { Skeleton, useCountUp } from "@sdm/design-system";
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
 * M.1.C — zero-collapse: tiles with `count === 0` or `count === null` render
 * as a compact 28-px chip instead of the full 88-px tile, so a quiet queue
 * doesn't look like a wall of empty placeholders. A header toggle restores
 * the full tile layout for users who want the symmetric strip; the choice
 * persists per browser via `localStorage`.
 */

const ONE_HOUR_MS = 60 * 60 * 1000;
const OPEN_STATUS_CODES: ReadonlySet<string> = new Set(["OP", "WIP", "NEW", "IN_PROGRESS", "HLD"]);
const SHOW_EMPTY_STORAGE_KEY = "sdm.workspace.queue.stats.showEmpty";

export interface QueueStatsProps {
  readonly rows: ReadonlyArray<UiQueueItem>;
  readonly currentUserId: string | null;
  readonly isLoading: boolean;
}

interface StatValue {
  readonly label: string;
  /** Numeric count for tiles that animate. `null` = degraded tile, render `value` string verbatim. */
  readonly count: number | null;
  readonly value: string;
  readonly icon: React.ReactNode;
  readonly subtitle?: string;
  readonly testid: string;
}

function QueueStatNumber({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  // L.1.A — count-up tween for numeric KPI tiles. Degraded tiles (e.g. SLA
  // overdue) bypass this and render the raw string fallback.
  useCountUp(value, { ref });
  return <span ref={ref}>{value}</span>;
}

function startOfTodayMs(now: Date): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function readShowEmpty(): boolean {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(SHOW_EMPTY_STORAGE_KEY) === "true";
}

function writeShowEmpty(value: boolean): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(SHOW_EMPTY_STORAGE_KEY, value ? "true" : "false");
}

export function QueueStats(props: QueueStatsProps) {
  const { rows, currentUserId, isLoading } = props;
  const { t } = useTranslation("workspace");
  const [showEmpty, setShowEmpty] = useState<boolean>(false);

  // Hydrate from localStorage on mount — keeps SSR/first-paint identical
  // so the chip/tile layout doesn't flicker on reload.
  useEffect(() => {
    setShowEmpty(readShowEmpty());
  }, []);

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
        count: open,
        value: open.toString(),
        icon: <Inbox size={14} aria-hidden="true" />,
        testid: "queue-stat-open",
      },
      {
        label: t("queue.stats.mine"),
        count: mine,
        value: mine.toString(),
        icon: <User size={14} aria-hidden="true" />,
        testid: "queue-stat-mine",
      },
      {
        label: t("queue.stats.overdue"),
        count: null,
        value: "—",
        icon: <AlertTriangle size={14} aria-hidden="true" />,
        subtitle: t("queue.stats.noSla"),
        testid: "queue-stat-overdue",
      },
      {
        label: t("queue.stats.lastHour"),
        count: lastHour,
        value: lastHour.toString(),
        icon: <Clock size={14} aria-hidden="true" />,
        testid: "queue-stat-lasthour",
      },
      {
        label: t("queue.stats.today"),
        count: today,
        value: today.toString(),
        icon: <Calendar size={14} aria-hidden="true" />,
        testid: "queue-stat-today",
      },
    ];
  }, [rows, currentUserId, t]);

  const handleToggle = () => {
    setShowEmpty((prev) => {
      const next = !prev;
      writeShowEmpty(next);
      return next;
    });
  };

  // While loading we render the canonical full-tile layout so the skeleton
  // strip occupies a stable footprint. Once data resolves, empty tiles
  // either collapse to chips or stay as tiles depending on `showEmpty`.
  return (
    <div className="sdm-queue-stats-wrap">
      <div className="sdm-queue-stats-header">
        <button
          type="button"
          className="sdm-queue-stats-toggle"
          aria-pressed={showEmpty}
          onClick={handleToggle}
          data-testid="queue-stats-toggle"
        >
          {showEmpty ? t("queue.stats.hideEmpty") : t("queue.stats.showEmpty")}
        </button>
      </div>
      <div
        className="sdm-queue-stats"
        data-testid="queue-stats"
        data-show-empty={showEmpty ? "true" : "false"}
        role="group"
        aria-label={t("queue.stats.ariaLabel")}
      >
        {tiles.map((tile) => {
          const isEmpty = tile.count === null || tile.count === 0;
          const collapseToChip = !isLoading && isEmpty && !showEmpty;
          if (collapseToChip) {
            return (
              <div
                key={tile.testid}
                className="sdm-queue-stat sdm-queue-stat--chip"
                data-testid={tile.testid}
                data-empty="true"
              >
                <span className="sdm-queue-stat-label">
                  <span className="sdm-queue-stat-icon" aria-hidden="true">
                    {tile.icon}
                  </span>
                  {tile.label}
                </span>
                <span className="sdm-queue-stat-value sdm-queue-stat-value--chip">
                  {tile.value}
                </span>
              </div>
            );
          }
          return (
            <div key={tile.testid} className="sdm-queue-stat" data-testid={tile.testid}>
              <span className="sdm-queue-stat-label">
                <span className="sdm-queue-stat-icon" aria-hidden="true">
                  {tile.icon}
                </span>
                {tile.label}
              </span>
              {isLoading ? (
                <Skeleton variant="text" width={42} height={28} />
              ) : tile.count === null ? (
                <span className="sdm-queue-stat-value">{tile.value}</span>
              ) : (
                <span className="sdm-queue-stat-value">
                  <QueueStatNumber value={tile.count} />
                </span>
              )}
              {tile.subtitle ? (
                <span className="sdm-queue-stat-subtitle">{tile.subtitle}</span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
