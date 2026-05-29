import { useTranslation } from "@sdm/i18n";
import { StatusBadge, type TicketStatus } from "@sdm/design-system";
import type { CiStatus } from "@sdm/domain";
import type { CiDetail } from "../types";

/**
 * CI detail sticky header per wireframe `05-cmdb-ci-detail.md §Low-fi`:
 *  - Line 1: name + status badge.
 *  - Line 2: class / owner / location / IP — 4-column meta grid.
 *
 * Cross-tenant badge (External tenant) is out of scope for H.13 read-only —
 * MSW fixture is single-tenant per row and the spec puts cross-tenant under
 * #18 acceptance (separate journey, deferred).
 */

const STATUS_MAP: Record<CiStatus, TicketStatus> = {
  ACTIVE: "open",
  INACTIVE: "pending",
  RETIRED: "closed",
  INVENTORY: "new",
};

export function CiHeader({ detail }: { readonly detail: CiDetail }) {
  const { t } = useTranslation("workspace");
  return (
    <header className="sdm-cmdb-header" data-testid="cmdb-header">
      <div className="sdm-cmdb-header-title">
        <span className="sdm-cmdb-header-id">{detail.id}</span>
        <h1 className="sdm-cmdb-header-name">{detail.name}</h1>
        <StatusBadge
          status={STATUS_MAP[detail.status]}
          label={t(`cmdb.statusLabel.${detail.status}`)}
        />
      </div>
      <div className="sdm-cmdb-header-meta">
        <div className="sdm-cmdb-header-field">
          <span className="sdm-cmdb-header-label">{t("cmdb.fields.class")}</span>
          <span data-testid="cmdb-header-class" data-class={detail.class}>
            {t(`cmdb.class.${detail.class}`, { defaultValue: detail.class })}
          </span>
        </div>
        <div className="sdm-cmdb-header-field">
          <span className="sdm-cmdb-header-label">{t("cmdb.fields.owner")}</span>
          <span data-testid="cmdb-header-owner">
            {detail.primaryContactId ?? t("cmdb.owner.unassigned")}
          </span>
        </div>
        <div className="sdm-cmdb-header-field">
          <span className="sdm-cmdb-header-label">{t("cmdb.fields.ip")}</span>
          <span data-testid="cmdb-header-ip">{detail.ipAddress ?? "—"}</span>
        </div>
        <div className="sdm-cmdb-header-field">
          <span className="sdm-cmdb-header-label">{t("cmdb.fields.vendor")}</span>
          <span data-testid="cmdb-header-vendor">{detail.vendor ?? "—"}</span>
        </div>
      </div>
    </header>
  );
}
