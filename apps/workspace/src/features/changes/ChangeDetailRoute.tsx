import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "@sdm/i18n";
import { changeDetailQuery } from "./api";
import { ChangeHeader } from "./components/ChangeHeader";
import { ChangeTabs } from "./components/ChangeTabs";
import { DetailTab } from "./components/DetailTab";
import { ImpactTab } from "./components/ImpactTab";
import { RollbackTab } from "./components/RollbackTab";
import { ApprovalsTab } from "./components/ApprovalsTab";
import { useChangeTab } from "./hooks";
import "./changes.css";

/**
 * `/changes/:id` — change-detail page with 4 tabs (Detail/Impact/Rollback/
 * Approvals). All read-only in H.9; H.10 adds the calendar drill-in
 * affordance and H.11 ships CAB approve/reject buttons inside ApprovalsTab.
 *
 * The active tab is URL-driven (`?tab=impact`) so deep links from the
 * change-calendar (H.10) and notifications (H.16) land directly on the right
 * panel.
 */
export default function ChangeDetailRoute() {
  const { t } = useTranslation("workspace");
  const params = useParams();
  const id = params["id"] ?? "";
  const { tab, setTab } = useChangeTab();

  const detailQuery = useQuery({
    ...changeDetailQuery(id),
    enabled: id.length > 0,
  });

  if (detailQuery.isPending) {
    return (
      <section className="sdm-change-detail-page" data-testid="change-detail-loading">
        <p className="sdm-changes-state">{t("changes.loading")}</p>
      </section>
    );
  }
  if (detailQuery.isError || !detailQuery.data) {
    return (
      <section className="sdm-change-detail-page" data-testid="change-detail-error" role="alert">
        <p className="sdm-changes-state sdm-changes-state--error">{t("changes.error")}</p>
      </section>
    );
  }

  const detail = detailQuery.data;

  return (
    <section
      className="sdm-change-detail-page"
      data-testid="change-detail-page"
      data-change-id={detail.id}
    >
      <ChangeHeader detail={detail} />
      <ChangeTabs active={tab} onSelect={setTab} />
      {tab === "detail" && <DetailTab detail={detail} />}
      {tab === "impact" && <ImpactTab detail={detail} />}
      {tab === "rollback" && <RollbackTab detail={detail} />}
      {tab === "approvals" && <ApprovalsTab detail={detail} />}
    </section>
  );
}
