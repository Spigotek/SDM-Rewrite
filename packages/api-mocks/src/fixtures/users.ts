import { roleId, userId, type RoleAssignment, type TenantId, type User } from "@sdm/domain";
import { TENANT_ACME, TENANT_GLOBEX } from "./tenants";

interface UserSeed {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string;
  defaultTenant: TenantId;
  roles: { tenant: TenantId; role: string }[];
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
      { tenant: TENANT_ACME, role: "LEVEL_1_ANALYST" },
      { tenant: TENANT_GLOBEX, role: "LEVEL_1_ANALYST" },
    ],
  },
  {
    id: "user-2",
    username: "marek.manager",
    firstName: "Marek",
    lastName: "Manager",
    email: "marek.manager@acme-corp.example",
    jobTitle: "Incident Manager",
    defaultTenant: TENANT_ACME,
    roles: [
      { tenant: TENANT_ACME, role: "INCIDENT_MANAGER" },
      { tenant: TENANT_ACME, role: "PROBLEM_MANAGER" },
    ],
  },
  {
    id: "user-3",
    username: "cyril.change",
    firstName: "Cyril",
    lastName: "Change",
    email: "cyril.change@acme-corp.example",
    jobTitle: "Change Manager",
    defaultTenant: TENANT_ACME,
    roles: [{ tenant: TENANT_ACME, role: "CHANGE_MANAGER" }],
  },
  {
    id: "user-4",
    username: "gabriela.globex",
    firstName: "Gabriela",
    lastName: "Globex",
    email: "gabriela@globex.example",
    jobTitle: "Service Desk Manager",
    defaultTenant: TENANT_GLOBEX,
    roles: [{ tenant: TENANT_GLOBEX, role: "SERVICE_DESK_MANAGER" }],
  },
  {
    id: "user-5",
    username: "lucia.l2",
    firstName: "Lucia",
    lastName: "L2",
    email: "lucia.l2@globex.example",
    jobTitle: "L2 Analyst",
    defaultTenant: TENANT_GLOBEX,
    roles: [{ tenant: TENANT_GLOBEX, role: "LEVEL_2_ANALYST" }],
  },
  {
    id: "user-6",
    username: "peter.problem",
    firstName: "Peter",
    lastName: "Problem",
    email: "peter.problem@globex.example",
    jobTitle: "Problem Manager",
    defaultTenant: TENANT_GLOBEX,
    roles: [{ tenant: TENANT_GLOBEX, role: "PROBLEM_MANAGER" }],
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
