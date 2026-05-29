import type { ElementDefinition, LayoutOptions, StylesheetStyle } from "cytoscape";
import type { CiClass, CIRelationship, RelationshipType } from "@sdm/domain";

/**
 * Cytoscape configuration for the workspace CMDB relationship graph.
 *
 * Per `design-system/components.md §CMDBGraph defaults`:
 *  - Layout default `cose-bilkent` (force-directed). Tree (dagre) + impact
 *    cascade (breadthfirst) are user-selectable.
 *  - Edge styles per `relationType` family:
 *      depends_on family  → solid (DEPENDS_ON, USES_SERVICE, RUNS_ON)
 *      hosts family       → thick (PROVIDES_SERVICE, SUPPORTS, INSTALLED_ON,
 *                                   PARENT_OF)
 *      peers_with family  → dashed (CONNECTED_TO)
 *  - `maxNodes` default 200 (performance gate — Cytoscape canvas mode stays
 *    fluid up to ~500 nodes; we keep headroom for browsers without GPU
 *    compositor acceleration).
 *
 * The mapping from the domain's eight `RelationshipType` values to the three
 * visual families lives in `EDGE_STYLE_FAMILY` so the renderer can show the
 * legend symbols + the graph itself from a single source of truth.
 */

export const MAX_NODES_DEFAULT = 200;

export type LayoutKind = "force" | "tree" | "breadth";

export type EdgeStyleFamily = "depends_on" | "hosts" | "peers_with";

export const EDGE_STYLE_FAMILY: Record<RelationshipType, EdgeStyleFamily> = {
  DEPENDS_ON: "depends_on",
  USES_SERVICE: "depends_on",
  RUNS_ON: "depends_on",
  PROVIDES_SERVICE: "hosts",
  SUPPORTS: "hosts",
  INSTALLED_ON: "hosts",
  PARENT_OF: "hosts",
  CONNECTED_TO: "peers_with",
};

export interface GraphNodeData {
  readonly id: string;
  readonly label: string;
  readonly ciClass: CiClass | string;
  readonly isCenter: boolean;
}

export interface GraphEdgeData {
  readonly id: string;
  readonly source: string;
  readonly target: string;
  readonly relType: RelationshipType;
  readonly family: EdgeStyleFamily;
}

export interface BuildElementsInput {
  readonly centerId: string;
  readonly centerLabel: string;
  readonly centerClass: CiClass | string;
  readonly relationships: ReadonlyArray<CIRelationship>;
  readonly neighbourLabels: ReadonlyMap<string, { name: string; ciClass: CiClass | string }>;
}

/**
 * Translate the BFF/MSW response into Cytoscape's `ElementDefinition[]`. We
 * deduplicate edges by `(source, target, type)` triplet — the underlying MSW
 * fixture can emit the same pair twice when a CI appears as both source and
 * target — and we deduplicate nodes by id so each neighbour renders once even
 * if it sits on multiple relationships.
 */
export function buildElements(input: BuildElementsInput): ReadonlyArray<ElementDefinition> {
  const seenNodes = new Set<string>();
  const seenEdges = new Set<string>();
  const elements: ElementDefinition[] = [];

  const pushNode = (id: string, label: string, ciClass: string, isCenter: boolean) => {
    if (seenNodes.has(id)) return;
    seenNodes.add(id);
    const nodeEl: ElementDefinition = {
      data: {
        id,
        label,
        ciClass,
        isCenter,
      } satisfies GraphNodeData,
    };
    if (isCenter) {
      // `classes` is consumed by the stylesheet selector below; the center
      // node gets the highlight ring per `components.md §RelationshipGraph
      // A11y` so the user knows where they are. Non-center nodes leave
      // `classes` unset (TS' `exactOptionalPropertyTypes` rejects `undefined`).
      nodeEl.classes = "center";
    }
    elements.push(nodeEl);
  };

  pushNode(input.centerId, input.centerLabel, input.centerClass, true);

  for (const rel of input.relationships) {
    const otherId = rel.sourceCiId === input.centerId ? rel.targetCiId : rel.sourceCiId;
    const neighbour = input.neighbourLabels.get(otherId);
    pushNode(otherId, neighbour?.name ?? otherId, neighbour?.ciClass ?? "Unknown", false);
    const edgeKey = `${rel.sourceCiId}|${rel.targetCiId}|${rel.type}`;
    if (seenEdges.has(edgeKey)) continue;
    seenEdges.add(edgeKey);
    const family = EDGE_STYLE_FAMILY[rel.type];
    elements.push({
      data: {
        id: rel.id,
        source: rel.sourceCiId,
        target: rel.targetCiId,
        relType: rel.type,
        family,
      } satisfies GraphEdgeData,
      classes: `family-${family}`,
    });
  }

  return elements;
}

