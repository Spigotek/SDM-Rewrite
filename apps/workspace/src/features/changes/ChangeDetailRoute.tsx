import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "@sdm/i18n";
import { Card, Skeleton, usePageTransition } from "@sdm/design-system";
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
 * Approvals). K.3.E polish: Card-wrapped header, page-transition crossfade,
 * skeleton loading state.
 */
export default function ChangeDetailRoute() {
  const { t } = useTranslation("workspace");
  const params = useParams();
  const id = params["id"] ?? "";
  const { tab, setTab } = useChangeTab();
  const { ref } = usePageTransition(`/changes/${id}`);

  const detailQuery = useQuery({
    ...changeDetailQuery(id),
    enabled: id.length > 0,
  });

  if (detailQuery.isPending) {
    return (
      <section
        ref={ref}
        className="sdm-change-detail-page"
        data-testid="change-detail-loading"
        aria-busy="true"
      >
        <Card variant="outlined" className="sdm-change-detail-header-card">
          <div className="sdm-change-detail-skeleton" aria-hidden="true">
            <Skeleton variant="text" width={80} height={14} />
            <Skeleton variant="text" width="60%" height={22} />
            <div className="sdm-change-detail-skeleton-meta">
              <Skeleton variant="text" width={120} height={16} />
              <Skeleton variant="text" width={120} height={16} />
              <Skeleton variant="text" width={120} height={16} />
              <Skeleton variant="text" width={120} height={16} />
            </div>
          </div>
        </Card>
      </section>
    );
  }
  if (detailQuery.isError || !detailQuery.data) {
    return (
      <section
        ref={ref}
        className="sdm-change-detail-page"
        data-testid="change-detail-error"
        role="alert"
      >
        <p className="sdm-changes-state sdm-changes-state--error">{t("changes.error")}</p>
      </section>
    );
  }

  const detail = detailQuery.data;

  return (
    <section
      ref={ref}
      className="sdm-change-detail-page"
      data-testid="change-detail-page"
      data-change-id={detail.id}
    >
      <Card variant="outlined" className="sdm-change-detail-header-card">
        <ChangeHeader detail={detail} />
      </Card>
      <ChangeTabs active={tab} onSelect={setTab} />
      <Card variant="outlined" className="sdm-change-detail-tab-card">
        {tab === "detail" && <DetailTab detail={detail} />}
        {tab === "impact" && <ImpactTab detail={detail} />}
        {tab === "rollback" && <RollbackTab detail={detail} />}
        {tab === "approvals" && <ApprovalsTab detail={detail} />}
      </Card>
    </section>
  );
}
