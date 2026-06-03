import { tenantId, type Tenant } from "@sdm/domain";

export const TENANT_ACME = tenantId("acme-corp");
export const TENANT_GLOBEX = tenantId("globex");
/**
 * I.3 — Suspended tenant fixture. Used by `/me/tenants` filter tests and the
 * browser-test `tenant-suspension.spec.ts` to exercise the suspension path
 * without touching the existing happy-path fixtures (ACME / GLOBEX stay
 * active). The id is intentionally distinct so per-tenant test stores never
 * collide with active-tenant assertions.
 */
export const TENANT_INITECH = tenantId("initech");

export const tenantsFixture: readonly Tenant[] = [
  {
    id: TENANT_ACME,
    name: "Acme Corporation",
    code: "ACME",
    superTenantId: null,
    isActive: true,
  },
  {
    id: TENANT_GLOBEX,
    name: "Globex Industries",
    code: "GLBX",
    superTenantId: null,
    isActive: true,
  },
  {
    id: TENANT_INITECH,
    name: "Initech Holdings",
    code: "INI",
    superTenantId: null,
    isActive: false,
  },
];

/**
 * I.3 — Lifecycle status surfaced to BFF + FE. `isActive` on the domain
 * `Tenant` entity is read-only metadata; runtime suspension is a separate
 * field so the test surface can flip a tenant from "active" → "suspended"
 * without rewriting the entity factory.
 */
export type TenantStatusValue = "active" | "suspended";

export const tenantStatusFixture: Readonly<Record<string, TenantStatusValue>> = {
  [TENANT_ACME]: "active",
  [TENANT_GLOBEX]: "active",
  [TENANT_INITECH]: "suspended",
};
