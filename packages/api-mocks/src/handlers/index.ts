import type { RequestHandler } from "msw";
import { attachmentHandlers } from "./attachments";
import { adminTenantHandlers } from "./admin-tenants";
import { auditHandlers } from "./audit";
import { authHandlers } from "./auth";
import { changeHandlers } from "./changes";
import { cmdbHandlers } from "./cmdb";
import { configHandlers } from "./config";
import { sseHandlers } from "./events";
import { incidentHandlers } from "./incidents";
import { knowledgeHandlers } from "./knowledge";
import { problemHandlers } from "./problems";
import { queueHandlers } from "./queue";
import { requestHandlers } from "./requests";
import { spHandlers } from "./sp";
import { tenantHandlers } from "./tenants";
import { ticketDetailHandlers } from "./ticket-detail";
import { userHandlers } from "./users";

export const handlers: readonly RequestHandler[] = [
  // J.3 — SSE + admin endpoints registered first (specific paths take priority).
  ...sseHandlers,
  ...adminTenantHandlers,
  // J.5 — KB attachment upload/serve
  ...attachmentHandlers,
  ...authHandlers,
  ...spHandlers,
  ...userHandlers,
  ...tenantHandlers,
  ...incidentHandlers,
  ...requestHandlers,
  ...problemHandlers,
  ...changeHandlers,
  ...knowledgeHandlers,
  ...cmdbHandlers,
  ...auditHandlers,
  ...configHandlers,
  ...queueHandlers,
  ...ticketDetailHandlers,
];

export {
  attachmentHandlers,
  adminTenantHandlers,
  auditHandlers,
  authHandlers,
  changeHandlers,
  cmdbHandlers,
  configHandlers,
  incidentHandlers,
  knowledgeHandlers,
  problemHandlers,
  queueHandlers,
  requestHandlers,
  spHandlers,
  sseHandlers,
  tenantHandlers,
  ticketDetailHandlers,
  userHandlers,
};