/**
 * Stylesheet driven by CSS custom properties so the graph picks up the
 * Catppuccin-inspired dark theme without baking colour literals here. The
 * three edge families map straight to the components.md spec:
 *
 *   depends_on → solid 1.5 px
 *   hosts      → solid 3 px (visually heavier — "this thing carries us")
 *   peers_with → dashed 1.5 px (looser coupling — "peers with")
 *
 * Cytoscape resolves `var(--…)` at draw time because canvas mode reads
 * computed styles from a hidden DOM element it injects into the container.
 */
export const STYLESHEET: ReadonlyArray<StylesheetStyle> = [
  {
    selector: "node",
    style: {
      "background-color": "var(--color-surface-raised, #2a2a2a)",
      "border-color": "var(--color-border-default, #555)",
      "border-width": 1,
      label: "data(label)",
      color: "var(--color-text-primary, #eee)",
      "font-size": "11px",
      "text-valign": "bottom",
      "text-margin-y": 6,
      "text-wrap": "ellipsis",
      "text-max-width": "120px",
      width: 26,
      height: 26,
    },
  },
  {
    selector: "node.center",
    style: {
      "background-color": "var(--color-accent, #89b4fa)",
      "border-color": "var(--color-accent, #89b4fa)",
      "border-width": 3,
      color: "var(--color-text-primary, #eee)",
      "font-weight": "bold",
      width: 34,
      height: 34,
    },
  },
  {
    selector: "edge",
    style: {
      width: 1.5,
      "line-color": "var(--color-border-default, #555)",
      "target-arrow-color": "var(--color-border-default, #555)",
      "target-arrow-shape": "triangle",
      "curve-style": "bezier",
      opacity: 0.85,
    },
  },
  {
    selector: "edge.family-depends_on",
    style: {
      "line-style": "solid",
      width: 1.5,
    },
  },
  {
    selector: "edge.family-hosts",
    style: {
      "line-style": "solid",
      width: 3,
    },
  },
  {
    selector: "edge.family-peers_with",
    style: {
      "line-style": "dashed",
      width: 1.5,
    },
  },
];

/**
 * Map our public layout knob (`force` / `tree` / `breadth`) to the actual
 * Cytoscape layout options.
 *
 * "force" uses the `cose-bilkent` plugin (registered in `CmdbGraph.tsx`).
 * "tree" and "breadth" both use Cytoscape's built-in layouts so they cost
 * zero bytes — `breadthfirst` (top-down hierarchy) for tree, `concentric`
 * (radial rings ordered by depth from the center) for impact-cascade. The
 * earlier draft pulled in `cytoscape-dagre` for a true Sugiyama tree but
 * dagre's lodash-based payload (~80 KB gzip) blew the `vendor-graph` cap
 * documented in `qa-test-strategy/performance.md §3` (150 KB heavy chunks).
 * Breadthfirst gives an equivalent top-down view for the shallow neighbour
 * graphs the CMDB tab renders (typical depth = 1-2 hops).
 */
export function layoutOptions(kind: LayoutKind): LayoutOptions {
  switch (kind) {
    case "tree":
      return {
        name: "breadthfirst",
        directed: true,
        // `circle: false` lays nodes out in horizontal layers (tree-like)
        // rather than concentric rings — that's the visual the spec means
        // by "tree / hierarchy".
        circle: false,
        spacingFactor: 1.4,
        padding: 30,
        animate: false,
        fit: true,
      };
    case "breadth":
      return {
        // Concentric rings from the center node outward — best for "what
        // does this CI cascade into?" impact analysis. The radii are
        // weighted by degree (more connected nodes sit closer to center).
        name: "concentric",
        concentric: (node: { degree: () => number }) => node.degree(),
        levelWidth: () => 1,
        minNodeSpacing: 30,
        padding: 30,
        animate: false,
        fit: true,
      } as unknown as LayoutOptions;
    case "force":
    default:
      return {
        name: "cose-bilkent",
        // cose-bilkent gives us a stable layout per run when randomize=false
        // — important so the screenshot tests don't flap on re-render.
        randomize: false,
        animate: false,
        nodeRepulsion: 4500,
        idealEdgeLength: 100,
        edgeElasticity: 0.45,
        gravity: 0.25,
        numIter: 2500,
        fit: true,
        padding: 30,
      } as unknown as LayoutOptions;
  }
}
