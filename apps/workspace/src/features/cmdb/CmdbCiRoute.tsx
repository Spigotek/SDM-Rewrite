import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "@sdm/i18n";
import { Card, Skeleton, usePageTransition } from "@sdm/design-system";
import { ciDetailQuery } from "./api";
import { CiHeader } from "./components/CiHeader";
import { CiTabs } from "./components/CiTabs";
import { DetailTab } from "./components/DetailTab";
import { AttributeGroups } from "./components/AttributeGroups";
import { RelationshipGraph } from "./components/RelationshipGraph";
import { HistoryTab } from "./components/HistoryTab";
import { useCmdbCiTab } from "./hooks";
import "./cmdb.css";

/**
 * `/cmdb/ci/:id` — Robert's CI detail page (K.3.E v1.2 polish).
 *
 * Card-wrapped sub-sections: header (CI key + status + owner) and the active
 * tab panel each live in their own Card. URL-driven active tab is preserved
 * for deep-links from change impact rows + audit log entries. Skeleton loading
 * keeps layout stable while the detail query resolves.
 */
export default function CmdbCiRoute() {
  const { t } = useTranslation("workspace");
  const params = useParams();
  const id = params["id"] ?? "";
  const { tab, setTab } = useCmdbCiTab();
  const { ref } = usePageTransition(`/cmdb/ci/${id}`);

  const detailQuery = useQuery({
    ...ciDetailQuery(id),
    enabled: id.length > 0,
  });

  if (detailQuery.isPending) {
    return (
      <section
        ref={ref}
        className="sdm-cmdb-detail-page"
        data-testid="cmdb-detail-loading"
        aria-busy="true"
      >
        <Card variant="outlined" className="sdm-cmdb-detail-header-card">
          <div className="sdm-cmdb-detail-skeleton" aria-hidden="true">
            <Skeleton variant="text" width={120} height={14} />
            <Skeleton variant="text" width="50%" height={24} />
            <div className="sdm-cmdb-detail-skeleton-meta">
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
        className="sdm-cmdb-detail-page"
        data-testid="cmdb-detail-error"
        role="alert"
      >
        <p className="sdm-cmdb-state sdm-cmdb-state--error">{t("cmdb.error")}</p>
      </section>
    );
  }

  const detail = detailQuery.data;

  return (
    <section
      ref={ref}
      className="sdm-cmdb-detail-page"
      data-testid="cmdb-detail-page"
      data-ci-id={detail.id}
      data-ci-class={detail.class}
    >
      <Card variant="outlined" className="sdm-cmdb-detail-header-card">
        <CiHeader detail={detail} />
      </Card>
      <CiTabs active={tab} onSelect={setTab} />
      <Card variant="outlined" className="sdm-cmdb-detail-tab-card">
        {tab === "detail" && <DetailTab detail={detail} />}
        {tab === "attributes" && <AttributeGroups detail={detail} />}
        {tab === "relationships" && <RelationshipGraph detail={detail} />}
        {tab === "history" && <HistoryTab detail={detail} />}
      </Card>
    </section>
  );
}
