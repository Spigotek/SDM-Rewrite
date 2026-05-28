import { useTranslation } from "@sdm/i18n";
import type { ChangeDetail } from "../types";

/**
 * Detail tab — read-only fields per spec §4.1 + wireframe two-column meta:
 * category, requester, scheduled window, actual window, description. H.11
 * ships an edit button for `change_manager` (Peter) but H.9 is read-only.
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

export function DetailTab({ detail }: { readonly detail: ChangeDetail }) {
  const { t } = useTranslation("workspace");
  return (
    <section
      role="tabpanel"
      id="change-tabpanel-detail"
      aria-labelledby="change-tab-detail"
      data-testid="change-tabpanel-detail"
      className="sdm-change-tabpanel"
    >
      <dl className="sdm-change-detail-grid">
        <div className="sdm-change-detail-row">
          <dt>{t("changes.fields.category")}</dt>
          <dd data-testid="change-detail-category">{t(`changes.category.${detail.category}`)}</dd>
        </div>
        <div className="sdm-change-detail-row">
          <dt>{t("changes.fields.risk")}</dt>
          <dd>{t(`changes.risk.${detail.risk}`)}</dd>
        </div>
        <div className="sdm-change-detail-row">
          <dt>{t("changes.fields.requester")}</dt>
          <dd>{detail.requesterId}</dd>
        </div>
        <div className="sdm-change-detail-row">
          <dt>{t("changes.fields.assignee")}</dt>
          <dd>{detail.assigneeId ?? t("changes.fields.unassigned")}</dd>
        </div>
        <div className="sdm-change-detail-row">
          <dt>{t("changes.fields.scheduledStart")}</dt>
          <dd>{formatIso(detail.scheduledStartAt)}</dd>
        </div>
        <div className="sdm-change-detail-row">
          <dt>{t("changes.fields.scheduledEnd")}</dt>
          <dd>{formatIso(detail.scheduledEndAt)}</dd>
        </div>
        <div className="sdm-change-detail-row">
          <dt>{t("changes.fields.actualStart")}</dt>
          <dd>{formatIso(detail.actualStartAt)}</dd>
        </div>
        <div className="sdm-change-detail-row">
          <dt>{t("changes.fields.actualEnd")}</dt>
          <dd>{formatIso(detail.actualEndAt)}</dd>
        </div>
      </dl>
      <section
        className="sdm-change-detail-description"
        aria-label={t("changes.fields.description")}
      >
        <h2>{t("changes.fields.description")}</h2>
        {detail.description ? (
          <p data-testid="change-detail-description">{detail.description}</p>
        ) : (
          <p className="sdm-change-detail-empty" data-testid="change-detail-description-empty">
            {t("changes.fields.descriptionEmpty")}
          </p>
        )}
      </section>
    </section>
  );
}
