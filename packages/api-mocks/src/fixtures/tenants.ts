import { tenantId, type Tenant } from "@sdm/domain";

export const TENANT_ACME = tenantId("acme-corp");
export const TENANT_GLOBEX = tenantId("globex");

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
];
