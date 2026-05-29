import { useTranslation } from "@sdm/i18n";

/**
 * Relationships tab placeholder. H.14 replaces this with the lazy-loaded
 * Cytoscape graph (`CMDBGraph` per `design-system/components.md`); for H.13
 * we ship a static card so the tab is reachable and the URL contract
 * (`?tab=relationships`) is already wired.
 */
export function RelationshipsPlaceholder() {
  const { t } = useTranslation("workspace");
  return (
    <section
      role="tabpanel"
      id="cmdb-tabpanel-relationships"
      aria-labelledby="cmdb-tab-relationships"
      data-testid="cmdb-tabpanel-relationships"
      className="sdm-cmdb-tabpanel"
    >
      <div className="sdm-cmdb-graph-placeholder" data-testid="cmdb-graph-placeholder">
        <h2>{t("cmdb.relationships.title")}</h2>
        <p>{t("cmdb.relationships.placeholder")}</p>
      </div>
    </section>
  );
}
