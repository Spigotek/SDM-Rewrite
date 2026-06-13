import { useMemo } from "react";
import { CalendarClock, CheckCircle2, ClipboardCheck, FileText, Users } from "lucide-react";
import { useTranslation } from "@sdm/i18n";
import { Skeleton } from "@sdm/design-system";
import type { ChangeRow } from "../types";

/**
 * KPI strip for `/changes` (K.3.E §10.2 row 1). Five tiles derived client-side
 * from the changes dataset:
 *
 *  - Open                — RFC + APPROVED + SCHEDULED + IN_PROGRESS + VERIFICATION_IN_PROGRESS + EMG_IN_PROGRESS
 *  - Pending approval    — APPR_PENDING + EMG_RFC
 *  - Scheduled today     — `scheduledStartAt` falls within the local day
 *  - In CAB              — at least one PENDING approver decision
 *  - Closed this week    — CL / CD with `actualEndAt` (or fallback `scheduledEndAt`) ≥ start-of-week
 */

const OPEN_STATUSES = new Set([
  "RFC",
  "APPROVED",
  "SCHEDULED",
  "IN_PROGRESS",
  "VERIFICATION_IN_PROGRESS",
  "EMG_IN_PROGRESS",
]);
const PENDING_STATUSES = new Set(["APPR_PENDING", "EMG_RFC", "EMG_RETROSPECTIVE"]);
const CLOSED_STATUSES = new Set(["CL", "CD", "VERIFIED", "REJECTED"]);

interface StatTile {
  readonly label: string;
  readonly value: string;
  readonly icon: React.ReactNode;
  readonly testid: string;
}

function startOfToday(now: Date): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function endOfToday(now: Date): number {
  const d = new Date(now);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

function startOfWeek(now: Date): number {
  const d = new Date(now);
  const day = d.getDay();
  // ISO week — Monday is the first day. JS's `getDay` returns 0 (Sun)…6 (Sat).
  const offset = day === 0 ? 6 : day - 1;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - offset);
  return d.getTime();
}

export interface ChangeStatsProps {
  readonly rows: ReadonlyArray<ChangeRow>;
  readonly isLoading: boolean;
}

export function ChangeStats({ rows, isLoading }: ChangeStatsProps) {
  const { t } = useTranslation("workspace");

  const tiles: ReadonlyArray<StatTile> = useMemo(() => {
    const now = new Date();
    const todayStart = startOfToday(now);
    const todayEnd = endOfToday(now);
    const weekStart = startOfWeek(now);

    let open = 0;
    let pending = 0;
    let scheduledToday = 0;
    let inCab = 0;
    let closedThisWeek = 0;

    for (const r of rows) {
      if (OPEN_STATUSES.has(r.status)) open += 1;
      if (PENDING_STATUSES.has(r.status)) pending += 1;
      if (r.scheduledStartAt) {
        const ts = Date.parse(r.scheduledStartAt);
        if (Number.isFinite(ts) && ts >= todayStart && ts <= todayEnd) scheduledToday += 1;
      }
      if (r.cabApprovers.some((a) => a.decision === "PENDING")) inCab += 1;
      if (CLOSED_STATUSES.has(r.status)) {
        const closedIso = r.actualEndAt ?? r.scheduledEndAt;
        if (closedIso) {
          const ts = Date.parse(closedIso);
          if (Number.isFinite(ts) && ts >= weekStart) closedThisWeek += 1;
        }
      }
    }

    return [
      {
        label: t("changes.stats.open"),
        value: open.toString(),
        icon: <FileText size={14} aria-hidden="true" />,
        testid: "changes-stat-open",
      },
      {
        label: t("changes.stats.pendingApproval"),
        value: pending.toString(),
        icon: <ClipboardCheck size={14} aria-hidden="true" />,
        testid: "changes-stat-pending",
      },
      {
        label: t("changes.stats.scheduledToday"),
        value: scheduledToday.toString(),
        icon: <CalendarClock size={14} aria-hidden="true" />,
        testid: "changes-stat-scheduled-today",
      },
      {
        label: t("changes.stats.inCab"),
        value: inCab.toString(),
        icon: <Users size={14} aria-hidden="true" />,
        testid: "changes-stat-in-cab",
      },
      {
        label: t("changes.stats.closedThisWeek"),
        value: closedThisWeek.toString(),
        icon: <CheckCircle2 size={14} aria-hidden="true" />,
        testid: "changes-stat-closed-week",
      },
    ];
  }, [rows, t]);

  return (
    <div
      className="sdm-changes-stats"
      data-testid="changes-stats"
      role="group"
      aria-label={t("changes.stats.ariaLabel")}
    >
      {tiles.map((tile) => (
        <div key={tile.testid} className="sdm-changes-stat" data-testid={tile.testid}>
          <span className="sdm-changes-stat-label">
            <span className="sdm-changes-stat-icon" aria-hidden="true">
              {tile.icon}
            </span>
            {tile.label}
          </span>
          {isLoading ? (
            <Skeleton variant="text" width={42} height={28} />
          ) : (
            <span className="sdm-changes-stat-value">{tile.value}</span>
          )}
        </div>
      ))}
    </div>
  );
}
