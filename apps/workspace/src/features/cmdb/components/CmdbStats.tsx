import { useMemo } from "react";
import { Boxes, CheckCircle2, PauseCircle, Share2, XCircle } from "lucide-react";
import { useTranslation } from "@sdm/i18n";
import { Skeleton } from "@sdm/design-system";
import type { CiRow } from "../types";

/**
 * KPI strip for `/cmdb` (K.3.E §10.2). Five tiles derived client-side from the
 * dataset:
 *
 *  - Total       — every CI in the page
 *  - Active      — `status === ACTIVE`
 *  - Inactive    — `status === INACTIVE`
 *  - Retired     — `status === RETIRED`
 *  - Shared      — `sharedWithTenantIds.length > 0`
 */

interface StatTile {
  readonly label: string;
  readonly value: string;
  readonly icon: React.ReactNode;
  readonly testid: string;
}

export interface CmdbStatsProps {
  readonly rows: ReadonlyArray<CiRow>;
  readonly isLoading: boolean;
}

export function CmdbStats({ rows, isLoading }: CmdbStatsProps) {
  const { t } = useTranslation("workspace");

  const tiles: ReadonlyArray<StatTile> = useMemo(() => {
    let active = 0;
    let inactive = 0;
    let retired = 0;
    let shared = 0;
    for (const r of rows) {
      if (r.status === "ACTIVE") active += 1;
      else if (r.status === "INACTIVE") inactive += 1;
      else if (r.status === "RETIRED") retired += 1;
      if (r.sharedWithTenantIds && r.sharedWithTenantIds.length > 0) shared += 1;
    }
    return [
      {
        label: t("cmdb.stats.total"),
        value: rows.length.toString(),
        icon: <Boxes size={14} aria-hidden="true" />,
        testid: "cmdb-stat-total",
      },
      {
        label: t("cmdb.stats.active"),
        value: active.toString(),
        icon: <CheckCircle2 size={14} aria-hidden="true" />,
        testid: "cmdb-stat-active",
      },
      {
        label: t("cmdb.stats.inactive"),
        value: inactive.toString(),
        icon: <PauseCircle size={14} aria-hidden="true" />,
        testid: "cmdb-stat-inactive",
      },
      {
        label: t("cmdb.stats.retired"),
        value: retired.toString(),
        icon: <XCircle size={14} aria-hidden="true" />,
        testid: "cmdb-stat-retired",
      },
      {
        label: t("cmdb.stats.sharedCount"),
        value: shared.toString(),
        icon: <Share2 size={14} aria-hidden="true" />,
        testid: "cmdb-stat-shared",
      },
    ];
  }, [rows, t]);

  return (
    <div
      className="sdm-cmdb-stats"
      data-testid="cmdb-stats"
      role="group"
      aria-label={t("cmdb.stats.ariaLabel")}
    >
      {tiles.map((tile) => (
        <div key={tile.testid} className="sdm-cmdb-stat" data-testid={tile.testid}>
          <span className="sdm-cmdb-stat-label">
            <span className="sdm-cmdb-stat-icon" aria-hidden="true">
              {tile.icon}
            </span>
            {tile.label}
          </span>
          {isLoading ? (
            <Skeleton variant="text" width={42} height={28} />
          ) : (
            <span className="sdm-cmdb-stat-value">{tile.value}</span>
          )}
        </div>
      ))}
    </div>
  );
}
