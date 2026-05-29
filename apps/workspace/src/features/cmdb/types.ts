import type { Ci, CIRelationship } from "@sdm/domain";

/**
 * UI-side aliases for the workspace CMDB feature. The list and detail share the
 * full `Ci` discriminated union from the domain package; the workspace consumes
 * `/api/ci` (MSW) / future BFF projection of CA SDM `nr` factory.
 *
 * The detail page renders 4 tabs against the same `Ci` payload:
 *  - DetailTab        → CiBase header attrs (status, owner, location, vendor…).
 *  - AttributesTab    → per-class CIAttributeGroup repeater (Key / DB / Network
 *                       / Compliance / Custom). H.13 covers Server (NetworkServer),
 *                       Database (DatabaseInstance), App (PortfolioApplication /
 *                       Service) + a generic "All attributes" fallback.
 *  - RelationshipsTab → lazy Cytoscape graph (`vendor-graph` chunk) with a
 *                       list-view a11y fallback per components.md (H.14).
 *  - HistoryTab       → read-only change log from `/api/ci/:id/history`
 *                       (synthetic MSW stream per spec/cmdb.md §audit-trail).
 */
export type CiRow = Ci;
export type CiDetail = Ci;

export type CmdbCiTabKey = "detail" | "attributes" | "relationships" | "history";

export const CMDB_CI_TABS: ReadonlyArray<CmdbCiTabKey> = [
  "detail",
  "attributes",
  "relationships",
  "history",
];

/**
 * One row in the CI change log. The MSW handler emits a deterministic stream
 * derived from `Ci.createdAt` + `lastModifiedAt` + neighbour-relationship
 * counts; the BFF will eventually project CA SDM `nr_com` (asset_log BREL).
 */
export interface CiHistoryEntry {
  readonly id: string;
  readonly timestamp: string;
  readonly action: CiHistoryAction;
  readonly actor: string;
  readonly detail: string;
}

export type CiHistoryAction =
  | "created"
  | "attribute_changed"
  | "relationship_added"
  | "relationship_removed"
  | "status_changed"
  | "discovered";

/**
 * Collapsible attribute group descriptor. Each group has a stable `key` that
 * combines with the CI's class to form the localStorage persistence key
 * `cmdbCiCollapse:{ciClass}.{group}`.
 */
export type AttributeGroupKey =
  | "key"
  | "database"
  | "network"
  | "compliance"
  | "custom"
  | "generic";

export interface AttributeRow {
  readonly label: string;
  readonly value: string;
}

export interface AttributeGroup {
  readonly key: AttributeGroupKey;
  readonly rows: ReadonlyArray<AttributeRow>;
}

/**
 * Relationship-graph payload — edges (CIRelationship) plus the neighbour CIs
 * referenced by those edges. The graph renderer needs both because Cytoscape
 * draws nodes from `neighbours[]` (label, class) and edges from
 * `relationships[]`. MSW emits the shape; the BFF will do the same projection.
 */
export interface CiRelationshipsPayload {
  readonly relationships: ReadonlyArray<CIRelationship>;
  readonly neighbours: ReadonlyArray<Ci>;
}
