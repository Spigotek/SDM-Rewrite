import { faker } from "@faker-js/faker";
import {
  changeId,
  userId,
  type ApprovalState,
  type Change,
  type ChangeCategory,
  type ChangeStatus,
  type RiskLevel,
  type TenantId,
} from "@sdm/domain";
import { TENANT_ACME, TENANT_GLOBEX } from "./tenants";

const STATUSES: readonly ChangeStatus[] = [
  "RFC",
  "APPR_PENDING",
  "APPROVED",
  "SCHEDULED",
  "IN_PROGRESS",
  "VERIFIED",
  "CL",
];

const CATEGORIES: readonly ChangeCategory[] = ["STANDARD", "NORMAL", "EMERGENCY"];
const RISKS: readonly RiskLevel[] = ["LOW", "MEDIUM", "HIGH"];

faker.seed(422);

const COUNT = 15;

function approvalStateOf(status: ChangeStatus): ApprovalState {
  if (status === "APPR_PENDING" || status === "RFC") return "PENDING";
  if (status === "APPROVED" || status === "SCHEDULED" || status === "IN_PROGRESS")
    return "APPROVED";
  if (status === "VERIFIED" || status === "CL") return "APPROVED";
  return "PENDING";
}

export const changesFixture: readonly Change[] = Array.from({ length: COUNT }, (_, i) => {
  const tenant: TenantId = i % 3 === 0 ? TENANT_GLOBEX : TENANT_ACME;
  const status = STATUSES[i % STATUSES.length] as ChangeStatus;
  const opened = faker.date.recent({ days: 30 }).toISOString();
  const schedStart = faker.date.soon({ days: 30, refDate: opened }).toISOString();
  const schedEnd = faker.date.soon({ days: 1, refDate: schedStart }).toISOString();
  const closedAt = status === "CL" ? faker.date.recent({ days: 5 }).toISOString() : null;
  return {
    id: changeId(`change:${40000 + i}`),
    ref: `CHG-${String(i + 1).padStart(5, "0")}`,
    summary: `${faker.company.buzzVerb()} ${faker.company.buzzNoun()}`,
    description: faker.lorem.paragraph(),
    status,
    category: CATEGORIES[i % CATEGORIES.length] as ChangeCategory,
    risk: RISKS[i % RISKS.length] as RiskLevel,
    requesterId: userId(`user-${(i % 6) + 1}`),
    assigneeId: userId(`user-${((i + 2) % 6) + 1}`),
    assignedGroupId: null,
    affectedCiIds: [],
    linkedProblemIds: [],
    linkedIncidentIds: [],
    scheduledStartAt: schedStart,
    scheduledEndAt: schedEnd,
    actualStartAt:
      status === "IN_PROGRESS" || status === "VERIFIED" || status === "CL" ? schedStart : null,
    actualEndAt: status === "VERIFIED" || status === "CL" ? schedEnd : null,
    approvalState: approvalStateOf(status),
    cabApprovers: [],
    changeSpecifications: [],
    openedAt: opened,
    closedAt,
    createdAt: opened,
    lastModifiedAt: closedAt ?? opened,
    tenantId: tenant,
  };
});
