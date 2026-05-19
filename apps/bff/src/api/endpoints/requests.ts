import type { Hono } from "hono";
import type { RestProxyDeps } from "../rest-proxy";
import { registerEntityRoutes } from "./_entity-routes";
import { epochSecToIso, liftAttrs, toFkRef, type CaSdmFk } from "./_shape";

/**
 * /api/requests — proxies to CA SDM factory `cr` (call-request, type=R).
 *
 * §13: `/cr` indexes call-requests of all types; we always send `type=R` on
 * POST so created records are Requests, not Incidents (which use `/api/incidents`).
 */

const DEFAULT_ATTRS =
  "ref_num,summary,description,status,priority,impact,urgency,customer,assignee,type,open_date,close_date,active,category";

export interface RequestRowFe {
  readonly id: string;
  readonly ref: string;
  readonly summary: string;
  readonly description: string;
  readonly type: ReturnType<typeof toFkRef>;
  readonly status: ReturnType<typeof toFkRef>;
  readonly priority: ReturnType<typeof toFkRef>;
  readonly customer: ReturnType<typeof toFkRef>;
  readonly assignee: ReturnType<typeof toFkRef>;
  readonly openedAt: string | null;
  readonly closedAt: string | null;
}

export interface RequestCreateFe {
  readonly summary: string;
  readonly description?: string;
  readonly customerId: string;
  readonly priorityCode?: string;
  readonly assigneeId?: string;
}

export interface RequestUpdateFe {
  readonly summary?: string;
  readonly description?: string;
  readonly statusCode?: string;
  readonly priorityCode?: string;
  readonly assigneeId?: string;
}

export function mapRequestRow(raw: Record<string, unknown>): RequestRowFe {
  return mapRow(raw);
}

function mapRow(raw: Record<string, unknown>): RequestRowFe {
  const top = liftAttrs(raw);
  return {
    id: top.id,
    ref:
      typeof raw["ref_num"] === "string"
        ? raw["ref_num"]
        : String(raw["ref_num"] ?? top.displayName),
    summary: typeof raw["summary"] === "string" ? raw["summary"] : "",
    description: typeof raw["description"] === "string" ? raw["description"] : "",
    type: toFkRef(raw["type"] as CaSdmFk | undefined),
    status: toFkRef(raw["status"] as CaSdmFk | undefined),
    priority: toFkRef(raw["priority"] as CaSdmFk | undefined),
    customer: toFkRef(raw["customer"] as CaSdmFk | undefined),
    assignee: toFkRef(raw["assignee"] as CaSdmFk | undefined),
    openedAt: epochSecToIso(raw["open_date"] as string | number | null | undefined),
    closedAt: epochSecToIso(raw["close_date"] as string | number | null | undefined),
  };
}

function mapCreate(body: RequestCreateFe): Record<string, unknown> {
  return {
    summary: body.summary,
    ...(body.description !== undefined ? { description: body.description } : {}),
    customer: { relAttr: body.customerId },
    type: { relAttr: "R" },
    ...(body.priorityCode !== undefined ? { priority: { relAttr: body.priorityCode } } : {}),
    ...(body.assigneeId !== undefined ? { assignee: { relAttr: body.assigneeId } } : {}),
  };
}

function mapUpdate(body: RequestUpdateFe): Record<string, unknown> {
  return {
    ...(body.summary !== undefined ? { summary: body.summary } : {}),
    ...(body.description !== undefined ? { description: body.description } : {}),
    ...(body.statusCode !== undefined ? { status: { relAttr: body.statusCode } } : {}),
    ...(body.priorityCode !== undefined ? { priority: { relAttr: body.priorityCode } } : {}),
    ...(body.assigneeId !== undefined ? { assignee: { relAttr: body.assigneeId } } : {}),
  };
}

export function registerRequestRoutes(app: Hono, deps: RestProxyDeps): void {
  registerEntityRoutes<RequestRowFe, RequestCreateFe, RequestUpdateFe>(app, deps, {
    factory: "cr",
    route: "/api/requests",
    defaultAttrs: DEFAULT_ATTRS,
    pkIsGuid: false,
    softClose: { kind: "status-CL" },
    mapRow,
    mapCreate,
    mapUpdate,
  });
}
