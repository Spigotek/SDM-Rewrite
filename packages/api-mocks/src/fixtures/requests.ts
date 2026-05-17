import { faker } from "@faker-js/faker";
import {
  catalogItemId,
  requestId,
  userId,
  type Priority,
  type Request as ServiceRequest,
  type RequestStatus,
  type Severity,
  type TenantId,
  type Urgency,
} from "@sdm/domain";
import { TENANT_ACME, TENANT_GLOBEX } from "./tenants";

const STATUSES: readonly RequestStatus[] = [
  "SUBMITTED",
  "APPR_PENDING",
  "APPROVED",
  "IN_PROGRESS",
  "AWU",
  "DELIVERED",
  "CL",
];
const CATEGORIES = ["access-request", "hardware-request", "software-request", "facilities"];

faker.seed(420);

const COUNT = 25;

export const requestsFixture: readonly ServiceRequest[] = Array.from({ length: COUNT }, (_, i) => {
  const tenant: TenantId = i % 3 === 0 ? TENANT_GLOBEX : TENANT_ACME;
  const status = STATUSES[i % STATUSES.length] as RequestStatus;
  const opened = faker.date.recent({ days: 30 }).toISOString();
  const isClosed = status === "CL" || status === "DELIVERED";
  const closedAt = isClosed
    ? faker.date.between({ from: opened, to: new Date() }).toISOString()
    : null;
  return {
    id: requestId(`request:${20000 + i}`),
    ref: `REQ-${String(i + 1).padStart(5, "0")}`,
    summary: `Request: ${faker.commerce.productName()}`,
    description: faker.lorem.sentences(2),
    priority: ((i % 5) + 1) as Priority,
    urgency: (((i + 1) % 5) + 1) as Urgency,
    severity: (((i + 2) % 5) + 1) as Severity,
    status,
    category: CATEGORIES[i % CATEGORIES.length] as string,
    requesterId: userId(`user-${(i % 6) + 1}`),
    assigneeId: userId(`user-${((i + 1) % 6) + 1}`),
    assignedGroupId: null,
    serviceCatalogItemId: catalogItemId(`catalog:offering-${(i % 5) + 1}`),
    formData: {
      reason: faker.lorem.sentence(),
      quantity: (i % 3) + 1,
    },
    isReturnedToService: false,
    linkedChangeIds: [],
    openedAt: opened,
    targetStartAt: null,
    resolvedAt: closedAt,
    closedAt,
    createdAt: opened,
    lastModifiedAt: closedAt ?? opened,
    tenantId: tenant,
  };
});
