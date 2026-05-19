import type { Hono } from "hono";
import type { RestProxyDeps } from "../rest-proxy";
import { registerEntityRoutes } from "./_entity-routes";
import { epochSecToIso, liftAttrs, toFkRef, type CaSdmFk } from "./_shape";

/**
 * /api/incidents — proxies to CA SDM factory `in`.
 *
 * `in` is a logical view over `cr` filtered to type=Incident (§13 — every probe
 * returns `REL_ATTR="cr:<id>"`). Use `/in/*` for Incident operations to avoid
 * accidentally treating a Request (`type=R`) as an Incident.
 */

const DEFAULT_ATTRS =
  "ref_num,summary,description,status,priority,impact,urgency,customer,assignee,open_date,close_date,active,category";

export interface IncidentRowFe {
  readonly id: string;
  readonly ref: string;
  readonly summary: string;
  readonly description: string;
  readonly status: ReturnType<typeof toFkRef>;
  readonly priority: ReturnType<typeof toFkRef>;
  readonly impact: ReturnType<typeof toFkRef>;
  readonly urgency: ReturnType<typeof toFkRef>;
  readonly customer: ReturnType<typeof toFkRef>;
  readonly assignee: ReturnType<typeof toFkRef>;
  readonly category: ReturnType<typeof toFkRef>;
  readonly openedAt: string | null;
  readonly closedAt: string | null;
  readonly isActive: boolean;
}

export interface IncidentCreateFe {
  readonly summary: string;
  readonly description?: string;
  readonly customerId: string; // U'...' contact GUID
  readonly priorityCode?: string;
  readonly statusCode?: string;
  readonly assigneeId?: string;
}

export interface IncidentUpdateFe {
  readonly summary?: string;
  readonly description?: string;
  readonly statusCode?: string;
  readonly priorityCode?: string;
  readonly assigneeId?: string;
}

export function mapIncidentRow(raw: Record<string, unknown>): IncidentRowFe {
  return mapRow(raw);
}

function mapRow(raw: Record<string, unknown>): IncidentRowFe {
  const top = liftAttrs(raw);
  const active = (raw["active"] as CaSdmFk | undefined)?.["@COMMON_NAME"];
  return {
    id: top.id,
    ref:
      typeof raw["ref_num"] === "string"
        ? raw["ref_num"]
        : String(raw["ref_num"] ?? top.displayName),
    summary: typeof raw["summary"] === "string" ? raw["summary"] : "",
    description: typeof raw["description"] === "string" ? raw["description"] : "",
    status: toFkRef(raw["status"] as CaSdmFk | undefined),
    priority: toFkRef(raw["priority"] as CaSdmFk | undefined),
    impact: toFkRef(raw["impact"] as CaSdmFk | undefined),
    urgency: toFkRef(raw["urgency"] as CaSdmFk | undefined),
    customer: toFkRef(raw["customer"] as CaSdmFk | undefined),
    assignee: toFkRef(raw["assignee"] as CaSdmFk | undefined),
    category: toFkRef(raw["category"] as CaSdmFk | undefined),
    openedAt: epochSecToIso(raw["open_date"] as string | number | null | undefined),
    closedAt: epochSecToIso(raw["close_date"] as string | number | null | undefined),
    isActive: active === "YES" || active === 1,
  };
}

function mapCreate(body: IncidentCreateFe): Record<string, unknown> {
  return {
    summary: body.summary,
    ...(body.description !== undefined ? { description: body.description } : {}),
    customer: { relAttr: body.customerId },
    ...(body.priorityCode !== undefined ? { priority: { relAttr: body.priorityCode } } : {}),
    ...(body.statusCode !== undefined ? { status: { relAttr: body.statusCode } } : {}),
    ...(body.assigneeId !== undefined ? { assignee: { relAttr: body.assigneeId } } : {}),
  };
}

function mapUpdate(body: IncidentUpdateFe): Record<string, unknown> {
  return {
    ...(body.summary !== undefined ? { summary: body.summary } : {}),
    ...(body.description !== undefined ? { description: body.description } : {}),
    ...(body.statusCode !== undefined ? { status: { relAttr: body.statusCode } } : {}),
    ...(body.priorityCode !== undefined ? { priority: { relAttr: body.priorityCode } } : {}),
    ...(body.assigneeId !== undefined ? { assignee: { relAttr: body.assigneeId } } : {}),
  };
}

export function registerIncidentRoutes(app: Hono, deps: RestProxyDeps): void {
  registerEntityRoutes<IncidentRowFe, IncidentCreateFe, IncidentUpdateFe>(app, deps, {
    factory: "in",
    route: "/api/incidents",
    defaultAttrs: DEFAULT_ATTRS,
    pkIsGuid: false,
    softClose: { kind: "status-CL" },
    mapRow,
    mapCreate,
    mapUpdate,
  });
}
