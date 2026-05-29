import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "@sdm/i18n";
import { ciDetailQuery } from "./api";
import { CiHeader } from "./components/CiHeader";
import { CiTabs } from "./components/CiTabs";
import { DetailTab } from "./components/DetailTab";
import { AttributeGroups } from "./components/AttributeGroups";
import { RelationshipsPlaceholder } from "./components/RelationshipsPlaceholder";
import { HistoryTab } from "./components/HistoryTab";
import { useCmdbCiTab } from "./hooks";
import "./cmdb.css";

/**
 * `/cmdb/ci/:id` — Robert's CI detail page with 4 tabs (Detail / Attributes
 * / Relationships / History). Pattern mirrors `/changes/:id` (H.9):
 *  - URL-driven active tab (`?tab=attributes`) for deep links from change
 *    impact rows + audit log entries.
 *  - Detail, Attributes, History are real (read-only); Relationships is a
 *    placeholder card pending H.14 Cytoscape graph.
 *
 * Cross-tenant CI variant (#18) — Robert lands on `stg-shared-01` owned by
 * HQ — is deferred to a later chunk; H.13 assumes single-tenant CI.
 */
export default function CmdbCiRoute() {
  const { t } = useTranslation("workspace");
  const params = useParams();
  const id = params["id"] ?? "";
  const { tab, setTab } = useCmdbCiTab();

  const detailQuery = useQuery({
    ...ciDetailQuery(id),
    enabled: id.length > 0,
  });

  if (detailQuery.isPending) {
    return (
      <section className="sdm-cmdb-detail-page" data-testid="cmdb-detail-loading">
        <p className="sdm-cmdb-state">{t("cmdb.loading")}</p>
      </section>
    );
  }
  if (detailQuery.isError || !detailQuery.data) {
    return (
      <section className="sdm-cmdb-detail-page" data-testid="cmdb-detail-error" role="alert">
        <p className="sdm-cmdb-state sdm-cmdb-state--error">{t("cmdb.error")}</p>
      </section>
    );
  }

  const detail = detailQuery.data;

  return (
    <section
      className="sdm-cmdb-detail-page"
      data-testid="cmdb-detail-page"
      data-ci-id={detail.id}
      data-ci-class={detail.class}
    >
      <CiHeader detail={detail} />
      <CiTabs active={tab} onSelect={setTab} />
      {tab === "detail" && <DetailTab detail={detail} />}
      {tab === "attributes" && <AttributeGroups detail={detail} />}
      {tab === "relationships" && <RelationshipsPlaceholder />}
      {tab === "history" && <HistoryTab detail={detail} />}
    </section>
  );
}
