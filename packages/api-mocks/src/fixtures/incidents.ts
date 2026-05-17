import { faker } from "@faker-js/faker";
import {
  contactId,
  incidentId,
  type Impact,
  type Incident,
  type IncidentStatus,
  type Priority,
  type TenantId,
  type Urgency,
  userId,
} from "@sdm/domain";
import { TENANT_ACME, TENANT_GLOBEX } from "./tenants";

const STATUSES: readonly IncidentStatus[] = ["OP", "WIP", "HLD", "AWU", "RES", "CL"];
const PRIORITIES: readonly Priority[] = [1, 2, 3, 4, 5];
const URGENCIES: readonly Urgency[] = [1, 2, 3, 4, 5];
const IMPACTS: readonly Impact[] = [1, 2, 3, 4, 5];
const CATEGORIES = ["network", "hardware", "software", "access", "service-request"];
const ASSIGNEES = ["user-1", "user-2", "user-5"] as const;
const CUSTOMERS = ["contact-1", "contact-2", "contact-3", "contact-4"] as const;

faker.seed(42);

const COUNT = 40;

export const incidentsFixture: readonly Incident[] = Array.from({ length: COUNT }, (_, i) => {
  const tenant: TenantId = i % 3 === 0 ? TENANT_GLOBEX : TENANT_ACME;
  const status = STATUSES[i % STATUSES.length] as IncidentStatus;
  const opened = faker.date.recent({ days: 30 }).toISOString();
  const isClosed = status === "CL" || status === "RES";
  const resolvedAt = isClosed
    ? faker.date.between({ from: opened, to: new Date() }).toISOString()
    : null;
  const closedAt = status === "CL" ? resolvedAt : null;
  return {
    id: incidentId(`incident:${10000 + i}`),
    ref: `IN-${String(i + 1).padStart(5, "0")}`,
    summary: faker.hacker.phrase(),
    description: faker.lorem.paragraph(),
    priority: PRIORITIES[i % PRIORITIES.length] as Priority,
    urgency: URGENCIES[(i + 1) % URGENCIES.length] as Urgency,
    impact: IMPACTS[(i + 2) % IMPACTS.length] as Impact,
    status,
    category: CATEGORIES[i % CATEGORIES.length] as string,
    isMajor: i % 11 === 0,
    affectedEndUserId: contactId(CUSTOMERS[i % CUSTOMERS.length] as string),
    requesterId: userId(ASSIGNEES[i % ASSIGNEES.length] as string),
    affectedCiId: null,
    callBackAt: null,
    outageStartAt: null,
    outageEndAt: null,
    outageType: null,
    isReturnedToService: false,
    symptomCode: null,
    rootCause: null,
    solutionUrls: [],
    linkedProblemIds: [],
    linkedChangeIds: [],
    assigneeId: userId(ASSIGNEES[i % ASSIGNEES.length] as string),
    assignedGroupId: null,
    openedAt: opened,
    targetStartAt: null,
    resolvedAt,
    closedAt,
    createdAt: opened,
    lastModifiedAt: resolvedAt ?? opened,
    tenantId: tenant,
  };
});
