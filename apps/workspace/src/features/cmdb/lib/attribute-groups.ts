import type { Ci } from "@sdm/domain";
import type { AttributeGroup, AttributeGroupKey, AttributeRow } from "../types";

/**
 * Per-class attribute grouping. The CMDB CI taxonomy has 23 classes (see
 * `domain/model.ts §CiClass`), but the H.13 plan calls for first-class support
 * of the top 3 (Server, Database, App) and a "generic" fallback for the rest.
 *
 * Mapping from `CiClass` → grouping bucket:
 *  - NetworkServer / OperatingSystem / Router / Processor / Memory / Printer
 *    / RunningHardware / GenericIPDevice / ResourceServer / InterfaceCard /
 *    Port / ESXHypervisor / HyperVHypervisorManager → "server-ish" grouping
 *    (Key + Network + Compliance + Custom).
 *  - DatabaseInstance → "database" grouping (Key + Database + Network +
 *    Compliance + Custom).
 *  - Service / PortfolioApplication / ProvisionedSoftware → "application"
 *    grouping (Key + Compliance + Custom).
 *  - Everything else (Location, File, MediaDrive, EnvironmentalSensor, …)
 *    → "generic" grouping (Key + Custom-all-attrs).
 *
 * Each group carries an ordered list of `AttributeRow` entries; nullish
 * attribute values render as "—" via `formatAttr`. Compliance is synthesized
 * from CiBase fields (`assetNumber`, `serialNumber`, `vendor`, `model`)
 * because the CA SDM `nr_com` table doesn't surface CMMI/SOC2 markers in MVP.
 */

const NETWORK_CLASSES = new Set<string>([
  "NetworkServer",
  "OperatingSystem",
  "Router",
  "Processor",
  "Memory",
  "Printer",
  "RunningHardware",
  "GenericIPDevice",
  "ResourceServer",
  "InterfaceCard",
  "Port",
  "ESXHypervisor",
  "HyperVHypervisorManager",
]);

const APP_CLASSES = new Set<string>(["Service", "PortfolioApplication", "ProvisionedSoftware"]);

