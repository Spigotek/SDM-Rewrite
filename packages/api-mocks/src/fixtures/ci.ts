import { faker } from "@faker-js/faker";
import {
  ciId,
  relationshipId,
  type Ci,
  type CIRelationship,
  type CiStatus,
  type RelationshipType,
  type TenantId,
} from "@sdm/domain";
import { TENANT_ACME, TENANT_GLOBEX } from "./tenants";

const STATUSES: readonly CiStatus[] = ["ACTIVE", "INACTIVE", "RETIRED", "INVENTORY"];
const REL_TYPES: readonly RelationshipType[] = [
  "DEPENDS_ON",
  "SUPPORTS",
  "RUNS_ON",
  "INSTALLED_ON",
  "CONNECTED_TO",
  "PARENT_OF",
  "USES_SERVICE",
  "PROVIDES_SERVICE",
];

faker.seed(424);

const COUNT = 50;

export const cisFixture: readonly Ci[] = Array.from({ length: COUNT }, (_, i) => {
  const tenant: TenantId = i % 3 === 0 ? TENANT_GLOBEX : TENANT_ACME;
  const status = STATUSES[i % STATUSES.length] as CiStatus;
  const createdAt = faker.date.past({ years: 2 }).toISOString();

  const base = {
    id: ciId(`ci:${60000 + i}`),
    name: `${faker.company.buzzAdjective()}-${faker.string.alphanumeric({ length: 6 })}`,
    family: null,
    systemName: faker.internet.domainName(),
    assetNumber: `AST-${String(i + 1).padStart(5, "0")}`,
    serialNumber: faker.string.alphanumeric({ length: 12, casing: "upper" }),
    status,
    vendor: faker.company.name(),
    model: faker.commerce.productName(),
    dnsName: null,
    macAddress: null,
    ipAddress: faker.internet.ip(),
    locationId: null,
    organizationId: null,
    primaryContactId: null,
    description: faker.lorem.sentence(),
    createdAt,
    lastModifiedAt: createdAt,
    tenantId: tenant,
  };

  // Distribute across CI classes — keep simple, use generic props for non-modeled
  switch (i % 6) {
    case 0:
      return {
        ...base,
        class: "DatabaseInstance" as const,
        props: {
          dbInstanceName: `db-${i}`,
          productName: "PostgreSQL",
          dbServerType: "RELATIONAL",
          processDistinguishingId: String(i),
        },
      };
    case 1:
      return {
        ...base,
        class: "NetworkServer" as const,
        props: {
          productName: "nginx",
          protocol: "HTTPS",
          processId: String(1000 + i),
          accessedViaTcpPort: "443",
        },
      };
    case 2:
      return {
        ...base,
        class: "Service" as const,
        props: {
          serviceVersion: "1.0.0",
          businessRisk: "LOW",
          businessImpact: "MEDIUM",
          impactDescription: null,
          availabilityStart: null,
          availabilityEnd: null,
          serviceManager: null,
          serviceLifecycleState: "PRODUCTION",
          serviceCapabilities: null,
        },
      };
    case 3:
      return {
        ...base,
        class: "OperatingSystem" as const,
        props: {
          version: "22.04",
          majorVersion: "22",
          minorVersion: "04",
          buildNumber: null,
          osType: "Linux",
        },
      };
    case 4:
      return {
        ...base,
        class: "Router" as const,
        props: {
          firmwareVersion: "1.2.3",
          routingProtocolTypes: "OSPF",
          routingRedundancyType: "HSRP",
        },
      };
    default:
      return {
        ...base,
        class: "Printer" as const,
        props: {} as Readonly<Record<string, string | number | boolean | null>>,
      };
  }
});

export const ciRelationshipsFixture: readonly CIRelationship[] = Array.from(
  { length: 60 },
  (_, i) => {
    const sourceIdx = i % cisFixture.length;
    const targetIdx = (i + 7) % cisFixture.length;
    const source = cisFixture[sourceIdx];
    const target = cisFixture[targetIdx];
    if (!source || !target) throw new Error("ci fixture index out of bounds");
    return {
      id: relationshipId(`rel:${70000 + i}`),
      sourceCiId: source.id,
      targetCiId: target.id,
      type: REL_TYPES[i % REL_TYPES.length] as RelationshipType,
    };
  },
);

/**
 * I.5 — Shared CI fixture map. Picks the first two acme CIs and tags them as
 * "shared with globex" so SP-cockpit and shared-CI marker tests have a stable
 * pair to assert on. The map is consulted by the cmdb handler to overlay
 * `sharedWithTenantIds` onto the response shape when the caller is sp_admin
 * (header-detected — see handlers/cmdb.ts).
 *
 * Cross-tenant relationship fixture: one extra `CIRelationship` whose source
 * is an acme CI and target is a globex CI. The cmdb handler emits this only
 * when `?tenants=all` is set, so single-tenant clients never see foreign
 * neighbours (existing tenant-isolation contract holds).
 */
const sharedAcmeCis = cisFixture.filter((c) => c.tenantId === TENANT_ACME).slice(0, 2);
export const sharedCiIdsFixture: Readonly<Record<string, readonly TenantId[]>> = Object.freeze(
  Object.fromEntries(sharedAcmeCis.map((c) => [c.id, [TENANT_GLOBEX] as readonly TenantId[]])),
);

const firstAcme = cisFixture.find((c) => c.tenantId === TENANT_ACME);
const firstGlobex = cisFixture.find((c) => c.tenantId === TENANT_GLOBEX);
export const crossTenantRelationshipsFixture: readonly CIRelationship[] =
  firstAcme && firstGlobex
    ? [
        {
          id: relationshipId("rel:cross-tenant-1"),
          sourceCiId: firstAcme.id,
          targetCiId: firstGlobex.id,
          type: "DEPENDS_ON",
        },
      ]
    : [];
