import { useQueries } from "@tanstack/react-query";
import { useTranslation } from "@sdm/i18n";
import type { Change, Ci, Incident } from "@sdm/domain";
import { colorForTenant } from "./CrossTenantCalendarOverlay";
import type { SpTenantRow } from "../api";

/**
 * `<TenantOverview>` — per-tenant health summary cards. For each SP-scoped
 * tenant we fire three lightweight per-tenant queries (incidents, changes,
 * CIs) and roll up:
 *  - open incidents count    (status ∈ {OP, WIP, AWU, AWV, ESC, HLD})
 *  - pending changes count   (status ∈ {RFC, APPR_PENDING})
 *  - critical CIs count      (status === "ACTIVE" + `sharedWithTenantIds` present)
 *
 * The roll-up is intentionally client-side — adding a `/me/sp-overview`
 * aggregator was rejected for I.5 because the per-entity endpoints already
 * exist and `useQueries` lets us fan out without bloating the BFF surface.
 * Each card carries the deterministic tenant color from
 * `CrossTenantCalendarOverlay` so the cockpit ↔ calendar overlay legend
 * stays consistent.
 */

interface PageResp<T> {
  readonly results: ReadonlyArray<T>;
  readonly totalCount: number;
}

async function fetchTenantData<T>(path: string, tenantId: string): Promise<ReadonlyArray<T>> {
  const resp = await fetch(path, {
    credentials: "include",
    headers: { Accept: "application/json", "X-CA-SDM-Tenant": tenantId },
  });
  if (!resp.ok) return [];
  const body = (await resp.json()) as PageResp<T>;
  return body.results;
}

const OPEN_INCIDENT_STATUSES = new Set(["OP", "WIP", "AWU", "AWV", "ESC", "HLD"]);
const PENDING_CHANGE_STATUSES = new Set(["RFC", "APPR_PENDING"]);

interface TenantHealth {
  readonly tenant: SpTenantRow;
  readonly openIncidents: number;
  readonly pendingChanges: number;
  readonly criticalCis: number;
}

export interface TenantOverviewProps {
  readonly tenants: ReadonlyArray<SpTenantRow>;
}

export function TenantOverview({ tenants }: TenantOverviewProps) {
  const { t } = useTranslation("workspace");

  const results = useQueries({
    queries: tenants.map((t) => ({
      queryKey: ["sp-overview", t.id],
      queryFn: async (): Promise<TenantHealth> => {
        const [incidents, changes, cis] = await Promise.all([
          fetchTenantData<Incident>(`/api/incidents?size=200`, t.id),
          fetchTenantData<Change>(`/api/changes?size=200`, t.id),
          fetchTenantData<Ci>(`/api/ci?size=200`, t.id),
        ]);
        const openIncidents = incidents.filter((i) => OPEN_INCIDENT_STATUSES.has(i.status)).length;
        const pendingChanges = changes.filter((c) => PENDING_CHANGE_STATUSES.has(c.status)).length;
        const criticalCis = cis.filter(
          (c) => c.status === "ACTIVE" && (c.sharedWithTenantIds?.length ?? 0) > 0,
        ).length;
        return { tenant: t, openIncidents, pendingChanges, criticalCis };
      },
      staleTime: 60_000,
    })),
  });

  return (
    <ul
      className="sdm-sp-cockpit-tenant-grid"
      data-testid="sp-cockpit-tenant-grid"
      aria-label={t("sp.cockpit.tenantOverview.ariaLabel")}
    >
      {tenants.map((tenant, idx) => {
        const r = results[idx];
        const data = r?.data;
        return (
          <li
            key={tenant.id}
            className="sdm-sp-cockpit-tenant-card"
            data-testid="sp-cockpit-tenant-card"
            data-tenant-id={tenant.id}
            style={{ borderLeftColor: colorForTenant(tenant.id) }}
          >
            <header className="sdm-sp-cockpit-tenant-card-header">
              <span className="sdm-sp-cockpit-tenant-card-name">{tenant.name}</span>
              <span className="sdm-sp-cockpit-tenant-card-id">{tenant.id}</span>
            </header>
            {r?.isPending ? (
              <p className="sdm-sp-cockpit-tenant-card-state">{t("sp.cockpit.loading")}</p>
            ) : r?.isError || !data ? (
              <p className="sdm-sp-cockpit-tenant-card-state sdm-sp-cockpit-tenant-card-state--error">
                {t("sp.cockpit.error")}
              </p>
            ) : (
              <dl className="sdm-sp-cockpit-tenant-card-stats">
                <div>
                  <dt>{t("sp.cockpit.metric.openIncidents")}</dt>
                  <dd data-metric="open-incidents">{data.openIncidents}</dd>
                </div>
                <div>
                  <dt>{t("sp.cockpit.metric.pendingChanges")}</dt>
                  <dd data-metric="pending-changes">{data.pendingChanges}</dd>
                </div>
                <div>
                  <dt>{t("sp.cockpit.metric.criticalCis")}</dt>
                  <dd data-metric="critical-cis">{data.criticalCis}</dd>
                </div>
              </dl>
            )}
          </li>
        );
      })}
    </ul>
  );
}
