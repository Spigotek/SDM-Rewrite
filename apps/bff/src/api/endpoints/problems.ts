import type { Hono } from "hono";
import type { RestProxyDeps } from "../rest-proxy";
import { registerEntityRoutes } from "./_entity-routes";
import { epochSecToIso, liftAttrs, toFkRef, type CaSdmFk } from "./_shape";

/**
 * /api/problems — proxies to CA SDM factory `pr`.
 *
 * §14: `pr` shares the call-request status reference (`crs`) and the
 * `customer` attribute name with `in`/`cr`. The `assignee` and `customer`
 * FKs both project through their own factory path (`/agt/` vs `/cnt/`)
 * but resolve to the same underlying contact.
 */

const DEFAULT_ATTRS =
  "ref_num,summary,description,status,priority,impact,urgency,customer,assignee,open_date,close_date,active";

export interface ProblemRowFe {
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
  readonly openedAt: string | null;
  readonly closedAt: string | null;
}

export interface ProblemCreateFe {
  readonly summary: string;
  readonly description?: string;
  readonly customerId: string;
  readonly priorityCode?: string;
  readonly assigneeId?: string;
}

export interface ProblemUpdateFe {
  readonly summary?: string;
  readonly description?: string;
  readonly statusCode?: string;
  readonly priorityCode?: string;
  readonly assigneeId?: string;
}

export function mapProblemRow(raw: Record<string, unknown>): ProblemRowFe {
  return mapRow(raw);
}

function mapRow(raw: Record<string, unknown>): ProblemRowFe {
  const top = liftAttrs(raw);
  return {
    id: top.id,
    ref: String(raw["ref_num"] ?? top.displayName ?? ""),
    summary: typeof raw["summary"] === "string" ? raw["summary"] : "",
    description: typeof raw["description"] === "string" ? raw["description"] : "",
    status: toFkRef(raw["status"] as CaSdmFk | undefined),
    priority: toFkRef(raw["priority"] as CaSdmFk | undefined),
    impact: toFkRef(raw["impact"] as CaSdmFk | undefined),
    urgency: toFkRef(raw["urgency"] as CaSdmFk | undefined),
    customer: toFkRef(raw["customer"] as CaSdmFk | undefined),
    assignee: toFkRef(raw["assignee"] as CaSdmFk | undefined),
    openedAt: epochSecToIso(raw["open_date"] as string | number | null | undefined),
    closedAt: epochSecToIso(raw["close_date"] as string | number | null | undefined),
  };
}

function mapCreate(body: ProblemCreateFe): Record<string, unknown> {
  return {
    summary: body.summary,
    ...(body.description !== undefined ? { description: body.description } : {}),
    customer: { relAttr: body.customerId },
    ...(body.priorityCode !== undefined ? { priority: { relAttr: body.priorityCode } } : {}),
    ...(body.assigneeId !== undefined ? { assignee: { relAttr: body.assigneeId } } : {}),
  };
}

function mapUpdate(body: ProblemUpdateFe): Record<string, unknown> {
  return {
    ...(body.summary !== undefined ? { summary: body.summary } : {}),
    ...(body.description !== undefined ? { description: body.description } : {}),
    ...(body.statusCode !== undefined ? { status: { relAttr: body.statusCode } } : {}),
    ...(body.priorityCode !== undefined ? { priority: { relAttr: body.priorityCode } } : {}),
    ...(body.assigneeId !== undefined ? { assignee: { relAttr: body.assigneeId } } : {}),
  };
}

export function registerProblemRoutes(app: Hono, deps: RestProxyDeps): void {
  registerEntityRoutes<ProblemRowFe, ProblemCreateFe, ProblemUpdateFe>(app, deps, {
    factory: "pr",
    route: "/api/problems",
    defaultAttrs: DEFAULT_ATTRS,
    pkIsGuid: false,
    softClose: { kind: "status-CL" },
    mapRow,
    mapCreate,
    mapUpdate,
  });
}
