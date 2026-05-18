import type { Hono } from "hono";
import type { RestProxyDeps } from "../rest-proxy";
import { registerEntityRoutes } from "./_entity-routes";
import { epochSecToIso, liftAttrs, toFkRef, type CaSdmFk } from "./_shape";

/**
 * /api/changes — proxies to CA SDM factory `chg`.
 *
 * Schema divergence vs `in`/`cr`/`pr` (§15, §21 item 3):
 *  - PK column is `chg_ref_num` (not `ref_num`).
 *  - Customer attribute is `requestor` (not `customer`).
 *  - Status reference is `chgstat` with English labels (not `crs` with Slovak).
 *
 * The FE-facing shape keeps `ref` + `customer` for uniformity with the other
 * ticket entities — the remap below absorbs the divergence.
 */

const DEFAULT_ATTRS =
  "chg_ref_num,summary,description,status,priority,requestor,assignee,open_date,close_date,category";

export interface ChangeRowFe {
  readonly id: string;
  readonly ref: string;
  readonly summary: string;
  readonly description: string;
  readonly status: ReturnType<typeof toFkRef>;
  readonly priority: ReturnType<typeof toFkRef>;
  readonly customer: ReturnType<typeof toFkRef>;
  readonly assignee: ReturnType<typeof toFkRef>;
  readonly openedAt: string | null;
  readonly closedAt: string | null;
}

export interface ChangeCreateFe {
  readonly summary: string;
  readonly description?: string;
  readonly customerId: string;
  readonly priorityCode?: string;
  readonly assigneeId?: string;
}

export interface ChangeUpdateFe {
  readonly summary?: string;
  readonly description?: string;
  readonly statusCode?: string;
  readonly priorityCode?: string;
  readonly assigneeId?: string;
}

function mapRow(raw: Record<string, unknown>): ChangeRowFe {
  const top = liftAttrs(raw);
  return {
    id: top.id,
    ref: String(raw["chg_ref_num"] ?? top.displayName ?? ""),
    summary: typeof raw["summary"] === "string" ? raw["summary"] : "",
    description: typeof raw["description"] === "string" ? raw["description"] : "",
    status: toFkRef(raw["status"] as CaSdmFk | undefined),
    priority: toFkRef(raw["priority"] as CaSdmFk | undefined),
    customer: toFkRef(raw["requestor"] as CaSdmFk | undefined),
    assignee: toFkRef(raw["assignee"] as CaSdmFk | undefined),
    openedAt: epochSecToIso(raw["open_date"] as string | number | null | undefined),
    closedAt: epochSecToIso(raw["close_date"] as string | number | null | undefined),
  };
}

function mapCreate(body: ChangeCreateFe): Record<string, unknown> {
  return {
    summary: body.summary,
    ...(body.description !== undefined ? { description: body.description } : {}),
    requestor: { relAttr: body.customerId },
    ...(body.priorityCode !== undefined ? { priority: { relAttr: body.priorityCode } } : {}),
    ...(body.assigneeId !== undefined ? { assignee: { relAttr: body.assigneeId } } : {}),
  };
}

function mapUpdate(body: ChangeUpdateFe): Record<string, unknown> {
  return {
    ...(body.summary !== undefined ? { summary: body.summary } : {}),
    ...(body.description !== undefined ? { description: body.description } : {}),
    ...(body.statusCode !== undefined ? { status: { relAttr: body.statusCode } } : {}),
    ...(body.priorityCode !== undefined ? { priority: { relAttr: body.priorityCode } } : {}),
    ...(body.assigneeId !== undefined ? { assignee: { relAttr: body.assigneeId } } : {}),
  };
}

export function registerChangeRoutes(app: Hono, deps: RestProxyDeps): void {
  registerEntityRoutes<ChangeRowFe, ChangeCreateFe, ChangeUpdateFe>(app, deps, {
    factory: "chg",
    route: "/api/changes",
    defaultAttrs: DEFAULT_ATTRS,
    pkIsGuid: false,
    softClose: { kind: "status-CL" },
    mapRow,
    mapCreate,
    mapUpdate,
  });
}
