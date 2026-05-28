import { Link } from "react-router-dom";
import { useTranslation } from "@sdm/i18n";
import type { ChangeDetail } from "../types";

/**
 * Impact tab — affected CIs grid. Per wireframe `03-change-calendar.md` the
 * tab also shows business services and conflict callouts; in H.9 we render
 * only the CI list (services + conflicts arrive once CMDB H.13 lands and the
 * BFF projects `lrel_chg_ci` + cross-tenant `lrel_chg_chg` links).
 *
 * Each CI row is a `<Link>` to `/cmdb/ci/:id`. The link is keyboard-focusable
 * so screen-reader and keyboard users can drill in; the H.13 destination is
 * still a placeholder, but the link contract is stable.
 */
export function ImpactTab({ detail }: { readonly detail: ChangeDetail }) {
  const { t } = useTranslation("workspace");
  const cis = detail.affectedCiIds;

  return (
    <section
      role="tabpanel"
      id="change-tabpanel-impact"
      aria-labelledby="change-tab-impact"
      data-testid="change-tabpanel-impact"
      className="sdm-change-tabpanel"
    >
      <header className="sdm-change-impact-header">
        <h2>{t("changes.impact.title")}</h2>
        <span className="sdm-change-impact-count" data-testid="change-impact-count">
          {t("changes.impact.count", { count: cis.length })}
        </span>
      </header>
      {cis.length === 0 ? (
        <p className="sdm-change-detail-empty" data-testid="change-impact-empty">
          {t("changes.impact.empty")}
        </p>
      ) : (
        <ul className="sdm-change-impact-list" data-testid="change-impact-list">
          {cis.map((ciId) => (
            <li key={ciId} data-testid="change-impact-row" data-ci-id={ciId}>
              <Link to={`/cmdb/ci/${encodeURIComponent(ciId)}`}>{ciId}</Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
