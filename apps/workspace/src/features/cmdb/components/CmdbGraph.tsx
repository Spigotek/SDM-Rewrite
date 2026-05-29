import { useEffect, useMemo, useRef } from "react";
import cytoscape, { type Core, type ElementDefinition } from "cytoscape";
import coseBilkent from "cytoscape-cose-bilkent";
import CytoscapeComponent from "react-cytoscapejs";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "@sdm/i18n";
import { STYLESHEET, layoutOptions, type LayoutKind } from "../lib/cytoscape-config";

/**
 * `CmdbGraph` is the lazy chunk entry — every import in this module pulls into
 * `vendor-graph` via the manualChunks pattern in `vite.config.ts`. The parent
 * (`RelationshipGraph.tsx`) loads us with `React.lazy(() => import("./CmdbGraph"))`
 * so the workspace initial JS pays zero cost for Cytoscape until an agent
 * actually clicks the Relationships tab.
 *
 * Why a default export: `React.lazy` requires the module to default-export a
 * component — named exports would force a wrapper module.
 *
 * Layout switching strategy: changing `layoutOptions` doesn't re-trigger
 * `react-cytoscapejs` to run the layout (it only does so on the initial
 * `elements` set per its own design). We therefore grab the `cy` instance via
 * the `cy` ref callback and run `cy.layout(...).run()` ourselves whenever the
 * user picks a different layout. This is the documented escape hatch from the
 * library README and avoids re-mounting the canvas.
 */

// Plugin registration is idempotent — Cytoscape ignores duplicate `use()`
// calls for the same extension. We register at module import time so by the
// time `<CytoscapeComponent />` renders, `name: "cose-bilkent"` is resolvable
// in its layout registry. The hierarchical "tree" and "breadth" layouts use
// Cytoscape's built-in `breadthfirst` + `concentric` algorithms, which need
// no extra plugin — the `cytoscape-dagre` alternative pulls in lodash via
// dagre@0.8 and pushed the `vendor-graph` chunk above its size-limit cap.
cytoscape.use(coseBilkent);

export interface CmdbGraphProps {
  readonly elements: ReadonlyArray<ElementDefinition>;
  readonly layout: LayoutKind;
  readonly centerCiId: string;
  readonly onSelectNode?: (ciId: string) => void;
}

export default function CmdbGraph({ elements, layout, centerCiId, onSelectNode }: CmdbGraphProps) {
  const { t } = useTranslation("workspace");
  const navigate = useNavigate();
  const cyRef = useRef<Core | null>(null);

  // Cytoscape mutates the element objects (positions, selected state, etc.)
  // so we must hand it a mutable copy. React's strict-mode double render also
  // requires a fresh array each time, otherwise the second render passes
  // already-mounted elements to a fresh `cy` and triggers an internal
  // duplicate-id error.
  const initialElements = useMemo(
    () => elements.map((el) => ({ ...el, data: { ...el.data } })) as ElementDefinition[],
    [elements],
  );

  // Re-run the layout when the layout knob changes — without this the user
  // would have to click each layout twice (once to toggle, once to re-render).
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.layout(layoutOptions(layout)).run();
  }, [layout]);

  // Wire the node click handler once per mount of the `cy` instance. Using
  // `.on()` with a selector confines the handler to nodes (the canvas itself
  // would otherwise swallow clicks and emit an extra event). The drill-in
  // navigates to the clicked CI's detail page; the center node is a no-op
  // (clicking yourself shouldn't push history).
  const handleCy = (cy: Core) => {
    cyRef.current = cy;
    cy.removeListener("tap");
    cy.on("tap", "node", (e) => {
      const id = String(e.target.data("id"));
      if (id === centerCiId) return;
      onSelectNode?.(id);
      navigate(`/cmdb/ci/${encodeURIComponent(id)}`);
    });
  };

  return (
    <div
      className="sdm-cmdb-graph-canvas"
      data-testid="cmdb-graph-canvas"
      role="img"
      aria-label={t("cmdb.relationships.graphAriaLabel")}
    >
      <CytoscapeComponent
        elements={initialElements}
        stylesheet={STYLESHEET}
        layout={layoutOptions(layout)}
        style={{ width: "100%", height: "100%" }}
        wheelSensitivity={0.2}
        minZoom={0.25}
        maxZoom={2.5}
        cy={handleCy}
      />
    </div>
  );
}
