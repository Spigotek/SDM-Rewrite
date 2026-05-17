import type { RequestHandler } from "msw";
import { auditHandlers } from "./audit";
import { authHandlers } from "./auth";
import { changeHandlers } from "./changes";
import { cmdbHandlers } from "./cmdb";
import { configHandlers } from "./config";
import { incidentHandlers } from "./incidents";
import { knowledgeHandlers } from "./knowledge";
import { problemHandlers } from "./problems";
import { requestHandlers } from "./requests";
import { tenantHandlers } from "./tenants";
import { userHandlers } from "./users";

export const handlers: readonly RequestHandler[] = [
  ...authHandlers,
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
];

export {
  auditHandlers,
  authHandlers,
  changeHandlers,
  cmdbHandlers,
  configHandlers,
  incidentHandlers,
  knowledgeHandlers,
  problemHandlers,
  requestHandlers,
  tenantHandlers,
  userHandlers,
};
