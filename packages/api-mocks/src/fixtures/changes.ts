import { faker } from "@faker-js/faker";
import {
  cabApprovalId,
  changeId,
  ciId,
  userId,
  type ApprovalDecision,
  type ApprovalState,
  type CabApproval,
  type Change,
  type ChangeCategory,
  type ChangeStatus,
  type CiId,
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

/**
 * 4 CAB approvers per change — Peter (chair), Jana (security), Lukáš (ops),
 * Tomáš (business). Decisions follow `approvalState`:
 *  - PENDING ⇒ first two APPROVED, last two PENDING (wireframe scenario).
 *  - APPROVED ⇒ all four APPROVED.
 *  - REJECTED ⇒ Peter approved, Jana rejected (only need one NOK).
 */
function buildApprovers(state: ApprovalState, changeRef: string): readonly CabApproval[] {
  const approvers = [
    { roleSuffix: "chair", userIdSuffix: 1 },
    { roleSuffix: "security", userIdSuffix: 2 },
    { roleSuffix: "ops", userIdSuffix: 3 },
    { roleSuffix: "business", userIdSuffix: 4 },
  ] as const;
  const ts = faker.date.recent({ days: 7 }).toISOString();

  function decisionFor(idx: number): ApprovalDecision {
    if (state === "APPROVED") return "APPROVED";
    if (state === "REJECTED") return idx === 0 ? "APPROVED" : idx === 1 ? "REJECTED" : "PENDING";
    // PENDING: first two approved, last two pending.
    return idx < 2 ? "APPROVED" : "PENDING";
  }

  return approvers.map((a, idx) => {
    const decision = decisionFor(idx);
    return {
      id: cabApprovalId(`cab:${changeRef}:${a.roleSuffix}`),
      approverId: userId(`user-${a.userIdSuffix}`),
      decision,
      decidedAt: decision === "PENDING" ? null : ts,
      comment: null,
    };
  });
}

function buildAffectedCis(i: number): readonly CiId[] {
  // Affected CI count tracks risk — 3/6/12 for low/med/high. Seeded
  // deterministically off the loop index so a given fixture row always
  // yields the same CI set; `cisFixture` ids are `ci:60000..60049`.
  const risk = RISKS[i % RISKS.length] ?? "LOW";
  const count = risk === "HIGH" ? 6 : risk === "MEDIUM" ? 3 : 1;
  const base = 60000 + ((i * 7) % 40);
  return Array.from({ length: count }, (_, k) => ciId(`ci:${base + k}`));
}

function buildRollbackPlan(i: number, ref: string): string | null {
  // Every 4th change has no rollback (tests the empty-state branch in H.9
  // RollbackTab and the H.11 "Approve disabled when rollback missing" gate).
  if (i % 4 === 3) return null;
  return [
    `# Rollback plan — ${ref}`,
    "",
    "## Pre-requisites",
    "- Verify backup completed within last 24 h.",
    "- Confirm change window has not yet started.",
    "",
    "## Steps",
    "1. Stop application services on affected nodes.",
    "2. Restore previous version from `/opt/releases/previous`.",
    "3. Restart services and verify health checks.",
    "4. Notify on-call channel `#sdm-cab`.",
    "",
    "## Verification",
    "- HTTP `200` from `/healthz` on all affected nodes.",
    "- Synthetic monitor `customer-portal` green for 10 min.",
  ].join("\n");
}

export const changesFixture: readonly Change[] = Array.from({ length: COUNT }, (_, i) => {
  const tenant: TenantId = i % 3 === 0 ? TENANT_GLOBEX : TENANT_ACME;
  const status = STATUSES[i % STATUSES.length] as ChangeStatus;
  const opened = faker.date.recent({ days: 30 }).toISOString();
  const schedStart = faker.date.soon({ days: 30, refDate: opened }).toISOString();
  const schedEnd = faker.date.soon({ days: 1, refDate: schedStart }).toISOString();
  const closedAt = status === "CL" ? faker.date.recent({ days: 5 }).toISOString() : null;
  const approvalState = approvalStateOf(status);
  const ref = `CHG-${String(i + 1).padStart(5, "0")}`;
  return {
    id: changeId(`change:${40000 + i}`),
    ref,
    summary: `${faker.company.buzzVerb()} ${faker.company.buzzNoun()}`,
    description: faker.lorem.paragraph(),
    status,
    category: CATEGORIES[i % CATEGORIES.length] as ChangeCategory,
    risk: RISKS[i % RISKS.length] as RiskLevel,
    requesterId: userId(`user-${(i % 6) + 1}`),
    assigneeId: userId(`user-${((i + 2) % 6) + 1}`),
    assignedGroupId: null,
    affectedCiIds: buildAffectedCis(i),
    linkedProblemIds: [],
    linkedIncidentIds: [],
    scheduledStartAt: schedStart,
    scheduledEndAt: schedEnd,
    actualStartAt:
      status === "IN_PROGRESS" || status === "VERIFIED" || status === "CL" ? schedStart : null,
    actualEndAt: status === "VERIFIED" || status === "CL" ? schedEnd : null,
    rollbackPlan: buildRollbackPlan(i, ref),
    approvalState,
    cabApprovers: buildApprovers(approvalState, ref),
    changeSpecifications: [],
    openedAt: opened,
    closedAt,
    createdAt: opened,
    lastModifiedAt: closedAt ?? opened,
    tenantId: tenant,
  };
});
