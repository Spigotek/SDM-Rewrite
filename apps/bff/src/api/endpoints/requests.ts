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

export type CatalogFieldValue = string | number | boolean | ReadonlyArray<string> | null;

export interface RequestCreateFe {
  readonly summary: string;
  readonly description?: string;
  /**
   * Concrete CA SDM contact GUID (`U'…'`). Operator/agent callers pass this;
   * the portal does NOT — it sends `requesterId: "me"` (or `customer: "me"`)
   * and the BFF resolves the session contact server-side.
   */
  readonly customerId?: string;
  /** Portal "me" signals — either resolves to `session.contactId`. */
  readonly customer?: string;
  readonly requesterId?: string;
  readonly priorityCode?: string;
  readonly assigneeId?: string;
  /** Service Catalog item id (e.g. `catalog:vpn`) — folded into description. */
  readonly serviceCatalogItemId?: string;
  /** Dynamic-form key/value answers — folded into description. */
  readonly formData?: Readonly<Record<string, CatalogFieldValue>>;
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
  const meSignal = body.customer === "me" || body.requesterId === "me";
  const concreteCustomer =
    typeof body.customerId === "string" && body.customerId.length > 0 && !meSignal;
  const description = foldRequestDescription(body);
  return {
    summary: body.summary,
    ...(description !== undefined ? { description } : {}),
    // Concrete GUID only — the "me" / omitted case is filled by the BFF's
    // create-time customer resolver from `session.contactId`.
    ...(concreteCustomer ? { customer: { relAttr: body.customerId } } : {}),
    type: { relAttr: "R" },
    ...(body.priorityCode !== undefined ? { priority: { relAttr: body.priorityCode } } : {}),
    ...(body.assigneeId !== undefined ? { assignee: { relAttr: body.assigneeId } } : {}),
  };
}

const FIELD_LABELS: Readonly<Record<string, string>> = {
  device: "Zariadenie",
  until: "Platnosť do",
  reason: "Dôvod",
  duration: "Trvanie",
  audience: "Pre koho",
  colleague: "Kolega",
  costCenter: "Nákladové stredisko",
};

/**
 * Fold the catalog context (item id + dynamic-form answers) into a
 * human-readable Slovak description so the requester's form selections survive
 * to CA SDM — `cr` has no generic key/value store for catalog form data, so we
 * serialise it into the free-text description rather than dropping it (§M.3).
 */
function foldRequestDescription(body: RequestCreateFe): string | undefined {
  const lines: string[] = [];
  if (typeof body.serviceCatalogItemId === "string" && body.serviceCatalogItemId.length > 0) {
    lines.push(`Katalógová položka: ${body.serviceCatalogItemId}`);
  }
  if (body.formData) {
    for (const [key, value] of Object.entries(body.formData)) {
      if (value === null || value === undefined || value === "") continue;
      const label = FIELD_LABELS[key] ?? key;
      const rendered = Array.isArray(value) ? value.join(", ") : String(value);
      lines.push(`${label}: ${rendered}`);
    }
  }
  const base = body.description?.trim();
  if (lines.length === 0) return base !== undefined && base.length > 0 ? base : undefined;
  const header = lines.join("\n");
  return base !== undefined && base.length > 0 ? `${header}\n\n${base}` : header;
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
    customerMeAttr: "customer",
    mapRow,
    mapCreate,
    mapUpdate,
  });
}
