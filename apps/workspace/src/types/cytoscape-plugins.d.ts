/**
 * Ambient module declarations for the Cytoscape plugin stack used by the
 * CMDB relationship graph (`features/cmdb/components/CmdbGraph.tsx`).
 *
 * Upstream packages ship JS only — no TypeScript definitions — so we declare
 * the minimal shape we consume:
 *  - `cytoscape-cose-bilkent` / `cytoscape-dagre` export a default `register`
 *    function compatible with `cytoscape.use()`.
 *  - `react-cytoscapejs` exports a default React component that mirrors the
 *    Cytoscape constructor options + a `cy` ref callback.
 *
 * Keeping these declarations local to `apps/workspace` avoids polluting the
 * shared `@types/*` namespace — only the workspace renderer imports them.
 */

declare module "cytoscape-cose-bilkent" {
  import type cytoscape from "cytoscape";
  const ext: cytoscape.Ext;
  export default ext;
}

declare module "react-cytoscapejs" {
  import type { ComponentType, CSSProperties } from "react";
  import type { Core, ElementDefinition, LayoutOptions, StylesheetStyle } from "cytoscape";

  export interface CytoscapeComponentProps {
    readonly id?: string;
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly elements: ReadonlyArray<ElementDefinition>;
    readonly stylesheet?: ReadonlyArray<StylesheetStyle>;
    readonly layout?: LayoutOptions;
    readonly zoom?: number;
    readonly minZoom?: number;
    readonly maxZoom?: number;
    readonly pan?: { x: number; y: number };
    readonly userZoomingEnabled?: boolean;
    readonly userPanningEnabled?: boolean;
    readonly boxSelectionEnabled?: boolean;
    readonly autoungrabify?: boolean;
    readonly autounselectify?: boolean;
    readonly wheelSensitivity?: number;
    readonly cy?: (cy: Core) => void;
  }

  const CytoscapeComponent: ComponentType<CytoscapeComponentProps>;
  export default CytoscapeComponent;
}
