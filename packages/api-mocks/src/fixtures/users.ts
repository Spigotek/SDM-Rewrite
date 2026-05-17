import {
  roleId,
  userId,
  type RoleAssignment,
  type TenantId,
  type UIRole,
  type User,
} from "@sdm/domain";
import { TENANT_ACME, TENANT_GLOBEX } from "./tenants";

interface UserSeed {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string;
  defaultTenant: TenantId;
  roles: { tenant: TenantId; role: UIRole }[];
}

const seeds: readonly UserSeed[] = [
  {
    id: "user-1",
    username: "anna.analyst",
    firstName: "Anna",
    lastName: "Analyst",
    email: "anna.analyst@acme-corp.example",
    jobTitle: "L1 Analyst",
    defaultTenant: TENANT_ACME,
    roles: [
      { tenant: TENANT_ACME, role: "agent_l1" },
      { tenant: TENANT_GLOBEX, role: "agent_l1" },
    ],
  },
  {
    id: "user-2",
    username: "marek.manager",
    firstName: "Marek",
    lastName: "Manager",
    email: "marek.manager@acme-corp.example",
    jobTitle: "Incident & Problem Manager",
    defaultTenant: TENANT_ACME,
    // Per rbac.md §2: "Analyst Level 2 + Problem Manager" konsoliduje na agent_l2.
    roles: [{ tenant: TENANT_ACME, role: "agent_l2" }],
  },
  {
    id: "user-3",
    username: "cyril.change",
    firstName: "Cyril",
    lastName: "Change",
    email: "cyril.change@acme-corp.example",
    jobTitle: "Change Manager",
    defaultTenant: TENANT_ACME,
    roles: [{ tenant: TENANT_ACME, role: "change_manager" }],
  },
  {
    id: "user-4",
    username: "gabriela.globex",
    firstName: "Gabriela",
    lastName: "Globex",
    email: "gabriela@globex.example",
    jobTitle: "Service Desk Manager",
    defaultTenant: TENANT_GLOBEX,
    // Service Desk Manager nemá vlastnú UI rolu — mapuje sa na agent_l2 (full ticket ops).
    roles: [{ tenant: TENANT_GLOBEX, role: "agent_l2" }],
  },
  {
    id: "user-5",
    username: "lucia.l2",
    firstName: "Lucia",
    lastName: "L2",
    email: "lucia.l2@globex.example",
    jobTitle: "L2 Analyst",
    defaultTenant: TENANT_GLOBEX,
    roles: [{ tenant: TENANT_GLOBEX, role: "agent_l2" }],
  },
  {
    id: "user-6",
    username: "peter.problem",
    firstName: "Peter",
    lastName: "Problem",
    email: "peter.problem@globex.example",
    jobTitle: "Problem Manager",
    defaultTenant: TENANT_GLOBEX,
    roles: [{ tenant: TENANT_GLOBEX, role: "agent_l2" }],
  },
  {
    id: "user-7",
    username: "jana.kb",
    firstName: "Jana",
    lastName: "Knowledge",
    email: "jana.kb@acme-corp.example",
    jobTitle: "Knowledge Editor",
    defaultTenant: TENANT_ACME,
    roles: [{ tenant: TENANT_ACME, role: "kb_editor" }],
  },
  {
    id: "user-8",
    username: "robert.cmdb",
    firstName: "Robert",
    lastName: "Cmdb",
    email: "robert.cmdb@acme-corp.example",
    jobTitle: "Configuration Manager",
    defaultTenant: TENANT_ACME,
    roles: [{ tenant: TENANT_ACME, role: "cmdb_owner" }],
  },
  {
    id: "user-9",
    username: "lucia.requester",
    firstName: "Lucia",
    lastName: "Requester",
    email: "lucia.requester@acme-corp.example",
    jobTitle: "Employee",
    defaultTenant: TENANT_ACME,
    roles: [{ tenant: TENANT_ACME, role: "requester" }],
  },
  {
    id: "user-10",
    username: "sp.admin",
    firstName: "Service",
    lastName: "Provider",
    email: "sp.admin@service-provider.example",
    jobTitle: "Service Provider Admin",
    defaultTenant: TENANT_ACME,
    roles: [
      { tenant: TENANT_ACME, role: "sp_admin" },
      { tenant: TENANT_GLOBEX, role: "sp_admin" },
    ],
  },
];

function buildAssignments(seed: UserSeed): readonly RoleAssignment[] {
  return seed.roles.map((r) => ({
    userId: userId(seed.id),
    roleId: roleId(`role:${r.role}`),
    tenantId: r.tenant,
    assignedAt: "2026-01-01T00:00:00Z",
  }));
}

export const usersFixture: readonly User[] = seeds.map((s) => ({
  id: userId(s.id),
  username: s.username,
  firstName: s.firstName,
  lastName: s.lastName,
  fullName: `${s.firstName} ${s.lastName}`,
  email: s.email,
  phone: null,
  jobTitle: s.jobTitle,
  isActive: true,
  defaultTenantId: s.defaultTenant,
  roleAssignments: buildAssignments(s),
}));

export const DEFAULT_USER_ID = userId("user-1");
