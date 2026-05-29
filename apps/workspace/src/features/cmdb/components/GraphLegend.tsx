import { useTranslation } from "@sdm/i18n";

/**
 * Legend for the CMDB relationship graph — three edge families (per
 * `components.md §CMDBGraph defaults`):
 *
 *   depends_on → thin solid arrow
 *   hosts      → thick solid arrow
 *   peers_with → dashed arrow
 *
 * The legend symbols use inline SVG so they render identically whether the
 * Cytoscape canvas is mounted or the list fallback is active. Each row pairs
 * a visible symbol with a textual label; the row's `aria-label` repeats the
 * mapping so screen readers don't have to interpret the symbol.
 */
export function GraphLegend() {
  const { t } = useTranslation("workspace");
  return (
    <ul
      className="sdm-cmdb-graph-legend"
      data-testid="cmdb-graph-legend"
      aria-label={t("cmdb.relationships.legendAriaLabel")}
    >
      <li className="sdm-cmdb-graph-legend-row" data-family="depends_on">
        <svg
          aria-hidden="true"
          width="40"
          height="10"
          viewBox="0 0 40 10"
          className="sdm-cmdb-graph-legend-symbol"
        >
          <line x1="2" y1="5" x2="34" y2="5" strokeWidth="1.5" />
          <polygon points="34,1 40,5 34,9" />
        </svg>
        <span>{t("cmdb.relationships.legend.depends_on")}</span>
      </li>
      <li className="sdm-cmdb-graph-legend-row" data-family="hosts">
        <svg
          aria-hidden="true"
          width="40"
          height="10"
          viewBox="0 0 40 10"
          className="sdm-cmdb-graph-legend-symbol"
        >
          <line x1="2" y1="5" x2="34" y2="5" strokeWidth="3" />
          <polygon points="34,1 40,5 34,9" />
        </svg>
        <span>{t("cmdb.relationships.legend.hosts")}</span>
      </li>
      <li className="sdm-cmdb-graph-legend-row" data-family="peers_with">
        <svg
          aria-hidden="true"
          width="40"
          height="10"
          viewBox="0 0 40 10"
          className="sdm-cmdb-graph-legend-symbol"
        >
          <line x1="2" y1="5" x2="34" y2="5" strokeWidth="1.5" strokeDasharray="4 3" />
          <polygon points="34,1 40,5 34,9" />
        </svg>
        <span>{t("cmdb.relationships.legend.peers_with")}</span>
      </li>
    </ul>
  );
}