function formatAttr(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value.length > 0 ? value : "—";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

function keyGroup(ci: Ci): AttributeGroup {
  return {
    key: "key",
    rows: [
      { label: "hostname", value: formatAttr(ci.systemName) },
      { label: "ipAddress", value: formatAttr(ci.ipAddress) },
      { label: "dnsName", value: formatAttr(ci.dnsName) },
      { label: "macAddress", value: formatAttr(ci.macAddress) },
      { label: "vendor", value: formatAttr(ci.vendor) },
      { label: "model", value: formatAttr(ci.model) },
      { label: "serialNumber", value: formatAttr(ci.serialNumber) },
      { label: "assetNumber", value: formatAttr(ci.assetNumber) },
    ],
  };
}

function complianceGroup(ci: Ci): AttributeGroup {
  return {
    key: "compliance",
    rows: [
      { label: "status", value: ci.status },
      { label: "assetNumber", value: formatAttr(ci.assetNumber) },
      { label: "createdAt", value: formatAttr(ci.createdAt) },
      { label: "lastModifiedAt", value: formatAttr(ci.lastModifiedAt) },
    ],
  };
}

function networkGroup(ci: Ci): AttributeGroup {
  const rows: AttributeRow[] = [
    { label: "ipAddress", value: formatAttr(ci.ipAddress) },
    { label: "dnsName", value: formatAttr(ci.dnsName) },
    { label: "macAddress", value: formatAttr(ci.macAddress) },
  ];
  if (ci.class === "NetworkServer") {
    rows.push(
      { label: "productName", value: formatAttr(ci.props.productName) },
      { label: "protocol", value: formatAttr(ci.props.protocol) },
      { label: "accessedViaTcpPort", value: formatAttr(ci.props.accessedViaTcpPort) },
      { label: "processId", value: formatAttr(ci.props.processId) },
    );
  } else if (ci.class === "Router") {
    rows.push(
      { label: "firmwareVersion", value: formatAttr(ci.props.firmwareVersion) },
      { label: "routingProtocolTypes", value: formatAttr(ci.props.routingProtocolTypes) },
      { label: "routingRedundancyType", value: formatAttr(ci.props.routingRedundancyType) },
    );
  } else if (ci.class === "OperatingSystem") {
    rows.push(
      { label: "osType", value: formatAttr(ci.props.osType) },
      { label: "version", value: formatAttr(ci.props.version) },
      { label: "buildNumber", value: formatAttr(ci.props.buildNumber) },
    );
  }
  return { key: "network", rows };
}

function databaseGroup(ci: Ci): AttributeGroup {
  if (ci.class !== "DatabaseInstance") {
    return { key: "database", rows: [] };
  }
  return {
    key: "database",
    rows: [
      { label: "dbInstanceName", value: formatAttr(ci.props.dbInstanceName) },
      { label: "productName", value: formatAttr(ci.props.productName) },
      { label: "dbServerType", value: formatAttr(ci.props.dbServerType) },
      { label: "processDistinguishingId", value: formatAttr(ci.props.processDistinguishingId) },
    ],
  };
}

function customGroup(ci: Ci): AttributeGroup {
  // The discriminated union's `props` is class-specific; for any class we
  // expose every value as a custom row so the user still sees the full
  // payload regardless of whether the class is first-class above.
  const props = (ci as { props?: Record<string, unknown> }).props ?? {};
  const rows: AttributeRow[] = Object.entries(props)
    .filter(([, v]) => v !== undefined)
    .map(([label, value]) => ({ label, value: formatAttr(value) }));
  return { key: "custom", rows };
}

function genericGroup(ci: Ci): AttributeGroup {
  // For classes without a first-class grouping above, dump every CiBase field
  // and every prop into one "All attributes" bucket. Mirrors the per-spec
  // open-question "rest fallback to generic 'All attributes' view".
  const baseRows: AttributeRow[] = [
    { label: "name", value: formatAttr(ci.name) },
    { label: "family", value: formatAttr(ci.family) },
    { label: "vendor", value: formatAttr(ci.vendor) },
    { label: "model", value: formatAttr(ci.model) },
    { label: "systemName", value: formatAttr(ci.systemName) },
    { label: "ipAddress", value: formatAttr(ci.ipAddress) },
    { label: "dnsName", value: formatAttr(ci.dnsName) },
    { label: "macAddress", value: formatAttr(ci.macAddress) },
    { label: "serialNumber", value: formatAttr(ci.serialNumber) },
    { label: "assetNumber", value: formatAttr(ci.assetNumber) },
    { label: "description", value: formatAttr(ci.description) },
    { label: "status", value: ci.status },
  ];
  const props = (ci as { props?: Record<string, unknown> }).props ?? {};
  const propRows: AttributeRow[] = Object.entries(props)
    .filter(([, v]) => v !== undefined)
    .map(([label, value]) => ({ label, value: formatAttr(value) }));
  return { key: "generic", rows: [...baseRows, ...propRows] };
}

/**
 * Build the ordered list of groups for a given CI. Empty groups (e.g.
 * "database" on a server) are pruned so the UI doesn't render a header with
 * zero rows.
 */
export function buildAttributeGroups(ci: Ci): ReadonlyArray<AttributeGroup> {
  const klass = ci.class as string;

  if (klass === "DatabaseInstance") {
    return [
      keyGroup(ci),
      databaseGroup(ci),
      networkGroup(ci),
      complianceGroup(ci),
      customGroup(ci),
    ].filter((g) => g.rows.length > 0);
  }
  if (NETWORK_CLASSES.has(klass)) {
    return [keyGroup(ci), networkGroup(ci), complianceGroup(ci), customGroup(ci)].filter(
      (g) => g.rows.length > 0,
    );
  }
  if (APP_CLASSES.has(klass)) {
    return [keyGroup(ci), complianceGroup(ci), customGroup(ci)].filter((g) => g.rows.length > 0);
  }
  return [genericGroup(ci)];
}

/**
 * Default collapse state per group. Robert's wireframe calls out Custom +
 * Compliance collapsed by default to keep the initial view scannable.
 */
export const DEFAULT_COLLAPSED: Readonly<Record<AttributeGroupKey, boolean>> = {
  key: false,
  database: false,
  network: false,
  compliance: true,
  custom: true,
  generic: false,
};
