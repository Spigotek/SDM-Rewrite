import { useNavigate } from "react-router-dom";
import { useTranslation } from "@sdm/i18n";
import type { Ci, CIRelationship } from "@sdm/domain";
import { EDGE_STYLE_FAMILY } from "../lib/cytoscape-config";

/**
 * Screen-reader / keyboard-friendly alternative to the Cytoscape canvas. The
 * canvas is natively SR-unfriendly (it renders to a single `<canvas>` element
 * with no DOM children), so per `components.md §RelationshipGraph A11y` we
 * MUST ship a list view the user can toggle to.
 *
 * Structure: WAI-ARIA `treeview` with the center CI as the root and each
 * neighbour as a child `treeitem`. We don't model multi-hop relationships in
 * this view — that would duplicate the graph's logic and is orthogonal to the
 * a11y goal (which is "let me read the same data linearly").
 *
 * Each neighbour row is also an in-app link to the neighbour's detail page,
 * mirroring the canvas drill-in behaviour. Keyboard users land on the link
 * via `Tab`; activation via Enter routes them.
 */
export interface GraphListFallbackProps {
  readonly centerCiId: string;
  readonly centerLabel: string;
  readonly centerClass: string;
  readonly relationships: ReadonlyArray<CIRelationship>;
  readonly neighbours: ReadonlyArray<Ci>;
}

export function GraphListFallback({
  centerCiId,
  centerLabel,
  centerClass,
  relationships,
  neighbours,
}: GraphListFallbackProps) {
  const { t } = useTranslation("workspace");
  const navigate = useNavigate();

  const neighbourMap = new Map(neighbours.map((c) => [c.id, c]));

  if (relationships.length === 0) {
    return (
      <p className="sdm-cmdb-graph-list-empty" data-testid="cmdb-graph-list-empty" role="status">
        {t("cmdb.relationships.empty")}
      </p>
    );
  }

  return (
    <ul
      role="tree"
      aria-label={t("cmdb.relationships.listAriaLabel")}
      className="sdm-cmdb-graph-list"
      data-testid="cmdb-graph-list"
    >
      <li
        role="treeitem"
        aria-level={1}
        aria-expanded="true"
        aria-selected="true"
        data-center="true"
      >
        <span className="sdm-cmdb-graph-list-center">
          <strong>{centerLabel}</strong>
          <span className="sdm-cmdb-graph-list-class">({centerClass})</span>
        </span>
        <ul role="group">
          {relationships.map((rel) => {
            const otherId = rel.sourceCiId === centerCiId ? rel.targetCiId : rel.sourceCiId;
            const direction = rel.sourceCiId === centerCiId ? "outbound" : "inbound";
            const neighbour = neighbourMap.get(otherId);
            const label = neighbour?.name ?? otherId;
            const ciClass = neighbour?.class ?? "Unknown";
            const family = EDGE_STYLE_FAMILY[rel.type];
            return (
              <li
                key={rel.id}
                role="treeitem"
                aria-level={2}
                aria-selected="false"
                data-testid="cmdb-graph-list-row"
                data-rel-type={rel.type}
                data-family={family}
                data-direction={direction}
                className="sdm-cmdb-graph-list-row"
              >
                <a
                  href={`/cmdb/ci/${encodeURIComponent(otherId)}`}
                  onClick={(e) => {
                    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
                      return;
                    }
                    e.preventDefault();
                    navigate(`/cmdb/ci/${encodeURIComponent(otherId)}`);
                  }}
                  className="sdm-cmdb-graph-list-link"
                >
                  <span className="sdm-cmdb-graph-list-rel">
                    {t(`cmdb.relationships.type.${rel.type}` as never)}
                  </span>
                  <span className="sdm-cmdb-graph-list-arrow" aria-hidden="true">
                    {direction === "outbound" ? "→" : "←"}
                  </span>
                  <span className="sdm-cmdb-graph-list-name">{label}</span>
                  <span className="sdm-cmdb-graph-list-class">({ciClass})</span>
                </a>
              </li>
            );
          })}
        </ul>
      </li>
    </ul>
  );
}
