import { faker } from "@faker-js/faker";
import type { AuditEvent, AuditEventOutcome } from "../db/types";
import { TENANT_ACME, TENANT_GLOBEX } from "./tenants";

const EVENT_TYPES = [
  "auth.login",
  "auth.logout",
  "auth.session_expired",
  "tenant.switched",
  "incident.created",
  "incident.updated",
  "incident.status_changed",
  "change.approved",
  "change.rejected",
  "kb.published",
  "permission.denied",
  "data.exported",
] as const;

faker.seed(43);

const COUNT = 50;
const OUTCOMES: readonly AuditEventOutcome[] = ["success", "failure"];

export const auditEventsFixture: readonly AuditEvent[] = Array.from({ length: COUNT }, (_, i) => ({
  id: `audit:${80000 + i}`,
  timestamp: faker.date.recent({ days: 7 }).toISOString(),
  eventType: EVENT_TYPES[i % EVENT_TYPES.length] as string,
  userId: `user-${(i % 6) + 1}`,
  tenantId: i % 3 === 0 ? TENANT_GLOBEX : TENANT_ACME,
  correlationId: faker.string.uuid(),
  outcome: OUTCOMES[i % OUTCOMES.length] as AuditEventOutcome,
  details: {
    ipAddress: faker.internet.ip(),
    userAgent: faker.internet.userAgent(),
  },
}));

export const AUDIT_EVENT_TYPES: readonly string[] = EVENT_TYPES;
