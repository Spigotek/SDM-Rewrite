import { faker } from "@faker-js/faker";
import {
  incidentId,
  problemId,
  userId,
  type Impact,
  type Priority,
  type Problem,
  type ProblemStatus,
  type TenantId,
  type Urgency,
} from "@sdm/domain";
import { TENANT_ACME, TENANT_GLOBEX } from "./tenants";

const STATUSES: readonly ProblemStatus[] = [
  "IDENTIFIED",
  "INVESTIGATION",
  "ROOT_CAUSE_KNOWN",
  "KNOWN_ERROR",
  "RESOLVED",
  "CL",
];

faker.seed(421);

const COUNT = 10;

export const problemsFixture: readonly Problem[] = Array.from({ length: COUNT }, (_, i) => {
  const tenant: TenantId = i % 3 === 0 ? TENANT_GLOBEX : TENANT_ACME;
  const status = STATUSES[i % STATUSES.length] as ProblemStatus;
  const opened = faker.date.recent({ days: 60 }).toISOString();
  const resolvedAt =
    status === "RESOLVED" || status === "CL"
      ? faker.date.between({ from: opened, to: new Date() }).toISOString()
      : null;
  const linkedIncidents = Array.from({ length: 2 }, (__, k) =>
    incidentId(`incident:${10000 + ((i * 2 + k) % 40)}`),
  );
  return {
    id: problemId(`problem:${30000 + i}`),
    ref: `PR-${String(i + 1).padStart(5, "0")}`,
    summary: `Problem: ${faker.hacker.noun()} ${faker.hacker.verb()}`,
    description: faker.lorem.paragraph(),
    priority: ((i % 5) + 1) as Priority,
    urgency: (((i + 2) % 5) + 1) as Urgency,
    impact: (((i + 1) % 5) + 1) as Impact,
    status,
    category: null,
    rootCause:
      status === "ROOT_CAUSE_KNOWN" || status === "KNOWN_ERROR" ? faker.lorem.sentence() : null,
    isMajor: i % 4 === 0,
    linkedIncidentIds: linkedIncidents,
    linkedChangeIds: [],
    linkedKbArticleIds: [],
    assigneeId: userId(`user-${(i % 6) + 1}`),
    assignedGroupId: null,
    openedAt: opened,
    targetStartAt: null,
    resolvedAt,
    closedAt: status === "CL" ? resolvedAt : null,
    createdAt: opened,
    lastModifiedAt: resolvedAt ?? opened,
    tenantId: tenant,
  };
});
