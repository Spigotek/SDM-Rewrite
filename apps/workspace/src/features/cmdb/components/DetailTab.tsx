import { useTranslation } from "@sdm/i18n";
import type { CiDetail } from "../types";

/**
 * Detail tab — CiBase summary (read-only). Mirrors the H.9 `DetailTab` layout
 * (two-column meta + description), scoped to CiBase fields per
 * `entities.md#configurationitem-ci`.
 *
 * Attribute groups (Key / DB / Network / Compliance / Custom) live on the
 * dedicated Attributes tab so the Detail tab stays scannable.
 */

function formatIso(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function DetailTab({ detail }: { readonly detail: CiDetail }) {
  const { t } = useTranslation("workspace");
  return (
    <section
      role="tabpanel"
      id="cmdb-tabpanel-detail"
      aria-labelledby="cmdb-tab-detail"
      data-testid="cmdb-tabpanel-detail"
      className="sdm-cmdb-tabpanel"
    >
      <dl className="sdm-cmdb-detail-grid">
        <div className="sdm-cmdb-detail-row">
          <dt>{t("cmdb.fields.class")}</dt>
          <dd>{t(`cmdb.class.${detail.class}`, { defaultValue: detail.class })}</dd>
        </div>
        <div className="sdm-cmdb-detail-row">
          <dt>{t("cmdb.fields.status")}</dt>
          <dd>{t(`cmdb.statusLabel.${detail.status}`)}</dd>
        </div>
        <div className="sdm-cmdb-detail-row">
          <dt>{t("cmdb.fields.systemName")}</dt>
          <dd>{detail.systemName ?? "—"}</dd>
        </div>
        <div className="sdm-cmdb-detail-row">
          <dt>{t("cmdb.fields.ip")}</dt>
          <dd>{detail.ipAddress ?? "—"}</dd>
        </div>
        <div className="sdm-cmdb-detail-row">
          <dt>{t("cmdb.fields.vendor")}</dt>
          <dd>{detail.vendor ?? "—"}</dd>
        </div>
        <div className="sdm-cmdb-detail-row">
          <dt>{t("cmdb.fields.model")}</dt>
          <dd>{detail.model ?? "—"}</dd>
        </div>
        <div className="sdm-cmdb-detail-row">
          <dt>{t("cmdb.fields.serialNumber")}</dt>
          <dd>{detail.serialNumber ?? "—"}</dd>
        </div>
        <div className="sdm-cmdb-detail-row">
          <dt>{t("cmdb.fields.assetNumber")}</dt>
          <dd>{detail.assetNumber ?? "—"}</dd>
        </div>
        <div className="sdm-cmdb-detail-row">
          <dt>{t("cmdb.fields.owner")}</dt>
          <dd>{detail.primaryContactId ?? t("cmdb.owner.unassigned")}</dd>
        </div>
        <div className="sdm-cmdb-detail-row">
          <dt>{t("cmdb.fields.createdAt")}</dt>
          <dd>{formatIso(detail.createdAt)}</dd>
        </div>
        <div className="sdm-cmdb-detail-row">
          <dt>{t("cmdb.fields.lastModifiedAt")}</dt>
          <dd>{formatIso(detail.lastModifiedAt)}</dd>
        </div>
      </dl>
      <section className="sdm-cmdb-detail-description" aria-label={t("cmdb.fields.description")}>
        <h2>{t("cmdb.fields.description")}</h2>
        {detail.description ? (
          <p data-testid="cmdb-detail-description">{detail.description}</p>
        ) : (
          <p className="sdm-cmdb-detail-empty" data-testid="cmdb-detail-description-empty">
            {t("cmdb.fields.descriptionEmpty")}
          </p>
        )}
      </section>
    </section>
  );
}
